import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useQuestionsStore, type Question } from './questions'
import { useAuthStore } from './auth'
import { useCurriculumStore } from './curriculum'
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
import { type PracticeAnswer, type PracticeSession, rowToAnswer } from '@/lib/practiceHelpers'

export type { DateRangeFilter }

type PracticeSessionRow = Database['public']['Tables']['practice_sessions']['Row']

// Cache TTL for session history (new sessions are added in-memory, so stale risk is low)
const SESSION_HISTORY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const usePracticeHistoryStore = defineStore('practice-history', () => {
  const sessionHistory = ref<PracticeSession[]>([])
  const sessionHistoryLastFetched = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const authStore = useAuthStore()
  const curriculumStore = useCurriculumStore()

  // History page filter state (persisted across navigation)
  const historyFilters = ref({
    dateRange: 'alltime' as DateRangeFilter,
    gradeLevel: '__all__',
    subject: '__all__',
    topic: '__all__',
    subTopic: '__all__',
  })

  // History page pagination state (persisted across navigation)
  const historyPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  // Get history for current student
  const studentHistory = computed(() => {
    if (!authStore.user) return []
    return sessionHistory.value
      .filter((s) => s.studentId === authStore.user!.id)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      })
  })

  /**
   * Get curriculum names for a sub-topic
   * Note: topic_id column in DB now references sub_topics table
   */
  function getCurriculumNames(
    subTopicId: string,
    gradeLevelId: string | null,
    subjectId: string | null,
  ): {
    gradeLevelName: string
    subjectName: string
    topicName: string
    subTopicName: string
  } {
    const hierarchy = curriculumStore.getSubTopicWithHierarchy(subTopicId)
    if (hierarchy) {
      return {
        gradeLevelName: hierarchy.gradeLevel.name,
        subjectName: hierarchy.subject.name,
        topicName: hierarchy.topic.name,
        subTopicName: hierarchy.subTopic.name,
      }
    }
    return {
      gradeLevelName: 'Unknown',
      subjectName: 'Unknown',
      topicName: 'Unknown',
      subTopicName: 'Unknown',
    }
  }

  /**
   * Convert database row to PracticeSession (without questions/answers)
   * Note: topic_id column in DB now references sub_topics table
   * @param answerCount - Optional answer count from nested query, defaults to 0
   */
  function rowToSession(row: PracticeSessionRow, answerCount: number = 0): PracticeSession {
    const names = getCurriculumNames(row.topic_id, row.grade_level_id, row.subject_id)
    return {
      id: row.id,
      studentId: row.student_id,
      gradeLevelId: row.grade_level_id,
      gradeLevelName: names.gradeLevelName,
      subjectId: row.subject_id,
      subjectName: names.subjectName,
      subTopicId: row.topic_id, // topic_id column references sub_topics
      topicName: names.topicName,
      subTopicName: names.subTopicName,
      totalQuestions: row.total_questions,
      currentQuestionIndex: row.current_question_index ?? 0,
      correctCount: row.correct_count ?? 0,
      answerCount,
      totalTimeSeconds: row.total_time_seconds ?? 0,
      xpEarned: row.xp_earned,
      coinsEarned: row.coins_earned,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      aiSummary: row.ai_summary ?? null,
      questions: [],
      answers: [],
    }
  }

  /**
   * Fetch session history for the current student
   */
  async function fetchSessionHistory(force = false): Promise<{ error: string | null }> {
    if (!authStore.user) {
      return { error: 'Not authenticated' }
    }

    // Skip if cache is still valid (new sessions are added in-memory via unshift)
    if (
      !force &&
      sessionHistoryLastFetched.value &&
      sessionHistory.value.length > 0 &&
      Date.now() - sessionHistoryLastFetched.value < SESSION_HISTORY_CACHE_TTL
    ) {
      return { error: null }
    }

    isLoading.value = true
    error.value = null

    try {
      // Ensure curriculum is loaded
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      // Include answer count using nested query
      const { data, error: fetchError } = await supabase
        .from('practice_sessions')
        .select('*, practice_answers(count)')
        .eq('student_id', authStore.user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        const msg = handleError(fetchError, 'Failed to fetch session history.')
        error.value = msg
        return { error: msg }
      }

      sessionHistory.value = (data ?? []).map((row) => {
        // Extract answer count from nested query result
        const answerCount = (row.practice_answers as { count: number }[])?.[0]?.count ?? 0
        return rowToSession(row, answerCount)
      })
      sessionHistoryLastFetched.value = Date.now()
      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch session history.')
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get filtered history for current student
   */
  function getFilteredHistory(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
    dateRange?: DateRangeFilter,
  ): PracticeSession[] {
    if (!authStore.user) return []

    const studentSessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    return filterSessions(studentSessions, {
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      dateRange,
    }).sort((a, b) => {
      // In-progress sessions pinned to top, then completed descending by completedAt
      const aCompleted = !!a.completedAt
      const bCompleted = !!b.completedAt
      if (!aCompleted && bCompleted) return -1
      if (aCompleted && !bCompleted) return 1
      if (!aCompleted && !bCompleted) {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      }
      const dateA = new Date(a.completedAt!).getTime()
      const dateB = new Date(b.completedAt!).getTime()
      return dateB - dateA
    })
  }

  /**
   * Get unique grade levels from student's history
   */
  function getHistoryGradeLevels(): string[] {
    if (!authStore.user) return []
    const sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    return getUniqueGradeLevels(sessions)
  }

  /**
   * Get unique subjects from student's history
   */
  function getHistorySubjects(gradeLevelName?: string): string[] {
    if (!authStore.user) return []
    const sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    return getUniqueSubjects(sessions, gradeLevelName)
  }

  /**
   * Get unique topics from student's history
   */
  function getHistoryTopics(gradeLevelName?: string, subjectName?: string): string[] {
    if (!authStore.user) return []
    const sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    return getUniqueTopics(sessions, gradeLevelName, subjectName)
  }

  /**
   * Get unique sub-topics from student's history
   */
  function getHistorySubTopics(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): string[] {
    if (!authStore.user) return []
    const sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    return getUniqueSubTopics(sessions, gradeLevelName, subjectName, topicName)
  }

  /**
   * Get a specific session by ID with full details
   * Uses parallel queries for better performance
   * Includes ownership verification to prevent IDOR attacks
   */
  async function getSessionById(
    sessionId: string,
  ): Promise<{ session: PracticeSession | null; error: string | null }> {
    try {
      // Authentication check
      if (!authStore.user) {
        return { session: null, error: 'Authentication required' }
      }

      // Ensure curriculum is loaded (uses cache)
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      // Fetch session and answers in parallel
      const [sessionResult, answersResult] = await Promise.all([
        supabase.from('practice_sessions').select('*').eq('id', sessionId).single(),
        supabase
          .from('practice_answers')
          .select('*')
          .eq('session_id', sessionId)
          .order('answered_at', { ascending: true }),
      ])

      if (sessionResult.error) {
        return {
          session: null,
          error: handleError(sessionResult.error, 'Failed to fetch session.'),
        }
      }
      if (answersResult.error) {
        return {
          session: null,
          error: handleError(answersResult.error, 'Failed to fetch session.'),
        }
      }

      // SECURITY: Verify session ownership to prevent IDOR attacks
      // This is defense-in-depth alongside RLS policies
      if (sessionResult.data.student_id !== authStore.user.id) {
        return { session: null, error: 'Unauthorized: You do not have access to this session' }
      }

      const session = rowToSession(sessionResult.data)
      session.answers = (answersResult.data ?? []).map(rowToAnswer)

      // Get all question IDs from answers (including null for deleted questions)
      const questionIds = session.answers.map((a) => a.questionId).filter(Boolean) as string[]

      // Fetch existing questions by their IDs directly (not by topic, as question might be deleted)
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds)

      const existingQuestions = new Map<string, Question>()
      if (questionsData) {
        for (const row of questionsData) {
          // Get curriculum names for this question (topic_id references sub_topics)
          const hierarchy = curriculumStore.getSubTopicWithHierarchy(row.topic_id)
          existingQuestions.set(row.id, {
            id: row.id,
            type: row.type,
            question: row.question,
            imagePath: row.image_path,
            subTopicId: row.topic_id, // topic_id column references sub_topics
            gradeLevelId: row.grade_level_id,
            subjectId: row.subject_id,
            explanation: row.explanation,
            answer: row.answer,
            options: [
              {
                id: 'a',
                text: row.option_1_text,
                imagePath: row.option_1_image_path,
                isCorrect: row.option_1_is_correct ?? false,
              },
              {
                id: 'b',
                text: row.option_2_text,
                imagePath: row.option_2_image_path,
                isCorrect: row.option_2_is_correct ?? false,
              },
              {
                id: 'c',
                text: row.option_3_text,
                imagePath: row.option_3_image_path,
                isCorrect: row.option_3_is_correct ?? false,
              },
              {
                id: 'd',
                text: row.option_4_text,
                imagePath: row.option_4_image_path,
                isCorrect: row.option_4_is_correct ?? false,
              },
            ],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            imageHash: row.image_hash,
            gradeLevelName: hierarchy?.gradeLevel.name ?? '',
            subjectName: hierarchy?.subject.name ?? '',
            topicName: hierarchy?.topic.name ?? '',
            subTopicName: hierarchy?.subTopic.name ?? '',
          })
        }
      }

      // Build questions array in order of answers, with placeholders for deleted questions
      session.questions = session.answers.map((answer, index) => {
        if (answer.questionId && existingQuestions.has(answer.questionId)) {
          return existingQuestions.get(answer.questionId)!
        }
        // Create placeholder for deleted question
        return {
          id: answer.questionId ?? `deleted-${index}`,
          type: 'mcq' as const,
          question: '[Question has been deleted]',
          imagePath: null,
          subTopicId: session.subTopicId,
          gradeLevelId: session.gradeLevelId,
          subjectId: session.subjectId,
          explanation: null,
          answer: null,
          options: [],
          createdAt: null,
          updatedAt: null,
          imageHash: null,
          gradeLevelName: session.gradeLevelName,
          subjectName: session.subjectName,
          topicName: session.topicName,
          subTopicName: session.subTopicName,
          isDeleted: true,
        } as Question & { isDeleted?: boolean }
      })

      return { session, error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch session.')
      return { session: null, error: message }
    }
  }

  // --- Methods called by practice store ---

  /** Push a new session to the front of history */
  function addToHistory(session: PracticeSession) {
    sessionHistory.value.unshift(session)
  }

  /** Update a session in history (used by completeSession) */
  function updateInHistory(session: PracticeSession) {
    const index = sessionHistory.value.findIndex((s) => s.id === session.id)
    if (index !== -1) {
      sessionHistory.value[index] = { ...session }
    }
  }

  /** Invalidate the session history cache so next fetch hits DB */
  function invalidateCache() {
    sessionHistoryLastFetched.value = null
  }

  // History filter setters
  function setHistoryDateRange(value: DateRangeFilter) {
    historyFilters.value.dateRange = value
  }

  function setHistoryGradeLevel(value: string) {
    historyFilters.value.gradeLevel = value
    // Reset dependent filters when grade level changes
    historyFilters.value.subject = '__all__'
    historyFilters.value.topic = '__all__'
    historyFilters.value.subTopic = '__all__'
  }

  function setHistorySubject(value: string) {
    historyFilters.value.subject = value
    // Reset dependent filters when subject changes
    historyFilters.value.topic = '__all__'
    historyFilters.value.subTopic = '__all__'
  }

  function setHistoryTopic(value: string) {
    historyFilters.value.topic = value
    // Reset dependent filter when topic changes
    historyFilters.value.subTopic = '__all__'
  }

  function setHistorySubTopic(value: string) {
    historyFilters.value.subTopic = value
  }

  function resetHistoryFilters() {
    historyFilters.value = {
      dateRange: 'alltime',
      gradeLevel: '__all__',
      subject: '__all__',
      topic: '__all__',
      subTopic: '__all__',
    }
  }

  // History pagination setters
  function setHistoryPageIndex(index: number) {
    historyPagination.value.pageIndex = index
  }

  function setHistoryPageSize(size: number) {
    historyPagination.value.pageSize = size
    historyPagination.value.pageIndex = 0 // Reset to first page when page size changes
  }

  // Reset store state (call on logout)
  function $reset() {
    sessionHistory.value = []
    sessionHistoryLastFetched.value = null
    isLoading.value = false
    error.value = null
    resetHistoryFilters()
    historyPagination.value = { pageIndex: 0, pageSize: 10 }
  }

  return {
    // State
    sessionHistory,
    isLoading,
    error,

    // Computed
    studentHistory,

    // History filters
    historyFilters,
    setHistoryDateRange,
    setHistoryGradeLevel,
    setHistorySubject,
    setHistoryTopic,
    setHistorySubTopic,
    resetHistoryFilters,

    // History pagination
    historyPagination,
    setHistoryPageIndex,
    setHistoryPageSize,

    // History actions
    fetchSessionHistory,
    getFilteredHistory,
    getHistoryGradeLevels,
    getHistorySubjects,
    getHistoryTopics,
    getHistorySubTopics,
    getSessionById,

    // Called by practice store
    addToHistory,
    updateInHistory,
    invalidateCache,

    $reset,
  }
})
