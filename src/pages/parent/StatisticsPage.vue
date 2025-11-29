<script setup lang="ts">
import { computed, ref, watch, h } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import {
  useChildStatisticsStore,
  type ChildPracticeSession,
  type DateRangeFilter,
} from '@/stores/child-statistics'
import { useChildLinkStore } from '@/stores/child-link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import {
  Target,
  BookOpen,
  Clock,
  Layers,
  Users,
  ArrowUpDown,
  History,
  Calendar,
} from 'lucide-vue-next'

const router = useRouter()
const childStatisticsStore = useChildStatisticsStore()
const childLinkStore = useChildLinkStore()

const ALL_VALUE = '__all__'

const selectedChildId = ref<string>(
  childLinkStore.linkedChildren.length > 0 ? (childLinkStore.linkedChildren[0]?.id ?? '') : '',
)
const selectedDateRange = ref<DateRangeFilter>('today')
const selectedGradeLevel = ref<string>(ALL_VALUE)
const selectedSubject = ref<string>(ALL_VALUE)
const selectedTopic = ref<string>(ALL_VALUE)

const dateRangeOptions = [
  { value: 'today' as DateRangeFilter, label: 'Today' },
  { value: 'last7days' as DateRangeFilter, label: 'Last 7 Days' },
  { value: 'last30days' as DateRangeFilter, label: 'Last 30 Days' },
  { value: 'alltime' as DateRangeFilter, label: 'All Time' },
]

// Reset filters when child changes
watch(selectedChildId, () => {
  selectedDateRange.value = 'today'
  selectedGradeLevel.value = ALL_VALUE
  selectedSubject.value = ALL_VALUE
  selectedTopic.value = ALL_VALUE
})

// Reset subject and topic when grade level changes
watch(selectedGradeLevel, () => {
  selectedSubject.value = ALL_VALUE
  selectedTopic.value = ALL_VALUE
})

// Reset topic when subject changes
watch(selectedSubject, () => {
  selectedTopic.value = ALL_VALUE
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  selectedGradeLevel.value === ALL_VALUE ? undefined : selectedGradeLevel.value,
)
const subjectFilter = computed(() =>
  selectedSubject.value === ALL_VALUE ? undefined : selectedSubject.value,
)
const topicFilter = computed(() =>
  selectedTopic.value === ALL_VALUE ? undefined : selectedTopic.value,
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

// Get filtered statistics
const averageScore = computed(() => {
  if (!selectedChildId.value) return 0
  return childStatisticsStore.getAverageScore(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    selectedDateRange.value,
  )
})

const totalSessions = computed(() => {
  if (!selectedChildId.value) return 0
  return childStatisticsStore.getTotalSessions(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    selectedDateRange.value,
  )
})

const totalStudyTime = computed(() => {
  if (!selectedChildId.value) return 0
  return childStatisticsStore.getTotalStudyTime(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    selectedDateRange.value,
  )
})

const topicsPracticed = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getTopicsPracticed(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    selectedDateRange.value,
  )
})

// Get recent sessions for table
const recentSessions = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getRecentSessions(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    selectedDateRange.value,
  )
})

function formatStudyTime(minutes: number): string {
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

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${remainingMinutes}m`
}

// Column definitions for recent sessions table
const columns: ColumnDef<ChildPracticeSession>[] = [
  {
    accessorKey: 'completedAt',
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
      return h('div', { class: 'text-sm' }, formatDate(row.original.completedAt))
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

      const colorClass =
        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'

      return h('div', { class: colorClass }, `${score}% (${correct}/${total})`)
    },
  },
  {
    accessorKey: 'durationMinutes',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Duration', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', {}, formatDuration(row.original.durationMinutes))
    },
  },
]

function handleRowClick(row: ChildPracticeSession) {
  // Navigate to session detail page
  router.push(`/parent/session/${selectedChildId.value}/${row.id}`)
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Statistics</h1>
      <p class="text-muted-foreground">View your children's learning progress</p>
    </div>

    <!-- No Children State -->
    <div v-if="childLinkStore.linkedChildren.length === 0" class="py-16 text-center">
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
        <!-- Child Selector -->
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

        <!-- Grade Level Selector -->
        <Select v-model="selectedGradeLevel">
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
        <Select v-model="selectedSubject" :disabled="selectedGradeLevel === ALL_VALUE">
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

        <!-- Topics Practiced Card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Topics Practiced</CardTitle>
            <Layers class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ topicsPracticed.length }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Recent Practice Sessions Table -->
      <Card v-if="selectedChildId">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <History class="size-5" />
            Recent Practice Sessions
          </CardTitle>
          <CardDescription> View recent practice session history </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            v-if="recentSessions.length > 0"
            :columns="columns"
            :data="recentSessions"
            :on-row-click="handleRowClick"
          />
          <div v-else class="py-12 text-center">
            <BookOpen class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-muted-foreground">No practice sessions found</p>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
