<script setup lang="ts">
import type { SubscriptionTier, SubscriptionPlan, UpgradePreview } from '@/stores/subscription'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-vue-next'
import { formatLongDate } from '@/lib/date'

const props = defineProps<{
  open: boolean
  pendingTier: SubscriptionTier | null
  currentTier: SubscriptionTier
  preview: UpgradePreview | null
  isLoading: boolean
  error: string | null
  childName: string
  pendingPlan: SubscriptionPlan | undefined
  hasActiveStripeSubscription: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

function getActionLabel() {
  const tierOrder: SubscriptionTier[] = ['core', 'plus', 'pro']
  const planIndex = props.pendingTier ? tierOrder.indexOf(props.pendingTier) : -1
  const currentIndex = tierOrder.indexOf(props.currentTier)

  if (props.pendingTier === 'core') return 'Downgrade'
  return planIndex > currentIndex ? 'Upgrade' : 'Downgrade'
}

function formatCurrency(amount: number) {
  return `RM ${(amount / 100).toFixed(2)}`
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle> {{ getActionLabel() }} to {{ pendingPlan?.name }} </AlertDialogTitle>
        <AlertDialogDescription as="div">
          <!-- Loading preview state -->
          <div v-if="isLoading" class="flex items-center justify-center py-4">
            <Loader2 class="mr-2 size-5 animate-spin" />
            <span>Calculating price...</span>
          </div>

          <!-- Preview error -->
          <div v-else-if="error" class="text-destructive">
            {{ error }}
          </div>

          <!-- Upgrade preview with proration details -->
          <template v-else-if="preview?.isUpgrade">
            <div class="space-y-4">
              <p>{{ preview.message }}</p>

              <!-- Line items breakdown -->
              <div
                v-if="preview.lineItems && preview.lineItems.length > 0"
                class="rounded-lg border p-3"
              >
                <p class="mb-2 text-sm font-medium">Price breakdown:</p>
                <ul class="space-y-1 text-sm">
                  <li
                    v-for="(item, index) in preview.lineItems"
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
                    {{ formatCurrency(preview.amountDue ?? 0) }}
                  </span>
                </div>
              </div>

              <p class="text-sm text-muted-foreground">
                {{ childName }}'s new plan includes
                {{ pendingPlan?.sessionsPerDay }}
                sessions per day.
              </p>
            </div>
          </template>

          <!-- Downgrade scheduled for next billing cycle -->
          <template v-else-if="preview && !preview.isUpgrade">
            <div class="space-y-3">
              <p>{{ preview.message }}</p>
              <p class="text-sm text-muted-foreground">
                Your current plan will remain active until
                {{ formatLongDate(preview.effectiveDate) }}.
              </p>
            </div>
          </template>

          <!-- Downgrade to basic -->
          <template v-else-if="pendingTier === 'core'">
            {{ childName }} will be downgraded to the free Basic plan. Their sessions will be
            limited to {{ pendingPlan?.sessionsPerDay }} per day.
          </template>

          <!-- New subscription (no Stripe subscription yet) -->
          <template v-else-if="!hasActiveStripeSubscription">
            You will be redirected to a secure checkout page to complete your payment.
            {{ childName }}'s new plan includes
            {{ pendingPlan?.sessionsPerDay }}
            sessions per day.
          </template>

          <!-- Downgrade with active subscription -->
          <template v-else>
            {{ childName }} will be downgraded to the {{ pendingPlan?.name }} plan. The change will
            take effect at the end of your current billing period.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="emit('cancel')">Cancel</AlertDialogCancel>
        <AlertDialogAction :disabled="isLoading || !!error" @click="emit('confirm')">
          <template v-if="preview?.isUpgrade && preview.amountDue">
            Pay {{ formatCurrency(preview.amountDue) }}
          </template>
          <template v-else> Confirm </template>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
