import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useChildLinkStore } from './child-link'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type DateRangeFilter = 'today' | 'last7days' | 'last30days' | 'alltime'

type QuestionRow = Database['public']['Tables']['questions']['Row']
type SubscriptionTier = Database['public']['Enums']['subscription_tier']

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

export function getDateRangeStart(filter: DateRangeFilter): Date | null {
  const now = new Date()
  switch (filter) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'last7days':
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return sevenDaysAgo
    case 'last30days':
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return thirtyDaysAgo
    case 'alltime':
      return null
  }
}

export interface ChildPracticeSession {
  id: string
  gradeLevelName: string
  subjectName: string
  topicName: string
  score: number
  totalQuestions: number
  correctAnswers: number
  durationSeconds: number
  completedAt: string
}

export interface PracticeAnswer {
  questionId: string | null
  selectedOption: number | null
  textAnswer: string | null
  isCorrect: boolean
  answeredAt: string
  timeSpentSeconds: number | null
}

export interface Question {
  id: string
  type: 'mcq' | 'short_answer'
  question: string
  explanation: string | null
  answer: string | null
  imagePath: string | null
  options?: QuestionOption[]
  isDeleted?: boolean
}

export interface ChildPracticeSessionFull extends ChildPracticeSession {
  subjectId: string
  topicId: string
  gradeLevelId: string
  questions: Question[]
  answers: PracticeAnswer[]
  startedAt: string
}

export interface ChildStatistics {
  childId: string
  childName: string
  sessions: ChildPracticeSession[]
}

