<script setup lang="ts">
import { ref, computed } from 'vue'
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
import { Gift } from 'lucide-vue-next'
import PixelCoin from '@/components/icons/PixelCoin.vue'

const dashboardStore = useStudentDashboardStore()
const isOpen = ref(false)
const isSpinning = ref(false)
const reward = ref<number | null>(null)
const rotation = ref(0)

const segments = [1, 2, 3, 4, 5, 1, 2, 3] // 8 segments for the wheel
const segmentAngle = 360 / segments.length

const wheelStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg)`,
  transition: isSpinning.value ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
}))

async function spin() {
  if (isSpinning.value || dashboardStore.hasSpunToday) return

  isSpinning.value = true
  reward.value = null

  // Call async spinWheel
  const result = await dashboardStore.spinWheel()
  const wonReward = result.reward

  if (wonReward === null) {
    isSpinning.value = false
    return
  }

  // Find the segment index for this reward
  const segmentIndex = segments.findIndex((s) => s === wonReward)

  // Calculate final rotation: multiple full spins + landing on correct segment
  const fullSpins = 5 + Math.random() * 3 // 5-8 full rotations
  const targetAngle = segmentIndex * segmentAngle + segmentAngle / 2 // Center of segment
  const targetRotation = 360 - targetAngle // The rotation angle (mod 360) needed to land on target
  const currentAngle = rotation.value % 360 // Current wheel position
  let deltaToTarget = targetRotation - currentAngle
  if (deltaToTarget <= 0) deltaToTarget += 360 // Always rotate forward (clockwise)
  const finalRotation = rotation.value + fullSpins * 360 + deltaToTarget

  rotation.value = finalRotation

  // Show reward after animation
  setTimeout(() => {
    isSpinning.value = false
    reward.value = wonReward
  }, 4000)
}

function closeDialog() {
  isOpen.value = false
  reward.value = null
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Card class="cursor-pointer">
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
                  ? 'border-green-500 bg-green-100'
                  : 'border-yellow-500 bg-yellow-100 animate-pulse'
              "
            >
              <span class="text-2xl">{{ dashboardStore.hasSpunToday ? '✓' : '🎡' }}</span>
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

        <!-- Reward Display -->
        <div v-if="reward !== null" class="animate-bounce text-center">
          <p class="text-lg font-bold text-green-600">Congratulations!</p>
          <div class="mt-2 flex items-center justify-center gap-2">
            <span class="text-2xl font-bold">+{{ reward }}</span>
            <PixelCoin :size="28" />
          </div>
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
