import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChildLinkStore } from './child-link'

export type SubscriptionTier = 'basic' | 'plus' | 'pro' | 'max'

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
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const childLinkStore = useChildLinkStore()

  // Define subscription plans
  const plans = ref<SubscriptionPlan[]>([
    {
      id: 'basic',
      name: 'Basic',
      price: 0,
      sessionsPerDay: 3,
      features: [
        '3 practice sessions per day',
        'Basic progress tracking',
        'View overall session scores',
      ],
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 9.99,
      sessionsPerDay: 10,
      features: [
        '10 practice sessions per day',
        'Basic progress tracking',
        'View overall session scores',
        'Email support',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 19.99,
      sessionsPerDay: 25,
      highlighted: true,
      features: [
        '25 practice sessions per day',
        'Detailed progress tracking',
        'View individual questions & answers',
        'Session history with full details',
        'Priority email support',
      ],
    },
    {
      id: 'max',
      name: 'Max',
      price: 29.99,
      sessionsPerDay: 50,
      features: [
        '50 practice sessions per day',
        'Detailed progress tracking',
        'View individual questions & answers',
        'Session history with full details',
        'AI-powered feedback after each session',
        'Personalized weakness analysis',
        'Learning recommendations',
        'Priority email support',
      ],
    },
  ])

  // Subscriptions per child (mock data)
  const childSubscriptions = ref<ChildSubscription[]>([
    {
      childId: 's1',
      tier: 'basic',
      startDate: '2024-01-01T00:00:00',
    },
  ])

  // Get subscription for a specific child
  function getChildSubscription(childId: string): ChildSubscription {
    const existing = childSubscriptions.value.find((s) => s.childId === childId)
    if (existing) return existing

    // Return default basic subscription if not found
    return {
      childId,
      tier: 'basic',
      startDate: new Date().toISOString(),
    }
  }

  // Get plan for a specific child
  function getChildPlan(childId: string): SubscriptionPlan | undefined {
    const subscription = getChildSubscription(childId)
    return plans.value.find((p) => p.id === subscription.tier)
  }

  // Upgrade/change plan for a child
  function upgradePlan(childId: string, tier: SubscriptionTier) {
    const existingIndex = childSubscriptions.value.findIndex((s) => s.childId === childId)

    const newSubscription: ChildSubscription = {
      childId,
      tier,
      startDate: new Date().toISOString(),
      nextBillingDate:
        tier !== 'basic'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
    }

    if (existingIndex >= 0) {
      childSubscriptions.value[existingIndex] = newSubscription
    } else {
      childSubscriptions.value.push(newSubscription)
    }
    return true
  }

  // Cancel subscription for a child (downgrade to basic)
  function cancelSubscription(childId: string) {
    const existingIndex = childSubscriptions.value.findIndex((s) => s.childId === childId)

    const basicSubscription: ChildSubscription = {
      childId,
      tier: 'basic',
      startDate: new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      childSubscriptions.value[existingIndex] = basicSubscription
    } else {
      childSubscriptions.value.push(basicSubscription)
    }
  }

  // Get total monthly cost across all children
  const totalMonthlyCost = computed(() => {
    return childSubscriptions.value.reduce((total, sub) => {
      const plan = plans.value.find((p) => p.id === sub.tier)
      return total + (plan?.price ?? 0)
    }, 0)
  })

  return {
    plans,
    childSubscriptions,
    getChildSubscription,
    getChildPlan,
    upgradePlan,
    cancelSubscription,
    totalMonthlyCost,
  }
})