export const useChildStatisticsStore = defineStore('childStatistics', () => {
  const childLinkStore = useChildLinkStore()
  const authStore = useAuthStore()

  const childrenStatistics = ref<ChildStatistics[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch practice sessions for all linked children
   */
  async function fetchChildrenStatistics(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    if (childLinkStore.linkedChildren.length === 0) {
      childrenStatistics.value = []
      return { error: null }
    }

    isLoading.value = true
    error.value = null

    try {
      const childIds = childLinkStore.linkedChildren.map((c) => c.id)

      // Fetch completed practice sessions for all linked children
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
        `,
        )
        .in('student_id', childIds)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })

      if (fetchError) throw fetchError

      // For each session, get the answers to calculate score and total time
      const sessionsWithScores: ChildPracticeSession[] = []

      for (const session of sessionsData ?? []) {
        const { data: answersData } = await supabase
          .from('practice_answers')
          .select('is_correct, time_spent_seconds')
          .eq('session_id', session.id)

        const correctAnswers = answersData?.filter((a) => a.is_correct).length ?? 0
        const totalQuestions = session.total_questions ?? answersData?.length ?? 0

        const topic = session.topics as unknown as {
          id: string
          name: string
          subjects: {
            id: string
            name: string
            grade_levels: { id: string; name: string }
          }
        }

        // Calculate duration from sum of time_spent_seconds in answers
        // This accurately tracks actual time spent, even if student left and came back
        const durationSeconds =
          answersData?.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0) ?? 0

        sessionsWithScores.push({
          id: session.id,
          gradeLevelName: topic?.subjects?.grade_levels?.name ?? 'Unknown',
          subjectName: topic?.subjects?.name ?? 'Unknown',
          topicName: topic?.name ?? 'Unknown',
          score: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
          totalQuestions,
          correctAnswers,
          durationSeconds,
          completedAt: session.completed_at!,
        })
      }

      // Group sessions by child
      const statsByChild = new Map<string, ChildPracticeSession[]>()

      for (const session of sessionsWithScores) {
        const originalSession = sessionsData?.find((s) => s.id === session.id)
        const studentId = originalSession?.student_id
        if (!studentId) continue

        if (!statsByChild.has(studentId)) {
          statsByChild.set(studentId, [])
        }
        statsByChild.get(studentId)!.push(session)
      }

      // Build statistics array
      childrenStatistics.value = childLinkStore.linkedChildren.map((child) => ({
        childId: child.id,
        childName: child.name,
        sessions: statsByChild.get(child.id) ?? [],
      }))

      return { error: null }
    } catch (err) {
      console.error('Error fetching children statistics:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch statistics'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get subscription status for a child
   */
  async function getChildSubscriptionStatus(childId: string): Promise<ChildSubscriptionStatus> {
    if (!authStore.user || !authStore.isParent) {
      return { tier: 'basic', canViewDetailedResults: false }
    }

    try {
      // Get the subscription for this child from the current parent
      const { data: subscriptionData, error: subError } = await supabase
        .from('child_subscriptions')
        .select('tier')
        .eq('parent_id', authStore.user.id)
        .eq('student_id', childId)
        .eq('is_active', true)
        .single()

      if (subError || !subscriptionData) {
        return { tier: 'basic', canViewDetailedResults: false }
      }

      const tier = subscriptionData.tier as SubscriptionTier
      const canViewDetailedResults = tier === 'pro' || tier === 'max'

      return { tier, canViewDetailedResults }
    } catch (err) {
      console.error('Error getting child subscription status:', err)
      return { tier: 'basic', canViewDetailedResults: false }
    }
  }

  /**
   * Fetch full session details by child ID and session ID
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

    // Check subscription status before fetching detailed results
    const subscriptionStatus = await getChildSubscriptionStatus(childId)
    if (!subscriptionStatus.canViewDetailedResults) {
      return {
        session: null,
        error:
          'Detailed session results require a Pro or Max subscription. Upgrade to view individual questions and answers.',
        subscriptionRequired: true,
      }
    }

    try {
      // Fetch the session
      const { data: sessionData, error: sessionError } = await supabase
        .from('practice_sessions')
        .select(
          `
          id,
          student_id,
          topic_id,
          total_questions,
          created_at,
          completed_at,
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
        `,
        )
        .eq('id', sessionId)
        .eq('student_id', childId)
        .single()

      if (sessionError) throw sessionError
      if (!sessionData) return { session: null, error: 'Session not found' }

      // Fetch answers
      const { data: answersData, error: answersError } = await supabase
        .from('practice_answers')
        .select('*')
        .eq('session_id', sessionId)
        .order('answered_at', { ascending: true })

      if (answersError) throw answersError

      // Fetch questions
      const questionIds = (answersData ?? []).map((a) => a.question_id).filter(Boolean) as string[]

      let questionsData: QuestionRow[] = []
      if (questionIds.length > 0) {
        const { data } = await supabase.from('questions').select('*').in('id', questionIds)
        questionsData = data ?? []
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
        selectedOption: a.selected_option,
        textAnswer: a.text_answer,
        isCorrect: a.is_correct ?? false,
        answeredAt: a.answered_at ?? new Date().toISOString(),
        timeSpentSeconds: a.time_spent_seconds,
      }))

      const topic = sessionData.topics as unknown as {
        id: string
        name: string
        subjects: {
          id: string
          name: string
          grade_levels: { id: string; name: string }
        }
      }

      const correctAnswers = answers.filter((a) => a.isCorrect).length
      const totalQuestions = sessionData.total_questions ?? answers.length
      // Calculate duration from sum of time_spent_seconds in answers
      const durationSeconds = answers.reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0)

      const session: ChildPracticeSessionFull = {
        id: sessionData.id,
        gradeLevelId: topic?.subjects?.grade_levels?.id ?? '',
        gradeLevelName: topic?.subjects?.grade_levels?.name ?? 'Unknown',
        subjectId: topic?.subjects?.id ?? '',
        subjectName: topic?.subjects?.name ?? 'Unknown',
        topicId: topic?.id ?? '',
        topicName: topic?.name ?? 'Unknown',
        score: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
        totalQuestions,
        correctAnswers,
        durationSeconds,
        startedAt: sessionData.created_at ?? '',
        completedAt: sessionData.completed_at!,
        questions,
        answers,
      }

      return { session, error: null }
    } catch (err) {
      console.error('Error fetching session:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
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
    dateRange?: DateRangeFilter,
  ): ChildPracticeSession[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []

    const dateRangeStart = dateRange ? getDateRangeStart(dateRange) : null

    return stats.sessions.filter((s) => {
      if (gradeLevelName && s.gradeLevelName !== gradeLevelName) return false
      if (subjectName && s.subjectName !== subjectName) return false
      if (topicName && s.topicName !== topicName) return false
      if (dateRangeStart) {
        const sessionDate = new Date(s.completedAt)
        if (sessionDate < dateRangeStart) return false
      }
      return true
    })
  }

  // Calculate average score for filtered sessions
  function getAverageScore(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)
    if (sessions.length === 0) return 0
    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0)
    return Math.round(totalScore / sessions.length)
  }

  // Get total practice sessions count for filtered sessions
  function getTotalSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    return getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange).length
  }

  // Get total study time in seconds for filtered sessions
  function getTotalStudyTime(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)
    return sessions.reduce((sum, s) => sum + s.durationSeconds, 0)
  }

  // Get unique topics practiced by a child (from filtered sessions)
  function getTopicsPracticed(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): { topicName: string; subjectName: string; count: number }[] {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)

    const topicMap = new Map<string, { topicName: string; subjectName: string; count: number }>()
    sessions.forEach((s) => {
      const key = `${s.subjectName}-${s.topicName}`
      if (topicMap.has(key)) {
        topicMap.get(key)!.count++
      } else {
        topicMap.set(key, { topicName: s.topicName, subjectName: s.subjectName, count: 1 })
      }
    })

    return Array.from(topicMap.values()).sort((a, b) => b.count - a.count)
  }

  // Get unique grade levels for a child
  function getGradeLevels(childId: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    const gradeLevels = new Set(stats.sessions.map((s) => s.gradeLevelName))
    return Array.from(gradeLevels).sort()
  }

  // Get unique subjects for a child (optionally filtered by grade level)
  function getSubjects(childId: string, gradeLevelName?: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    const sessions = gradeLevelName
      ? stats.sessions.filter((s) => s.gradeLevelName === gradeLevelName)
      : stats.sessions
    const subjects = new Set(sessions.map((s) => s.subjectName))
    return Array.from(subjects).sort()
  }

  // Get unique topics for a child (optionally filtered by grade level and subject)
  function getTopics(childId: string, gradeLevelName?: string, subjectName?: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    let sessions = stats.sessions
    if (gradeLevelName) {
      sessions = sessions.filter((s) => s.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      sessions = sessions.filter((s) => s.subjectName === subjectName)
    }
    const topics = new Set(sessions.map((s) => s.topicName))
    return Array.from(topics).sort()
  }

  // Get recent sessions for a child (sorted by date descending)
  function getRecentSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
    limit?: number,
  ): ChildPracticeSession[] {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
    return limit ? sorted.slice(0, limit) : sorted
  }

  return {
    // State
    childrenStatistics,
    isLoading,
    error,

    // Computed
    linkedChildrenStatistics,

    // Actions
    fetchChildrenStatistics,
    getChildStatistics,
    getFilteredSessions,
    getAverageScore,
    getTotalSessions,
    getTotalStudyTime,
    getTopicsPracticed,
    getGradeLevels,
    getSubjects,
    getTopics,
    getRecentSessions,
    getSessionById,
    getChildSubscriptionStatus,
  }
})
