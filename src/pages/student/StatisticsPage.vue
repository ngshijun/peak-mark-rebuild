<script setup lang="ts">
import { computed, ref, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import { usePracticeStore, type DateRangeFilter } from '@/stores/practice'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowUpDown,
  Calendar,
  Loader2,
  Target,
  BookOpen,
  Clock,
  Layers,
  History,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const router = useRouter()
const practiceStore = usePracticeStore()
const authStore = useAuthStore()

const ALL_VALUE = '__all__'

// Status config for badge styling (matching admin announcement pattern)
const statusConfig = {
  completed: {
    label: 'Completed',
    bgColor: 'bg-green-100 dark:bg-green-950/30',
    color: 'text-green-700 dark:text-green-400',
  },
  in_progress: {
    label: 'In Progress',
    bgColor: 'bg-amber-100 dark:bg-amber-950/30',
    color: 'text-amber-700 dark:text-amber-400',
  },
} as const

const dateRangeOptions = [
  { value: 'today' as DateRangeFilter, label: 'Today' },
  { value: 'last7days' as DateRangeFilter, label: 'Last 7 Days' },
  { value: 'last30days' as DateRangeFilter, label: 'Last 30 Days' },
  { value: 'alltime' as DateRangeFilter, label: 'All Time' },
]

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  practiceStore.historyFilters.gradeLevel === ALL_VALUE
    ? undefined
    : practiceStore.historyFilters.gradeLevel,
)

const isLoading = ref(true)

// Fetch session history on mount
onMounted(async () => {
  try {
    await practiceStore.fetchSessionHistory()
  } catch {
    toast.error('Failed to load practice history')
  } finally {
    isLoading.value = false
  }
})

const subjectFilter = computed(() =>
  practiceStore.historyFilters.subject === ALL_VALUE
    ? undefined
    : practiceStore.historyFilters.subject,
)
const topicFilter = computed(() =>
  practiceStore.historyFilters.topic === ALL_VALUE ? undefined : practiceStore.historyFilters.topic,
)
const subTopicFilter = computed(() =>
  practiceStore.historyFilters.subTopic === ALL_VALUE
    ? undefined
    : practiceStore.historyFilters.subTopic,
)

// Get available grade levels from history
const availableGradeLevels = computed(() => {
  return practiceStore.getHistoryGradeLevels()
})

// Get available subjects from history (filtered by grade level)
const availableSubjects = computed(() => {
  return practiceStore.getHistorySubjects(gradeLevelFilter.value)
})

// Get available topics (filtered by grade level and subject)
const availableTopics = computed(() => {
  return practiceStore.getHistoryTopics(gradeLevelFilter.value, subjectFilter.value)
})

// Get available sub-topics (filtered by grade level, subject, and topic)
const availableSubTopics = computed(() => {
  return practiceStore.getHistorySubTopics(
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
  )
})

// Helper type for table row
interface HistoryRow {
  id: string
  createdAt: string
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
  status: 'completed' | 'in_progress'
  score: number | null
  totalQuestions: number
  correctAnswers: number
  timeUsedSeconds: number | null
}

// Transform session data for table with filters applied
const historyData = computed<HistoryRow[]>(() => {
  const filteredSessions = practiceStore.getFilteredHistory(
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    subTopicFilter.value,
    practiceStore.historyFilters.dateRange,
  )

  return filteredSessions.map((session) => {
    const isCompleted = !!session.completedAt
    // Use correctCount and totalQuestions from session data (stored in DB)
    // instead of answers array which is not loaded in history fetch
    const correctAnswers = session.correctCount
    const totalQuestions = session.totalQuestions
    const score =
      isCompleted && totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : null

    // Use totalTimeSeconds from session (sum of time spent on each question)
    // This accurately tracks actual time spent, even if student left and came back
    const timeUsedSeconds = isCompleted ? session.totalTimeSeconds : null

    return {
      id: session.id,
      createdAt: session.createdAt ?? new Date().toISOString(),
      gradeLevelName: session.gradeLevelName,
      subjectName: session.subjectName,
      topicName: session.topicName,
      subTopicName: session.subTopicName,
      status: isCompleted ? 'completed' : 'in_progress',
      score,
      totalQuestions,
      correctAnswers,
      timeUsedSeconds,
    }
  })
})

// Statistics computed values (only from completed sessions)
const completedSessions = computed(() => historyData.value.filter((s) => s.status === 'completed'))

const averageScore = computed(() => {
  const sessions = completedSessions.value
  if (sessions.length === 0) return 0
  const totalScore = sessions.reduce((sum, s) => sum + (s.score ?? 0), 0)
  return Math.round(totalScore / sessions.length)
})

const totalSessions = computed(() => completedSessions.value.length)

const totalStudyTime = computed(() => {
  return completedSessions.value.reduce((sum, s) => sum + (s.timeUsedSeconds ?? 0), 0)
})

const subTopicsPracticed = computed(() => {
  const sessions = completedSessions.value
  const subTopicSet = new Set<string>()
  for (const s of sessions) {
    subTopicSet.add(`${s.subjectName}-${s.topicName}-${s.subTopicName}`)
  }
  return subTopicSet.size
})

function formatStudyTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours} hr`
  }
  return `${hours} hr ${remainingMinutes} min`
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format time duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

// Column definitions
const columns: ColumnDef<HistoryRow>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Time', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'text-sm' }, formatDate(row.original.createdAt))
    },
  },
  {
    accessorKey: 'subjectName',
    header: 'Subject',
    cell: ({ row }) => {
      return h('div', { class: 'font-medium' }, row.original.subjectName)
    },
  },
  {
    accessorKey: 'topicName',
    header: 'Topic',
    cell: ({ row }) => {
      return h('div', {}, row.original.topicName)
    },
  },
  {
    accessorKey: 'subTopicName',
    header: 'Sub-Topic',
    cell: ({ row }) => {
      return h('div', {}, row.original.subTopicName)
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Status', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const status = row.original.status
      const config = statusConfig[status]
      return h(
        Badge,
        {
          variant: 'secondary',
          class: `${config.bgColor} ${config.color}`,
        },
        () => config.label,
      )
    },
  },
  {
    accessorKey: 'score',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Score', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const score = row.original.score
      const correct = row.original.correctAnswers
      const total = row.original.totalQuestions

      if (score === null) {
        return h('div', { class: 'text-muted-foreground' }, '-')
      }

      const colorClass =
        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'

      return h('div', { class: colorClass }, `${score}% (${correct}/${total})`)
    },
  },
  {
    accessorKey: 'timeUsedSeconds',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Time Used', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const seconds = row.original.timeUsedSeconds
      if (seconds === null) {
        return h('div', { class: 'text-muted-foreground' }, '-')
      }
      return h('div', {}, formatDuration(seconds))
    },
  },
]

function handleRowClick(row: HistoryRow) {
  if (row.status === 'completed') {
    // Navigate to result page for completed sessions
    router.push(`/student/session/${row.id}`)
  } else {
    // Resume in-progress sessions
    router.push({ path: '/student/practice/quiz', query: { sessionId: row.id } })
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold">Statistics</h1>
      <p class="text-muted-foreground">View your learning progress and practice history.</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Filters Row -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Date Range Selector -->
        <Select
          :model-value="practiceStore.historyFilters.dateRange"
          @update:model-value="practiceStore.setHistoryDateRange($event as DateRangeFilter)"
        >
          <SelectTrigger class="w-[140px]">
            <Calendar class="mr-2 size-4" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in dateRangeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Grade Level Selector -->
        <Select
          :model-value="practiceStore.historyFilters.gradeLevel"
          @update:model-value="practiceStore.setHistoryGradeLevel($event as string)"
        >
          <SelectTrigger class="w-[130px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Grades</SelectItem>
            <SelectItem v-for="grade in availableGradeLevels" :key="grade" :value="grade">
              {{ grade }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Subject Selector -->
        <Select
          :model-value="practiceStore.historyFilters.subject"
          :disabled="practiceStore.historyFilters.gradeLevel === ALL_VALUE"
          @update:model-value="practiceStore.setHistorySubject($event as string)"
        >
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Subjects</SelectItem>
            <SelectItem v-for="subject in availableSubjects" :key="subject" :value="subject">
              {{ subject }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Topic Selector -->
        <Select
          :model-value="practiceStore.historyFilters.topic"
          :disabled="practiceStore.historyFilters.subject === ALL_VALUE"
          @update:model-value="practiceStore.setHistoryTopic($event as string)"
        >
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All Topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Topics</SelectItem>
            <SelectItem v-for="topic in availableTopics" :key="topic" :value="topic">
              {{ topic }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Sub-Topic Selector -->
        <Select
          :model-value="practiceStore.historyFilters.subTopic"
          :disabled="practiceStore.historyFilters.topic === ALL_VALUE"
          @update:model-value="practiceStore.setHistorySubTopic($event as string)"
        >
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All Sub-Topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Sub-Topics</SelectItem>
            <SelectItem v-for="subTopic in availableSubTopics" :key="subTopic" :value="subTopic">
              {{ subTopic }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Statistics Cards -->
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- Average Score Card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Average Score</CardTitle>
            <Target class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ averageScore }}%</div>
          </CardContent>
        </Card>

        <!-- Total Sessions Card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Sessions Completed</CardTitle>
            <BookOpen class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ totalSessions }}</div>
          </CardContent>
        </Card>

        <!-- Study Time Card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Study Time</CardTitle>
            <Clock class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ formatStudyTime(totalStudyTime) }}</div>
          </CardContent>
        </Card>

        <!-- Sub-Topics Practiced Card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Sub-Topics Practiced</CardTitle>
            <Layers class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ subTopicsPracticed }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Practice History Table -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <History class="size-5" />
            Practice History
          </CardTitle>
          <CardDescription>View your past practice sessions and scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            v-if="historyData.length > 0"
            :columns="columns"
            :data="historyData"
            :on-row-click="handleRowClick"
            :page-index="practiceStore.historyPagination.pageIndex"
            :page-size="practiceStore.historyPagination.pageSize"
            :on-page-index-change="practiceStore.setHistoryPageIndex"
            :on-page-size-change="practiceStore.setHistoryPageSize"
          />
          <div v-else class="py-12 text-center">
            <BookOpen class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-muted-foreground">
              No practice sessions found for the selected filters.
            </p>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
