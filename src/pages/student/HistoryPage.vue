<script setup lang="ts">
import { computed, ref, watch, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import { usePracticeStore, type DateRangeFilter } from '@/stores/practice'
import { useAuthStore } from '@/stores/auth'
import { ArrowUpDown, Calendar, Loader2 } from 'lucide-vue-next'
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

const selectedDateRange = ref<DateRangeFilter>('alltime')
const selectedSubject = ref<string>(ALL_VALUE)
const selectedTopic = ref<string>(ALL_VALUE)
const selectedSubTopic = ref<string>(ALL_VALUE)

const dateRangeOptions = [
  { value: 'today' as DateRangeFilter, label: 'Today' },
  { value: 'last7days' as DateRangeFilter, label: 'Last 7 Days' },
  { value: 'last30days' as DateRangeFilter, label: 'Last 30 Days' },
  { value: 'alltime' as DateRangeFilter, label: 'All Time' },
]

// Get current student's grade level from profile
// TODO: gradeLevelName needs to be fetched or added to studentProfile
const currentGradeLevel = computed(() => undefined)

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

// Reset topic and sub-topic when subject changes
watch(selectedSubject, () => {
  selectedTopic.value = ALL_VALUE
  selectedSubTopic.value = ALL_VALUE
})

// Reset sub-topic when topic changes
watch(selectedTopic, () => {
  selectedSubTopic.value = ALL_VALUE
})

// Helper to convert ALL_VALUE to undefined for store calls
const subjectFilter = computed(() =>
  selectedSubject.value === ALL_VALUE ? undefined : selectedSubject.value,
)
const topicFilter = computed(() =>
  selectedTopic.value === ALL_VALUE ? undefined : selectedTopic.value,
)
const subTopicFilter = computed(() =>
  selectedSubTopic.value === ALL_VALUE ? undefined : selectedSubTopic.value,
)

// Get available subjects from history (filtered by current grade level)
const availableSubjects = computed(() => {
  return practiceStore.getHistorySubjects(currentGradeLevel.value)
})

// Get available topics (filtered by current grade level and subject)
const availableTopics = computed(() => {
  return practiceStore.getHistoryTopics(currentGradeLevel.value, subjectFilter.value)
})

// Get available sub-topics (filtered by current grade level, subject, and topic)
const availableSubTopics = computed(() => {
  return practiceStore.getHistorySubTopics(
    currentGradeLevel.value,
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
    currentGradeLevel.value, // filter by student's current grade level from profile
    subjectFilter.value,
    topicFilter.value,
    subTopicFilter.value,
    selectedDateRange.value,
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
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      return h(
        Badge,
        {
          variant: status === 'completed' ? 'default' : 'secondary',
        },
        () => (status === 'completed' ? 'Completed' : 'In Progress'),
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
  // Only navigate to result page for completed sessions
  if (row.status === 'completed') {
    router.push(`/student/session/${row.id}`)
  }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Practice History</h1>
      <p class="text-muted-foreground">View your past practice sessions and scores.</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Filters Row -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <!-- Date Range Selector -->
        <Select v-model="selectedDateRange">
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

        <!-- Subject Selector -->
        <Select v-model="selectedSubject">
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
        <Select v-model="selectedTopic" :disabled="selectedSubject === ALL_VALUE">
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
        <Select v-model="selectedSubTopic" :disabled="selectedTopic === ALL_VALUE">
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

      <DataTable :columns="columns" :data="historyData" :on-row-click="handleRowClick" />

      <div v-if="historyData.length === 0" class="py-12 text-center">
        <p class="text-muted-foreground">No practice sessions found for the selected filters.</p>
      </div>
    </template>
  </div>
</template>
