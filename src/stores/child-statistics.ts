import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useChildLinkStore } from './child-link'
import { useAuthStore } from './auth'
import { handleError } from '@/lib/errors'
import type { Database } from '@/types/database.types'
import {
  type DateRangeFilter,
  filterSessions,
  getUniqueGradeLevels,
  getUniqueSubjects,
  getUniqueTopics,
  getUniqueSubTopics,
} from '@/lib/sessionFilters'

export type { DateRangeFilter }

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

// Options are stored directly in the questions table as columns
export interface QuestionOption {
  id: string // 'a', 'b', 'c', 'd'
  text: string | null
  imagePath: string | null
  isCorrect: boolean
}

export interface ChildPracticeSession {
  id: string
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
  score: number | null
  totalQuestions: number
  correctAnswers: number
  durationSeconds: number | null
  createdAt: string
  completedAt: string | null
  status: 'completed' | 'in_progress'
}

export interface PracticeAnswer {
  questionId: string | null
  selectedOptions: number[] | null
  textAnswer: string | null
  isCorrect: boolean
  answeredAt: string
  timeSpentSeconds: number | null
}

export interface Question {
  id: string
  type: 'mcq' | 'mrq' | 'short_answer'
  question: string
  explanation: string | null
  answer: string | null
  imagePath: string | null
  options?: QuestionOption[]
  isDeleted?: boolean
}

