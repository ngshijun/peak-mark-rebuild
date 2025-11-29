<script setup lang="ts">
import { ref } from 'vue'
import { useStudentDashboardStore, type MoodType } from '@/stores/studentDashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const dashboardStore = useStudentDashboardStore()
const isOpen = ref(false)

const moods: { type: MoodType; emoji: string; label: string }[] = [
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'neutral', emoji: '😐', label: 'Neutral' },
  { type: 'happy', emoji: '😊', label: 'Happy' },
]

function getMoodEmoji(mood: MoodType | undefined): string {
  if (!mood) return '❓'
  return moods.find((m) => m.type === mood)?.emoji ?? '❓'
}

function getMoodLabel(mood: MoodType | undefined): string {
  if (!mood) return 'Not set'
  return moods.find((m) => m.type === mood)?.label ?? 'Unknown'
}

function selectMood(mood: MoodType) {
  dashboardStore.setMood(mood)
  isOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Card class="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Daily Status</CardTitle>
          <CardDescription>How are you feeling today?</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <span class="text-4xl">{{ getMoodEmoji(dashboardStore.todayStatus.mood) }}</span>
            <div>
              <p class="font-medium">{{ getMoodLabel(dashboardStore.todayStatus.mood) }}</p>
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
          :class="{ 'ring-2 ring-primary': dashboardStore.todayStatus.mood === mood.type }"
          @click="selectMood(mood.type)"
        >
          <span class="text-5xl">{{ mood.emoji }}</span>
          <span class="text-sm font-medium">{{ mood.label }}</span>
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
