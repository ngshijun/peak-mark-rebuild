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
  stripePriceId?: string
}

export interface StripeSubscriptionDetails {
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  stripeStatus: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface UpgradePreview {
  isUpgrade: boolean
  amountDue?: number
  currency?: string
  lineItems?: Array<{
    description: string
    amount: number
    currency: string
    proration: boolean
  }>
  currentPlan: {
    name: string
    priceId: string
    amount: number
  }
  newPlan: {
    name: string
    priceId: string
    amount: number
  }
  message: string
  effectiveDate?: string
  newBillingCycleStart?: string
  newBillingCycleEnd?: string
}

export interface ScheduledChange {
  scheduledTier: SubscriptionTier
  scheduledChangeDate: string
  stripeScheduleId?: string
}

export interface ChildSubscription {
  childId: string
  tier: SubscriptionTier
  startDate: string
  nextBillingDate?: string
  isActive: boolean
  stripe?: StripeSubscriptionDetails
  scheduledChange?: ScheduledChange
}

// Cache TTL constants
const PLANS_CACHE_TTL = 10 * 60 * 1000 // 10 minutes - plans rarely change
const SUBSCRIPTIONS_CACHE_TTL = 2 * 60 * 1000 // 2 minutes - subscriptions may change more often

export const useSubscriptionStore = defineStore('subscription', () => {
  const childLinkStore = useChildLinkStore()
  const authStore = useAuthStore()

  // Define subscription plans (fetched from DB)
  const plans = ref<SubscriptionPlan[]>([])
  const childSubscriptions = ref<ChildSubscription[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isProcessingPayment = ref(false)
  const paymentError = ref<string | null>(null)

  // Cache timestamps for staleness tracking
  const plansLastFetched = ref<number | null>(null)
  const subscriptionsLastFetched = ref<number | null>(null)

  /**
   * Check if plans cache is still valid
   */
  function isPlansStale(): boolean {
    if (!plansLastFetched.value || plans.value.length === 0) return true
    return Date.now() - plansLastFetched.value > PLANS_CACHE_TTL
  }

  /**
   * Check if subscriptions cache is still valid
   */
  function isSubscriptionsStale(): boolean {
    if (!subscriptionsLastFetched.value) return true
    return Date.now() - subscriptionsLastFetched.value > SUBSCRIPTIONS_CACHE_TTL
  }

  /**
   * Fetch subscription plans from the database (with caching)
   */
  async function fetchPlans(force = false): Promise<{ error: string | null }> {
    // Skip if cache is still valid and not forced
    if (!force && !isPlansStale()) {
      return { error: null }
    }

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
        stripePriceId: row.stripe_price_id ?? undefined,
      }))

      plansLastFetched.value = Date.now()
      return { error: null }
    } catch (err) {
      console.error('Error fetching subscription plans:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch plans'
      return { error: message }
    }
  }

  /**
   * Fetch subscriptions for all linked children (with caching)
   */
  async function fetchChildrenSubscriptions(force = false): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    if (childLinkStore.linkedChildren.length === 0) {
      childSubscriptions.value = []
      return { error: null }
    }

