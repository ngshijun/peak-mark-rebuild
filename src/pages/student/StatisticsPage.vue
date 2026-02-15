<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePracticeHistoryStore, type DateRangeFilter } from '@/stores/practice-history'
import { useAuthStore } from '@/stores/auth'
import { ALL_VALUE, createPracticeHistoryColumns } from '@/lib/statisticsColumns'
import { computeScorePercent } from '@/lib/questionHelpers'
import StatisticsFilterBar from '@/components/statistics/StatisticsFilterBar.vue'
import StatisticsSummaryCards from '@/components/statistics/StatisticsSummaryCards.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, BookOpen, History } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const router = useRouter()
const practiceStore = usePracticeHistoryStore()
const authStore = useAuthStore()

const hideInProgress = ref(false)
const isLoading = ref(true)

// Fetch session history on mount
onMounted(async () => {
  try {
    await practiceStore.fetchSessionHistory()
  } catch (err) {
    console.error('Failed to load practice history:', err)
    toast.error('Failed to load practice history')
  } finally {
    isLoading.value = false
  }
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  practiceStore.historyFilters.gradeLevel === ALL_VALUE
    ? undefined
    : practiceStore.historyFilters.gradeLevel,
)
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

// Get available filter options
const availableGradeLevels = computed(() => practiceStore.getHistoryGradeLevels())
const availableSubjects = computed(() => practiceStore.getHistorySubjects(gradeLevelFilter.value))
const availableTopics = computed(() =>
  practiceStore.getHistoryTopics(gradeLevelFilter.value, subjectFilter.value),
)
const availableSubTopics = computed(() =>
  practiceStore.getHistorySubTopics(gradeLevelFilter.value, subjectFilter.value, topicFilter.value),
)

// Helper type for table row
interface HistoryRow {
  id: string
  completedAt: string | null
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
  status: 'completed' | 'in_progress'
  score: number | null
  totalQuestions: number
  correctAnswers: number
  answeredCount: number
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
    const correctAnswers = session.correctCount
    const totalQuestions = session.totalQuestions
    const score = isCompleted ? computeScorePercent(correctAnswers, totalQuestions) || null : null
    const timeUsedSeconds = isCompleted ? session.totalTimeSeconds : null

    return {
      id: session.id,
      completedAt: session.completedAt ?? null,
      gradeLevelName: session.gradeLevelName,
      subjectName: session.subjectName,
      topicName: session.topicName,
      subTopicName: session.subTopicName,
      status: isCompleted ? 'completed' : 'in_progress',
      score,
      totalQuestions,
      correctAnswers,
      answeredCount: session.answerCount,
      timeUsedSeconds,
    }
  })
})

// Table data with optional in-progress filtering
const displayedHistory = computed(() => {
  if (hideInProgress.value) {
    return historyData.value.filter((s) => s.status === 'completed')
  }
  return historyData.value
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

const columns = createPracticeHistoryColumns<HistoryRow>()

const showResumeDialog = ref(false)
const pendingResumeSession = ref<HistoryRow | null>(null)

function handleRowClick(row: HistoryRow) {
  if (row.status === 'completed') {
    router.push(`/student/session/${row.id}`)
  } else {
    pendingResumeSession.value = row
    showResumeDialog.value = true
  }
}

function confirmResume() {
  if (pendingResumeSession.value) {
    router.push({
      path: '/student/practice/quiz',
      query: { sessionId: pendingResumeSession.value.id },
    })
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
      <StatisticsFilterBar
        :date-range="practiceStore.historyFilters.dateRange"
        :grade-level="practiceStore.historyFilters.gradeLevel"
        :subject="practiceStore.historyFilters.subject"
        :topic="practiceStore.historyFilters.topic"
        :sub-topic="practiceStore.historyFilters.subTopic"
        :available-grade-levels="availableGradeLevels"
        :available-subjects="availableSubjects"
        :available-topics="availableTopics"
        :available-sub-topics="availableSubTopics"
        :hide-in-progress="hideInProgress"
        @update:date-range="practiceStore.setHistoryDateRange($event)"
        @update:grade-level="practiceStore.setHistoryGradeLevel($event)"
        @update:subject="practiceStore.setHistorySubject($event)"
        @update:topic="practiceStore.setHistoryTopic($event)"
        @update:sub-topic="practiceStore.setHistorySubTopic($event)"
        @update:hide-in-progress="hideInProgress = $event"
      />

      <!-- Statistics Cards -->
      <StatisticsSummaryCards
        :average-score="averageScore"
        :total-sessions="totalSessions"
        :total-study-time="totalStudyTime"
        :sub-topics-practiced="subTopicsPracticed"
      />

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
            v-if="displayedHistory.length > 0"
            :columns="columns"
            :data="displayedHistory"
            :on-row-click="handleRowClick"
            :initial-sorting="[{ id: 'completedAt', desc: true }]"
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

    <!-- Resume Session Dialog -->
    <AlertDialog v-model:open="showResumeDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continue Session?</AlertDialogTitle>
          <AlertDialogDescription v-if="pendingResumeSession" as="div">
            <p>
              You have an in-progress session for
              <span class="font-medium text-foreground">{{
                pendingResumeSession.subTopicName
              }}</span>
              ({{ pendingResumeSession.subjectName }}).
            </p>
            <p class="mt-1">
              Progress: {{ pendingResumeSession.answeredCount }} /
              {{ pendingResumeSession.totalQuestions }} questions answered.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmResume">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
