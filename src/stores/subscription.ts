import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useChildLinkStore } from './child-link'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type SubscriptionTier = Database['public']['Enums']['subscription_tier']
type SubscriptionPlanRow = Database['public']['Tables']['subscription_plans']['Row']
type ChildSubscriptionRow = Database['public']['Tables']['child_subscriptions']['Row']

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  price: number // monthly price
  sessionsPerDay: number
  features: string[]
  highlighted?: boolean
}

export interface ChildSubscription {
  childId: string
  tier: SubscriptionTier
  startDate: string
  nextBillingDate?: string
  isActive: boolean
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const childLinkStore = useChildLinkStore()
  const authStore = useAuthStore()

  // Define subscription plans (fetched from DB)
  const plans = ref<SubscriptionPlan[]>([])
  const childSubscriptions = ref<ChildSubscription[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch subscription plans from the database
   */
  async function fetchPlans(): Promise<{ error: string | null }> {
    try {
      const { data, error: fetchError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true })

      if (fetchError) throw fetchError

      plans.value = (data ?? []).map((row: SubscriptionPlanRow) => ({
        id: row.id,
        name: row.name,
        price: row.price_monthly,
        sessionsPerDay: row.sessions_per_day,
        features: (row.features as string[]) ?? [],
        highlighted: row.is_highlighted ?? false,
      }))

      return { error: null }
    } catch (err) {
      console.error('Error fetching subscription plans:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch plans'
      return { error: message }
    }
  }

  /**
   * Fetch subscriptions for all linked children
   */
  async function fetchChildrenSubscriptions(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    if (childLinkStore.linkedChildren.length === 0) {
      childSubscriptions.value = []
      return { error: null }
    }

    isLoading.value = true
    error.value = null

    try {
      const childIds = childLinkStore.linkedChildren.map((c) => c.id)

      const { data, error: fetchError } = await supabase
        .from('child_subscriptions')
        .select('*')
        .eq('parent_id', authStore.user.id)
        .in('student_id', childIds)

      if (fetchError) throw fetchError

      // Map existing subscriptions
      const subscriptionMap = new Map<string, ChildSubscriptionRow>()
      for (const row of data ?? []) {
        subscriptionMap.set(row.student_id, row)
      }

      // Build subscription array for all children (default to basic if not found)
      childSubscriptions.value = childIds.map((childId) => {
        const existing = subscriptionMap.get(childId)
        if (existing) {
          return {
            childId: existing.student_id,
            tier: existing.tier,
            startDate: existing.start_date,
            nextBillingDate: existing.next_billing_date ?? undefined,
            isActive: existing.is_active ?? true,
          }
        }
        // Default to basic subscription
        return {
          childId,
          tier: 'basic' as SubscriptionTier,
          startDate: new Date().toISOString(),
          isActive: true,
        }
      })

      return { error: null }
    } catch (err) {
      console.error('Error fetching children subscriptions:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch subscriptions'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Get subscription for a specific child
  function getChildSubscription(childId: string): ChildSubscription {
    const existing = childSubscriptions.value.find((s) => s.childId === childId)
    if (existing) return existing

    // Return default basic subscription if not found
    return {
      childId,
      tier: 'basic',
      startDate: new Date().toISOString(),
      isActive: true,
    }
  }

  // Get plan for a specific child
  function getChildPlan(childId: string): SubscriptionPlan | undefined {
    const subscription = getChildSubscription(childId)
    return plans.value.find((p) => p.id === subscription.tier)
  }

  /**
   * Upgrade/change plan for a child
   */
  async function upgradePlan(
    childId: string,
    tier: SubscriptionTier,
  ): Promise<{ success: boolean; error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { success: false, error: 'Not authenticated as parent' }
    }

    try {
      const nextBillingDate =
        tier !== 'basic' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null

      // Check if subscription exists
      const { data: existing } = await supabase
        .from('child_subscriptions')
        .select('id')
        .eq('parent_id', authStore.user.id)
        .eq('student_id', childId)
        .single()

      if (existing) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from('child_subscriptions')
          .update({
            tier,
            next_billing_date: nextBillingDate,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else {
        // Create new subscription
        const { error: insertError } = await supabase.from('child_subscriptions').insert({
          parent_id: authStore.user.id,
          student_id: childId,
          tier,
          start_date: new Date().toISOString(),
          next_billing_date: nextBillingDate,
          is_active: true,
        })

        if (insertError) throw insertError
      }

      // Update local state
      const existingIndex = childSubscriptions.value.findIndex((s) => s.childId === childId)
      const newSubscription: ChildSubscription = {
        childId,
        tier,
        startDate: new Date().toISOString(),
        nextBillingDate: nextBillingDate ?? undefined,
        isActive: true,
      }

      if (existingIndex >= 0) {
        childSubscriptions.value[existingIndex] = newSubscription
      } else {
        childSubscriptions.value.push(newSubscription)
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error upgrading plan:', err)
      const message = err instanceof Error ? err.message : 'Failed to upgrade plan'
      return { success: false, error: message }
    }
  }

  /**
   * Cancel subscription for a child (downgrade to basic)
   */
  async function cancelSubscription(
    childId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    return upgradePlan(childId, 'basic')
  }

  // Get total monthly cost across all children
  const totalMonthlyCost = computed(() => {
    return childSubscriptions.value.reduce((total, sub) => {
      const plan = plans.value.find((p) => p.id === sub.tier)
      return total + (plan?.price ?? 0)
    }, 0)
  })

  return {
    // State
    plans,
    childSubscriptions,
    isLoading,
    error,

    // Computed
    totalMonthlyCost,

    // Actions
    fetchPlans,
    fetchChildrenSubscriptions,
    getChildSubscription,
    getChildPlan,
    upgradePlan,
    cancelSubscription,
  }
})