    // Skip if cache is still valid and not forced
    if (!force && !isSubscriptionsStale() && childSubscriptions.value.length > 0) {
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
          const subscription: ChildSubscription = {
            childId: existing.student_id,
            tier: existing.tier,
            startDate: existing.start_date,
            nextBillingDate: existing.next_billing_date ?? undefined,
            isActive: existing.is_active ?? true,
            stripe: {
              stripeSubscriptionId: existing.stripe_subscription_id,
              stripePriceId: existing.stripe_price_id,
              stripeStatus: existing.stripe_status,
              currentPeriodStart: existing.current_period_start,
              currentPeriodEnd: existing.current_period_end,
              cancelAtPeriodEnd: existing.cancel_at_period_end ?? false,
            },
          }

          // Add scheduled change info if present
          if (existing.scheduled_tier && existing.scheduled_change_date) {
            subscription.scheduledChange = {
              scheduledTier: existing.scheduled_tier,
              scheduledChangeDate: existing.scheduled_change_date,
              stripeScheduleId: existing.stripe_schedule_id ?? undefined,
            }
          }

          return subscription
        }
        // Default to basic subscription
        return {
          childId,
          tier: 'core' as SubscriptionTier,
          startDate: new Date().toISOString(),
          isActive: true,
        }
      })

      subscriptionsLastFetched.value = Date.now()
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
      tier: 'core',
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
   * Check if a child has an active Stripe subscription
   */
  function hasActiveStripeSubscription(childId: string): boolean {
    const subscription = getChildSubscription(childId)
    return !!subscription.stripe?.stripeSubscriptionId
  }

  /**
   * Create a Stripe Checkout session for a new subscription
   */
  async function createCheckoutSession(
    childId: string,
    tier: SubscriptionTier,
  ): Promise<{ url: string | null; error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { url: null, error: 'Not authenticated as parent' }
    }

    if (tier === 'core') {
      return { url: null, error: 'Cannot checkout for basic tier' }
    }

    // Get price ID for tier
    const plan = plans.value.find((p) => p.id === tier)
    if (!plan?.stripePriceId) {
      return { url: null, error: 'Plan not configured for payments' }
    }

    isProcessingPayment.value = true
    paymentError.value = null

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'create-checkout-session',
        {
          body: {
            priceId: plan.stripePriceId,
            studentId: childId,
            successUrl: `${window.location.origin}/parent/subscription?success=true`,
            cancelUrl: `${window.location.origin}/parent/subscription?canceled=true`,
          },
        },
      )

      if (invokeError) throw invokeError
      if (data.error) throw new Error(data.error)

      return { url: data.url, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create checkout'
      paymentError.value = message
      return { url: null, error: message }
    } finally {
      isProcessingPayment.value = false
    }
  }

  /**
   * Open Stripe Customer Portal for billing management
   */
  async function openCustomerPortal(): Promise<{ url: string | null; error: string | null }> {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'create-portal-session',
        {
          body: {
            returnUrl: `${window.location.origin}/parent/subscription`,
          },
        },
      )

      if (invokeError) throw invokeError
      if (data.error) throw new Error(data.error)

      return { url: data.url, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open billing portal'
      return { url: null, error: message }
    }
  }

  /**
   * Sync subscription state from Stripe to database.
   * Used after checkout redirect and for manual reconciliation.
   */
  async function syncSubscription(
    childId: string,
    sessionId?: string,
  ): Promise<{ success: boolean; error: string | null }> {
    isProcessingPayment.value = true
    paymentError.value = null

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('sync-subscription', {
        body: {
          studentId: childId,
          sessionId: sessionId,
        },
      })

      if (invokeError) throw invokeError
      if (data.error) throw new Error(data.error)

      // Refresh subscriptions to get synced data
      await fetchChildrenSubscriptions()
      return { success: true, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync subscription'
      paymentError.value = message
      return { success: false, error: message }
    } finally {
      isProcessingPayment.value = false
    }
  }

  /**
   * Preview an upgrade to see prorated costs before confirming
   */
  async function previewUpgrade(
    childId: string,
    newTier: SubscriptionTier,
  ): Promise<{ preview: UpgradePreview | null; error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { preview: null, error: 'Not authenticated as parent' }
    }

    const plan = plans.value.find((p) => p.id === newTier)
    if (!plan?.stripePriceId) {
      return { preview: null, error: 'Plan not configured for payments' }
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('preview-upgrade', {
        body: {
          studentId: childId,
          newPriceId: plan.stripePriceId,
        },
      })

      if (invokeError) throw invokeError
      if (data.error) throw new Error(data.error)

      return { preview: data as UpgradePreview, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview upgrade'
      return { preview: null, error: message }
    }
  }

  /**
   * Modify an existing Stripe subscription (upgrade/downgrade)
   * - Upgrades: Applied immediately with proration
   * - Downgrades: Scheduled for next billing cycle
   */
  async function modifySubscription(
    childId: string,
    newTier: SubscriptionTier,
  ): Promise<{
    success: boolean
    error: string | null
    type?: 'immediate' | 'scheduled'
    scheduledDate?: string
    message?: string
  }> {
    if (newTier === 'core') {
      // Downgrade to basic = cancel at period end (user keeps access until period ends)
      const result = await cancelStripeSubscription(childId, false)
      return { ...result, type: 'scheduled' }
    }

    const plan = plans.value.find((p) => p.id === newTier)
    if (!plan?.stripePriceId) {
      return { success: false, error: 'Plan not configured for payments' }
    }

    isProcessingPayment.value = true
    paymentError.value = null

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('modify-subscription', {
        body: {
          studentId: childId,
          newPriceId: plan.stripePriceId,
        },
      })

      if (invokeError) throw invokeError
      if (data.error) throw new Error(data.error)

      // Refresh subscriptions to get updated data (non-blocking, non-critical)
      // If refresh fails, the modification still succeeded - just log a warning
      try {
        await fetchChildrenSubscriptions(true) // Force refresh
      } catch (refreshErr) {
        console.warn('Failed to refresh subscriptions after modification:', refreshErr)
        // Invalidate cache so next access will fetch fresh data
        subscriptionsLastFetched.value = null
      }

      return {
        success: true,
        error: null,
        type: data.type,
        scheduledDate: data.scheduledDate,
        message: data.message,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to modify subscription'
      paymentError.value = message
      return { success: false, error: message }
    } finally {
      isProcessingPayment.value = false
    }
  }

  /**
   * Cancel a Stripe subscription
   */
  async function cancelStripeSubscription(
    childId: string,
    immediately: boolean = false,
  ): Promise<{ success: boolean; error: string | null }> {
    isProcessingPayment.value = true
    paymentError.value = null

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('cancel-subscription', {
        body: {
          studentId: childId,
          cancelImmediately: immediately,
        },
      })

      if (invokeError) throw invokeError
      if (data.error) throw new Error(data.error)

      // Refresh subscriptions
      await fetchChildrenSubscriptions()
      return { success: true, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel subscription'
      paymentError.value = message
      return { success: false, error: message }
    } finally {
      isProcessingPayment.value = false
    }
  }

  /**
   * Upgrade/change plan for a child (local DB only - for basic tier or initial setup)
   * @deprecated Use createCheckoutSession or modifySubscription for paid tiers
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
        tier !== 'core' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null

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
   * @deprecated Use cancelStripeSubscription for Stripe-managed subscriptions
   */
  async function cancelSubscription(
    childId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    return upgradePlan(childId, 'core')
  }

  // Get total monthly cost across all children
  const totalMonthlyCost = computed(() => {
    return childSubscriptions.value.reduce((total, sub) => {
      const plan = plans.value.find((p) => p.id === sub.tier)
      return total + (plan?.price ?? 0)
    }, 0)
  })

  // Check if any child has an active Stripe subscription (for showing billing portal)
  const hasAnyStripeSubscription = computed(() => {
    return childSubscriptions.value.some((sub) => sub.stripe?.stripeSubscriptionId)
  })

  // Reset user-specific state (call on logout)
  // Note: plans is shared data and doesn't need reset
  function $reset() {
    childSubscriptions.value = []
    isLoading.value = false
    error.value = null
    isProcessingPayment.value = false
    paymentError.value = null
  }

  return {
    // State
    plans,
    childSubscriptions,
    isLoading,
    error,
    isProcessingPayment,
    paymentError,

    // Computed
    totalMonthlyCost,
    hasAnyStripeSubscription,

    // Actions
    fetchPlans,
    fetchChildrenSubscriptions,
    getChildSubscription,
    getChildPlan,
    hasActiveStripeSubscription,

    // Stripe Actions
    createCheckoutSession,
    openCustomerPortal,
    syncSubscription,
    previewUpgrade,
    modifySubscription,
    cancelStripeSubscription,

    // Legacy Actions (for basic tier or non-Stripe usage)
    upgradePlan,
    cancelSubscription,
    $reset,
  }
})
