<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Minus, Loader2, Apple, CirclePoundSterling } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  currentCoins: number
  exchangeRate: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  exchange: [amount: number]
}>()

const foodAmount = ref(1)
const isExchanging = ref(false)

const exchangeCost = computed(() => foodAmount.value * props.exchangeRate)
const canAffordExchange = computed(() => props.currentCoins >= exchangeCost.value)

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      foodAmount.value = 1
      isExchanging.value = false
    }
  },
)

function incrementFood(amount = 1) {
  const maxAffordable = Math.floor(props.currentCoins / props.exchangeRate)
  foodAmount.value = Math.min(foodAmount.value + amount, maxAffordable)
}

function decrementFood(amount = 1) {
  foodAmount.value = Math.max(foodAmount.value - amount, 1)
}

function handleExchange() {
  if (!canAffordExchange.value || isExchanging.value) return
  isExchanging.value = true
  emit('exchange', foodAmount.value)
}

function handleDone() {
  isExchanging.value = false
}

defineExpose({ handleDone })
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Buy Food</DialogTitle>
        <DialogDescription>Exchange coins for food to feed your pet.</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <!-- Exchange Rate Info -->
        <div class="rounded-lg bg-muted p-3 text-center text-sm">
          <span class="text-muted-foreground">Exchange Rate: </span>
          <span class="font-semibold">{{ props.exchangeRate }} coins = 1 food</span>
        </div>

        <!-- Amount Selector -->
        <div class="flex items-center justify-center gap-1.5">
          <button
            class="flex size-9 items-center justify-center rounded-full border text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="foodAmount <= 10"
            @click="decrementFood(10)"
          >
            -10
          </button>
          <button
            class="flex size-9 items-center justify-center rounded-full border text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="foodAmount <= 5"
            @click="decrementFood(5)"
          >
            -5
          </button>
          <button
            class="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="foodAmount <= 1"
            @click="decrementFood()"
          >
            <Minus class="size-4" />
          </button>
          <div class="flex min-w-16 flex-col items-center">
            <div class="flex items-center gap-1.5">
              <Apple class="size-5 text-green-600 dark:text-green-400" />
              <span class="text-2xl font-bold">{{ foodAmount }}</span>
            </div>
          </div>
          <button
            class="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="
              !canAffordExchange || props.currentCoins < (foodAmount + 1) * props.exchangeRate
            "
            @click="incrementFood()"
          >
            <Plus class="size-4" />
          </button>
          <button
            class="flex size-9 items-center justify-center rounded-full border text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="
              !canAffordExchange || props.currentCoins < (foodAmount + 5) * props.exchangeRate
            "
            @click="incrementFood(5)"
          >
            +5
          </button>
          <button
            class="flex size-9 items-center justify-center rounded-full border text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="
              !canAffordExchange || props.currentCoins < (foodAmount + 10) * props.exchangeRate
            "
            @click="incrementFood(10)"
          >
            +10
          </button>
        </div>

        <!-- Cost Display -->
        <div class="flex items-center justify-center gap-2 text-lg">
          <span class="text-muted-foreground">Cost:</span>
          <div class="flex items-center gap-1">
            <CirclePoundSterling class="size-5 text-amber-600 dark:text-amber-400" />
            <span class="font-bold" :class="canAffordExchange ? 'text-amber-600' : 'text-red-500'">
              {{ exchangeCost.toLocaleString() }}
            </span>
          </div>
        </div>

        <!-- Current Balance -->
        <div class="text-center text-sm text-muted-foreground">
          Your balance:
          <span class="font-semibold text-amber-600">{{
            props.currentCoins.toLocaleString()
          }}</span>
          coins
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
        <Button
          :disabled="!canAffordExchange || isExchanging"
          class="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600"
          @click="handleExchange"
        >
          <Loader2 v-if="isExchanging" class="mr-2 size-4 animate-spin" />
          Buy Food
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
