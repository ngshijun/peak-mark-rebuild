<script setup lang="ts">
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'vue-router'
import { Flame } from 'lucide-vue-next'
import fireGif from '@/assets/icons/fire.gif'

const dashboardStore = useStudentDashboardStore()
const router = useRouter()

function goToPractice() {
  router.push('/student/practice')
}

function getStreakMessage(streak: number, hasPracticedToday: boolean): string {
  if (streak === 0) {
    return hasPracticedToday ? 'Great start! Keep it up!' : 'Start your streak today!'
  }
  if (!hasPracticedToday) {
    return 'Practice today to keep your streak!'
  }
  if (streak < 3) return 'Good momentum!'
  if (streak < 7) return "You're on fire!"
  if (streak < 14) return 'Amazing dedication!'
  if (streak < 30) return 'Unstoppable!'
  return 'Legendary streak!'
}
</script>

<template>
  <!-- Warm orange/amber tint - fire/streak association -->
  <Card
    class="cursor-pointer border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:border-orange-900/50 dark:from-orange-950/30 dark:to-amber-950/30"
    @click="goToPractice"
  >
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">Practice Streak</CardTitle>
      <Flame class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div class="flex items-center gap-3">
        <div class="flex size-14 items-center justify-center">
          <img v-if="dashboardStore.currentStreak > 0" :src="fireGif" alt="fire" class="size-10" />
          <span v-else class="text-4xl">💤</span>
        </div>
        <div>
          <p class="text-2xl font-bold">
            {{ dashboardStore.currentStreak }}
            <span class="text-sm font-normal text-muted-foreground">days</span>
          </p>
          <p class="text-xs text-muted-foreground">
            {{ getStreakMessage(dashboardStore.currentStreak, dashboardStore.hasPracticedToday) }}
          </p>
        </div>
      </div>
      <!-- Today's status indicator -->
      <div class="mt-2 flex items-center gap-1.5 text-xs">
        <div
          class="size-2 rounded-full"
          :class="dashboardStore.hasPracticedToday ? 'bg-green-500' : 'bg-gray-300'"
        />
        <span
          :class="dashboardStore.hasPracticedToday ? 'text-green-600' : 'text-muted-foreground'"
        >
          {{ dashboardStore.hasPracticedToday ? 'Practiced today' : 'Not yet practiced today' }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
