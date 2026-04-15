<script setup lang="ts">
import { watch } from 'vue'
import type { WeeklyReward } from '@/stores/leaderboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trophy, CirclePoundSterling, Share2, Link } from 'lucide-vue-next'
import { useShare } from '@/composables/useShare'
import { useT } from '@/composables/useT'

const t = useT()

const props = defineProps<{
  open: boolean
  reward: WeeklyReward | null
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const { share, copyLink } = useShare()

function getShareText() {
  if (!props.reward) return ''
  const rank = props.reward.rank
  const suffix = getOrdinalSuffix(rank)
  return `I placed ${rank}${suffix} in this week's competition on Clavis! 🏆 Join me: https://clavis.com.my`
}

function shareReward() {
  if (!props.reward) return
  share({ title: 'Clavis Weekly Competition', text: getShareText() })
}

function copyRewardLink() {
  if (!props.reward) return
  copyLink(getShareText())
}

function getOrdinalSuffix(rank: number): string {
  if (rank === 1) return 'st'
  if (rank === 2) return 'nd'
  if (rank === 3) return 'rd'
  return 'th'
}

// Fire confetti when dialog opens
watch(
  () => props.open,
  async (open) => {
    if (open) {
      const { default: confetti } = await import('canvas-confetti')
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
    <DialogContent class="sm:max-w-md text-center">
      <DialogHeader class="pr-0">
        <DialogTitle class="text-center text-xl">{{
          t.shared.weeklyRewardDialog.title
        }}</DialogTitle>
        <DialogDescription class="text-center">
          {{ t.shared.weeklyRewardDialog.description }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="reward" class="space-y-4 py-2">
        <div class="flex flex-col items-center gap-2">
          <Trophy class="size-12 text-yellow-500" />
          <p class="text-2xl font-bold">
            {{ t.shared.weeklyRewardDialog.place(reward.rank, getOrdinalSuffix(reward.rank)) }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ t.shared.weeklyRewardDialog.earnedXp(reward.weeklyXp) }}
          </p>
        </div>

        <div
          class="flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-4 py-3 dark:bg-amber-950/30"
        >
          <CirclePoundSterling class="size-5 text-amber-600 dark:text-amber-400" />
          <span class="text-lg font-bold text-amber-600 dark:text-amber-400">
            {{ t.shared.weeklyRewardDialog.coinsAwarded(reward.coinsAwarded) }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <Button class="flex-1" @click="emit('dismiss')">
            {{ t.shared.weeklyRewardDialog.awesome }}
          </Button>
          <Button variant="outline" size="icon" @click="copyRewardLink">
            <Link class="size-4" />
          </Button>
          <Button variant="outline" size="icon" @click="shareReward">
            <Share2 class="size-4" />
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
