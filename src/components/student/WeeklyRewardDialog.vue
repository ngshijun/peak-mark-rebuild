<script setup lang="ts">
import { watch } from 'vue'
import confetti from 'canvas-confetti'
import type { WeeklyReward } from '@/stores/leaderboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trophy, CirclePoundSterling } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  reward: WeeklyReward | null
}>()

const emit = defineEmits<{
  dismiss: []
}>()

function getOrdinalSuffix(rank: number): string {
  if (rank === 1) return 'st'
  if (rank === 2) return 'nd'
  if (rank === 3) return 'rd'
  return 'th'
}

// Fire confetti when dialog opens
watch(
  () => props.open,
  (open) => {
    if (open) {
      const duration = 1500
      const end = Date.now() + duration
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  },
)
</script>

<template>
  <Dialog
    :open="open"
    @update:open="
      (v: boolean) => {
        if (!v) emit('dismiss')
      }
    "
  >
    <DialogContent class="sm:max-w-sm text-center">
      <DialogHeader>
        <DialogTitle class="text-center text-xl">Weekly Leaderboard Results</DialogTitle>
        <DialogDescription class="text-center">
          Last week's competition has ended!
        </DialogDescription>
      </DialogHeader>

      <div v-if="reward" class="space-y-4 py-2">
        <div class="flex flex-col items-center gap-2">
          <Trophy class="size-12 text-yellow-500" />
          <p class="text-2xl font-bold">
            {{ reward.rank }}{{ getOrdinalSuffix(reward.rank) }} Place
          </p>
          <p class="text-sm text-muted-foreground">
            You earned {{ reward.weeklyXp.toLocaleString() }} XP last week
          </p>
        </div>

        <div
          class="flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-4 py-3 dark:bg-amber-950/30"
        >
          <CirclePoundSterling class="size-5 text-amber-600 dark:text-amber-400" />
          <span class="text-lg font-bold text-amber-600 dark:text-amber-400">
            +{{ reward.coinsAwarded }} Coins
          </span>
        </div>

        <Button class="w-full" @click="emit('dismiss')"> Awesome! </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
