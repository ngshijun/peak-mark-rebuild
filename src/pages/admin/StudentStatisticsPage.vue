<script setup lang="ts">
import { computed, ref, watch, h, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import {
  useAdminStudentsStore,
  type StudentPracticeSession,
  type DateRangeFilter,
} from '@/stores/admin-students'
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
  ArrowUpDown,
  History,
  Calendar,
  CalendarDays,
  Loader2,
  ArrowLeft,
  User,
  Mail,
  CreditCard,
  Cake,
  Users,
  GraduationCap,
  Star,
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

// Subscription tier config
const tierConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  core: { label: 'Core', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  pro: { label: 'Pro', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  max: { label: 'Max', color: 'text-purple-700', bgColor: 'bg-purple-100' },
}

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return 'Yesterday'

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return formatShortDate(dateString)
}

const route = useRoute()
const router = useRouter()
const adminStudentsStore = useAdminStudentsStore()

const studentId = computed(() => route.params.studentId as string)

// Get student info
const student = computed(() => adminStudentsStore.getStudentById(studentId.value))

// Fetch data on mount
onMounted(async () => {
  try {
    // Ensure students are loaded first
    if (adminStudentsStore.students.length === 0) {
      await adminStudentsStore.fetchAllStudents()
    }
    // Then load this student's statistics
    if (studentId.value) {
      await adminStudentsStore.fetchStudentStatistics(studentId.value)
    }
  } catch {
    toast.error('Failed to load statistics')
  }
})

const ALL_VALUE = '__all__'

const dateRangeOptions = [
  { value: 'today' as DateRangeFilter, label: 'Today' },
  { value: 'last7days' as DateRangeFilter, label: 'Last 7 Days' },
  { value: 'last30days' as DateRangeFilter, label: 'Last 30 Days' },
  { value: 'alltime' as DateRangeFilter, label: 'All Time' },
]

// Reset filters when student changes
watch(studentId, async (newStudentId) => {
  adminStudentsStore.resetStatisticsFilters()
  if (newStudentId) {
    await adminStudentsStore.fetchStudentStatistics(newStudentId)
  }
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  adminStudentsStore.statisticsFilters.gradeLevel === ALL_VALUE
    ? undefined
    : adminStudentsStore.statisticsFilters.gradeLevel,
)
const subjectFilter = computed(() =>
  adminStudentsStore.statisticsFilters.subject === ALL_VALUE
    ? undefined
    : adminStudentsStore.statisticsFilters.subject,
)
const topicFilter = computed(() =>
  adminStudentsStore.statisticsFilters.topic === ALL_VALUE
    ? undefined
    : adminStudentsStore.statisticsFilters.topic,
)
const subTopicFilter = computed(() =>
  adminStudentsStore.statisticsFilters.subTopic === ALL_VALUE
    ? undefined
    : adminStudentsStore.statisticsFilters.subTopic,
)

// Get available filter options
const availableGradeLevels = computed(() => {
  if (!studentId.value) return []
  return adminStudentsStore.getGradeLevels(studentId.value)
})

const availableSubjects = computed(() => {
  if (!studentId.value) return []
  return adminStudentsStore.getSubjects(studentId.value, gradeLevelFilter.value)
})

const availableTopics = computed(() => {
  if (!studentId.value) return []
  return adminStudentsStore.getTopics(studentId.value, gradeLevelFilter.value, subjectFilter.value)
})

const availableSubTopics = computed(() => {
  if (!studentId.value) return []
  return adminStudentsStore.getSubTopics(
    studentId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
  )
})

// Get filtered sessions
const filteredSessions = computed(() => {
  if (!studentId.value) return []
  return adminStudentsStore.getFilteredSessions(
    studentId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    subTopicFilter.value,
    adminStudentsStore.statisticsFilters.dateRange,
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

// Column definitions for practice sessions table
const columns: ColumnDef<StudentPracticeSession>[] = [
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
    accessorKey: 'gradeLevelName',
    header: 'Grade',
    cell: ({ row }) => {
      return h('div', {}, row.original.gradeLevelName)
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

function handleRowClick(row: StudentPracticeSession) {
  // Only navigate to result page for completed sessions
  if (row.status === 'completed') {
    router.push(`/admin/students/${studentId.value}/session/${row.id}`)
  }
}

function goBack() {
  router.push('/admin/students')
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <Button variant="ghost" size="sm" class="mb-4" @click="goBack">
        <ArrowLeft class="mr-2 size-4" />
        Back to Students
      </Button>

      <h1 class="text-2xl font-bold">Student Statistics</h1>
      <p class="text-muted-foreground">View practice history and performance</p>
    </div>

    <!-- Loading State -->
    <div
      v-if="adminStudentsStore.isLoadingStatistics"
      class="flex items-center justify-center py-16"
    >
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Student Info Card -->
    <Card v-if="student">
      <CardHeader>
        <CardTitle>Student Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Name -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <User class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Name</p>
              <p class="font-medium">{{ student.name }}</p>
            </div>
          </div>

          <!-- Email -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Mail class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Email</p>
              <p class="font-medium">{{ student.email }}</p>
            </div>
          </div>

          <!-- Grade Level -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <GraduationCap class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Grade Level</p>
              <p class="font-medium">{{ student.gradeLevelName ?? '-' }}</p>
            </div>
          </div>

          <!-- XP -->
          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30"
            >
              <Star class="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">XP</p>
              <p class="font-medium text-amber-600 dark:text-amber-400">
                {{ student.xp.toLocaleString() }}
              </p>
            </div>
          </div>

          <!-- Date of Birth -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Cake class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Date of Birth</p>
              <p class="font-medium">{{ formatShortDate(student.dateOfBirth) }}</p>
            </div>
          </div>

          <!-- Subscription -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <CreditCard class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Subscription</p>
              <Badge
                v-if="student.subscriptionTier"
                variant="secondary"
                :class="`${tierConfig[student.subscriptionTier]?.bgColor ?? ''} ${tierConfig[student.subscriptionTier]?.color ?? ''}`"
              >
                {{ tierConfig[student.subscriptionTier]?.label ?? student.subscriptionTier }}
              </Badge>
              <p v-else class="font-medium text-muted-foreground">None</p>
            </div>
          </div>

          <!-- Joined -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <CalendarDays class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Joined</p>
              <p class="font-medium">{{ formatShortDate(student.joinedAt) }}</p>
            </div>
          </div>

          <!-- Last Active -->
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Clock class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Last Active</p>
              <p class="font-medium">{{ formatRelativeDate(student.lastActive) }}</p>
            </div>
          </div>

          <!-- Parent -->
          <div
            v-if="student.parentName"
            class="flex items-center gap-3 sm:col-span-2 lg:col-span-3"
          >
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Users class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Parent</p>
              <p class="font-medium">
                {{ student.parentName }}
                <span v-if="student.parentEmail" class="text-muted-foreground">
                  ({{ student.parentEmail }})
                </span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Statistics Content -->
    <template v-if="!adminStudentsStore.isLoadingStatistics">
      <!-- Filters Row -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Date Range Selector -->
        <Select
          :model-value="adminStudentsStore.statisticsFilters.dateRange"
          @update:model-value="adminStudentsStore.setStatisticsDateRange($event as DateRangeFilter)"
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
          :model-value="adminStudentsStore.statisticsFilters.gradeLevel"
          @update:model-value="adminStudentsStore.setStatisticsGradeLevel($event as string)"
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
          :model-value="adminStudentsStore.statisticsFilters.subject"
          :disabled="adminStudentsStore.statisticsFilters.gradeLevel === ALL_VALUE"
          @update:model-value="adminStudentsStore.setStatisticsSubject($event as string)"
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
          :model-value="adminStudentsStore.statisticsFilters.topic"
          :disabled="adminStudentsStore.statisticsFilters.subject === ALL_VALUE"
          @update:model-value="adminStudentsStore.setStatisticsTopic($event as string)"
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
          :model-value="adminStudentsStore.statisticsFilters.subTopic"
          :disabled="adminStudentsStore.statisticsFilters.topic === ALL_VALUE"
          @update:model-value="adminStudentsStore.setStatisticsSubTopic($event as string)"
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
      <div v-if="studentId" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div class="text-3xl font-bold">{{ subTopicsPracticed.length }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Practice History Table -->
      <Card v-if="studentId">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <History class="size-5" />
            Practice History
          </CardTitle>
          <CardDescription>View all practice sessions and scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            v-if="recentSessions.length > 0"
            :columns="columns"
            :data="recentSessions"
            :on-row-click="handleRowClick"
            :page-index="adminStudentsStore.statisticsPagination.pageIndex"
            :page-size="adminStudentsStore.statisticsPagination.pageSize"
            :on-page-index-change="adminStudentsStore.setStatisticsPageIndex"
            :on-page-size-change="adminStudentsStore.setStatisticsPageSize"
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
