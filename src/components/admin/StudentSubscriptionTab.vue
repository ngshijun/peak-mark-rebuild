<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard } from 'lucide-vue-next'

import { tierConfig } from '@/lib/tierConfig'
import { formatDate } from '@/lib/date'
import { useT } from '@/composables/useT'

const t = useT()

function getSubscriptionStatusConfig(sub: {
  isActive: boolean
  cancelAtPeriodEnd: boolean
  stripeStatus: string | null
}) {
  if (sub.cancelAtPeriodEnd) {
    return {
      label: t.value.shared.studentSubscriptionTab.statusCancelling,
      bgColor: 'bg-amber-100 dark:bg-amber-950/30',
      color: 'text-amber-700 dark:text-amber-400',
    }
  }
  if (sub.stripeStatus === 'past_due') {
    return {
      label: t.value.shared.studentSubscriptionTab.statusPastDue,
      bgColor: 'bg-red-100 dark:bg-red-950/30',
      color: 'text-red-700 dark:text-red-400',
    }
  }
  if (sub.isActive) {
    return {
      label: t.value.shared.studentSubscriptionTab.statusActive,
      bgColor: 'bg-green-100 dark:bg-green-950/30',
      color: 'text-green-700 dark:text-green-400',
    }
  }
  return {
    label: t.value.shared.studentSubscriptionTab.statusInactive,
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
        {{ t.shared.studentSubscriptionTab.title }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-xs text-muted-foreground">
            {{ t.shared.studentSubscriptionTab.statusLabel }}
          </p>
          <Badge
            variant="secondary"
            :class="`mt-1 ${getSubscriptionStatusConfig(subscription).bgColor} ${getSubscriptionStatusConfig(subscription).color}`"
          >
            {{ getSubscriptionStatusConfig(subscription).label }}
          </Badge>
        </div>

        <div>
          <p class="text-xs text-muted-foreground">
            {{ t.shared.studentSubscriptionTab.tierLabel }}
          </p>
          <Badge
            variant="secondary"
            :class="`mt-1 ${tierConfig[subscription.tier]?.bgColor ?? ''} ${tierConfig[subscription.tier]?.color ?? ''}`"
          >
            {{ tierConfig[subscription.tier]?.label ?? subscription.tier }}
          </Badge>
        </div>

        <div>
          <p class="text-xs text-muted-foreground">
            {{ t.shared.studentSubscriptionTab.startDateLabel }}
          </p>
          <p class="mt-1 font-medium">
            {{ formatDate(subscription.startDate) }}
          </p>
        </div>

        <div>
          <p class="text-xs text-muted-foreground">
            {{ t.shared.studentSubscriptionTab.renewalDateLabel }}
          </p>
          <p class="mt-1 font-medium">
            {{ formatDate(subscription.nextBillingDate) }}
          </p>
        </div>

        <div v-if="subscription.scheduledTier" class="sm:col-span-2">
          <p class="text-xs text-muted-foreground">
            {{ t.shared.studentSubscriptionTab.scheduledTierChange }}
          </p>
          <p class="mt-1 font-medium">
            {{ t.shared.studentSubscriptionTab.changingTo }}
            <Badge variant="secondary" class="mx-1">
              {{ tierConfig[subscription.scheduledTier]?.label ?? subscription.scheduledTier }}
            </Badge>
            {{ t.shared.studentSubscriptionTab.on }}
            {{ formatDate(subscription.scheduledChangeDate) }}
          </p>
        </div>
      </div>

      <!-- Payment History -->
      <div v-if="subscription.paymentHistory.length > 0" class="mt-6">
        <h4 class="mb-3 text-sm font-medium">
          {{ t.shared.studentSubscriptionTab.paymentHistory }}
        </h4>
        <div class="rounded-md border">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/50">
                <th class="px-4 py-2 text-left font-medium">
                  {{ t.shared.studentSubscriptionTab.dateCol }}
                </th>
                <th class="px-4 py-2 text-left font-medium">
                  {{ t.shared.studentSubscriptionTab.amountCol }}
                </th>
                <th class="px-4 py-2 text-left font-medium">
                  {{ t.shared.studentSubscriptionTab.tierCol }}
                </th>
                <th class="px-4 py-2 text-left font-medium">
                  {{ t.shared.studentSubscriptionTab.statusCol }}
                </th>
                <th class="px-4 py-2 text-left font-medium">
                  {{ t.shared.studentSubscriptionTab.descriptionCol }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="payment in subscription.paymentHistory"
                :key="payment.id"
                class="border-b last:border-0"
              >
                <td class="px-4 py-2">{{ formatDate(payment.createdAt) }}</td>
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
