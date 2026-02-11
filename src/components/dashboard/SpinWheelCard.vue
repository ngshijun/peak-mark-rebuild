<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Gift, CirclePoundSterling } from 'lucide-vue-next'

const dashboardStore = useStudentDashboardStore()
const isOpen = ref(false)
const isSpinning = ref(false)
const rotation = ref(0)
const justSpun = ref(false) // Tracks if user just spun (for animation)

const segments = [5, 10, 15, 5, 10, 15, 5, 10] // 8 segments (multiples of 5)
const segmentAngle = 360 / segments.length

// Single source of truth: derive reward from store
const reward = computed(() => dashboardStore.todayStatus?.spinReward ?? null)

// Calculate rotation needed to point at a specific reward segment
function getRotationForReward(rewardValue: number): number {
  const segmentIndex = segments.findIndex((s) => s === rewardValue)
  if (segmentIndex === -1) return 0
  const targetAngle = segmentIndex * segmentAngle + segmentAngle / 2
  return 360 - targetAngle
}

// Sync rotation with store when data loads (handles page refresh)
watch(
  () => dashboardStore.todayStatus?.spinReward,
  (spinReward) => {
    if (!isSpinning.value && spinReward != null) {
      rotation.value = getRotationForReward(spinReward)
    }
  },
  { immediate: true },
)

const wheelStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg)`,
  transition: isSpinning.value ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
}))

const pendingReward = ref<number | null>(null)
const spinError = ref<string | null>(null)

async function spin() {
  if (isSpinning.value || dashboardStore.hasSpunToday) return

  isSpinning.value = true
  spinError.value = null

  // Generate reward locally before animation starts
  const possibleRewards = [5, 10, 15] as const
  const randomIndex = Math.floor(Math.random() * possibleRewards.length)
  const wonReward = possibleRewards[randomIndex] as number
  pendingReward.value = wonReward

  // Calculate final rotation: multiple full spins + landing on correct segment
  const fullSpins = 5 + Math.floor(Math.random() * 4) // 5, 6, 7, or 8 full rotations
  const targetRotation = getRotationForReward(wonReward)
  const currentAngle = rotation.value % 360
  let deltaToTarget = targetRotation - currentAngle
  if (deltaToTarget <= 0) deltaToTarget += 360 // Always rotate forward (clockwise)
  const finalRotation = rotation.value + fullSpins * 360 + deltaToTarget

  rotation.value = finalRotation

  // Call RPC after animation completes (4 seconds matches CSS transition)
  setTimeout(async () => {
    const result = await dashboardStore.recordSpinReward(wonReward)

    if (result.error) {
      // RPC failed - show error but keep wheel in position
      spinError.value = result.error
      pendingReward.value = null
    }

    isSpinning.value = false
    justSpun.value = true
  }, 4000)
}

function closeDialog() {
  isOpen.value = false
}

// Reset bounce animation state when dialog closes (any method)
watch(isOpen, (open) => {
  if (!open) {
    justSpun.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <!-- Soft green/teal tint - reward/positive association -->
      <Card
        class="cursor-pointer border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-teal-950/30"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Daily Spin</CardTitle>
          <Gift class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <div
              class="flex size-14 items-center justify-center rounded-full border-2"
              :class="
                dashboardStore.hasSpunToday
                  ? 'border-green-500 bg-green-100 dark:bg-green-900'
                  : 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900 animate-pulse'
              "
            >
              <span
                class="text-2xl"
                :class="dashboardStore.hasSpunToday ? 'text-green-700 dark:text-green-400' : ''"
              >
                {{ dashboardStore.hasSpunToday ? '✓' : '🎡' }}
              </span>
            </div>
            <div>
              <p class="font-medium">
                {{ dashboardStore.hasSpunToday ? 'Claimed!' : 'Available!' }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{
                  dashboardStore.hasSpunToday
                    ? `+${dashboardStore.todayStatus?.spinReward ?? 0} coins earned`
                    : 'Tap to spin the wheel'
                }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md" :show-close-button="!isSpinning">
      <DialogHeader>
        <DialogTitle>Daily Spin Wheel</DialogTitle>
        <DialogDescription>
          {{ dashboardStore.hasSpunToday ? "You've already spun today!" : 'Spin to win coins!' }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center gap-6 py-4">
        <!-- Wheel Container -->
        <div class="relative">
          <!-- Arrow pointer -->
          <div
            class="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-2xl"
            style="filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3))"
          >
            ▼
          </div>

          <!-- Wheel -->
          <div
            class="relative size-48 rounded-full border-4 border-amber-600 shadow-lg"
            :style="wheelStyle"
          >
            <svg viewBox="0 0 100 100" class="size-full">
              <g v-for="(value, index) in segments" :key="index">
                <path
                  :d="`M50,50 L${50 + 45 * Math.cos(((index * segmentAngle - 90) * Math.PI) / 180)},${50 + 45 * Math.sin(((index * segmentAngle - 90) * Math.PI) / 180)} A45,45 0 0,1 ${50 + 45 * Math.cos((((index + 1) * segmentAngle - 90) * Math.PI) / 180)},${50 + 45 * Math.sin((((index + 1) * segmentAngle - 90) * Math.PI) / 180)} Z`"
                  :fill="index % 2 === 0 ? '#fbbf24' : '#f59e0b'"
                />
                <text
                  :x="50 + 30 * Math.cos((((index + 0.5) * segmentAngle - 90) * Math.PI) / 180)"
                  :y="50 + 30 * Math.sin((((index + 0.5) * segmentAngle - 90) * Math.PI) / 180)"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="fill-amber-900 text-xs font-bold"
                  style="font-size: 10px"
                >
                  {{ value }}
                </text>
              </g>
              <!-- Center circle -->
              <circle cx="50" cy="50" r="8" fill="#92400e" />
              <circle cx="50" cy="50" r="5" fill="#d97706" />
            </svg>
          </div>
        </div>

        <!-- Reward Display (only shown after wheel stops successfully) -->
        <div
          v-if="reward !== null && !isSpinning && !spinError"
          :class="['text-center', { 'animate-bounce': justSpun }]"
        >
          <p class="text-lg font-bold text-green-600">Congratulations!</p>
          <div class="mt-2 flex items-center justify-center gap-2">
            <span class="text-2xl font-bold">+{{ reward }}</span>
            <CirclePoundSterling class="size-7 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <!-- Error Display (if RPC failed after animation) -->
        <div v-if="spinError && !isSpinning" class="text-center">
          <p class="text-lg font-bold text-red-600">Oops!</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ spinError }}</p>
          <p class="mt-1 text-xs text-muted-foreground">Please try again</p>
        </div>

        <!-- Spin Button -->
        <Button
          v-if="!dashboardStore.hasSpunToday"
          size="lg"
          :disabled="isSpinning"
          class="min-w-32"
          @click="spin"
        >
          {{ isSpinning ? 'Spinning...' : 'SPIN!' }}
        </Button>

        <Button v-else variant="outline" @click="closeDialog"> Come back tomorrow! </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
