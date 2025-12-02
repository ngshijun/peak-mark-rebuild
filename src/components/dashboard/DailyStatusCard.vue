<script setup lang="ts">
import { ref } from 'vue'
import { useStudentDashboardStore, type MoodType } from '@/stores/studentDashboard'
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
import { Smile } from 'lucide-vue-next'

const dashboardStore = useStudentDashboardStore()
const isOpen = ref(false)
const isSaving = ref(false)

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
    isOpen.value = false
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
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
    </DialogContent>
  </Dialog>
</template>
