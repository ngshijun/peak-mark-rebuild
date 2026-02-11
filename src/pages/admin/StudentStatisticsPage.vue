<script setup lang="ts">
import { computed, ref, watch, h, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import {
  useAdminStudentsStore,
  type StudentPracticeSession,
  type DateRangeFilter,
  type StudentOwnedPet,
} from '@/stores/admin-students'
import { usePetsStore, rarityConfig, type PetRarity } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  CirclePoundSterling,
  Flame,
  Apple,
  PawPrint,
  SmilePlus,
  CheckCircle,
  XCircle,
  HelpCircle,
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
const petsStore = usePetsStore()

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
    // Load statistics, engagement data, and all pets in parallel
    if (studentId.value) {
      const [statsResult, engagementResult] = await Promise.all([
        adminStudentsStore.fetchStudentStatistics(studentId.value),
        adminStudentsStore.fetchStudentEngagement(studentId.value),
        petsStore.allPets.length === 0
          ? petsStore.fetchAllPets()
          : Promise.resolve({ error: null }),
      ])
      if (statsResult.error) toast.error(statsResult.error)
      if (engagementResult.error) toast.error(engagementResult.error)
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

// Engagement data
const engagement = computed(() =>
  studentId.value ? adminStudentsStore.getStudentEngagement(studentId.value) : undefined,
)

const rarityOrder: PetRarity[] = ['legendary', 'epic', 'rare', 'common']

// Build a lookup map from petId -> owned pet data for this student
const ownedPetMap = computed(() => {
  const map = new Map<string, StudentOwnedPet>()
  if (!engagement.value) return map
  for (const op of engagement.value.ownedPets) {
    map.set(op.petId, op)
  }
  return map
})

// Collection stats per rarity for this student
const petCollectionStats = computed(() => {
  const stats: Record<PetRarity, { total: number; owned: number }> = {
    common: { total: 0, owned: 0 },
    rare: { total: 0, owned: 0 },
    epic: { total: 0, owned: 0 },
    legendary: { total: 0, owned: 0 },
  }
  for (const pet of petsStore.allPets) {
    stats[pet.rarity].total++
    if (ownedPetMap.value.has(pet.id)) {
      stats[pet.rarity].owned++
    }
  }
  return stats
})

const totalOwnedPets = computed(() => engagement.value?.ownedPets.length ?? 0)
const totalPets = computed(() => petsStore.allPets.length)

// Get the tier-appropriate image path for a pet
function getPetImagePath(pet: StudentOwnedPet): string {
  if (pet.tier >= 3 && pet.tier3ImagePath) return pet.tier3ImagePath
  if (pet.tier >= 2 && pet.tier2ImagePath) return pet.tier2ImagePath
  return pet.imagePath
}

function getPetImageUrl(imagePath: string): string {
  if (!imagePath) return ''
  return petsStore.getOptimizedPetImageUrl(imagePath)
}

// Mood emoji mapping
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

// Subscription status badge config
function getSubscriptionStatusConfig(engagement: {
  isActive: boolean
  cancelAtPeriodEnd: boolean
  stripeStatus: string | null
}) {
  if (engagement.cancelAtPeriodEnd) {
    return {
      label: 'Cancelling',
      bgColor: 'bg-amber-100 dark:bg-amber-950/30',
      color: 'text-amber-700 dark:text-amber-400',
    }
  }
  if (engagement.stripeStatus === 'past_due') {
    return {
      label: 'Past Due',
      bgColor: 'bg-red-100 dark:bg-red-950/30',
      color: 'text-red-700 dark:text-red-400',
    }
  }
  if (engagement.isActive) {
    return {
      label: 'Active',
      bgColor: 'bg-green-100 dark:bg-green-950/30',
      color: 'text-green-700 dark:text-green-400',
    }
  }
  return {
    label: 'Inactive',
    bgColor: 'bg-gray-100 dark:bg-gray-950/30',
    color: 'text-gray-700 dark:text-gray-400',
  }
}

function formatMoodDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

    <!-- Tabbed Sections -->
    <Tabs v-if="student" default-value="info">
      <TabsList>
        <TabsTrigger value="info">
          <User class="mr-1.5 size-4" />
          Student Info
        </TabsTrigger>
        <TabsTrigger value="practice">
          <History class="mr-1.5 size-4" />
          Practice History
        </TabsTrigger>
        <TabsTrigger v-if="engagement?.subscription" value="subscription">
          <CreditCard class="mr-1.5 size-4" />
          Subscription
        </TabsTrigger>
        <TabsTrigger v-if="engagement" value="pets">
          <PawPrint class="mr-1.5 size-4" />
          Pets ({{ totalOwnedPets }}/{{ totalPets }})
        </TabsTrigger>
        <TabsTrigger v-if="engagement" value="mood">
          <SmilePlus class="mr-1.5 size-4" />
          Mood
        </TabsTrigger>
      </TabsList>

      <!-- Student Info Tab -->
      <TabsContent value="info">
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <User class="size-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <!-- Personal -->
              <div class="space-y-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Personal
                </p>

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <User class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Name</p>
                    <p class="font-medium">{{ student.name }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Mail class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Email</p>
                    <p class="font-medium">{{ student.email }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Cake class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Date of Birth</p>
                    <p class="font-medium">{{ formatShortDate(student.dateOfBirth) }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Users class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Parent</p>
                    <p v-if="student.parentName" class="font-medium">
                      {{ student.parentName }}
                      <span v-if="student.parentEmail" class="text-muted-foreground">
                        ({{ student.parentEmail }})
                      </span>
                    </p>
                    <p v-else class="font-medium text-muted-foreground">-</p>
                  </div>
                </div>
              </div>

              <!-- Account -->
              <div class="space-y-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Account
                </p>

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <GraduationCap class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Grade Level</p>
                    <p class="font-medium">{{ student.gradeLevelName ?? '-' }}</p>
                  </div>
                </div>

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

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <CalendarDays class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Joined</p>
                    <p class="font-medium">{{ formatShortDate(student.joinedAt) }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Clock class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Last Active</p>
                    <p class="font-medium">{{ formatRelativeDate(student.lastActive) }}</p>
                  </div>
                </div>
              </div>

              <!-- Engagement -->
              <div class="space-y-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Engagement
                </p>

                <div class="flex items-center gap-3">
                  <div
                    class="flex size-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/30"
                  >
                    <Star class="size-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Level {{ engagement?.level ?? Math.floor(student.xp / 500) + 1 }}
                    </p>
                    <p class="font-medium text-purple-600 dark:text-purple-400">
                      {{ student.xp.toLocaleString() }} XP
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div
                    class="flex size-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30"
                  >
                    <CirclePoundSterling class="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Coins</p>
                    <p class="font-medium text-amber-600 dark:text-amber-400">
                      {{ student.coins.toLocaleString() }}
                    </p>
                  </div>
                </div>

                <div v-if="engagement" class="flex items-center gap-3">
                  <div
                    class="flex size-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30"
                  >
                    <Apple class="size-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Food</p>
                    <p class="font-medium text-green-600 dark:text-green-400">
                      {{ engagement.food }}
                    </p>
                  </div>
                </div>

                <div v-if="engagement" class="flex items-center gap-3">
                  <div
                    class="flex size-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/30"
                  >
                    <Flame class="size-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Current Streak</p>
                    <p class="font-medium text-orange-600 dark:text-orange-400">
                      {{ engagement.currentStreak }}
                      {{ engagement.currentStreak === 1 ? 'day' : 'days' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Practice History Tab -->
      <TabsContent value="practice">
        <div v-if="!adminStudentsStore.isLoadingStatistics" class="space-y-6">
          <!-- Filters Row -->
          <div class="flex flex-wrap items-center gap-3">
            <Select
              :model-value="adminStudentsStore.statisticsFilters.dateRange"
              @update:model-value="
                adminStudentsStore.setStatisticsDateRange($event as DateRangeFilter)
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
                <SelectItem
                  v-for="subTopic in availableSubTopics"
                  :key="subTopic"
                  :value="subTopic"
                >
                  {{ subTopic }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Statistics Cards -->
          <div v-if="studentId" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Average Score</CardTitle>
                <Target class="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div class="text-3xl font-bold">{{ averageScore }}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Sessions Completed</CardTitle>
                <BookOpen class="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div class="text-3xl font-bold">{{ totalSessions }}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Study Time</CardTitle>
                <Clock class="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div class="text-3xl font-bold">{{ formatStudyTime(totalStudyTime) }}</div>
              </CardContent>
            </Card>

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
        </div>
      </TabsContent>

      <!-- Subscription Tab -->
      <TabsContent v-if="engagement?.subscription" value="subscription">
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <CreditCard class="size-5" />
              Subscription Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <!-- Status -->
              <div>
                <p class="text-xs text-muted-foreground">Status</p>
                <Badge
                  variant="secondary"
                  :class="`mt-1 ${getSubscriptionStatusConfig(engagement.subscription).bgColor} ${getSubscriptionStatusConfig(engagement.subscription).color}`"
                >
                  {{ getSubscriptionStatusConfig(engagement.subscription).label }}
                </Badge>
              </div>

              <!-- Tier -->
              <div>
                <p class="text-xs text-muted-foreground">Tier</p>
                <Badge
                  variant="secondary"
                  :class="`mt-1 ${tierConfig[engagement.subscription.tier]?.bgColor ?? ''} ${tierConfig[engagement.subscription.tier]?.color ?? ''}`"
                >
                  {{
                    tierConfig[engagement.subscription.tier]?.label ?? engagement.subscription.tier
                  }}
                </Badge>
              </div>

              <!-- Start Date -->
              <div>
                <p class="text-xs text-muted-foreground">Start Date</p>
                <p class="mt-1 font-medium">
                  {{ formatShortDate(engagement.subscription.startDate) }}
                </p>
              </div>

              <!-- Renewal Date -->
              <div>
                <p class="text-xs text-muted-foreground">Renewal Date</p>
                <p class="mt-1 font-medium">
                  {{ formatShortDate(engagement.subscription.nextBillingDate) }}
                </p>
              </div>

              <!-- Scheduled Tier Change -->
              <div v-if="engagement.subscription.scheduledTier" class="sm:col-span-2">
                <p class="text-xs text-muted-foreground">Scheduled Tier Change</p>
                <p class="mt-1 font-medium">
                  Changing to
                  <Badge variant="secondary" class="mx-1">
                    {{
                      tierConfig[engagement.subscription.scheduledTier]?.label ??
                      engagement.subscription.scheduledTier
                    }}
                  </Badge>
                  on {{ formatShortDate(engagement.subscription.scheduledChangeDate) }}
                </p>
              </div>
            </div>

            <!-- Payment History -->
            <div v-if="engagement.subscription.paymentHistory.length > 0" class="mt-6">
              <h4 class="mb-3 text-sm font-medium">Payment History</h4>
              <div class="rounded-md border">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/50">
                      <th class="px-4 py-2 text-left font-medium">Date</th>
                      <th class="px-4 py-2 text-left font-medium">Amount</th>
                      <th class="px-4 py-2 text-left font-medium">Tier</th>
                      <th class="px-4 py-2 text-left font-medium">Status</th>
                      <th class="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="payment in engagement.subscription.paymentHistory"
                      :key="payment.id"
                      class="border-b last:border-0"
                    >
                      <td class="px-4 py-2">{{ formatShortDate(payment.createdAt) }}</td>
                      <td class="px-4 py-2 font-medium">
                        {{ (payment.amountCents / 100).toFixed(2) }}
                        {{ payment.currency.toUpperCase() }}
                      </td>
                      <td class="px-4 py-2">
                        <Badge
                          v-if="payment.tier"
                          variant="secondary"
                          :class="`${tierConfig[payment.tier]?.bgColor ?? ''} ${tierConfig[payment.tier]?.color ?? ''}`"
                        >
                          {{ tierConfig[payment.tier]?.label ?? payment.tier }}
                        </Badge>
                        <span v-else class="text-muted-foreground">-</span>
                      </td>
                      <td class="px-4 py-2">
                        <Badge
                          variant="secondary"
                          :class="
                            payment.status === 'succeeded'
                              ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                          "
                        >
                          {{ payment.status }}
                        </Badge>
                      </td>
                      <td class="px-4 py-2 text-muted-foreground">
                        {{ payment.description ?? '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Pet Collection Tab -->
      <TabsContent v-if="engagement" value="pets">
        <div class="space-y-4">
          <!-- Overall count -->
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">
              {{ totalOwnedPets }} / {{ totalPets }} pets collected
            </p>
          </div>

          <!-- Grouped by rarity -->
          <Card v-for="rarity in rarityOrder" :key="rarity">
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <CardTitle
                  class="flex items-center gap-2 text-base"
                  :class="rarityConfig[rarity].color"
                >
                  {{ rarityConfig[rarity].label }}
                </CardTitle>
                <Badge variant="outline" :class="rarityConfig[rarity].color">
                  {{ petCollectionStats[rarity].owned }} / {{ petCollectionStats[rarity].total }}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                <div
                  v-for="pet in petsStore.petsByRarity[rarity]"
                  :key="pet.id"
                  class="relative flex flex-col items-center rounded-lg border px-2 pb-2 pt-3"
                  :class="[
                    ownedPetMap.has(pet.id)
                      ? [rarityConfig[rarity].bgColor, rarityConfig[rarity].borderColor]
                      : 'border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900',
                    ownedPetMap.get(pet.id)?.petId === engagement.selectedPetId
                      ? 'ring-2 ring-primary ring-offset-2'
                      : '',
                  ]"
                >
                  <!-- Selected indicator -->
                  <div
                    v-if="ownedPetMap.get(pet.id)?.petId === engagement.selectedPetId"
                    class="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
                  >
                    ★
                  </div>

                  <!-- Count badge -->
                  <div
                    v-if="ownedPetMap.has(pet.id) && (ownedPetMap.get(pet.id)?.count ?? 0) > 1"
                    class="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white"
                  >
                    {{ ownedPetMap.get(pet.id)?.count }}
                  </div>

                  <!-- Pet image or question mark -->
                  <div class="flex aspect-square w-full items-center justify-center">
                    <template v-if="ownedPetMap.has(pet.id)">
                      <img
                        :src="getPetImageUrl(getPetImagePath(ownedPetMap.get(pet.id)!))"
                        :alt="pet.name"
                        class="size-full object-contain"
                      />
                    </template>
                    <template v-else>
                      <HelpCircle class="size-14 text-gray-400 dark:text-gray-600" />
                    </template>
                  </div>

                  <!-- Pet name + tier badge -->
                  <div class="mt-1 flex items-center justify-center gap-1">
                    <p
                      class="text-center text-xs font-medium leading-tight"
                      :class="
                        ownedPetMap.has(pet.id)
                          ? rarityConfig[rarity].textColor
                          : 'text-gray-400 dark:text-gray-600'
                      "
                    >
                      {{ pet.name }}
                    </p>
                    <Badge
                      v-if="ownedPetMap.has(pet.id) && (ownedPetMap.get(pet.id)?.tier ?? 1) > 1"
                      variant="outline"
                      class="text-[10px] px-1 py-0"
                    >
                      T{{ ownedPetMap.get(pet.id)?.tier }}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- Mood History Tab -->
      <TabsContent v-if="engagement" value="mood">
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <SmilePlus class="size-5" />
              Mood History
            </CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              v-if="engagement.moodHistory.length > 0"
              class="grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-10"
            >
              <div
                v-for="entry in engagement.moodHistory"
                :key="entry.date"
                class="flex flex-col items-center rounded-md border p-2 text-center"
                :class="
                  entry.hasPracticed
                    ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
                    : 'border-border'
                "
              >
                <span class="text-[10px] text-muted-foreground">{{
                  formatMoodDate(entry.date)
                }}</span>
                <span class="text-lg leading-tight">{{ getMoodEmoji(entry.mood) }}</span>
                <CheckCircle v-if="entry.hasPracticed" class="mt-0.5 size-3 text-green-500" />
                <XCircle v-else class="mt-0.5 size-3 text-muted-foreground/30" />
              </div>
            </div>
            <div v-else class="py-8 text-center">
              <SmilePlus class="mx-auto size-12 text-muted-foreground/50" />
              <p class="mt-2 text-muted-foreground">No mood data recorded yet.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
