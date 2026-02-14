<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard } from 'lucide-vue-next'

import { tierConfig } from '@/lib/tierConfig'

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getSubscriptionStatusConfig(sub: {
  isActive: boolean
  cancelAtPeriodEnd: boolean
  stripeStatus: string | null
}) {
  if (sub.cancelAtPeriodEnd) {
    return {
      label: 'Cancelling',
      bgColor: 'bg-amber-100 dark:bg-amber-950/30',
      color: 'text-amber-700 dark:text-amber-400',
    }
  }
  if (sub.stripeStatus === 'past_due') {
    return {
      label: 'Past Due',
      bgColor: 'bg-red-100 dark:bg-red-950/30',
      color: 'text-red-700 dark:text-red-400',
    }
  }
  if (sub.isActive) {
    return {
      label: 'Active',
      bgColor: 'bg-green-100 dark:bg-green-950/30',
      color: 'text-green-700 dark:text-green-400',
    }
  }
  return {
    label: 'Inactive',
    bgColor: 'bg-gray-100 dark:bg-gray-950/30',
    color: 'text-gray-700 dark:text-gray-400',
  }
}

defineProps<{
  subscription: {
    isActive: boolean
    cancelAtPeriodEnd: boolean
    stripeStatus: string | null
    tier: string
    startDate: string | null
    nextBillingDate: string | null
    scheduledTier: string | null
    scheduledChangeDate: string | null
    paymentHistory: Array<{
      id: string
      createdAt: string
      amountCents: number
      currency: string
      tier: string | null
      status: string
      description: string | null
    }>
  }
}>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <CreditCard class="size-5" />
        Subscription Details
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-xs text-muted-foreground">Status</p>
          <Badge
            variant="secondary"
            :class="`mt-1 ${getSubscriptionStatusConfig(subscription).bgColor} ${getSubscriptionStatusConfig(subscription).color}`"
          >
            {{ getSubscriptionStatusConfig(subscription).label }}
          </Badge>
        </div>

        <div>
          <p class="text-xs text-muted-foreground">Tier</p>
          <Badge
            variant="secondary"
            :class="`mt-1 ${tierConfig[subscription.tier]?.bgColor ?? ''} ${tierConfig[subscription.tier]?.color ?? ''}`"
          >
            {{ tierConfig[subscription.tier]?.label ?? subscription.tier }}
          </Badge>
        </div>

        <div>
          <p class="text-xs text-muted-foreground">Start Date</p>
          <p class="mt-1 font-medium">
            {{ formatShortDate(subscription.startDate) }}
          </p>
        </div>

        <div>
          <p class="text-xs text-muted-foreground">Renewal Date</p>
          <p class="mt-1 font-medium">
            {{ formatShortDate(subscription.nextBillingDate) }}
          </p>
        </div>

        <div v-if="subscription.scheduledTier" class="sm:col-span-2">
          <p class="text-xs text-muted-foreground">Scheduled Tier Change</p>
          <p class="mt-1 font-medium">
            Changing to
            <Badge variant="secondary" class="mx-1">
              {{ tierConfig[subscription.scheduledTier]?.label ?? subscription.scheduledTier }}
            </Badge>
            on {{ formatShortDate(subscription.scheduledChangeDate) }}
          </p>
        </div>
      </div>

      <!-- Payment History -->
      <div v-if="subscription.paymentHistory.length > 0" class="mt-6">
        <h4 class="mb-3 text-sm font-medium">Payment History</h4>
        <div class="rounded-md border">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/50">
                <th class="px-4 py-2 text-left font-medium">Date</th>
                <th class="px-4 py-2 text-left font-medium">Amount</th>
                <th class="px-4 py-2 text-left font-medium">Tier</th>
                <th class="px-4 py-2 text-left font-medium">Status</th>
                <th class="px-4 py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="payment in subscription.paymentHistory"
                :key="payment.id"
                class="border-b last:border-0"
              >
                <td class="px-4 py-2">{{ formatShortDate(payment.createdAt) }}</td>
                <td class="px-4 py-2 font-medium">
                  {{ (payment.amountCents / 100).toFixed(2) }}
                  {{ payment.currency.toUpperCase() }}
                </td>
                <td class="px-4 py-2">
                  <Badge
                    v-if="payment.tier"
                    variant="secondary"
                    :class="`${tierConfig[payment.tier]?.bgColor ?? ''} ${tierConfig[payment.tier]?.color ?? ''}`"
                  >
                    {{ tierConfig[payment.tier]?.label ?? payment.tier }}
                  </Badge>
                  <span v-else class="text-muted-foreground">-</span>
                </td>
                <td class="px-4 py-2">
                  <Badge
                    variant="secondary"
                    :class="
                      payment.status === 'succeeded'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    "
                  >
                    {{ payment.status }}
                  </Badge>
                </td>
                <td class="px-4 py-2 text-muted-foreground">
                  {{ payment.description ?? '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
