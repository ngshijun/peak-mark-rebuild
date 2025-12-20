import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type MoodType = Database['public']['Enums']['mood_type']

export interface DailyStatus {
  id: string
  studentId: string
  date: string // ISO date string (YYYY-MM-DD)
  mood: MoodType | null
  hasPracticed: boolean
  hasSpun: boolean
  spinReward: number | null
  createdAt: string | null
}

export const useStudentDashboardStore = defineStore('studentDashboard', () => {
  const authStore = useAuthStore()

  // Current day's status
  const todayStatus = ref<DailyStatus | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Streak from database (single source of truth)
  const currentStreak = ref<number>(0)

  // Get today's date string in local timezone
  function getTodayString(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  // Fetch today's daily status
  async function fetchTodayStatus(): Promise<{ error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { error: 'Not logged in' }
    }

    isLoading.value = true
    error.value = null

    try {
      const today = getTodayString()

      const { data, error: fetchError } = await supabase
        .from('daily_statuses')
        .select('*')
        .eq('student_id', studentId)
        .eq('date', today)
        .maybeSingle()

      if (fetchError) {
        error.value = fetchError.message
        return { error: fetchError.message }
      }

      if (data) {
        todayStatus.value = {
          id: data.id,
          studentId: data.student_id,
          date: data.date,
          mood: data.mood,
          hasPracticed: data.has_practiced ?? false,
          hasSpun: data.has_spun ?? false,
          spinReward: data.spin_reward,
          createdAt: data.created_at,
        }
      } else {
        // No record for today yet - create one
        const { data: newData, error: insertError } = await supabase
          .from('daily_statuses')
          .insert({
            student_id: studentId,
            date: today,
            has_practiced: false,
            has_spun: false,
          })
          .select()
          .single()

        if (insertError) {
          error.value = insertError.message
          return { error: insertError.message }
        }

        todayStatus.value = {
          id: newData.id,
          studentId: newData.student_id,
          date: newData.date,
          mood: newData.mood,
          hasPracticed: newData.has_practiced ?? false,
          hasSpun: newData.has_spun ?? false,
          spinReward: newData.spin_reward,
          createdAt: newData.created_at,
        }
      }

      // Fetch current streak from student_profiles
      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('current_streak')
        .eq('id', studentId)
        .single()

      if (profileData) {
        currentStreak.value = profileData.current_streak ?? 0
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch daily status'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Check if mood has been set today
  const hasMoodToday = computed(() => todayStatus.value?.mood !== null)

  // Check if already spun today
  const hasSpunToday = computed(() => todayStatus.value?.hasSpun ?? false)

  // Set today's mood
  async function setMood(mood: MoodType): Promise<{ error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { error: 'Not logged in' }
    }

    if (!todayStatus.value) {
      await fetchTodayStatus()
    }

    if (!todayStatus.value) {
      return { error: 'Could not create daily status' }
    }

    try {
      const { error: updateError } = await supabase
        .from('daily_statuses')
        .update({ mood })
        .eq('id', todayStatus.value.id)

      if (updateError) {
        return { error: updateError.message }
      }

      todayStatus.value.mood = mood
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set mood'
      return { error: message }
    }
  }

  // Spin the wheel and get a random reward (1-5 coins)
  async function spinWheel(): Promise<{ reward: number | null; error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { reward: null, error: 'Not logged in' }
    }

    if (!todayStatus.value) {
      await fetchTodayStatus()
    }

    if (!todayStatus.value) {
      return { reward: null, error: 'Could not create daily status' }
    }

    if (todayStatus.value.hasSpun) {
      return { reward: null, error: 'Already spun today' }
    }

    // Generate random reward between 1 and 5
    const reward = Math.floor(Math.random() * 5) + 1

    try {
      // Update daily status
      const { error: updateError } = await supabase
        .from('daily_statuses')
        .update({
          has_spun: true,
          spin_reward: reward,
        })
        .eq('id', todayStatus.value.id)

      if (updateError) {
        return { reward: null, error: updateError.message }
      }

      todayStatus.value.hasSpun = true
      todayStatus.value.spinReward = reward

      // Add coins to user
      await authStore.addCoins(reward)

      return { reward, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to spin wheel'
      return { reward: null, error: message }
    }
  }

  // Refresh streak from database (call after practice completion)
  async function refreshStreak(): Promise<void> {
    const studentId = authStore.user?.id
    if (!studentId) return

    const { data } = await supabase
      .from('student_profiles')
      .select('current_streak')
      .eq('id', studentId)
      .single()

    if (data) {
      currentStreak.value = data.current_streak ?? 0
    }
  }

  // Check if practiced today
  const hasPracticedToday = computed(() => {
    return todayStatus.value?.hasPracticed ?? false
  })

  // Mark that user has practiced today
  async function markPracticedToday(): Promise<{ error: string | null }> {
    if (!todayStatus.value) {
      await fetchTodayStatus()
    }

    if (!todayStatus.value) {
      return { error: 'Could not create daily status' }
    }

    if (todayStatus.value.hasPracticed) {
      return { error: null } // Already marked
    }

    try {
      const { error: updateError } = await supabase
        .from('daily_statuses')
        .update({ has_practiced: true })
        .eq('id', todayStatus.value.id)

      if (updateError) {
        return { error: updateError.message }
      }

      todayStatus.value.hasPracticed = true
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark practiced'
      return { error: message }
    }
  }

  // Reset store state (call on logout)
  function $reset() {
    todayStatus.value = null
    isLoading.value = false
    error.value = null
    currentStreak.value = 0
  }

  return {
    todayStatus,
    isLoading,
    error,
    hasMoodToday,
    hasSpunToday,
    currentStreak,
    hasPracticedToday,
    fetchTodayStatus,
    setMood,
    spinWheel,
    refreshStreak,
    markPracticedToday,
    getTodayString,
    $reset,
  }
})
