<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStudentDashboardStore, type MoodType } from '@/stores/student-dashboard'
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
import { useT } from '@/composables/useT'
import {
  isMoodReminderOpen,
  openMoodReminder,
  useMoodReminder,
} from '@/composables/useMoodReminder'

const t = useT()

const props = withDefaults(defineProps<{ variant?: 'button' | 'card' }>(), { variant: 'button' })

const dashboardStore = useStudentDashboardStore()
const { isDismissedToday } = useMoodReminder()
const isSaving = ref(false)

const moods = computed<{ type: MoodType; emoji: string; label: string }[]>(() => [
  { type: 'sad', emoji: '😢', label: t.value.shared.dailyStatus.moodSad },
  { type: 'neutral', emoji: '😐', label: t.value.shared.dailyStatus.moodNeutral },
  { type: 'happy', emoji: '😊', label: t.value.shared.dailyStatus.moodHappy },
])

function getMoodEmoji(mood: MoodType | null | undefined): string {
  if (!mood) return '❓'
  return moods.value.find((m) => m.type === mood)?.emoji ?? '❓'
}

function getMoodLabel(mood: MoodType | null | undefined): string {
  if (!mood) return t.value.shared.dailyStatus.moodNotSet
  return moods.value.find((m) => m.type === mood)?.label ?? t.value.shared.dailyStatus.moodNotSet
}

async function selectMood(mood: MoodType) {
  isSaving.value = true
  try {
    await dashboardStore.setMood(mood)
    isMoodReminderOpen.value = false
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isMoodReminderOpen">
    <!-- Button variant -->
    <button
      v-if="props.variant === 'button'"
      class="flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 shadow-sm transition-colors hover:bg-accent"
      :class="{ 'animate-glow-border': !dashboardStore.todayStatus?.mood }"
      @click="openMoodReminder()"
    >
      <span class="text-sm font-medium">{{ t.shared.dailyStatus.dailyStatusButton }}</span>
      <span class="text-lg">{{ getMoodEmoji(dashboardStore.todayStatus?.mood) }}</span>
    </button>

    <!-- Card variant -->
    <DialogTrigger v-else as-child>
      <Card class="cursor-pointer">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{{ t.shared.dailyStatus.title }}</CardTitle>
          <Smile class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <span class="text-4xl">{{ getMoodEmoji(dashboardStore.todayStatus?.mood) }}</span>
            <div>
              <p class="font-medium">{{ getMoodLabel(dashboardStore.todayStatus?.mood) }}</p>
              <p class="text-xs text-muted-foreground">
                {{
                  dashboardStore.hasMoodToday
                    ? t.shared.dailyStatus.tapToChange
                    : t.shared.dailyStatus.tapToSet
                }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DialogTrigger>

    <!-- Shared dialog content -->
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t.shared.dailyStatus.howAreYouFeeling }}</DialogTitle>
        <DialogDescription>{{ t.shared.dailyStatus.selectMoodToday }}</DialogDescription>
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
      <div v-if="!dashboardStore.hasMoodToday" class="flex items-center gap-2 border-t pt-4">
        <Checkbox id="dontShowAgain" v-model="isDismissedToday" :disabled="isSaving" />
        <label for="dontShowAgain" class="cursor-pointer select-none text-sm text-muted-foreground">
          {{ t.shared.dailyStatus.dontShowAgain }}
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
