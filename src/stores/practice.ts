import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'
import { useQuestionsStore, type Question } from './questions'
import { useAuthStore } from './auth'
import { useCurriculumStore } from './curriculum'
import { handleError } from '@/lib/errors'
import {
  useStudentSubscription,
  type StudentSubscriptionStatus,
  type SessionLimitStatus,
} from '@/composables/useStudentSubscription'

export type { StudentSubscriptionStatus, SessionLimitStatus }

type PracticeSessionRow = Database['public']['Tables']['practice_sessions']['Row']
type PracticeAnswerRow = Database['public']['Tables']['practice_answers']['Row']

// Cache TTL for session history (new sessions are added in-memory, so stale risk is low)
const SESSION_HISTORY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fisher-Yates shuffle - O(n) time, uniform distribution
 * Preferred over sort(() => Math.random() - 0.5) which is O(n log n) and biased
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

import {
  type DateRangeFilter,
  filterSessions,
  getUniqueGradeLevels,
  getUniqueSubjects,
  getUniqueTopics,
  getUniqueSubTopics,
} from '@/lib/sessionFilters'

export type { DateRangeFilter }

export interface PracticeAnswer {
  id: string
  questionId: string | null
  selectedOptions: number[] | null // Array of 1-4 for options a-d (MCQ: single element, MRQ: multiple)
  textAnswer: string | null
  isCorrect: boolean
  answeredAt: string | null
  timeSpentSeconds: number | null
}

export interface PracticeSession {
  id: string
  studentId: string
  gradeLevelId: string | null
  gradeLevelName: string
  subjectId: string | null
  subjectName: string
  subTopicId: string // topic_id column now references sub_topics
  topicName: string
  subTopicName: string
  totalQuestions: number
  currentQuestionIndex: number
  correctCount: number
  answerCount: number // Actual number of answered questions
  totalTimeSeconds: number
  xpEarned: number | null
  coinsEarned: number | null
  createdAt: string | null
  completedAt: string | null
  aiSummary: string | null
  // Loaded separately
  questions: Question[]
  answers: PracticeAnswer[]
}

