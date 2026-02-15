import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useChildLinkStore } from './child-link'
import { useAuthStore } from './auth'
import { handleError } from '@/lib/errors'
import type { Database } from '@/types/database.types'
import type { SubTopicHierarchy } from '@/types/supabase-helpers'
import { type DateRangeFilter, createSessionLookupMethods } from '@/lib/sessionFilters'
import { useCascadingFilters } from '@/composables/useCascadingFilters'
import type {
  QuestionOption,
  PracticeAnswer,
  Question,
  PracticeSessionSummary,
  PracticeSessionFull,
} from '@/types/session'
import {
  buildQuestionsFromAnswers,
  mapAnswerRows,
  assembleSessionFull,
  computeScorePercent,
} from '@/lib/questionHelpers'

export type { DateRangeFilter, QuestionOption, PracticeAnswer, SessionQuestion }
export type ChildPracticeSession = PracticeSessionSummary
export type ChildPracticeSessionFull = PracticeSessionFull

type QuestionRow = Database['public']['Tables']['questions']['Row']
type SubscriptionTier = Database['public']['Enums']['subscription_tier']

// Cache TTL for child subscription status
const SUBSCRIPTION_CACHE_TTL = 2 * 60 * 1000 // 2 minutes
// Cache TTL for child statistics (re-fetch when navigating back after this period)
const STATISTICS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface ChildSubscriptionStatus {
  tier: SubscriptionTier
  canViewDetailedResults: boolean // Pro and Max tiers only
}

export interface ChildStatistics {
  childId: string
  childName: string
  sessions: ChildPracticeSession[]
}

export type MoodType = Database['public']['Enums']['mood_type']

export interface ChildDailyStatus {
  id: string
  date: string // YYYY-MM-DD
  mood: MoodType | null
  hasPracticed: boolean
}

export interface DailySessionCount {
  date: string // YYYY-MM-DD
  count: number
}

