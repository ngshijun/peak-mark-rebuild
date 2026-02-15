import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'
import { useAdminStudentsStore } from './admin-students'
import { handleError } from '@/lib/errors'
import { type DateRangeFilter, createSessionLookupMethods } from '@/lib/sessionFilters'
import { fetchSessionSummaries, fetchFullSessionDetails } from '@/lib/sessionFetching'
import { useCascadingFilters } from '@/composables/useCascadingFilters'
import type {
  QuestionOption,
  PracticeAnswer,
  SessionQuestion,
  PracticeSessionSummary,
  PracticeSessionFull,
} from '@/types/session'

// Cache TTL for student statistics (re-fetch when navigating back after this period)
const STATISTICS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export type { DateRangeFilter, QuestionOption, PracticeAnswer, SessionQuestion }
export type StudentPracticeSession = PracticeSessionSummary
export type StudentPracticeSessionFull = PracticeSessionFull

export interface StudentStatistics {
  studentId: string
  studentName: string
  sessions: StudentPracticeSession[]
}

export const useAdminStudentStatsStore = defineStore('adminStudentStats', () => {
  const authStore = useAuthStore()

  // Student statistics state
  const studentStatistics = ref<StudentStatistics[]>([])
  const isLoadingStatistics = ref(false)
  const statisticsError = ref<string | null>(null)

  // Track when each student's statistics were last fetched (for TTL-based cache)
  const statsLastFetched = ref<Map<string, number>>(new Map())

  // Statistics page filter + pagination state
  const {
    filters: statisticsFilters,
    pagination: statisticsPagination,
    setGradeLevel: setStatisticsGradeLevel,
    setSubject: setStatisticsSubject,
    setTopic: setStatisticsTopic,
    setSubTopic: setStatisticsSubTopic,
    setDateRange: setStatisticsDateRange,
    setPageIndex: setStatisticsPageIndex,
    setPageSize: setStatisticsPageSize,
    resetFilters: resetStatisticsFilters,
  } = useCascadingFilters({ defaultDateRange: 'alltime' })

  /**
   * Fetch practice sessions for a specific student (lazy loading)
   */
  async function fetchStudentStatistics(studentId: string): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { error: 'Not authenticated as admin' }
    }

    // Skip if cache is still valid
    const lastFetched = statsLastFetched.value.get(studentId)
    if (lastFetched && Date.now() - lastFetched < STATISTICS_CACHE_TTL) {
      return { error: null }
    }

    isLoadingStatistics.value = true
    statisticsError.value = null

    try {
      const sessions = await fetchSessionSummaries(studentId)

      // Get student info
      const adminStudentsStore = useAdminStudentsStore()
      const student = adminStudentsStore.getStudentById(studentId)

      // Update or add this student's statistics
      const existingIndex = studentStatistics.value.findIndex((s) => s.studentId === studentId)
      const stats: StudentStatistics = {
        studentId,
        studentName: student?.name ?? 'Unknown',
        sessions,
      }

      if (existingIndex >= 0) {
        studentStatistics.value[existingIndex] = stats
      } else {
        studentStatistics.value.push(stats)
      }

      // Update cache timestamp
      statsLastFetched.value.set(studentId, Date.now())

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch statistics.')
      statisticsError.value = message
      return { error: message }
    } finally {
      isLoadingStatistics.value = false
    }
  }

  /**
   * Fetch full session details by student ID and session ID
   */
  async function getSessionById(
    studentId: string,
    sessionId: string,
  ): Promise<{
    session: StudentPracticeSessionFull | null
    error: string | null
  }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { session: null, error: 'Not authenticated as admin' }
    }

    try {
      const session = await fetchFullSessionDetails(studentId, sessionId)
      if (!session) return { session: null, error: 'Session not found' }
      return { session, error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch session.')
      return { session: null, error: message }
    }
  }

  // Get statistics for a specific student
  function getStudentStatistics(studentId: string) {
    return studentStatistics.value.find((stat) => stat.studentId === studentId)
  }

  // Cascading filter lookup methods (shared pattern)
  const { getFilteredSessions, getGradeLevels, getSubjects, getTopics, getSubTopics } =
    createSessionLookupMethods((studentId: string) => getStudentStatistics(studentId)?.sessions)

  // Reset store state
  function $reset() {
    studentStatistics.value = []
    isLoadingStatistics.value = false
    statisticsError.value = null
    statsLastFetched.value.clear()
    resetStatisticsFilters()
  }

  return {
    // State
    studentStatistics,
    isLoadingStatistics,
    statisticsError,

    // Statistics filters
    statisticsFilters,
    setStatisticsDateRange,
    setStatisticsGradeLevel,
    setStatisticsSubject,
    setStatisticsTopic,
    setStatisticsSubTopic,
    resetStatisticsFilters,

    // Statistics pagination
    statisticsPagination,
    setStatisticsPageIndex,
    setStatisticsPageSize,

    // Actions
    fetchStudentStatistics,
    getSessionById,
    getStudentStatistics,
    getFilteredSessions,
    getGradeLevels,
    getSubjects,
    getTopics,
    getSubTopics,
    $reset,
  }
})