export const usePracticeStore = defineStore('practice', () => {
  const currentSession = ref<PracticeSession | null>(null)
  const sessionHistory = ref<PracticeSession[]>([])
  const sessionHistoryLastFetched = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const subscription = useStudentSubscription()

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

  // Practice page navigation state (persisted across navigation)
  const practiceNavigation = ref({
    selectedSubjectId: null as string | null,
    selectedTopicId: null as string | null,
  })

  // Sub-topic progress tracking (unique questions answered per sub-topic)
  const subTopicProgress = ref<Map<string, number>>(new Map())

  const questionsStore = useQuestionsStore()
  const authStore = useAuthStore()
  const curriculumStore = useCurriculumStore()

  const isSessionActive = computed(
    () => currentSession.value !== null && !currentSession.value.completedAt,
  )

  const currentQuestion = computed(() => {
    if (!currentSession.value) return null
    return currentSession.value.questions[currentSession.value.currentQuestionIndex] ?? null
  })

  const currentQuestionNumber = computed(() => {
    if (!currentSession.value) return 0
    return currentSession.value.currentQuestionIndex + 1
  })

  const totalQuestions = computed(() => {
    if (!currentSession.value) return 0
    return currentSession.value.totalQuestions
  })

  const currentAnswer = computed(() => {
    if (!currentSession.value || !currentQuestion.value) return null
    return (
      currentSession.value.answers.find((a) => a.questionId === currentQuestion.value!.id) ?? null
    )
  })

  const isCurrentQuestionAnswered = computed(() => currentAnswer.value !== null)

  const sessionResults = computed(() => {
    if (!currentSession.value) return null
    const totalAnswered = currentSession.value.answers.length
    const correctAnswers = currentSession.value.answers.filter((a) => a.isCorrect).length
    return {
      total: totalQuestions.value,
      answered: totalAnswered,
      correct: correctAnswers,
      incorrect: totalAnswered - correctAnswers,
      score: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
    }
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
   * Convert option ID ('a', 'b', 'c', 'd') to number (1, 2, 3, 4) for database storage
   */
  function optionIdToNumber(optionId: string): number {
    const mapping: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 }
    return mapping[optionId] ?? 1
  }

  /**
   * Convert option number (1, 2, 3, 4) to ID ('a', 'b', 'c', 'd') for UI display
   */
  function optionNumberToId(optionNumber: number): string {
    const mapping: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }
    return mapping[optionNumber] ?? 'a'
  }

  /**
   * Convert array of option numbers to array of IDs for UI display
   */
  function optionNumbersToIds(optionNumbers: number[] | null): string[] {
    if (!optionNumbers) return []
    return optionNumbers.map((num) => optionNumberToId(num))
  }

  /**
   * Convert database row to PracticeAnswer
   */
  function rowToAnswer(row: PracticeAnswerRow): PracticeAnswer {
    return {
      id: row.id,
      questionId: row.question_id,
      selectedOptions: row.selected_options,
      textAnswer: row.text_answer,
      isCorrect: row.is_correct,
      answeredAt: row.answered_at,
      timeSpentSeconds: row.time_spent_seconds,
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
   * Start a new practice session
   * Note: subTopicId parameter corresponds to topic_id column which now references sub_topics table
   */
  async function startSession(
    subTopicId: string,
    questionCount: number = 10,
  ): Promise<{ session: PracticeSession | null; error: string | null; limitReached?: boolean }> {
    if (!authStore.user || authStore.user.userType !== 'student') {
      return { session: null, error: 'Only students can start practice sessions' }
    }

    isLoading.value = true
    error.value = null

    try {
      // Check session limit before starting
      const limitStatus = await subscription.checkSessionLimit()
      if (!limitStatus.canStartSession) {
        const subStatus = await subscription.getStudentSubscriptionStatus()
        const isMaxTier = subStatus.tier === 'max'
        return {
          session: null,
          error: isMaxTier
            ? `You have reached your daily session limit (${limitStatus.sessionLimit} sessions). Come back tomorrow!`
            : `You have reached your daily session limit (${limitStatus.sessionLimit} sessions). Upgrade your plan for more sessions!`,
          limitReached: true,
        }
      }

      // Ensure curriculum is loaded
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      // Get sub-topic hierarchy for grade_level_id and subject_id
      const hierarchy = curriculumStore.getSubTopicWithHierarchy(subTopicId)
      if (!hierarchy) {
        return { session: null, error: 'Sub-topic not found' }
      }

      // Fetch questions for this sub-topic
      const questionsResult = await questionsStore.fetchQuestionsBySubTopic(subTopicId)
      if (questionsResult.error) {
        return { session: null, error: questionsResult.error }
      }

      const allQuestions = questionsResult.questions
      if (allQuestions.length === 0) {
        return { session: null, error: 'No questions available for this sub-topic' }
      }

      // Get current cycle and answered questions for this student+sub-topic
      const { data: progressData } = await supabase
        .from('student_question_progress')
        .select('question_id, cycle_number')
        .eq('student_id', authStore.user.id)
        .eq('topic_id', subTopicId)
        .order('cycle_number', { ascending: false })

      // Determine current cycle (highest cycle number, or 1 if no progress)
      let currentCycle = 1
      const answeredQuestionIds = new Set<string>()

      if (progressData && progressData.length > 0) {
        const firstRow = progressData[0]
        if (firstRow) {
          currentCycle = firstRow.cycle_number
          // Get all question IDs answered in current cycle
          for (const row of progressData) {
            if (row.cycle_number === currentCycle) {
              answeredQuestionIds.add(row.question_id)
            }
          }
        }
      }

      // Filter out answered questions from current cycle
      let unansweredQuestions = allQuestions.filter((q) => !answeredQuestionIds.has(q.id))

      // If not enough unanswered questions, start a new cycle
      let selectedQuestions: Question[] = []
      let questionsFromNewCycle = 0

      if (unansweredQuestions.length >= questionCount) {
        // Enough unanswered questions - select randomly from them
        const shuffled = shuffle(unansweredQuestions)
        selectedQuestions = shuffled.slice(0, questionCount)
      } else {
        // Not enough - use all remaining + start new cycle for the rest
        selectedQuestions = [...unansweredQuestions]
        questionsFromNewCycle = questionCount - unansweredQuestions.length

        if (questionsFromNewCycle > 0) {
          currentCycle++ // Move to new cycle
          // Select additional questions from the full pool (excluding already selected)
          const selectedIds = new Set(selectedQuestions.map((q) => q.id))
          const remainingPool = allQuestions.filter((q) => !selectedIds.has(q.id))
          const shuffledRemaining = shuffle(remainingPool)
          const additionalQuestions = shuffledRemaining.slice(
            0,
            Math.min(questionsFromNewCycle, shuffledRemaining.length),
          )
          selectedQuestions = [...selectedQuestions, ...additionalQuestions]
        }

        // Shuffle final selection so old/new cycle questions are mixed
        selectedQuestions = shuffle(selectedQuestions)
      }

      // Create session atomically using RPC function
      // This inserts session, questions, and progress in a single transaction
      const questionsPayload = selectedQuestions.map((question, index) => ({
        question_id: question.id,
        question_order: index,
      }))

      const { data: sessionId, error: createError } = await supabase.rpc(
        'create_practice_session',
        {
          p_student_id: authStore.user.id,
          p_topic_id: subTopicId,
          p_grade_level_id: hierarchy.gradeLevel.id,
          p_subject_id: hierarchy.subject.id,
          p_questions: questionsPayload,
          p_cycle_number: currentCycle,
        },
      )

      if (createError) {
        return { session: null, error: handleError(createError, 'Failed to start session.') }
      }

      const session: PracticeSession = {
        id: sessionId,
        studentId: authStore.user.id,
        gradeLevelId: hierarchy.gradeLevel.id,
        gradeLevelName: hierarchy.gradeLevel.name,
        subjectId: hierarchy.subject.id,
        subjectName: hierarchy.subject.name,
        subTopicId: subTopicId,
        topicName: hierarchy.topic.name,
        subTopicName: hierarchy.subTopic.name,
        totalQuestions: selectedQuestions.length,
        currentQuestionIndex: 0,
        correctCount: 0,
        answerCount: 0,
        totalTimeSeconds: 0,
        xpEarned: null,
        coinsEarned: null,
        aiSummary: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        questions: selectedQuestions,
        answers: [],
      }

      currentSession.value = session
      sessionHistory.value.unshift(session)

      // Invalidate session limit cache (session count changed)
      subscription.invalidateSessionLimitCache()

      return { session, error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to start session.')
      error.value = message
      return { session: null, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Submit an answer to the current question
   * @param selectedOptionIds - Array of option IDs for MCQ/MRQ (e.g., ['a'] for MCQ, ['a', 'c'] for MRQ)
   * @param textAnswer - Text answer for short_answer questions
   * @param timeSpentSeconds - Time spent on this question
   */
  async function submitAnswer(
    selectedOptionIds?: string[],
    textAnswer?: string,
    timeSpentSeconds?: number,
  ): Promise<{ answer: PracticeAnswer | null; error: string | null }> {
    if (!currentSession.value || !currentQuestion.value) {
      return { answer: null, error: 'No active session or question' }
    }

    const question = currentQuestion.value
    let isCorrect = false

    if (question.type === 'mcq' && selectedOptionIds && selectedOptionIds.length === 1) {
      // MCQ: single correct answer
      const selectedOption = question.options.find((o) => o.id === selectedOptionIds[0])
      isCorrect = selectedOption?.isCorrect ?? false
    } else if (question.type === 'mrq' && selectedOptionIds && selectedOptionIds.length > 0) {
      // MRQ: must select ALL correct options and NO incorrect options
      const correctOptionIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id as string)
      const selectedSet = new Set(selectedOptionIds)
      const correctSet = new Set(correctOptionIds)

      // Check if sets are equal (same size and all elements match)
      isCorrect =
        selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id))
    } else if (question.type === 'short_answer' && textAnswer && question.answer) {
      // Simple case-insensitive comparison for short answers
      isCorrect = textAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase()
    }

    try {
      // Convert option IDs to numbers for database storage
      const selectedOptionsNumbers =
        selectedOptionIds && selectedOptionIds.length > 0
          ? selectedOptionIds.map((id) => optionIdToNumber(id))
          : null

      // Insert answer into database
      const { data: answerData, error: insertError } = await supabase
        .from('practice_answers')
        .insert({
          session_id: currentSession.value.id,
          question_id: question.id,
          selected_options: selectedOptionsNumbers,
          text_answer: textAnswer ?? null,
          is_correct: isCorrect,
          time_spent_seconds: timeSpentSeconds ?? null,
        })
        .select()
        .single()

      if (insertError) {
        return { answer: null, error: handleError(insertError, 'Failed to submit answer.') }
      }

      const answer = rowToAnswer(answerData)
      currentSession.value.answers.push(answer)

      // Update local counts for UI
      currentSession.value.answerCount++
      if (isCorrect) {
        currentSession.value.correctCount++
      }

      return { answer, error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to submit answer.')
      return { answer: null, error: message }
    }
  }

  /**
   * Move to the next question
   */
  async function nextQuestion(): Promise<boolean> {
    if (!currentSession.value) return false

    if (currentSession.value.currentQuestionIndex < currentSession.value.totalQuestions - 1) {
      currentSession.value.currentQuestionIndex++

      // Update in database
      await supabase
        .from('practice_sessions')
        .update({ current_question_index: currentSession.value.currentQuestionIndex })
        .eq('id', currentSession.value.id)

      return true
    }
    return false
  }

  /**
   * Move to the previous question
   */
  async function previousQuestion(): Promise<boolean> {
    if (!currentSession.value) return false

    if (currentSession.value.currentQuestionIndex > 0) {
      currentSession.value.currentQuestionIndex--

      // Update in database
      await supabase
        .from('practice_sessions')
        .update({ current_question_index: currentSession.value.currentQuestionIndex })
        .eq('id', currentSession.value.id)

      return true
    }
    return false
  }

  /**
   * Go to a specific question
   */
  async function goToQuestion(index: number): Promise<boolean> {
    if (!currentSession.value) return false

    if (index >= 0 && index < currentSession.value.totalQuestions) {
      currentSession.value.currentQuestionIndex = index

      // Update in database
      await supabase
        .from('practice_sessions')
        .update({ current_question_index: index })
        .eq('id', currentSession.value.id)

      return true
    }
    return false
  }

  /**
   * Complete the current session
   */
  async function completeSession(): Promise<{
    session: PracticeSession | null
    error: string | null
  }> {
    if (!currentSession.value) {
      return { session: null, error: 'No active session' }
    }

    try {
      // Complete session atomically using RPC function
      // Server counts correct answers from practice_answers and calculates rewards
      const { data: rewards, error: completeError } = await supabase.rpc(
        'complete_practice_session',
        { p_session_id: currentSession.value.id },
      )

      if (completeError) {
        return { session: null, error: handleError(completeError, 'Failed to complete session.') }
      }

      const result = rewards as { xp_earned: number; coins_earned: number; correct_count: number }

      // Update local session state with server-calculated values
      currentSession.value.completedAt = new Date().toISOString()
      currentSession.value.totalTimeSeconds = currentSession.value.answers.reduce(
        (sum, a) => sum + (a.timeSpentSeconds ?? 0),
        0,
      )
      currentSession.value.correctCount = result.correct_count
      currentSession.value.xpEarned = result.xp_earned
      currentSession.value.coinsEarned = result.coins_earned

      // Update the corresponding entry in sessionHistory so in-memory state is current
      const historyIndex = sessionHistory.value.findIndex((s) => s.id === currentSession.value!.id)
      if (historyIndex !== -1) {
        sessionHistory.value[historyIndex] = { ...currentSession.value }
      }

      // Invalidate session history cache so next fetch will hit DB
      sessionHistoryLastFetched.value = null

      // Refresh auth store to get updated XP/coins from database
      await authStore.refreshProfile()

      // Invalidate session limit cache (session count changed)
      subscription.invalidateSessionLimitCache()

      // Generate AI summary for Max tier subscribers (non-blocking)
      generateAiSummary(currentSession.value.id)

      return { session: currentSession.value, error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to complete session.')
      return { session: null, error: message }
    }
  }

  /**
   * Generate AI summary for a session (Max tier only)
   * This is called non-blocking after session completion
   */
  async function generateAiSummary(sessionId: string): Promise<void> {
    try {
      // Check subscription status
      const subscriptionStatus = await subscription.getStudentSubscriptionStatus()
      if (subscriptionStatus.tier !== 'max') {
        return // Only Max tier gets AI summaries
      }

      // Call Edge Function to generate summary
      const { data, error } = await supabase.functions.invoke('generate-session-summary', {
        body: { sessionId },
      })

      if (error) {
        console.error('Failed to generate AI summary:', error)
        return
      }

      // Update current session if it's still loaded
      if (currentSession.value?.id === sessionId && data?.summary) {
        currentSession.value.aiSummary = data.summary
      }
    } catch (err) {
      console.error('Error generating AI summary:', err)
    }
  }

  /**
   * End the current session (clear from memory)
   */
  function endSession() {
    currentSession.value = null
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

  /**
   * Resume an incomplete session
   */
  async function resumeSession(
    sessionId: string,
  ): Promise<{ session: PracticeSession | null; error: string | null }> {
    const result = await getSessionById(sessionId)
    if (result.error || !result.session) {
      return result
    }

    if (result.session.completedAt) {
      return { session: null, error: 'Session is already completed' }
    }

    // Fetch questions from session_questions table to get the original question order
    const { data: sessionQuestionsData, error: sqError } = await supabase
      .from('session_questions')
      .select('question_id, question_order')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true })

    if (sqError) {
      return { session: null, error: handleError(sqError, 'Failed to resume session.') }
    }

    if (!sessionQuestionsData || sessionQuestionsData.length === 0) {
      return { session: null, error: 'Session questions not found' }
    }

    const questionIds = sessionQuestionsData.map((sq) => sq.question_id)

    // Fetch the actual question data
    const { data: questionsData, error: qError } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionIds)

    if (qError) {
      return { session: null, error: handleError(qError, 'Failed to resume session.') }
    }

    // Create a map for quick lookup
    const questionsMap = new Map<string, Question>()
    if (questionsData) {
      for (const row of questionsData) {
        const hierarchy = curriculumStore.getSubTopicWithHierarchy(row.topic_id)
        questionsMap.set(row.id, {
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

    // Build questions array in the original order
    result.session.questions = sessionQuestionsData
      .map((sq) => questionsMap.get(sq.question_id))
      .filter((q): q is Question => q !== undefined)

    currentSession.value = result.session

    return { session: result.session, error: null }
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

  // Practice navigation setters
  function setPracticeSubject(subjectId: string | null) {
    practiceNavigation.value.selectedSubjectId = subjectId
    // Reset topic when subject changes
    practiceNavigation.value.selectedTopicId = null
  }

  function setPracticeTopic(topicId: string | null) {
    practiceNavigation.value.selectedTopicId = topicId
  }

  function resetPracticeNavigation() {
    practiceNavigation.value = {
      selectedSubjectId: null,
      selectedTopicId: null,
    }
  }

  /**
   * Fetch unique questions answered per sub-topic for the current student
   * This counts distinct question_ids from student_question_progress
   */
  async function fetchSubTopicProgress(): Promise<void> {
    if (!authStore.user) return

    try {
      // Query distinct question_ids per topic_id (which references sub_topics)
      const { data, error: fetchError } = await supabase
        .from('student_question_progress')
        .select('topic_id, question_id')
        .eq('student_id', authStore.user.id)

      if (fetchError) {
        console.error('Error fetching sub-topic progress:', fetchError)
        return
      }

      // Count unique questions per sub-topic
      const progressMap = new Map<string, Set<string>>()
      for (const row of data ?? []) {
        if (!progressMap.has(row.topic_id)) {
          progressMap.set(row.topic_id, new Set())
        }
        progressMap.get(row.topic_id)!.add(row.question_id)
      }

      // Convert to count map
      const countMap = new Map<string, number>()
      for (const [topicId, questionIds] of progressMap) {
        countMap.set(topicId, questionIds.size)
      }

      subTopicProgress.value = countMap
    } catch (err) {
      console.error('Error fetching sub-topic progress:', err)
    }
  }

  /**
   * Get answered question count for a specific sub-topic
   */
  function getSubTopicAnsweredCount(subTopicId: string): number {
    return subTopicProgress.value.get(subTopicId) ?? 0
  }

  // Reset store state (call on logout)
  function $reset() {
    currentSession.value = null
    sessionHistory.value = []
    sessionHistoryLastFetched.value = null
    isLoading.value = false
    error.value = null
    subscription.$reset()
    subTopicProgress.value = new Map()
    resetHistoryFilters()
    historyPagination.value = { pageIndex: 0, pageSize: 10 }
    resetPracticeNavigation()
  }

  /**
   * Generate AI summary for a completed session (Edge Function)
   */
  async function generateSessionSummary(
    sessionId: string,
  ): Promise<{ summary: string | null; error: string | null }> {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-session-summary', {
        body: { sessionId },
      })

      if (fnError) {
        return { summary: null, error: handleError(fnError, 'Failed to generate AI summary') }
      }

      return { summary: data?.summary ?? null, error: null }
    } catch (err) {
      return { summary: null, error: handleError(err, 'Failed to generate AI summary') }
    }
  }

  return {
    currentSession,
    sessionHistory,
    studentHistory,
    isLoading,
    error,
    isSessionActive,
    currentQuestion,
    currentQuestionNumber,
    totalQuestions,
    currentAnswer,
    isCurrentQuestionAnswered,
    sessionResults,
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
    // Practice navigation
    practiceNavigation,
    setPracticeSubject,
    setPracticeTopic,
    resetPracticeNavigation,
    // Sub-topic progress
    subTopicProgress,
    fetchSubTopicProgress,
    getSubTopicAnsweredCount,
    // Actions
    fetchSessionHistory,
    startSession,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    completeSession,
    endSession,
    getFilteredHistory,
    getHistoryGradeLevels,
    getHistorySubjects,
    getHistoryTopics,
    getHistorySubTopics,
    getSessionById,
    generateSessionSummary,
    resumeSession,
    optionNumberToId,
    optionNumbersToIds,
    getStudentSubscriptionStatus: subscription.getStudentSubscriptionStatus,
    checkSessionLimit: subscription.checkSessionLimit,
    $reset,
  }
})
