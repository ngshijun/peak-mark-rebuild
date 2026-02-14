import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { useAdminStudentsStore } from './admin-students'
import { handleError } from '@/lib/errors'
import type { Database } from '@/types/database.types'
import type { SubTopicHierarchy } from '@/types/supabase-helpers'
import {
  type DateRangeFilter,
  filterSessions,
  getUniqueGradeLevels,
  getUniqueSubjects,
  getUniqueTopics,
  getUniqueSubTopics,
} from '@/lib/sessionFilters'
import { useCascadingFilters } from '@/composables/useCascadingFilters'

// Cache TTL for student statistics (re-fetch when navigating back after this period)
const STATISTICS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export type { DateRangeFilter }

type QuestionRow = Database['public']['Tables']['questions']['Row']

export interface QuestionOption {
  id: string // 'a', 'b', 'c', 'd'
  text: string | null
  imagePath: string | null
  isCorrect: boolean
}

export interface StudentPracticeSession {
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

export interface StudentPracticeSessionFull
  extends Omit<StudentPracticeSession, 'score' | 'durationSeconds' | 'completedAt'> {
  subjectId: string
  subTopicId: string
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
      // Fetch all practice sessions for this student
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
        .eq('student_id', studentId)
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
      const sessions: StudentPracticeSession[] = []

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
      // Fetch session and answers in parallel
      const [sessionResult, answersResult] = await Promise.all([
        supabase
          .from('practice_sessions')
          .select(
            `
            id,
            student_id,
            topic_id,
            total_questions,
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
          .eq('student_id', studentId)
          .single(),
        supabase
          .from('practice_answers')
          .select('*')
          .eq('session_id', sessionId)
          .order('answered_at', { ascending: true }),
      ])

      if (sessionResult.error) throw sessionResult.error
      if (!sessionResult.data) return { session: null, error: 'Session not found' }
      if (answersResult.error) throw answersResult.error

      const sessionData = sessionResult.data
      const answersData = answersResult.data

      // Fetch questions (depends on answer data)
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
            type: q.type as 'mcq' | 'mrq' | 'short_answer',
            question: q.question,
            explanation: q.explanation,
            answer: q.answer,
            imagePath: q.image_path,
            options:
              q.type === 'mcq' || q.type === 'mrq' ? extractOptionsFromQuestion(q) : undefined,
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
      const subTopic = sessionData.sub_topics as unknown as SubTopicHierarchy

      const correctAnswers = answers.filter((a) => a.isCorrect).length
      const totalQuestions = sessionData.total_questions ?? answers.length
      // Calculate duration from sum of time_spent_seconds in answers
      const durationSeconds = answers.reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0)

      const session: StudentPracticeSessionFull = {
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

  // Get filtered sessions for a student
  function getFilteredSessions(
    studentId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): StudentPracticeSession[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    return filterSessions(stats.sessions, {
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    })
  }

  // Get unique grade levels for a student
  function getGradeLevels(studentId: string): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    return getUniqueGradeLevels(stats.sessions)
  }

  // Get unique subjects for a student (optionally filtered by grade level)
  function getSubjects(studentId: string, gradeLevelName?: string): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    return getUniqueSubjects(stats.sessions, gradeLevelName)
  }

  // Get unique topics for a student (optionally filtered by grade level and subject)
  function getTopics(studentId: string, gradeLevelName?: string, subjectName?: string): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    return getUniqueTopics(stats.sessions, gradeLevelName, subjectName)
  }

  // Get unique sub-topics for a student
  function getSubTopics(
    studentId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    return getUniqueSubTopics(stats.sessions, gradeLevelName, subjectName, topicName)
  }

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
