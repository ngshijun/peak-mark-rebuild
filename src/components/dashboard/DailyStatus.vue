<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStudentDashboardStore, type MoodType } from '@/stores/studentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Smile } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ variant?: 'button' | 'card' }>(), { variant: 'button' })

const dashboardStore = useStudentDashboardStore()
const isOpen = ref(false)
const isSaving = ref(false)
const showDontShowAgain = ref(false)
const dontShowAgainToday = ref(false)

// LocalStorage key for "don't show again today"
const MOOD_REMINDER_DISMISSED_KEY = 'mood_reminder_dismissed_date'

const moods: { type: MoodType; emoji: string; label: string }[] = [
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'neutral', emoji: '😐', label: 'Neutral' },
  { type: 'happy', emoji: '😊', label: 'Happy' },
]

function getMoodEmoji(mood: MoodType | null | undefined): string {
  if (!mood) return '❓'
  return moods.find((m) => m.type === mood)?.emoji ?? '❓'
}

function getMoodLabel(mood: MoodType | null | undefined): string {
  if (!mood) return 'Not set'
  return moods.find((m) => m.type === mood)?.label ?? 'Unknown'
}

async function selectMood(mood: MoodType) {
  isSaving.value = true
  try {
    await dashboardStore.setMood(mood)

    // If "don't show again" is checked, save to localStorage
    if (dontShowAgainToday.value) {
      localStorage.setItem(MOOD_REMINDER_DISMISSED_KEY, dashboardStore.getTodayString())
    }

    isOpen.value = false
    showDontShowAgain.value = false
    dontShowAgainToday.value = false
  } finally {
    isSaving.value = false
  }
}

// Open dialog programmatically (called from parent)
function openDialog(withDontShowAgain = false) {
  showDontShowAgain.value = withDontShowAgain
  dontShowAgainToday.value = false
  isOpen.value = true
}

// Save "don't show again" preference when dialog is closed (dismissed without selecting mood)
watch(isOpen, (open) => {
  if (!open && dontShowAgainToday.value && showDontShowAgain.value) {
    localStorage.setItem(MOOD_REMINDER_DISMISSED_KEY, dashboardStore.getTodayString())
    showDontShowAgain.value = false
    dontShowAgainToday.value = false
  }
})

// Expose for parent component
defineExpose({
  openDialog,
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <!-- Button variant -->
    <button
      v-if="props.variant === 'button'"
      class="flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 shadow-sm transition-colors hover:bg-accent"
      :class="{ 'animate-glow-border': !dashboardStore.todayStatus?.mood }"
      @click="isOpen = true"
    >
      <span class="text-sm font-medium">Daily Status</span>
      <span class="text-lg">{{ getMoodEmoji(dashboardStore.todayStatus?.mood) }}</span>
    </button>

    <!-- Card variant -->
    <DialogTrigger v-else as-child>
      <Card class="cursor-pointer">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Daily Status</CardTitle>
          <Smile class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <span class="text-4xl">{{ getMoodEmoji(dashboardStore.todayStatus?.mood) }}</span>
            <div>
              <p class="font-medium">{{ getMoodLabel(dashboardStore.todayStatus?.mood) }}</p>
              <p class="text-xs text-muted-foreground">
                {{ dashboardStore.hasMoodToday ? 'Tap to change' : 'Tap to set your mood' }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DialogTrigger>

    <!-- Shared dialog content -->
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>How are you feeling?</DialogTitle>
        <DialogDescription>Select your mood for today</DialogDescription>
      </DialogHeader>
      <div class="flex justify-center gap-6 py-6">
        <Button
          v-for="mood in moods"
          :key="mood.type"
          variant="ghost"
          class="flex h-auto flex-col gap-2 p-4 hover:bg-muted"
          :class="{ 'ring-2 ring-primary': dashboardStore.todayStatus?.mood === mood.type }"
          :disabled="isSaving"
          @click="selectMood(mood.type)"
        >
          <span class="text-5xl">{{ mood.emoji }}</span>
          <span class="text-sm font-medium">{{ mood.label }}</span>
        </Button>
      </div>
      <div v-if="showDontShowAgain" class="flex items-center gap-2 border-t pt-4">
        <Checkbox id="dontShowAgain" v-model="dontShowAgainToday" :disabled="isSaving" />
        <label for="dontShowAgain" class="cursor-pointer select-none text-sm text-muted-foreground">
          Don't show again today
        </label>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
@keyframes glow-border {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(16, 185, 129, 0.2);
    border-color: rgb(167, 243, 208);
  }
  50% {
    box-shadow: 0 0 16px rgba(16, 185, 129, 0.5);
    border-color: rgb(16, 185, 129);
  }
}

.animate-glow-border {
  animation: glow-border 2s ease-in-out infinite;
}
</style>
