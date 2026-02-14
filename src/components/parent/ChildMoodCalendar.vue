<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  useChildStatisticsStore,
  type ChildDailyStatus,
  type MoodType,
} from '@/stores/child-statistics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next'

const props = defineProps<{
  childId: string
  childName: string
}>()

const childStatisticsStore = useChildStatisticsStore()

const currentDate = ref(new Date())
const dailyStatuses = ref<ChildDailyStatus[]>([])
const isLoading = ref(false)

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth() + 1) // 1-12

const monthName = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// Get days in month
const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 0).getDate()
})

// Get the day of week for the first day of the month (0 = Sunday)
const firstDayOfWeek = computed(() => {
  return new Date(currentYear.value, currentMonth.value - 1, 1).getDay()
})

// Generate calendar days array
const calendarDays = computed(() => {
  const days: { day: number | null; date: string | null }[] = []

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek.value; i++) {
    days.push({ day: null, date: null })
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth.value; day++) {
    const date = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ day, date })
  }

  return days
})

// Create a map of date -> status for quick lookup
const statusMap = computed(() => {
  const map = new Map<string, ChildDailyStatus>()
  dailyStatuses.value.forEach((status) => {
    map.set(status.date, status)
  })
  return map
})

// Get status for a specific date
function getStatusForDate(date: string | null): ChildDailyStatus | null {
  if (!date) return null
  return statusMap.value.get(date) ?? null
}

// Get mood emoji
function getMoodEmoji(mood: MoodType | null): string {
  if (!mood) return ''
  const moodEmojis: Record<MoodType, string> = {
    sad: '😢',
    neutral: '😐',
    happy: '😊',
  }
  return moodEmojis[mood] ?? ''
}

// Check if date is today
function isToday(date: string | null): boolean {
  if (!date) return false
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return date === todayStr
}

// Check if date is in the future
function isFuture(date: string | null): boolean {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Parse date as local time (not UTC) by splitting the string
  const parts = date.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const dateObj = new Date(year, month - 1, day) // month is 0-indexed
  return dateObj > today
}

// Navigate months
function previousMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

function nextMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

// Fetch statuses when month or child changes
async function fetchStatuses() {
  isLoading.value = true
  const { statuses } = await childStatisticsStore.fetchChildDailyStatuses(
    props.childId,
    currentYear.value,
    currentMonth.value,
  )
  dailyStatuses.value = statuses
  isLoading.value = false
}

// Watch for changes in month or child
watch([currentYear, currentMonth, () => props.childId], fetchStatuses)

onMounted(fetchStatuses)

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
</script>

<template>
  <Card class="h-full">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">{{ childName }}'s Daily Status</CardTitle>
      <Calendar class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <!-- Month Navigation -->
      <div class="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" class="size-7" @click="previousMonth">
          <ChevronLeft class="size-4" />
        </Button>
        <span class="text-sm font-medium">{{ monthName }}</span>
        <Button variant="ghost" size="icon" class="size-7" @click="nextMonth">
          <ChevronRight class="size-4" />
        </Button>
      </div>

      <!-- Week Days Header -->
      <div class="mb-1 grid grid-cols-7 gap-1">
        <div
          v-for="day in weekDays"
          :key="day"
          class="text-center text-xs font-medium text-muted-foreground"
        >
          {{ day.charAt(0) }}
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="(cell, index) in calendarDays"
          :key="index"
          class="relative flex aspect-[3/2] items-center justify-center rounded text-xs"
          :class="{
            'bg-green-100 dark:bg-green-950/30':
              cell.day && !isFuture(cell.date) && getStatusForDate(cell.date)?.hasPracticed,
            'bg-muted/50':
              cell.day && !isFuture(cell.date) && !getStatusForDate(cell.date)?.hasPracticed,
            'text-muted-foreground/30': !cell.day || isFuture(cell.date),
            'ring-1 ring-primary': isToday(cell.date),
          }"
        >
          <template v-if="cell.day">
            <span v-if="isFuture(cell.date)" class="text-muted-foreground/30">
              {{ cell.day }}
            </span>
            <template v-else>
              <span
                v-if="getStatusForDate(cell.date)?.mood"
                class="text-base"
                :title="`${cell.day}: ${getStatusForDate(cell.date)?.mood}${getStatusForDate(cell.date)?.hasPracticed ? ' (Practiced)' : ''}`"
              >
                {{ getMoodEmoji(getStatusForDate(cell.date)?.mood ?? null) }}
              </span>
              <span
                v-else-if="getStatusForDate(cell.date)?.hasPracticed"
                class="font-medium text-green-700 dark:text-green-400"
                title="Practiced"
              >
                {{ cell.day }}
              </span>
              <span v-else class="text-muted-foreground">
                {{ cell.day }}
              </span>
            </template>
          </template>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div class="flex items-center gap-1">
          <div class="size-3 rounded bg-green-100 dark:bg-green-950/30" />
          <span>Practiced</span>
        </div>
        <div class="flex items-center gap-1">
          <span>😊</span>
          <span>Happy</span>
        </div>
        <div class="flex items-center gap-1">
          <span>😐</span>
          <span>Neutral</span>
        </div>
        <div class="flex items-center gap-1">
          <span>😢</span>
          <span>Sad</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