export interface ChildPracticeSessionFull
  extends Omit<ChildPracticeSession, 'score' | 'durationSeconds' | 'completedAt'> {
  subjectId: string
  subTopicId: string // topic_id column now references sub_topics
  topicId: string
  gradeLevelId: string
  questions: Question[]
  answers: PracticeAnswer[]
  startedAt: string
  aiSummary: string | null
  score: number
  durationSeconds: number
  completedAt: string
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

  // Statistics page filter state (persisted across navigation)
  // Note: selectedChildId is persisted via localStorage in the component (user preference)
  const statisticsFilters = ref({
    dateRange: 'alltime' as DateRangeFilter,
    gradeLevel: '__all__',
    subject: '__all__',
    topic: '__all__',
    subTopic: '__all__',
  })

  // Statistics page table pagination state (persisted across navigation)
  const statisticsPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

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

        const subTopic = session.sub_topics as unknown as {
          id: string
          name: string
          topics: {
            id: string
            name: string
            subjects: {
              id: string
              name: string
              grade_levels: { id: string; name: string }
            }
          }
        }

        const durationSeconds = isCompleted
          ? answersData.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0)
          : null

        sessions.push({
          id: session.id,
          gradeLevelName: subTopic?.topics?.subjects?.grade_levels?.name ?? 'Unknown',
          subjectName: subTopic?.topics?.subjects?.name ?? 'Unknown',
          topicName: subTopic?.topics?.name ?? 'Unknown',
          subTopicName: subTopic?.name ?? 'Unknown',
          score:
            isCompleted && totalQuestions > 0
              ? Math.round((correctAnswers / totalQuestions) * 100)
              : null,
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

      // Helper function to extract options from question columns
      function extractOptionsFromQuestion(q: QuestionRow): QuestionOption[] {
        const options: QuestionOption[] = []
        if (q.option_1_text !== null || q.option_1_image_path !== null) {
          options.push({
            id: 'a',
            text: q.option_1_text,
            imagePath: q.option_1_image_path,
            isCorrect: q.option_1_is_correct ?? false,
          })
        }
        if (q.option_2_text !== null || q.option_2_image_path !== null) {
          options.push({
            id: 'b',
            text: q.option_2_text,
            imagePath: q.option_2_image_path,
            isCorrect: q.option_2_is_correct ?? false,
          })
        }
        if (q.option_3_text !== null || q.option_3_image_path !== null) {
          options.push({
            id: 'c',
            text: q.option_3_text,
            imagePath: q.option_3_image_path,
            isCorrect: q.option_3_is_correct ?? false,
          })
        }
        if (q.option_4_text !== null || q.option_4_image_path !== null) {
          options.push({
            id: 'd',
            text: q.option_4_text,
            imagePath: q.option_4_image_path,
            isCorrect: q.option_4_is_correct ?? false,
          })
        }
        return options
      }

      // Build questions array in order of answers
      const questions: Question[] = (answersData ?? []).map((answer, index) => {
        if (answer.question_id && questionsMap.has(answer.question_id)) {
          const q = questionsMap.get(answer.question_id)!
          return {
            id: q.id,
            type: q.type as 'mcq' | 'short_answer',
            question: q.question,
            explanation: q.explanation,
            answer: q.answer,
            imagePath: q.image_path,
            options: q.type === 'mcq' ? extractOptionsFromQuestion(q) : undefined,
          }
        }
        // Deleted question placeholder
        return {
          id: answer.question_id ?? `deleted-${index}`,
          type: 'mcq' as const,
          question: '[Question has been deleted]',
          explanation: null,
          answer: null,
          imagePath: null,
          isDeleted: true,
        }
      })

      // Build answers array
      const answers: PracticeAnswer[] = (answersData ?? []).map((a) => ({
        questionId: a.question_id,
        selectedOptions: a.selected_options,
        textAnswer: a.text_answer,
        isCorrect: a.is_correct ?? false,
        answeredAt: a.answered_at ?? new Date().toISOString(),
        timeSpentSeconds: a.time_spent_seconds,
      }))

      // New hierarchy: sub_topics -> topics -> subjects -> grade_levels
      const subTopic = sessionData.sub_topics as unknown as {
        id: string
        name: string
        topics: {
          id: string
          name: string
          subjects: {
            id: string
            name: string
            grade_levels: { id: string; name: string }
          }
        }
      }

      // Use DB row fields for summary (works even when answers aren't loaded)
      const correctAnswers = canViewDetails
        ? answers.filter((a) => a.isCorrect).length
        : ((sessionData as unknown as { correct_count: number | null }).correct_count ?? 0)
      const totalQuestions = sessionData.total_questions ?? answers.length
      const durationSeconds = canViewDetails
        ? answers.reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0)
        : ((sessionData as unknown as { total_time_seconds: number | null }).total_time_seconds ??
          0)

      const session: ChildPracticeSessionFull = {
        id: sessionData.id,
        gradeLevelId: subTopic?.topics?.subjects?.grade_levels?.id ?? '',
        gradeLevelName: subTopic?.topics?.subjects?.grade_levels?.name ?? 'Unknown',
        subjectId: subTopic?.topics?.subjects?.id ?? '',
        subjectName: subTopic?.topics?.subjects?.name ?? 'Unknown',
        topicId: subTopic?.topics?.id ?? '',
        topicName: subTopic?.topics?.name ?? 'Unknown',
        subTopicId: subTopic?.id ?? '',
        subTopicName: subTopic?.name ?? 'Unknown',
        score: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
        totalQuestions,
        correctAnswers,
        durationSeconds,
        createdAt: sessionData.created_at ?? '',
        startedAt: sessionData.created_at ?? '',
        completedAt: sessionData.completed_at!,
        status: 'completed',
        questions,
        answers,
        aiSummary: sessionData.ai_summary ?? null,
      }

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

  // Get filtered sessions for a child
  function getFilteredSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): ChildPracticeSession[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    return filterSessions(stats.sessions, {
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    })
  }

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

  // Get unique grade levels for a child
  function getGradeLevels(childId: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    return getUniqueGradeLevels(stats.sessions)
  }

  // Get unique subjects for a child (optionally filtered by grade level)
  function getSubjects(childId: string, gradeLevelName?: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    return getUniqueSubjects(stats.sessions, gradeLevelName)
  }

  // Get unique topics for a child (optionally filtered by grade level and subject)
  function getTopics(childId: string, gradeLevelName?: string, subjectName?: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    return getUniqueTopics(stats.sessions, gradeLevelName, subjectName)
  }

  // Get unique sub-topics for a child (optionally filtered by grade level, subject, and topic)
  function getSubTopics(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    return getUniqueSubTopics(stats.sessions, gradeLevelName, subjectName, topicName)
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

  // Statistics filter setters
  function setStatisticsDateRange(value: DateRangeFilter) {
    statisticsFilters.value.dateRange = value
  }

  function setStatisticsGradeLevel(value: string) {
    statisticsFilters.value.gradeLevel = value
    // Reset dependent filters when grade level changes
    statisticsFilters.value.subject = '__all__'
    statisticsFilters.value.topic = '__all__'
    statisticsFilters.value.subTopic = '__all__'
  }

  function setStatisticsSubject(value: string) {
    statisticsFilters.value.subject = value
    // Reset dependent filters when subject changes
    statisticsFilters.value.topic = '__all__'
    statisticsFilters.value.subTopic = '__all__'
  }

  function setStatisticsTopic(value: string) {
    statisticsFilters.value.topic = value
    // Reset dependent filter when topic changes
    statisticsFilters.value.subTopic = '__all__'
  }

  function setStatisticsSubTopic(value: string) {
    statisticsFilters.value.subTopic = value
  }

  // Pagination setters
  function setStatisticsPageIndex(value: number) {
    statisticsPagination.value.pageIndex = value
  }

  function setStatisticsPageSize(value: number) {
    statisticsPagination.value.pageSize = value
    // Reset to first page when page size changes
    statisticsPagination.value.pageIndex = 0
  }

  function resetStatisticsFilters() {
    statisticsFilters.value = {
      dateRange: 'today',
      gradeLevel: '__all__',
      subject: '__all__',
      topic: '__all__',
      subTopic: '__all__',
    }
    // Also reset pagination when filters are reset
    statisticsPagination.value = {
      pageIndex: 0,
      pageSize: 10,
    }
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
