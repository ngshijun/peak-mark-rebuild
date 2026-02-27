<script setup lang="ts">
import { watch } from 'vue'
import confetti from 'canvas-confetti'
import { useAuthStore } from '@/stores/auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Star, Share2, Link } from 'lucide-vue-next'
import { useShare } from '@/composables/useShare'

const authStore = useAuthStore()
const { share, copyLink } = useShare()

function getShareText() {
  if (!authStore.levelUpInfo) return ''
  return `I just reached Level ${authStore.levelUpInfo.newLevel} on Clavis! 🎉 Join me: https://clavis.com.my`
}

function shareLevel() {
  if (!authStore.levelUpInfo) return
  share({ title: 'Clavis Level Up!', text: getShareText() })
}

function copyLevelLink() {
  if (!authStore.levelUpInfo) return
  copyLink(getShareText())
}

// Fire confetti when level-up is detected
watch(
  () => authStore.levelUpInfo,
  (info) => {
    if (info) {
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

function dismiss() {
  authStore.clearLevelUp()
}
</script>

<template>
  <Dialog
    :open="!!authStore.levelUpInfo"
    @update:open="
      (v: boolean) => {
        if (!v) dismiss()
      }
    "
  >
    <DialogContent class="sm:max-w-md text-center">
      <DialogHeader class="pr-0">
        <DialogTitle class="text-center text-xl">Level Up!</DialogTitle>
        <DialogDescription class="text-center"> You reached a new level! </DialogDescription>
      </DialogHeader>

      <div v-if="authStore.levelUpInfo" class="space-y-4 py-2">
        <div class="flex flex-col items-center gap-2">
          <Star class="size-12 text-yellow-500" />
          <p class="text-4xl font-bold">Level {{ authStore.levelUpInfo.newLevel }}</p>
          <p class="text-sm text-muted-foreground">Keep practicing to reach the next level!</p>
        </div>

        <div class="flex items-center gap-2">
          <Button class="flex-1" @click="dismiss"> Awesome! </Button>
          <Button variant="outline" size="icon" @click="copyLevelLink">
            <Link class="size-4" />
          </Button>
          <Button variant="outline" size="icon" @click="shareLevel">
            <Share2 class="size-4" />
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
