<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-vue-next'

export interface StatusEntry {
  mood: string | null
  hasPracticed: boolean
}

const props = withDefaults(
  defineProps<{
    statuses: Map<string, StatusEntry>
    isLoading?: boolean
    aspectClass?: string
    emojiClass?: string
  }>(),
  {
    isLoading: false,
    aspectClass: 'aspect-[3/2]',
    emojiClass: 'text-base',
  },
)

const emit = defineEmits<{
  'month-change': [year: number, month: number]
}>()

const currentDate = ref(new Date())

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth() + 1)

const monthName = computed(() =>
  currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
)

const daysInMonth = computed(() => new Date(currentYear.value, currentMonth.value, 0).getDate())
const firstDayOfWeek = computed(() =>
  new Date(currentYear.value, currentMonth.value - 1, 1).getDay(),
)

const calendarDays = computed(() => {
  const days: { day: number | null; date: string | null }[] = []
  for (let i = 0; i < firstDayOfWeek.value; i++) {
    days.push({ day: null, date: null })
  }
  for (let day = 1; day <= daysInMonth.value; day++) {
    const date = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ day, date })
  }
  return days
})

function getStatus(date: string | null): StatusEntry | null {
  if (!date) return null
  return props.statuses.get(date) ?? null
}

function getMoodEmoji(mood: string | null): string {
  if (!mood) return ''
  const moodEmojis: Record<string, string> = { sad: '😢', neutral: '😐', happy: '😊' }
  return moodEmojis[mood] ?? ''
}

function isToday(date: string | null): boolean {
  if (!date) return false
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return date === todayStr
}

function isFuture(date: string | null): boolean {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const parts = date.split('-').map(Number)
  const dateObj = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  return dateObj > today
}

function previousMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() - 1)
  currentDate.value = d
  emit('month-change', currentYear.value, currentMonth.value)
}

function nextMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() + 1)
  currentDate.value = d
  emit('month-change', currentYear.value, currentMonth.value)
}

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Expose year/month so parents can read the initial values
defineExpose({ currentYear, currentMonth })
</script>

<template>
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

  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <Loader2 class="size-6 animate-spin text-muted-foreground" />
  </div>

  <template v-else>
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
        class="relative flex items-center justify-center rounded text-xs"
        :class="[
          aspectClass,
          {
            'bg-green-100 dark:bg-green-950/30':
              cell.day && !isFuture(cell.date) && getStatus(cell.date)?.hasPracticed,
            'bg-muted/50': cell.day && !isFuture(cell.date) && !getStatus(cell.date)?.hasPracticed,
            'text-muted-foreground/30': !cell.day || isFuture(cell.date),
            'ring-1 ring-primary': isToday(cell.date),
          },
        ]"
      >
        <template v-if="cell.day">
          <span v-if="isFuture(cell.date)" class="text-muted-foreground/30">
            {{ cell.day }}
          </span>
          <template v-else>
            <span
              v-if="getStatus(cell.date)?.mood"
              :class="emojiClass"
              :title="`${cell.day}: ${getStatus(cell.date)?.mood}${getStatus(cell.date)?.hasPracticed ? ' (Practiced)' : ''}`"
            >
              {{ getMoodEmoji(getStatus(cell.date)?.mood ?? null) }}
            </span>
            <span
              v-else-if="getStatus(cell.date)?.hasPracticed"
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
  </template>
</template>