export const useChildStatisticsStore = defineStore('childStatistics', () => {
  const childLinkStore = useChildLinkStore()
  const authStore = useAuthStore()

  const childrenStatistics = ref<ChildStatistics[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Cache for child subscription statuses (keyed by childId)
  const subscriptionStatusCache = ref<
    Map<string, { status: ChildSubscriptionStatus; lastFetched: number }>
  >(new Map())

  // Statistics page filter + pagination state (persisted across navigation)
  // Note: selectedChildId is persisted via localStorage in the component (user preference)
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
    resetFilters: _resetStatisticsFilters,
  } = useCascadingFilters({ defaultDateRange: 'alltime' })

  // Track when each child's statistics were last fetched (for TTL-based cache)
  const childStatsLastFetched = ref<Map<string, number>>(new Map())

  /**
   * Fetch practice sessions for a specific child (lazy loading)
   */
  async function fetchChildStatistics(childId: string): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    // Check if child is linked
    const child = childLinkStore.linkedChildren.find((c) => c.id === childId)
    if (!child) {
      return { error: 'Child not linked to your account' }
    }

    // Skip if cache is still valid
    const lastFetched = childStatsLastFetched.value.get(childId)
    if (lastFetched && Date.now() - lastFetched < STATISTICS_CACHE_TTL) {
      return { error: null }
    }

    isLoading.value = true
    error.value = null

    try {
      // Fetch all practice sessions for this child (including in-progress)
      const { data: sessionsData, error: fetchError } = await supabase
        .from('practice_sessions')
        .select(
          `
          id,
          student_id,
          topic_id,
          total_questions,
          created_at,
          completed_at,
          sub_topics (
            id,
            name,
            topics (
              id,
              name,
              subjects (
                id,
                name,
                grade_levels (
                  id,
                  name
                )
              )
            )
          )
        `,
        )
        .eq('student_id', childId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Get all session IDs for batch query
      const sessionIds = (sessionsData ?? []).map((s) => s.id)

      // Batch fetch all answers in a single request
      let allAnswersData: {
        session_id: string
        is_correct: boolean | null
        time_spent_seconds: number | null
      }[] = []
      if (sessionIds.length > 0) {
        const { data } = await supabase
          .from('practice_answers')
          .select('session_id, is_correct, time_spent_seconds')
          .in('session_id', sessionIds)
        allAnswersData = data ?? []
      }

      // Group answers by session_id
      const answersBySession = new Map<
        string,
        { is_correct: boolean | null; time_spent_seconds: number | null }[]
      >()
      for (const answer of allAnswersData) {
        if (!answersBySession.has(answer.session_id)) {
          answersBySession.set(answer.session_id, [])
        }
        answersBySession.get(answer.session_id)!.push(answer)
      }

      // Build sessions with scores
      const sessions: ChildPracticeSession[] = []

      for (const session of sessionsData ?? []) {
        const answersData = answersBySession.get(session.id) ?? []
        const correctAnswers = answersData.filter((a) => a.is_correct).length
        const totalQuestions = session.total_questions ?? answersData.length
        const isCompleted = !!session.completed_at

        const subTopic = session.sub_topics as unknown as SubTopicHierarchy

        const durationSeconds = isCompleted
          ? answersData.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0)
          : null

        sessions.push({
          id: session.id,
          gradeLevelName: subTopic?.topics?.subjects?.grade_levels?.name ?? 'Unknown',
          subjectName: subTopic?.topics?.subjects?.name ?? 'Unknown',
          topicName: subTopic?.topics?.name ?? 'Unknown',
          subTopicName: subTopic?.name ?? 'Unknown',
          score: isCompleted ? computeScorePercent(correctAnswers, totalQuestions) || null : null,
          totalQuestions,
          correctAnswers,
          durationSeconds,
          createdAt: session.created_at ?? new Date().toISOString(),
          completedAt: session.completed_at,
          status: isCompleted ? 'completed' : 'in_progress',
        })
      }

      // Update or add this child's statistics
      const existingIndex = childrenStatistics.value.findIndex((s) => s.childId === childId)
      const childStats: ChildStatistics = {
        childId,
        childName: child.name,
        sessions,
      }

      if (existingIndex >= 0) {
        childrenStatistics.value[existingIndex] = childStats
      } else {
        childrenStatistics.value.push(childStats)
      }

      // Update cache timestamp
      childStatsLastFetched.value.set(childId, Date.now())

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch statistics.')
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch practice sessions for all linked children
   * @deprecated Use fetchChildStatistics for lazy loading instead
   */
  async function fetchChildrenStatistics(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    if (childLinkStore.linkedChildren.length === 0) {
      childrenStatistics.value = []
      return { error: null }
    }

    // Fetch all children's statistics in parallel
    const results = await Promise.all(
      childLinkStore.linkedChildren.map((child) => fetchChildStatistics(child.id)),
    )

    // Return first error if any
    const errorResult = results.find((r) => r.error)
    return { error: errorResult?.error ?? null }
  }

  /**
   * Check if subscription status cache is stale for a specific child
   */
  function isSubscriptionCacheStale(childId: string): boolean {
    const cached = subscriptionStatusCache.value.get(childId)
    if (!cached) return true
    return Date.now() - cached.lastFetched > SUBSCRIPTION_CACHE_TTL
  }

  /**
   * Get subscription status for a child (with caching)
   */
  async function getChildSubscriptionStatus(
    childId: string,
    force = false,
  ): Promise<ChildSubscriptionStatus> {
    // Return cached status if still valid
    if (!force && !isSubscriptionCacheStale(childId)) {
      const cached = subscriptionStatusCache.value.get(childId)
      if (cached) return cached.status
    }

    if (!authStore.user || !authStore.isParent) {
      const status: ChildSubscriptionStatus = { tier: 'core', canViewDetailedResults: false }
      subscriptionStatusCache.value.set(childId, { status, lastFetched: Date.now() })
      return status
    }

    try {
      // Read the child's subscription tier directly from student_profiles
      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('subscription_tier')
        .eq('id', childId)
        .maybeSingle()

      const tier = (profileData?.subscription_tier as SubscriptionTier) ?? 'core'
      const canViewDetailedResults = tier === 'pro' || tier === 'max'

      const status: ChildSubscriptionStatus = { tier, canViewDetailedResults }
      subscriptionStatusCache.value.set(childId, { status, lastFetched: Date.now() })
      return status
    } catch (err) {
      console.error('Error getting child subscription status:', err)
      const status: ChildSubscriptionStatus = { tier: 'core', canViewDetailedResults: false }
      subscriptionStatusCache.value.set(childId, { status, lastFetched: Date.now() })
      return status
    }
  }

  /**
   * Fetch full session details by child ID and session ID
   * Uses parallel queries for better performance
   */
  async function getSessionById(
    childId: string,
    sessionId: string,
  ): Promise<{
    session: ChildPracticeSessionFull | null
    error: string | null
    subscriptionRequired?: boolean
  }> {
    if (!authStore.user || !authStore.isParent) {
      return { session: null, error: 'Not authenticated as parent' }
    }

    // Verify the child is linked to this parent
    const isLinked = childLinkStore.linkedChildren.some((c) => c.id === childId)
    if (!isLinked) {
      return { session: null, error: 'Child is not linked to your account' }
    }

    // Check subscription status (cached)
    const subscriptionStatus = await getChildSubscriptionStatus(childId)
    const canViewDetails = subscriptionStatus.canViewDetailedResults

    try {
      // Always fetch session row (for summary cards)
      // Only fetch answers when subscription allows detailed view
      const sessionPromise = supabase
        .from('practice_sessions')
        .select(
          `
            id,
            student_id,
            topic_id,
            total_questions,
            correct_count,
            total_time_seconds,
            created_at,
            completed_at,
            ai_summary,
            sub_topics (
              id,
              name,
              topics (
                id,
                name,
                subjects (
                  id,
                  name,
                  grade_levels (
                    id,
                    name
                  )
                )
              )
            )
          `,
        )
        .eq('id', sessionId)
        .eq('student_id', childId)
        .single()

      const answersPromise = canViewDetails
        ? supabase
            .from('practice_answers')
            .select('*')
            .eq('session_id', sessionId)
            .order('answered_at', { ascending: true })
        : Promise.resolve({
            data: [] as Database['public']['Tables']['practice_answers']['Row'][],
            error: null,
          })

      const [sessionResult, answersResult] = await Promise.all([sessionPromise, answersPromise])

      if (sessionResult.error) throw sessionResult.error
      if (!sessionResult.data) return { session: null, error: 'Session not found' }
      if (answersResult.error) throw answersResult.error

      const sessionData = sessionResult.data
      const answersData = answersResult.data

      // Fetch questions only when detailed view is allowed
      let questionsData: QuestionRow[] = []
      if (canViewDetails) {
        const questionIds = (answersData ?? [])
          .map((a) => a.question_id)
          .filter(Boolean) as string[]
        if (questionIds.length > 0) {
          const { data } = await supabase.from('questions').select('*').in('id', questionIds)
          questionsData = data ?? []
        }
      }

      // Build questions map
      const questionsMap = new Map<string, QuestionRow>()
      for (const q of questionsData) {
        questionsMap.set(q.id, q)
      }

      // Build questions and answers from DB rows
      const questions = buildQuestionsFromAnswers(answersData ?? [], questionsMap)
      const answers = mapAnswerRows(answersData ?? [])
      const subTopic = sessionData.sub_topics as unknown as SubTopicHierarchy

      // Use DB row fields for summary when answers aren't loaded (subscription-gated)
      const correctAnswers = canViewDetails
        ? answers.filter((a) => a.isCorrect).length
        : (sessionData.correct_count ?? 0)
      const durationSeconds = canViewDetails
        ? answers.reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0)
        : (sessionData.total_time_seconds ?? 0)

      const session: ChildPracticeSessionFull = assembleSessionFull(
        sessionData,
        subTopic,
        questions,
        answers,
        correctAnswers,
        durationSeconds,
      )

      return {
        session,
        error: null,
        subscriptionRequired: !canViewDetails ? true : undefined,
      }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch session.')
      return { session: null, error: message }
    }
  }

  // Get statistics only for linked children
  const linkedChildrenStatistics = computed(() => {
    const linkedIds = childLinkStore.linkedChildren.map((c) => c.id)
    return childrenStatistics.value.filter((stat) => linkedIds.includes(stat.childId))
  })

  // Get statistics for a specific child
  function getChildStatistics(childId: string) {
    return childrenStatistics.value.find((stat) => stat.childId === childId)
  }

  // Cascading filter lookup methods (shared pattern)
  const { getFilteredSessions, getGradeLevels, getSubjects, getTopics, getSubTopics } =
    createSessionLookupMethods((childId: string) => getChildStatistics(childId)?.sessions)

  // Calculate average score for filtered sessions
  function getAverageScore(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    const sessions = getFilteredSessions(
      childId,
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    )
    const completedSessions = sessions.filter((s) => s.status === 'completed' && s.score !== null)
    if (completedSessions.length === 0) return 0
    const totalScore = completedSessions.reduce((sum, s) => sum + (s.score ?? 0), 0)
    return Math.round(totalScore / completedSessions.length)
  }

  // Get total practice sessions count for filtered sessions
  function getTotalSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    return getFilteredSessions(
      childId,
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    ).length
  }

  // Get total study time in seconds for filtered sessions
  function getTotalStudyTime(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    const sessions = getFilteredSessions(
      childId,
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    )
    return sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)
  }

  // Get unique sub-topics practiced by a child (from filtered sessions)
  function getSubTopicsPracticed(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): { subTopicName: string; topicName: string; subjectName: string; count: number }[] {
    const sessions = getFilteredSessions(
      childId,
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    )

    const subTopicMap = new Map<
      string,
      { subTopicName: string; topicName: string; subjectName: string; count: number }
    >()
    sessions.forEach((s) => {
      const key = `${s.subjectName}-${s.topicName}-${s.subTopicName}`
      if (subTopicMap.has(key)) {
        subTopicMap.get(key)!.count++
      } else {
        subTopicMap.set(key, {
          subTopicName: s.subTopicName,
          topicName: s.topicName,
          subjectName: s.subjectName,
          count: 1,
        })
      }
    })

    return Array.from(subTopicMap.values()).sort((a, b) => b.count - a.count)
  }

  // Get recent sessions for a child (sorted by date descending)
  function getRecentSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
    limit?: number,
  ): ChildPracticeSession[] {
    const sessions = getFilteredSessions(
      childId,
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    )
    const sorted = [...sessions].sort((a, b) => {
      const dateA = new Date(a.completedAt ?? a.createdAt).getTime()
      const dateB = new Date(b.completedAt ?? b.createdAt).getTime()
      return dateB - dateA
    })
    return limit ? sorted.slice(0, limit) : sorted
  }

  /**
   * Fetch daily statuses for a child for a specific month
   */
  async function fetchChildDailyStatuses(
    childId: string,
    year: number,
    month: number, // 1-12
  ): Promise<{ statuses: ChildDailyStatus[]; error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { statuses: [], error: 'Not authenticated as parent' }
    }

    // Verify the child is linked to this parent
    const isLinked = childLinkStore.linkedChildren.some((c) => c.id === childId)
    if (!isLinked) {
      return { statuses: [], error: 'Child is not linked to your account' }
    }

    // Calculate date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    try {
      const { data, error: fetchError } = await supabase
        .from('daily_statuses')
        .select('id, date, mood, has_practiced')
        .eq('student_id', childId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (fetchError) {
        return { statuses: [], error: handleError(fetchError, 'Failed to fetch daily statuses.') }
      }

      const statuses: ChildDailyStatus[] = (data ?? []).map((d) => ({
        id: d.id,
        date: d.date,
        mood: d.mood,
        hasPracticed: d.has_practiced ?? false,
      }))

      return { statuses, error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch daily statuses.')
      return { statuses: [], error: message }
    }
  }

  /**
   * Get daily session counts for a child for the last N days
   */
  function getDailySessionCounts(childId: string, days: number = 30): DailySessionCount[] {
    const stats = getChildStatistics(childId)
    const sessions = stats?.sessions ?? []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create a map for the last N days initialized to 0
    const countsMap = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      countsMap.set(dateStr, 0)
    }

    // Count completed sessions per day
    sessions
      .filter((s) => s.status === 'completed' && s.completedAt)
      .forEach((session) => {
        const completedDate = new Date(session.completedAt!)
        const dateStr = `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}-${String(completedDate.getDate()).padStart(2, '0')}`
        if (countsMap.has(dateStr)) {
          countsMap.set(dateStr, (countsMap.get(dateStr) ?? 0) + 1)
        }
      })

    // Convert to array sorted by date
    return Array.from(countsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  function resetStatisticsFilters() {
    _resetStatisticsFilters({ dateRange: 'today' })
  }

  // Reset store state (call on logout)
  function $reset() {
    childrenStatistics.value = []
    isLoading.value = false
    error.value = null
    childStatsLastFetched.value.clear()
    subscriptionStatusCache.value.clear()
    resetStatisticsFilters()
  }

  return {
    // State
    childrenStatistics,
    isLoading,
    error,

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

    // Computed
    linkedChildrenStatistics,

    // Actions
    fetchChildStatistics,
    fetchChildrenStatistics,
    getChildStatistics,
    getFilteredSessions,
    getAverageScore,
    getTotalSessions,
    getTotalStudyTime,
    getSubTopicsPracticed,
    getGradeLevels,
    getSubjects,
    getTopics,
    getSubTopics,
    getRecentSessions,
    getSessionById,
    getChildSubscriptionStatus,
    fetchChildDailyStatuses,
    getDailySessionCounts,
    $reset,
  }
})
