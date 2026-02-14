<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAdminStudentsStore, type MoodEntry } from '@/stores/admin-students'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  studentId: string
}>()

const adminStudentsStore = useAdminStudentsStore()

const calendarDate = ref(new Date())
const calendarStatuses = ref<MoodEntry[]>([])
const isLoading = ref(false)

const calendarYear = computed(() => calendarDate.value.getFullYear())
const calendarMonth = computed(() => calendarDate.value.getMonth() + 1)
const monthName = computed(() =>
  calendarDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
)

const daysInMonth = computed(() => new Date(calendarYear.value, calendarMonth.value, 0).getDate())
const firstDayOfWeek = computed(() =>
  new Date(calendarYear.value, calendarMonth.value - 1, 1).getDay(),
)

const calendarDays = computed(() => {
  const days: { day: number | null; date: string | null }[] = []
  for (let i = 0; i < firstDayOfWeek.value; i++) {
    days.push({ day: null, date: null })
  }
  for (let day = 1; day <= daysInMonth.value; day++) {
    const date = `${calendarYear.value}-${String(calendarMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ day, date })
  }
  return days
})

const statusMap = computed(() => {
  const map = new Map<string, MoodEntry>()
  calendarStatuses.value.forEach((s) => map.set(s.date, s))
  return map
})

function getMoodForDate(date: string | null): MoodEntry | null {
  if (!date) return null
  return statusMap.value.get(date) ?? null
}

function getMoodEmoji(mood: 'sad' | 'neutral' | 'happy' | null): string {
  switch (mood) {
    case 'happy':
      return '😊'
    case 'neutral':
      return '😐'
    case 'sad':
      return '😢'
    default:
      return '—'
  }
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
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() - 1)
  calendarDate.value = d
}

function nextMonth() {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() + 1)
  calendarDate.value = d
}

async function fetchCalendar() {
  if (!props.studentId) return
  isLoading.value = true
  const { statuses } = await adminStudentsStore.fetchStudentDailyStatuses(
    props.studentId,
    calendarYear.value,
    calendarMonth.value,
  )
  calendarStatuses.value = statuses
  isLoading.value = false
}

onMounted(fetchCalendar)
watch([calendarYear, calendarMonth], fetchCalendar)

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Calendar class="size-5" />
        Daily Status
      </CardTitle>
    </CardHeader>
    <CardContent>
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
        <div class="mb-1 grid grid-cols-7 gap-1">
          <div
            v-for="day in weekDays"
            :key="day"
            class="text-center text-xs font-medium text-muted-foreground"
          >
            {{ day.charAt(0) }}
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="(cell, index) in calendarDays"
            :key="index"
            class="relative flex aspect-[2/1] items-center justify-center rounded text-sm"
            :class="{
              'bg-green-100 dark:bg-green-950/30':
                cell.day && !isFuture(cell.date) && getMoodForDate(cell.date)?.hasPracticed,
              'bg-muted/50':
                cell.day && !isFuture(cell.date) && !getMoodForDate(cell.date)?.hasPracticed,
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
                  v-if="getMoodForDate(cell.date)?.mood"
                  class="text-2xl"
                  :title="`${cell.day}: ${getMoodForDate(cell.date)?.mood}${getMoodForDate(cell.date)?.hasPracticed ? ' (Practiced)' : ''}`"
                >
                  {{ getMoodEmoji(getMoodForDate(cell.date)?.mood ?? null) }}
                </span>
                <span
                  v-else-if="getMoodForDate(cell.date)?.hasPracticed"
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
    </CardContent>
  </Card>
</template>
