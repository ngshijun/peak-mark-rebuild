<script setup lang="ts">
import { computed } from 'vue'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { usePracticeStore } from '@/stores/practice'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'vue-router'
import { Flame } from 'lucide-vue-next'
import fireGif from '@/assets/icons/fire.gif'
import { toMYTDateString, getMYTDayOfWeek, mytDateToUTCDate, utcDateToString } from '@/lib/date'

const dashboardStore = useStudentDashboardStore()
const practiceStore = usePracticeStore()
const router = useRouter()

function goToPractice() {
  router.push('/student/practice')
}

function getStreakMessage(streak: number, hasPracticedToday: boolean): string {
  if (streak === 0) {
    return hasPracticedToday ? 'Great start! Keep it up!' : 'Start your streak today!'
  }
  if (!hasPracticedToday) {
    return 'Complete a session to keep your streak!'
  }
  if (streak < 3) return 'Good momentum!'
  if (streak < 7) return "You're on fire!"
  if (streak < 14) return 'Amazing dedication!'
  if (streak < 30) return 'Unstoppable!'
  return 'Legendary streak!'
}

// Weekly activity: derived from actual completed sessions (not daily_statuses)
const weekDayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const weeklyActivity = computed(() => {
  // All date logic uses MYT timezone to match server-side daily_statuses
  const todayStr = toMYTDateString()
  const dayOfWeek = getMYTDayOfWeek() // 0=Sun, 1=Mon...
  const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  // Compute Monday of this week in MYT
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const todayUTC = mytDateToUTCDate(todayStr)
  const monday = new Date(todayUTC)
  monday.setUTCDate(todayUTC.getUTCDate() + mondayOffset)

  // Build set of MYT date strings that had completed sessions this week
  const activeDateStrs = new Set<string>()
  const completedSessions = practiceStore.getFilteredHistory().filter((s) => s.completedAt)

  completedSessions.forEach((s) => {
    if (!s.completedAt) return
    // Convert UTC completedAt timestamp to MYT date
    activeDateStrs.add(toMYTDateString(new Date(s.completedAt)))
  })

  // Build the 7-day array
  return weekDayLabels.map((label, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    const dateStr = utcDateToString(d)

    return {
      label,
      active: activeDateStrs.has(dateStr),
      isToday: i === todayIndex,
      isFuture: i > todayIndex,
    }
  })
})
</script>

<template>
  <!-- Warm orange/amber tint - fire/streak association -->
  <Card
    class="cursor-pointer border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 transition-shadow hover:shadow-lg dark:border-orange-900/50 dark:from-orange-950/30 dark:to-amber-950/30"
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
      <!-- Weekly Activity -->
      <div class="mt-8 flex items-center justify-between gap-1">
        <div
          v-for="(day, i) in weeklyActivity"
          :key="i"
          class="flex flex-1 flex-col items-center gap-1"
        >
          <div
            class="size-5 rounded-full border"
            :class="[
              day.active
                ? 'border-orange-400 bg-orange-400 dark:border-orange-500 dark:bg-orange-500'
                : day.isFuture
                  ? 'border-dashed border-gray-300 dark:border-gray-700'
                  : 'border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800',
              day.isToday && !day.active ? 'border-orange-300 dark:border-orange-700' : '',
            ]"
          />
          <span
            class="text-[10px] leading-none"
            :class="
              day.isToday
                ? 'font-bold text-orange-600 dark:text-orange-400'
                : 'text-muted-foreground'
            "
          >
            {{ day.label }}
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
