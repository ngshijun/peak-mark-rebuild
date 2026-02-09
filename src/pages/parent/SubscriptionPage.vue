<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  useSubscriptionStore,
  type SubscriptionTier,
  type UpgradePreview,
} from '@/stores/subscription'
import { useChildLinkStore } from '@/stores/child-link'
import { toast } from 'vue-sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  CreditCard,
  Users,
  Loader2,
  ExternalLink,
} from 'lucide-vue-next'

const subscriptionStore = useSubscriptionStore()
const childLinkStore = useChildLinkStore()

const selectedChildId = ref<string>('')

// Upgrade preview state
const upgradePreview = ref<UpgradePreview | null>(null)
const isLoadingPreview = ref(false)
const previewError = ref<string | null>(null)
const upgradeDialogOpen = ref(false)
const pendingUpgradeTier = ref<SubscriptionTier | null>(null)

// Handle checkout redirect on mount
// Note: Plans and subscriptions are preloaded by the route guard for faster initial render
onMounted(async () => {
  // Set default selected child (linkedChildren already loaded by route guard)
  if (childLinkStore.linkedChildren.length > 0 && !selectedChildId.value) {
    selectedChildId.value = childLinkStore.linkedChildren[0]?.id ?? ''
  }

  // Handle Stripe checkout redirect
  const urlParams = new URLSearchParams(window.location.search)
  const sessionId = urlParams.get('session_id')
  const isSuccess = urlParams.get('success') === 'true'
  const isCanceled = urlParams.get('canceled') === 'true'

  if (isSuccess && sessionId && selectedChildId.value) {
    // Sync subscription from Stripe to ensure database is up to date
    const { success, error } = await subscriptionStore.syncSubscription(
      selectedChildId.value,
      sessionId,
    )

    if (success) {
      toast.success('Subscription activated!', {
        description: 'Your subscription has been successfully activated.',
      })
      // Refresh subscriptions to show the new status
      await subscriptionStore.fetchChildrenSubscriptions(true)
    } else {
      toast.error('Sync issue', {
        description: error || 'Subscription may not be fully synced. Please refresh the page.',
      })
    }
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname)
  } else if (isCanceled) {
    toast.error('Checkout cancelled', {
      description: 'You cancelled the checkout process.',
    })
    window.history.replaceState({}, '', window.location.pathname)
  }
})

const selectedChild = computed(() => {
  return childLinkStore.linkedChildren.find((c) => c.id === selectedChildId.value)
})

const currentSubscription = computed(() => {
  if (!selectedChildId.value) return null
  return subscriptionStore.getChildSubscription(selectedChildId.value)
})

const currentPlan = computed(() => {
  if (!selectedChildId.value) return null
  return subscriptionStore.getChildPlan(selectedChildId.value)
})

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Handle clicking upgrade/downgrade button - fetches preview for upgrades
 */
async function handlePlanChange(tier: SubscriptionTier) {
  if (!selectedChildId.value) return

  // For basic tier, directly show cancel dialog (handled separately)
  if (tier === 'core') {
    pendingUpgradeTier.value = tier
    upgradeDialogOpen.value = true
    return
  }

  const hasStripe = subscriptionStore.hasActiveStripeSubscription(selectedChildId.value)

  // If user has an active Stripe subscription, fetch preview for both upgrades and downgrades
  if (hasStripe) {
    isLoadingPreview.value = true
    previewError.value = null
    upgradePreview.value = null
    pendingUpgradeTier.value = tier
    upgradeDialogOpen.value = true

    const { preview, error } = await subscriptionStore.previewUpgrade(selectedChildId.value, tier)
    isLoadingPreview.value = false

    if (error) {
      previewError.value = error
    } else {
      upgradePreview.value = preview
    }
  } else {
    // For new subscriptions, just open dialog
    pendingUpgradeTier.value = tier
    upgradeDialogOpen.value = true
  }
}

/**
 * Confirm the plan change after preview
 */
