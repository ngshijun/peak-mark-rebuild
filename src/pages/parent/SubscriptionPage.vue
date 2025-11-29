<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSubscriptionStore, type SubscriptionTier } from '@/stores/subscription'
import { useChildLinkStore } from '@/stores/child-link'
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
import { Check, Sparkles, Zap, Crown, CreditCard, Users } from 'lucide-vue-next'

const subscriptionStore = useSubscriptionStore()
const childLinkStore = useChildLinkStore()

const selectedChildId = ref<string>(
  childLinkStore.linkedChildren.length > 0 ? (childLinkStore.linkedChildren[0]?.id ?? '') : '',
)

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function handleUpgrade(tier: SubscriptionTier) {
  if (!selectedChildId.value) return
  subscriptionStore.upgradePlan(selectedChildId.value, tier)
}

function handleCancel() {
  if (!selectedChildId.value) return
  subscriptionStore.cancelSubscription(selectedChildId.value)
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
  if (planTier === 'basic') return 'Downgrade'

  const tierOrder: SubscriptionTier[] = ['basic', 'plus', 'pro', 'max']
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
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Subscription</h1>
      <p class="text-muted-foreground">Manage subscriptions for your children</p>
    </div>

    <!-- No Children State -->
    <div v-if="childLinkStore.linkedChildren.length === 0" class="py-16 text-center">
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
                  <Badge v-if="currentSubscription.tier !== 'basic'" variant="default">
                    Active
                  </Badge>
                  <Badge v-else variant="secondary">Free Tier</Badge>
                </div>
                <p class="mt-1 text-sm text-muted-foreground">
                  Started on {{ formatDate(currentSubscription.startDate) }}
                </p>
                <p v-if="currentSubscription.nextBillingDate" class="text-sm text-muted-foreground">
                  Next billing: {{ formatDate(currentSubscription.nextBillingDate) }}
                </p>
              </div>
              <div class="text-right">
                <div class="text-3xl font-bold">
                  ${{ currentPlan.price.toFixed(2) }}
                  <span class="text-base font-normal text-muted-foreground">/month</span>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ currentPlan.sessionsPerDay }} sessions/day
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter v-if="currentSubscription.tier !== 'basic'">
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
                    Are you sure you want to cancel {{ selectedChild?.name }}'s subscription? They
                    will be downgraded to the Basic tier and lose access to premium features.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                <span class="text-2xl font-bold text-foreground">${{ plan.price.toFixed(2) }}</span>
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
              <AlertDialog v-if="plan.id !== currentSubscription.tier">
                <AlertDialogTrigger as-child>
                  <Button
                    class="w-full"
                    :variant="getButtonVariant(plan.id, currentSubscription.tier, plan.highlighted)"
                  >
                    {{ getButtonText(plan.id, currentSubscription.tier) }}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {{ getButtonText(plan.id, currentSubscription.tier) }} to {{ plan.name }}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      <template v-if="plan.price > (currentPlan?.price ?? 0)">
                        You will be charged ${{ plan.price.toFixed(2) }}/month for
                        {{ selectedChild?.name }}. Their new plan includes
                        {{ plan.sessionsPerDay }} sessions per day.
                      </template>
                      <template v-else>
                        {{ selectedChild?.name }} will be downgraded to the {{ plan.name }} plan.
                        Their sessions will be limited to {{ plan.sessionsPerDay }} per day.
                      </template>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="handleUpgrade(plan.id)"> Confirm </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button v-else class="w-full" variant="outline" disabled> Current Plan </Button>
            </CardFooter>
          </Card>
        </div>
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
