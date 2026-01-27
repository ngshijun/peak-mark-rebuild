<script setup lang="ts">
import { computed, ref, watch, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import {
  useChildStatisticsStore,
  type ChildPracticeSession,
  type DateRangeFilter,
} from '@/stores/child-statistics'
import { useChildLinkStore } from '@/stores/child-link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'vue-sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Target,
  BookOpen,
  Clock,
  Layers,
  Users,
  ArrowUpDown,
  History,
  Calendar,
  Loader2,
} from 'lucide-vue-next'

// Status config for badge styling
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

const router = useRouter()
const childStatisticsStore = useChildStatisticsStore()
const childLinkStore = useChildLinkStore()

// Fetch data on mount - uses lazy loading (only selected child)
// Note: linkedChildren is preloaded by parentRouteGuard in router/index.ts
onMounted(async () => {
  try {
    // Set selected child from localStorage or default to first child
    if (childLinkStore.linkedChildren.length > 0 && !selectedChildId.value) {
      selectedChildId.value = getInitialChildId()
    }
    // Only load the selected child's statistics (lazy loading)
    if (selectedChildId.value) {
      await childStatisticsStore.fetchChildStatistics(selectedChildId.value)
    }
  } catch {
    toast.error('Failed to load statistics')
  }
})

const ALL_VALUE = '__all__'
const SELECTED_CHILD_KEY = 'parent_selected_child_id'

// Get initial child ID from localStorage or default to first child (user preference - persists across sessions)
function getInitialChildId(): string {
  const savedChildId = localStorage.getItem(SELECTED_CHILD_KEY)
  // Verify saved child is still in linked children list
  if (savedChildId && childLinkStore.linkedChildren.some((c) => c.id === savedChildId)) {
    return savedChildId
  }
  return childLinkStore.linkedChildren[0]?.id ?? ''
}

const selectedChildId = ref<string>(getInitialChildId())

const dateRangeOptions = [
  { value: 'today' as DateRangeFilter, label: 'Today' },
  { value: 'last7days' as DateRangeFilter, label: 'Last 7 Days' },
  { value: 'last30days' as DateRangeFilter, label: 'Last 30 Days' },
  { value: 'alltime' as DateRangeFilter, label: 'All Time' },
]

// Fetch statistics and reset filters when child changes
watch(selectedChildId, async (newChildId) => {
  // Reset all filters when switching children
  childStatisticsStore.resetStatisticsFilters()

  // Persist selected child to localStorage (user preference)
  if (newChildId) {
    localStorage.setItem(SELECTED_CHILD_KEY, newChildId)
    // Lazy load this child's statistics if not already loaded
    await childStatisticsStore.fetchChildStatistics(newChildId)
  }
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  childStatisticsStore.statisticsFilters.gradeLevel === ALL_VALUE
    ? undefined
    : childStatisticsStore.statisticsFilters.gradeLevel,
)
const subjectFilter = computed(() =>
  childStatisticsStore.statisticsFilters.subject === ALL_VALUE
    ? undefined
    : childStatisticsStore.statisticsFilters.subject,
)
const topicFilter = computed(() =>
  childStatisticsStore.statisticsFilters.topic === ALL_VALUE
    ? undefined
    : childStatisticsStore.statisticsFilters.topic,
)
const subTopicFilter = computed(() =>
  childStatisticsStore.statisticsFilters.subTopic === ALL_VALUE
    ? undefined
    : childStatisticsStore.statisticsFilters.subTopic,
)

// Get available grade levels for selected child
const availableGradeLevels = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getGradeLevels(selectedChildId.value)
})

// Get available subjects for selected child (filtered by grade level)
const availableSubjects = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getSubjects(selectedChildId.value, gradeLevelFilter.value)
})

// Get available topics for selected child (filtered by grade level and subject)
const availableTopics = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getTopics(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
  )
})

// Get available sub-topics for selected child (filtered by grade level, subject, and topic)
const availableSubTopics = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getSubTopics(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
  )
})

// Get filtered sessions once (memoized) - avoids calling getFilteredSessions multiple times
const filteredSessions = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getFilteredSessions(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    subTopicFilter.value,
    childStatisticsStore.statisticsFilters.dateRange,
  )
})

// Get only completed sessions for statistics
const completedSessions = computed(() =>
  filteredSessions.value.filter((s) => s.status === 'completed'),
)

// Derive all metrics from completed sessions only
const averageScore = computed(() => {
  const sessions = completedSessions.value
  if (sessions.length === 0) return 0
  const totalScore = sessions.reduce((sum, s) => sum + (s.score ?? 0), 0)
  return Math.round(totalScore / sessions.length)
})

const totalSessions = computed(() => completedSessions.value.length)

const totalStudyTime = computed(() => {
  return completedSessions.value.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)
})