async function confirmPlanChange() {
  if (!selectedChildId.value || !pendingUpgradeTier.value) return

  const tier = pendingUpgradeTier.value
  upgradeDialogOpen.value = false

  // For basic tier, cancel the subscription
  if (tier === 'core') {
    await handleCancel()
    resetUpgradeState()
    return
  }

  const hasStripe = subscriptionStore.hasActiveStripeSubscription(selectedChildId.value)

  if (hasStripe) {
    // Has existing Stripe subscription - modify it
    const result = await subscriptionStore.modifySubscription(selectedChildId.value, tier)
    if (result.error) {
      toast.error('Error', { description: result.error })
    } else if (result.type === 'scheduled') {
      // Downgrade scheduled for next billing cycle
      const scheduledDate = result.scheduledDate
        ? new Date(result.scheduledDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'next billing cycle'
      toast.success('Downgrade scheduled', {
        description: `Your plan will change to ${tier} on ${scheduledDate}. You'll keep your current plan until then.`,
      })
    } else {
      // Upgrade applied immediately
      toast.success('Subscription upgraded!', {
        description: `Plan has been upgraded to ${tier}. Your billing cycle has been reset.`,
      })
    }
  } else {
    // No Stripe subscription - create checkout session
    const { url, error } = await subscriptionStore.createCheckoutSession(
      selectedChildId.value,
      tier,
    )
    if (error) {
      toast.error('Error', { description: error })
    } else if (url) {
      // Redirect to Stripe Checkout
      window.location.href = url
    }
  }

  resetUpgradeState()
}

function resetUpgradeState() {
  upgradePreview.value = null
  previewError.value = null
  pendingUpgradeTier.value = null
}

function formatCurrency(amount: number) {
  return `RM ${(amount / 100).toFixed(2)}`
}

async function handleCancel() {
  if (!selectedChildId.value) return

  const hasStripe = subscriptionStore.hasActiveStripeSubscription(selectedChildId.value)

  if (!hasStripe) {
    // Already on core tier with no Stripe subscription - nothing to cancel
    toast.info('No active subscription', {
      description: 'This child is already on the basic tier.',
    })
    return
  }

  const { error } = await subscriptionStore.cancelStripeSubscription(selectedChildId.value, false)
  if (error) {
    toast.error('Error', { description: error })
  } else {
    toast.success('Subscription cancelled', {
      description: 'Your subscription will end at the current billing period.',
    })
  }
}

async function handleOpenPortal() {
  const { url, error } = await subscriptionStore.openCustomerPortal()
  if (error) {
    toast.error('Error', { description: error })
  } else if (url) {
    window.location.href = url
  }
}

function getTierIcon(tier: SubscriptionTier) {
  switch (tier) {
    case 'plus':
      return Zap
    case 'pro':
      return Sparkles
    case 'max':
      return Crown
    default:
      return CreditCard
  }
}

function getButtonText(planTier: SubscriptionTier, currentTier: SubscriptionTier) {
  if (planTier === currentTier) return 'Current Plan'

  // Check if this tier is scheduled
  if (currentSubscription.value?.scheduledChange?.scheduledTier === planTier) {
    return 'Scheduled'
  }

  if (planTier === 'core') return 'Downgrade'

  const tierOrder: SubscriptionTier[] = ['core', 'plus', 'pro', 'max']
  const planIndex = tierOrder.indexOf(planTier)
  const currentIndex = tierOrder.indexOf(currentTier)

  return planIndex > currentIndex ? 'Upgrade' : 'Downgrade'
}

function getButtonVariant(
  planTier: SubscriptionTier,
  currentTier: SubscriptionTier,
  highlighted?: boolean,
) {
  if (planTier === currentTier) return 'outline' as const
  if (highlighted) return 'default' as const
  return 'outline' as const
}

function getStatusBadge(subscription: ReturnType<typeof subscriptionStore.getChildSubscription>) {
  if (!subscription.stripe) return null

  if (subscription.stripe.cancelAtPeriodEnd) {
    return { text: 'Cancels soon', variant: 'destructive' as const }
  }

  if (subscription.scheduledChange) {
    return { text: 'Downgrade scheduled', variant: 'secondary' as const }
  }

  if (subscription.stripe.stripeStatus === 'past_due') {
    return { text: 'Payment failed', variant: 'destructive' as const }
  }

  if (subscription.stripe.stripeStatus === 'active') {
    return { text: 'Active', variant: 'default' as const }
  }

  return null
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Subscription</h1>
        <p class="text-muted-foreground">Manage subscriptions for your children</p>
      </div>

      <!-- Manage Billing Button -->
      <Button
        v-if="subscriptionStore.hasAnyStripeSubscription"
        variant="outline"
        @click="handleOpenPortal"
      >
        <CreditCard class="mr-2 size-4" />
        Manage Billing
        <ExternalLink class="ml-2 size-3" />
      </Button>
    </div>

    <!-- Loading State -->
    <div
      v-if="subscriptionStore.isLoading || subscriptionStore.isProcessingPayment"
      class="flex items-center justify-center py-16"
    >
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- No Children State -->
    <div v-else-if="childLinkStore.linkedChildren.length === 0" class="py-16 text-center">
      <Users class="mx-auto size-16 text-muted-foreground/50" />
      <h2 class="mt-4 text-lg font-semibold">No Linked Children</h2>
      <p class="mt-2 text-muted-foreground">
        Link a child to manage their subscription. Go to the Children page to send an invitation.
      </p>
    </div>

    <template v-else>
      <!-- Child Selector and Current Subscription Side by Side -->
      <div class="grid gap-4 md:grid-cols-2">
        <!-- Child Selector -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Users class="size-5" />
              Select Child
            </CardTitle>
            <CardDescription>Choose a child to manage their subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <Select v-model="selectedChildId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="child in childLinkStore.linkedChildren"
                  :key="child.id"
                  :value="child.id"
                >
                  {{ child.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <!-- Current Subscription Card -->
        <Card v-if="currentSubscription && currentPlan">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <CreditCard class="size-5" />
              Current Plan for {{ selectedChild?.name }}
            </CardTitle>
            <CardDescription>Active subscription details</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-2xl font-bold">{{ currentPlan.name }}</span>
                  <!-- Status badges -->
                  <template v-if="getStatusBadge(currentSubscription)">
                    <Badge :variant="getStatusBadge(currentSubscription)!.variant">
                      {{ getStatusBadge(currentSubscription)!.text }}
                    </Badge>
                  </template>
                  <template v-else>
                    <Badge v-if="currentSubscription.tier !== 'core'" variant="default">
                      Active
                    </Badge>
                    <Badge v-else variant="secondary">Free Tier</Badge>
                  </template>
                </div>
                <!-- Show period end for Stripe subscriptions -->
                <p
                  v-if="currentSubscription.stripe?.currentPeriodEnd"
                  class="text-sm text-muted-foreground"
                >
                  <template v-if="currentSubscription.stripe.cancelAtPeriodEnd">
                    Ends on {{ formatDate(currentSubscription.stripe.currentPeriodEnd) }}
                  </template>
                  <template v-else-if="currentSubscription.scheduledChange">
                    Changing to
                    <span class="font-medium text-amber-600 dark:text-amber-400">
                      {{
                        subscriptionStore.plans.find(
                          (p) => p.id === currentSubscription?.scheduledChange?.scheduledTier,
                        )?.name || currentSubscription?.scheduledChange?.scheduledTier
                      }}
                    </span>
                    on {{ formatDate(currentSubscription?.scheduledChange?.scheduledChangeDate) }}
                  </template>
                  <template v-else>
                    Renews on {{ formatDate(currentSubscription.stripe.currentPeriodEnd) }}
                  </template>
                </p>
              </div>
              <div class="text-right">
                <div class="text-3xl font-bold">
                  RM {{ currentPlan.price.toFixed(2) }}
                  <span class="text-base font-normal text-muted-foreground">/month</span>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ currentPlan.sessionsPerDay }} sessions/day
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter
            v-if="
              currentSubscription.tier !== 'core' && !currentSubscription.stripe?.cancelAtPeriodEnd
            "
          >
            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button variant="outline" class="text-destructive hover:text-destructive">
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel {{ selectedChild?.name }}'s subscription?
                    <template v-if="currentSubscription.stripe?.stripeSubscriptionId">
                      The subscription will remain active until
                      {{ formatDate(currentSubscription.stripe.currentPeriodEnd) }}, then
                      automatically downgrade to Basic.
                    </template>
                    <template v-else>
                      They will be downgraded to the Basic tier immediately.
                    </template>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-white hover:bg-destructive/90"
                    @click="handleCancel"
                  >
                    Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>

      <!-- Subscription Tiers -->
      <div v-if="currentSubscription">
        <h2 class="mb-4 text-xl font-semibold">Available Plans</h2>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            v-for="plan in subscriptionStore.plans"
            :key="plan.id"
            :class="[
              'relative flex flex-col',
              plan.highlighted && 'border-primary shadow-md',
              currentSubscription.tier === plan.id && 'bg-muted/50',
            ]"
          >
            <!-- Popular Badge -->
            <Badge v-if="plan.highlighted" class="absolute -top-2 left-1/2 -translate-x-1/2">
              Most Popular
            </Badge>

            <CardHeader>
              <div class="flex items-center gap-2">
                <component :is="getTierIcon(plan.id)" class="size-5 text-primary" />
                <CardTitle>{{ plan.name }}</CardTitle>
              </div>
              <CardDescription>
                <span class="text-2xl font-bold text-foreground"
                  >RM {{ plan.price.toFixed(2) }}</span
                >
                <span class="text-muted-foreground">/month</span>
              </CardDescription>
            </CardHeader>

            <CardContent class="flex-1">
              <div class="mb-4">
                <Badge variant="outline"> {{ plan.sessionsPerDay }} sessions/day </Badge>
              </div>
              <ul class="space-y-2">
                <li
                  v-for="(feature, index) in plan.features"
                  :key="index"
                  class="flex items-start gap-2 text-sm"
                >
                  <Check class="mt-0.5 size-4 shrink-0 text-green-500" />
                  <span>{{ feature }}</span>
                </li>
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                v-if="plan.id !== currentSubscription.tier"
                class="w-full"
                :variant="getButtonVariant(plan.id, currentSubscription.tier, plan.highlighted)"
                :disabled="
                  subscriptionStore.isProcessingPayment ||
                  currentSubscription.scheduledChange?.scheduledTier === plan.id
                "
                @click="handlePlanChange(plan.id)"
              >
                <Loader2
                  v-if="subscriptionStore.isProcessingPayment"
                  class="mr-2 size-4 animate-spin"
                />
                {{ getButtonText(plan.id, currentSubscription.tier) }}
              </Button>
              <Button v-else class="w-full" variant="outline" disabled> Current Plan </Button>
            </CardFooter>
          </Card>
        </div>

        <!-- Upgrade/Downgrade Confirmation Dialog -->
        <AlertDialog v-model:open="upgradeDialogOpen">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{
                  getButtonText(pendingUpgradeTier ?? 'core', currentSubscription?.tier ?? 'core')
                }}
                to
                {{ subscriptionStore.plans.find((p) => p.id === pendingUpgradeTier)?.name }}
              </AlertDialogTitle>
              <AlertDialogDescription as="div">
                <!-- Loading preview state -->
                <div v-if="isLoadingPreview" class="flex items-center justify-center py-4">
                  <Loader2 class="mr-2 size-5 animate-spin" />
                  <span>Calculating price...</span>
                </div>

                <!-- Preview error -->
                <div v-else-if="previewError" class="text-destructive">
                  {{ previewError }}
                </div>

                <!-- Upgrade preview with proration details -->
                <template v-else-if="upgradePreview?.isUpgrade">
                  <div class="space-y-4">
                    <p>{{ upgradePreview.message }}</p>

                    <!-- Line items breakdown -->
                    <div
                      v-if="upgradePreview.lineItems && upgradePreview.lineItems.length > 0"
                      class="rounded-lg border p-3"
                    >
                      <p class="mb-2 text-sm font-medium">Price breakdown:</p>
                      <ul class="space-y-1 text-sm">
                        <li
                          v-for="(item, index) in upgradePreview.lineItems"
                          :key="index"
                          class="flex justify-between"
                        >
                          <span :class="{ 'text-muted-foreground': item.proration }">
                            {{ item.description }}
                          </span>
                          <span :class="{ 'text-green-600': item.amount < 0 }">
                            {{ formatCurrency(item.amount) }}
                          </span>
                        </li>
                      </ul>
                      <div class="mt-2 flex justify-between border-t pt-2 font-medium">
                        <span>Total due today</span>
                        <span>
                          {{ formatCurrency(upgradePreview.amountDue ?? 0) }}
                        </span>
                      </div>
                    </div>

                    <p class="text-sm text-muted-foreground">
                      {{ selectedChild?.name }}'s new plan includes
                      {{
                        subscriptionStore.plans.find((p) => p.id === pendingUpgradeTier)
                          ?.sessionsPerDay
                      }}
                      sessions per day.
                    </p>
                  </div>
                </template>

                <!-- Downgrade scheduled for next billing cycle -->
                <template v-else-if="upgradePreview && !upgradePreview.isUpgrade">
                  <div class="space-y-3">
                    <p>{{ upgradePreview.message }}</p>
                    <p class="text-sm text-muted-foreground">
                      Your current plan will remain active until
                      {{ formatDate(upgradePreview.effectiveDate) }}.
                    </p>
                  </div>
                </template>

                <!-- Downgrade to basic -->
                <template v-else-if="pendingUpgradeTier === 'core'">
                  {{ selectedChild?.name }} will be downgraded to the free Basic plan. Their
                  sessions will be limited to
                  {{ subscriptionStore.plans.find((p) => p.id === 'core')?.sessionsPerDay }} per
                  day.
                </template>

                <!-- New subscription (no Stripe subscription yet) -->
                <template
                  v-else-if="!subscriptionStore.hasActiveStripeSubscription(selectedChildId)"
                >
                  You will be redirected to a secure checkout page to complete your payment.
                  {{ selectedChild?.name }}'s new plan includes
                  {{
                    subscriptionStore.plans.find((p) => p.id === pendingUpgradeTier)?.sessionsPerDay
                  }}
                  sessions per day.
                </template>

                <!-- Downgrade with active subscription -->
                <template v-else>
                  {{ selectedChild?.name }} will be downgraded to the
                  {{ subscriptionStore.plans.find((p) => p.id === pendingUpgradeTier)?.name }} plan.
                  The change will take effect at the end of your current billing period.
                </template>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel @click="resetUpgradeState">Cancel</AlertDialogCancel>
              <AlertDialogAction
                :disabled="isLoadingPreview || !!previewError"
                @click="confirmPlanChange"
              >
                <template v-if="upgradePreview?.isUpgrade && upgradePreview.amountDue">
                  Pay {{ formatCurrency(upgradePreview.amountDue) }}
                </template>
                <template v-else> Confirm </template>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <!-- Feature Comparison Note -->
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Plan Features Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4 md:grid-cols-3">
            <div class="rounded-lg border p-4">
              <div class="flex items-center gap-2">
                <Zap class="size-5 text-blue-500" />
                <h3 class="font-semibold">Plus</h3>
              </div>
              <p class="mt-2 text-sm text-muted-foreground">
                More practice sessions per day. Perfect for students who want regular practice
                without limits.
              </p>
            </div>
            <div class="rounded-lg border p-4">
              <div class="flex items-center gap-2">
                <Sparkles class="size-5 text-purple-500" />
                <h3 class="font-semibold">Pro</h3>
              </div>
              <p class="mt-2 text-sm text-muted-foreground">
                View detailed session history including individual questions and answers. Great for
                identifying specific areas to improve.
              </p>
            </div>
            <div class="rounded-lg border p-4">
              <div class="flex items-center gap-2">
                <Crown class="size-5 text-yellow-500" />
                <h3 class="font-semibold">Max</h3>
              </div>
              <p class="mt-2 text-sm text-muted-foreground">
                AI-powered feedback after each session with personalized weakness analysis and
                learning recommendations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
