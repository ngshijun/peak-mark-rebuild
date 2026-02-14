import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { handleError } from '@/lib/errors'

// Cache TTL for engagement data (re-fetch when navigating back after this period)
const ENGAGEMENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface StudentEngagementData {
  coins: number
  xp: number
  level: number
  xpProgress: number
  currentStreak: number
  food: number
  selectedPetId: string | null
  ownedPets: StudentOwnedPet[]
  moodHistory: MoodEntry[]
  subscription: StudentSubscriptionDetail | null
}

export interface StudentOwnedPet {
  petId: string
  petName: string
  rarity: string
  tier: number
  count: number
  imagePath: string
  tier2ImagePath: string | null
  tier3ImagePath: string | null
}

export interface MoodEntry {
  date: string
  mood: 'sad' | 'neutral' | 'happy' | null
  hasPracticed: boolean
}

export interface StudentSubscriptionDetail {
  tier: string
  isActive: boolean
  stripeStatus: string | null
  startDate: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingDate: string | null
  cancelAtPeriodEnd: boolean
  scheduledTier: string | null
  scheduledChangeDate: string | null
  paymentHistory: PaymentHistoryEntry[]
}

export interface PaymentHistoryEntry {
  id: string
  amountCents: number
  currency: string
  status: string
  tier: string | null
  description: string | null
  createdAt: string
}

export const useAdminStudentEngagementStore = defineStore('adminStudentEngagement', () => {
  const authStore = useAuthStore()

  // Student engagement data
  const studentEngagement = ref<Map<string, StudentEngagementData>>(new Map())
  const engagementLastFetched = ref<Map<string, number>>(new Map())
  const isLoadingEngagement = ref(false)

  /**
   * Fetch engagement data for a specific student (pets, mood, subscription)
   */
  async function fetchStudentEngagement(studentId: string): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { error: 'Not authenticated as admin' }
    }

    // Skip if cache is still valid
    const lastFetched = engagementLastFetched.value.get(studentId)
    if (lastFetched && Date.now() - lastFetched < ENGAGEMENT_CACHE_TTL) {
      return { error: null }
    }

    isLoadingEngagement.value = true

    try {
      // Parallel fetch all engagement data
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]!

      const [profileResult, petsResult, moodResult, subscriptionResult, paymentResult] =
        await Promise.all([
          supabase
            .from('student_profiles')
            .select('coins, xp, current_streak, food, selected_pet_id')
            .eq('id', studentId)
            .single(),
          supabase
            .from('owned_pets')
            .select(
              'pet_id, tier, count, pets (name, rarity, image_path, tier2_image_path, tier3_image_path)',
            )
            .eq('student_id', studentId),
          supabase
            .from('daily_statuses')
            .select('date, mood, has_practiced')
            .eq('student_id', studentId)
            .gte('date', thirtyDaysAgoStr)
            .order('date', { ascending: false }),
          supabase
            .from('child_subscriptions')
            .select(
              'tier, is_active, stripe_status, start_date, current_period_start, current_period_end, next_billing_date, cancel_at_period_end, scheduled_tier, scheduled_change_date',
            )
            .eq('student_id', studentId)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('payment_history')
            .select('id, amount_cents, currency, status, tier, description, created_at')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(10),
        ])

      if (profileResult.error) throw profileResult.error
      if (petsResult.error) throw petsResult.error
      if (moodResult.error) throw moodResult.error
      if (subscriptionResult.error) throw subscriptionResult.error
      if (paymentResult.error) throw paymentResult.error

      const profile = profileResult.data
      const xp = profile?.xp ?? 0
      const level = Math.floor(xp / 500) + 1
      const xpProgress = xp % 500

      // Transform owned pets
      const ownedPets: StudentOwnedPet[] = (petsResult.data ?? []).map((op) => {
        const pet = op.pets as unknown as {
          name: string
          rarity: string
          image_path: string
          tier2_image_path: string | null
          tier3_image_path: string | null
        } | null
        return {
          petId: op.pet_id,
          petName: pet?.name ?? 'Unknown',
          rarity: pet?.rarity ?? 'common',
          tier: op.tier,
          count: op.count ?? 1,
          imagePath: pet?.image_path ?? '',
          tier2ImagePath: pet?.tier2_image_path ?? null,
          tier3ImagePath: pet?.tier3_image_path ?? null,
        }
      })

      // Transform mood history
      const moodHistory: MoodEntry[] = (moodResult.data ?? []).map((d) => ({
        date: d.date,
        mood: d.mood as MoodEntry['mood'],
        hasPracticed: d.has_practiced ?? false,
      }))

      // Transform payment history
      const paymentHistory: PaymentHistoryEntry[] = (paymentResult.data ?? []).map((p) => ({
        id: p.id,
        amountCents: p.amount_cents,
        currency: p.currency,
        status: p.status,
        tier: p.tier,
        description: p.description,
        createdAt: p.created_at ?? new Date().toISOString(),
      }))

      // Transform subscription
      const sub = subscriptionResult.data
      const subscription: StudentSubscriptionDetail | null = sub
        ? {
            tier: sub.tier,
            isActive: sub.is_active ?? false,
            stripeStatus: sub.stripe_status,
            startDate: sub.start_date,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            nextBillingDate: sub.next_billing_date,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            scheduledTier: sub.scheduled_tier,
            scheduledChangeDate: sub.scheduled_change_date,
            paymentHistory,
          }
        : null

      studentEngagement.value.set(studentId, {
        coins: profile?.coins ?? 0,
        xp,
        level,
        xpProgress,
        currentStreak: profile?.current_streak ?? 0,
        food: profile?.food ?? 0,
        selectedPetId: profile?.selected_pet_id ?? null,
        ownedPets,
        moodHistory,
        subscription,
      })

      // Update cache timestamp
      engagementLastFetched.value.set(studentId, Date.now())

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch engagement data.')
      return { error: message }
    } finally {
      isLoadingEngagement.value = false
    }
  }

  /**
   * Fetch daily statuses for a student for a specific month (calendar view)
   */
  async function fetchStudentDailyStatuses(
    studentId: string,
    year: number,
    month: number,
  ): Promise<{ statuses: MoodEntry[]; error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { statuses: [], error: 'Not authenticated as admin' }
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    try {
      const { data, error: fetchError } = await supabase
        .from('daily_statuses')
        .select('date, mood, has_practiced')
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (fetchError) {
        return { statuses: [], error: handleError(fetchError, 'Failed to fetch daily statuses.') }
      }

      const statuses: MoodEntry[] = (data ?? []).map((d) => ({
        date: d.date,
        mood: d.mood as MoodEntry['mood'],
        hasPracticed: d.has_practiced ?? false,
      }))

      return { statuses, error: null }
    } catch (err) {
      return { statuses: [], error: handleError(err, 'Failed to fetch daily statuses.') }
    }
  }

  // Get engagement data for a specific student
  function getStudentEngagement(studentId: string): StudentEngagementData | undefined {
    return studentEngagement.value.get(studentId)
  }

  // Reset store state
  function $reset() {
    studentEngagement.value.clear()
    engagementLastFetched.value.clear()
    isLoadingEngagement.value = false
  }

  return {
    // State
    isLoadingEngagement,

    // Actions
    fetchStudentEngagement,
    fetchStudentDailyStatuses,
    getStudentEngagement,
    $reset,
  }
})