const subTopicsPracticed = computed(() => {
  const sessions = completedSessions.value
  const subTopicMap = new Map<
    string,
    { subTopicName: string; topicName: string; subjectName: string; count: number }
  >()
  for (const s of sessions) {
    const key = `${s.subjectName}-${s.topicName}-${s.subTopicName}`
    const existing = subTopicMap.get(key)
    if (existing) {
      existing.count++
    } else {
      subTopicMap.set(key, {
        subTopicName: s.subTopicName,
        topicName: s.topicName,
        subjectName: s.subjectName,
        count: 1,
      })
    }
  }
  return Array.from(subTopicMap.values()).sort((a, b) => b.count - a.count)
})

// Get recent sessions for table (sorted by date descending)
const recentSessions = computed(() => {
  return [...filteredSessions.value].sort((a, b) => {
    const dateA = new Date(a.completedAt ?? a.createdAt).getTime()
    const dateB = new Date(b.completedAt ?? b.createdAt).getTime()
    return dateB - dateA
  })
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

// Column definitions for recent sessions table
const columns: ColumnDef<ChildPracticeSession>[] = [
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
      const dateStr = row.original.completedAt ?? row.original.createdAt
      return h('div', { class: 'text-sm' }, formatDate(dateStr))
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
    accessorKey: 'durationSeconds',
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
      const seconds = row.original.durationSeconds
      if (seconds == null) {
        return h('div', { class: 'text-muted-foreground' }, '-')
      }
      return h('div', {}, formatDuration(seconds))
    },
  },
]

function handleRowClick(row: ChildPracticeSession) {
  // Only navigate to result page for completed sessions
  if (row.status === 'completed') {
    router.push(`/parent/session/${selectedChildId.value}/${row.id}`)
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Statistics</h1>
      <p class="text-muted-foreground">View your children's learning progress</p>
    </div>

    <!-- Loading State -->
    <div v-if="childStatisticsStore.isLoading" class="flex items-center justify-center py-16">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- No Children State -->
    <div v-else-if="childLinkStore.linkedChildren.length === 0" class="py-16 text-center">
      <Users class="mx-auto size-16 text-muted-foreground/50" />
      <h2 class="mt-4 text-lg font-semibold">No Linked Children</h2>
      <p class="mt-2 text-muted-foreground">
        Link a child to view their statistics. Go to the Children page to send an invitation.
      </p>
    </div>

    <!-- Statistics Content -->
    <template v-else>
      <!-- Filters Row -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Child Selector (persisted in localStorage - user preference) -->
        <Select v-model="selectedChildId">
          <SelectTrigger class="w-[150px]">
            <SelectValue placeholder="Select child" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="child in childLinkStore.linkedChildren"
              :key="child.id"
              :value="child.id"
            >
              {{ child.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Date Range Selector -->
        <Select
          :model-value="childStatisticsStore.statisticsFilters.dateRange"
          @update:model-value="
            childStatisticsStore.setStatisticsDateRange($event as DateRangeFilter)
          "
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
          :model-value="childStatisticsStore.statisticsFilters.gradeLevel"
          @update:model-value="childStatisticsStore.setStatisticsGradeLevel($event as string)"
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
          :model-value="childStatisticsStore.statisticsFilters.subject"
          :disabled="childStatisticsStore.statisticsFilters.gradeLevel === ALL_VALUE"
          @update:model-value="childStatisticsStore.setStatisticsSubject($event as string)"
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
          :model-value="childStatisticsStore.statisticsFilters.topic"
          :disabled="childStatisticsStore.statisticsFilters.subject === ALL_VALUE"
          @update:model-value="childStatisticsStore.setStatisticsTopic($event as string)"
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
          :model-value="childStatisticsStore.statisticsFilters.subTopic"
          :disabled="childStatisticsStore.statisticsFilters.topic === ALL_VALUE"
          @update:model-value="childStatisticsStore.setStatisticsSubTopic($event as string)"
        >
          <SelectTrigger class="w-[150px]">
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
      <div v-if="selectedChildId" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle class="text-sm font-medium">Practice Sessions</CardTitle>
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
            <div class="text-3xl font-bold">{{ subTopicsPracticed.length }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Practice History Table -->
      <Card v-if="selectedChildId">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <History class="size-5" />
            Practice History
          </CardTitle>
          <CardDescription>View your child's past practice sessions and scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            v-if="recentSessions.length > 0"
            :columns="columns"
            :data="recentSessions"
            :on-row-click="handleRowClick"
            :page-index="childStatisticsStore.statisticsPagination.pageIndex"
            :page-size="childStatisticsStore.statisticsPagination.pageSize"
            :on-page-index-change="childStatisticsStore.setStatisticsPageIndex"
            :on-page-size-change="childStatisticsStore.setStatisticsPageSize"
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
