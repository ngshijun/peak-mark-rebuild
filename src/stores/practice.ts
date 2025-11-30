import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'
import { useQuestionsStore, type Question } from './questions'
import { useAuthStore } from './auth'
import { useCurriculumStore } from './curriculum'

type PracticeSessionRow = Database['public']['Tables']['practice_sessions']['Row']
type PracticeAnswerRow = Database['public']['Tables']['practice_answers']['Row']

export type DateRangeFilter = 'today' | 'last7days' | 'last30days' | 'alltime'

export interface PracticeAnswer {
  id: string
  questionId: string | null
  selectedOption: number | null // 1-4 for options a-d
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
  topicId: string
  topicName: string
  totalQuestions: number
  currentQuestionIndex: number
  correctCount: number
  xpEarned: number | null
  coinsEarned: number | null
  createdAt: string | null
  completedAt: string | null
  // Loaded separately
  questions: Question[]
  answers: PracticeAnswer[]
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

export const usePracticeStore = defineStore('practice', () => {
  const currentSession = ref<PracticeSession | null>(null)
  const sessionHistory = ref<PracticeSession[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
   * Convert option id ('a', 'b', 'c', 'd') to option number (1, 2, 3, 4)
   */
  function optionIdToNumber(optionId: string): number {
    const map: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 }
    return map[optionId] ?? 1
  }

  /**
   * Convert option number (1, 2, 3, 4) to option id ('a', 'b', 'c', 'd')
   */
  function optionNumberToId(optionNumber: number): 'a' | 'b' | 'c' | 'd' {
    const map: Record<number, 'a' | 'b' | 'c' | 'd'> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }
    return map[optionNumber] ?? 'a'
  }

  /**
   * Get curriculum names for a topic
   */
  function getCurriculumNames(
    topicId: string,
    gradeLevelId: string | null,
    subjectId: string | null,
  ): {
    gradeLevelName: string
    subjectName: string
    topicName: string
  } {
    const hierarchy = curriculumStore.getTopicWithHierarchy(topicId)
    if (hierarchy) {
      return {
        gradeLevelName: hierarchy.gradeLevel.name,
        subjectName: hierarchy.subject.name,
        topicName: hierarchy.topic.name,
      }
    }
    return {
      gradeLevelName: 'Unknown',
      subjectName: 'Unknown',
      topicName: 'Unknown',
    }
  }

  /**
   * Convert database row to PracticeAnswer
   */
  function rowToAnswer(row: PracticeAnswerRow): PracticeAnswer {
    return {
      id: row.id,
      questionId: row.question_id,
      selectedOption: row.selected_option,
      textAnswer: row.text_answer,
      isCorrect: row.is_correct,
      answeredAt: row.answered_at,
      timeSpentSeconds: row.time_spent_seconds,
    }
  }

  /**
   * Convert database row to PracticeSession (without questions/answers)
   */
  function rowToSession(row: PracticeSessionRow): PracticeSession {
    const names = getCurriculumNames(row.topic_id, row.grade_level_id, row.subject_id)
    return {
      id: row.id,
      studentId: row.student_id,
      gradeLevelId: row.grade_level_id,
      gradeLevelName: names.gradeLevelName,
      subjectId: row.subject_id,
      subjectName: names.subjectName,
      topicId: row.topic_id,
      topicName: names.topicName,
      totalQuestions: row.total_questions,
      currentQuestionIndex: row.current_question_index ?? 0,
      correctCount: row.correct_count ?? 0,
      xpEarned: row.xp_earned,
      coinsEarned: row.coins_earned,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      questions: [],
      answers: [],
    }
  }

  /**
   * Fetch session history for the current student
   */
  async function fetchSessionHistory(): Promise<{ error: string | null }> {
    if (!authStore.user) {
      return { error: 'Not authenticated' }
    }

    isLoading.value = true
    error.value = null

    try {
      // Ensure curriculum is loaded
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      const { data, error: fetchError } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('student_id', authStore.user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        error.value = fetchError.message
        return { error: fetchError.message }
      }

      sessionHistory.value = (data ?? []).map(rowToSession)
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session history'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Start a new practice session
   */
  async function startSession(
    topicId: string,
    questionCount: number = 10,
  ): Promise<{ session: PracticeSession | null; error: string | null }> {
    if (!authStore.user || authStore.user.userType !== 'student') {
      return { session: null, error: 'Only students can start practice sessions' }
    }

    isLoading.value = true
    error.value = null

    try {
      // Ensure curriculum is loaded
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      // Get topic hierarchy for grade_level_id and subject_id
      const hierarchy = curriculumStore.getTopicWithHierarchy(topicId)
      if (!hierarchy) {
        return { session: null, error: 'Topic not found' }
      }

      // Fetch questions for this topic
      const questionsResult = await questionsStore.fetchQuestionsByTopic(topicId)
      if (questionsResult.error) {
        return { session: null, error: questionsResult.error }
      }

      const availableQuestions = questionsResult.questions
      if (availableQuestions.length === 0) {
        return { session: null, error: 'No questions available for this topic' }
      }

      // Shuffle and select questions
      const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
      const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length))

      // Create session in database
      const { data: sessionData, error: insertError } = await supabase
        .from('practice_sessions')
        .insert({
          student_id: authStore.user.id,
          topic_id: topicId,
          grade_level_id: hierarchy.gradeLevel.id,
          subject_id: hierarchy.subject.id,
          total_questions: selectedQuestions.length,
          current_question_index: 0,
          correct_count: 0,
        })
        .select()
        .single()

      if (insertError) {
        return { session: null, error: insertError.message }
      }

      const session: PracticeSession = {
        id: sessionData.id,
        studentId: sessionData.student_id,
        gradeLevelId: sessionData.grade_level_id,
        gradeLevelName: hierarchy.gradeLevel.name,
        subjectId: sessionData.subject_id,
        subjectName: hierarchy.subject.name,
        topicId: sessionData.topic_id,
        topicName: hierarchy.topic.name,
        totalQuestions: sessionData.total_questions,
        currentQuestionIndex: 0,
        correctCount: 0,
        xpEarned: null,
        coinsEarned: null,
        createdAt: sessionData.created_at,
        completedAt: null,
        questions: selectedQuestions,
        answers: [],
      }

      currentSession.value = session
      sessionHistory.value.unshift(session)

      return { session, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start session'
      error.value = message
      return { session: null, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Submit an answer to the current question
   */
  async function submitAnswer(
    selectedOptionId?: string,
    textAnswer?: string,
    timeSpentSeconds?: number,
  ): Promise<{ answer: PracticeAnswer | null; error: string | null }> {
    if (!currentSession.value || !currentQuestion.value) {
      return { answer: null, error: 'No active session or question' }
    }

    const question = currentQuestion.value
    let isCorrect = false

    if (question.type === 'mcq' && selectedOptionId) {
      const selectedOption = question.options.find((o) => o.id === selectedOptionId)
      isCorrect = selectedOption?.isCorrect ?? false
    } else if (question.type === 'short_answer' && textAnswer && question.answer) {
      // Simple case-insensitive comparison for short answers
      isCorrect = textAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase()
    }

    try {
      // Insert answer into database
      const { data: answerData, error: insertError } = await supabase
        .from('practice_answers')
        .insert({
          session_id: currentSession.value.id,
          question_id: question.id,
          selected_option: selectedOptionId ? optionIdToNumber(selectedOptionId) : null,
          text_answer: textAnswer ?? null,
          is_correct: isCorrect,
          time_spent_seconds: timeSpentSeconds ?? null,
        })
        .select()
        .single()

      if (insertError) {
        return { answer: null, error: insertError.message }
      }

      const answer = rowToAnswer(answerData)
      currentSession.value.answers.push(answer)

      // Update correct count if correct
      if (isCorrect) {
        currentSession.value.correctCount++
        await supabase
          .from('practice_sessions')
          .update({ correct_count: currentSession.value.correctCount })
          .eq('id', currentSession.value.id)
      }

      return { answer, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer'
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
      // Calculate rewards
      const correctAnswers = currentSession.value.correctCount
      const baseXp = 50
      const bonusXp = correctAnswers * 10
      const totalXp = baseXp + bonusXp

      const baseCoins = 20
      const bonusCoins = correctAnswers * 5
      const totalCoins = baseCoins + bonusCoins

      // Update session in database
      const { error: updateError } = await supabase
        .from('practice_sessions')
        .update({
          completed_at: new Date().toISOString(),
          xp_earned: totalXp,
          coins_earned: totalCoins,
        })
        .eq('id', currentSession.value.id)

      if (updateError) {
        return { session: null, error: updateError.message }
      }

      currentSession.value.completedAt = new Date().toISOString()
      currentSession.value.xpEarned = totalXp
      currentSession.value.coinsEarned = totalCoins

      // Award XP and coins to user
      authStore.addXp(totalXp)
      authStore.addCoins(totalCoins)

      return { session: currentSession.value, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete session'
      return { session: null, error: message }
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
    dateRange?: DateRangeFilter,
  ): PracticeSession[] {
    if (!authStore.user) return []

    const dateRangeStart = dateRange ? getDateRangeStart(dateRange) : null

    return sessionHistory.value
      .filter((s) => s.studentId === authStore.user!.id)
      .filter((s) => {
        if (gradeLevelName && s.gradeLevelName !== gradeLevelName) return false
        if (subjectName && s.subjectName !== subjectName) return false
        if (topicName && s.topicName !== topicName) return false
        if (dateRangeStart && s.createdAt) {
          const sessionDate = new Date(s.createdAt)
          if (sessionDate < dateRangeStart) return false
        }
        return true
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      })
  }

  /**
   * Get unique grade levels from student's history
   */
  function getHistoryGradeLevels(): string[] {
    if (!authStore.user) return []
    const gradeLevels = new Set(
      sessionHistory.value
        .filter((s) => s.studentId === authStore.user!.id)
        .map((s) => s.gradeLevelName),
    )
    return Array.from(gradeLevels).sort()
  }

  /**
   * Get unique subjects from student's history
   */
  function getHistorySubjects(gradeLevelName?: string): string[] {
    if (!authStore.user) return []
    const sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    const filtered = gradeLevelName
      ? sessions.filter((s) => s.gradeLevelName === gradeLevelName)
      : sessions
    const subjects = new Set(filtered.map((s) => s.subjectName))
    return Array.from(subjects).sort()
  }

  /**
   * Get unique topics from student's history
   */
  function getHistoryTopics(gradeLevelName?: string, subjectName?: string): string[] {
    if (!authStore.user) return []
    let sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    if (gradeLevelName) {
      sessions = sessions.filter((s) => s.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      sessions = sessions.filter((s) => s.subjectName === subjectName)
    }
    const topics = new Set(sessions.map((s) => s.topicName))
    return Array.from(topics).sort()
  }

  /**
   * Get a specific session by ID with full details
   */
  async function getSessionById(
    sessionId: string,
  ): Promise<{ session: PracticeSession | null; error: string | null }> {
    // Check if already in history
    const cachedSession = sessionHistory.value.find((s) => s.id === sessionId)

    try {
      // Ensure curriculum is loaded
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      // Fetch session from database
      const { data: sessionData, error: sessionError } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        return { session: null, error: sessionError.message }
      }

      const session = rowToSession(sessionData)

      // Fetch answers for this session
      const { data: answersData, error: answersError } = await supabase
        .from('practice_answers')
        .select('*')
        .eq('session_id', sessionId)
        .order('answered_at', { ascending: true })

      if (answersError) {
        return { session: null, error: answersError.message }
      }

      session.answers = (answersData ?? []).map(rowToAnswer)

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
          // Get curriculum names for this question
          const hierarchy = curriculumStore.getTopicWithHierarchy(row.topic_id)
          existingQuestions.set(row.id, {
            id: row.id,
            type: row.type,
            question: row.question,
            imagePath: row.image_path,
            topicId: row.topic_id,
            gradeLevelId: row.grade_level_id,
            subjectId: row.subject_id,
            explanation: row.explanation,
            answer: row.answer,
            options: [
              { id: 'a', text: row.option_1_text, imagePath: row.option_1_image_path, isCorrect: row.option_1_is_correct ?? false },
              { id: 'b', text: row.option_2_text, imagePath: row.option_2_image_path, isCorrect: row.option_2_is_correct ?? false },
              { id: 'c', text: row.option_3_text, imagePath: row.option_3_image_path, isCorrect: row.option_3_is_correct ?? false },
              { id: 'd', text: row.option_4_text, imagePath: row.option_4_image_path, isCorrect: row.option_4_is_correct ?? false },
            ],
            createdAt: row.created_at,
            gradeLevelName: hierarchy?.gradeLevel.name ?? '',
            subjectName: hierarchy?.subject.name ?? '',
            topicName: hierarchy?.topic.name ?? '',
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
          topicId: session.topicId,
          gradeLevelId: session.gradeLevelId,
          subjectId: session.subjectId,
          explanation: null,
          answer: null,
          options: [],
          createdAt: null,
          gradeLevelName: session.gradeLevelName,
          subjectName: session.subjectName,
          topicName: session.topicName,
          isDeleted: true,
        } as Question & { isDeleted?: boolean }
      })

      return { session, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
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

    // Fetch all questions for the topic to resume
    const questionsResult = await questionsStore.fetchQuestionsByTopic(result.session.topicId)
    if (questionsResult.error) {
      return { session: null, error: questionsResult.error }
    }

    result.session.questions = questionsResult.questions.slice(0, result.session.totalQuestions)
    currentSession.value = result.session

    return { session: result.session, error: null }
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
    getSessionById,
    resumeSession,
    optionNumberToId,
  }
})
