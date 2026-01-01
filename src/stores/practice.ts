import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'
import { useQuestionsStore, type Question } from './questions'
import { useAuthStore } from './auth'
import { useCurriculumStore } from './curriculum'

type PracticeSessionRow = Database['public']['Tables']['practice_sessions']['Row']
type PracticeAnswerRow = Database['public']['Tables']['practice_answers']['Row']
type SubscriptionTier = Database['public']['Enums']['subscription_tier']

const FALLBACK_SESSIONS_PER_DAY = 3 // Fallback if database fetch fails

// Cache TTL for subscription status (check frequently enough to catch changes)
const SUBSCRIPTION_CACHE_TTL = 2 * 60 * 1000 // 2 minutes
// Cache TTL for session limit (short since sessions can be completed)
const SESSION_LIMIT_CACHE_TTL = 30 * 1000 // 30 seconds
// Cache TTL for subscription plans (rarely change)
const SUBSCRIPTION_PLANS_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

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

export type DateRangeFilter = 'today' | 'last7days' | 'last30days' | 'alltime'

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

export interface StudentSubscriptionStatus {
  isLinkedToParent: boolean
  tier: SubscriptionTier
  sessionsPerDay: number
  canViewDetailedResults: boolean // Pro and Max tiers only
}

export interface SessionLimitStatus {
  canStartSession: boolean
  sessionsToday: number
  sessionLimit: number
  remainingSessions: number
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

  // Subscription status cache
  const subscriptionStatusCache = ref<{
    status: StudentSubscriptionStatus | null
    lastFetched: number | null
  }>({
    status: null,
    lastFetched: null,
  })

  // Session limit cache (invalidated after completing a session)
  const sessionLimitCache = ref<{
    status: SessionLimitStatus | null
    lastFetched: number | null
  }>({
    status: null,
    lastFetched: null,
  })

  // Subscription plans cache (keyed by tier, rarely changes)
  const subscriptionPlansCache = ref<{
    plans: Map<string, number> // tier -> sessions_per_day
    lastFetched: number | null
  }>({
    plans: new Map(),
    lastFetched: null,
  })

  // History page filter state (persisted across navigation)
  const historyFilters = ref({
    dateRange: 'alltime' as DateRangeFilter,
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
      subTopicId: row.topic_id, // topic_id column references sub_topics
      topicName: names.topicName,
      subTopicName: names.subTopicName,
      totalQuestions: row.total_questions,
      currentQuestionIndex: row.current_question_index ?? 0,
      correctCount: row.correct_count ?? 0,
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
   * Check if subscription plans cache is stale
   */
  function isSubscriptionPlansCacheStale(): boolean {
    if (!subscriptionPlansCache.value.lastFetched) return true
    return Date.now() - subscriptionPlansCache.value.lastFetched > SUBSCRIPTION_PLANS_CACHE_TTL
  }

  /**
   * Fetch all subscription plans and cache them (parallelizable)
   */
  async function fetchSubscriptionPlans(): Promise<void> {
    if (!isSubscriptionPlansCacheStale() && subscriptionPlansCache.value.plans.size > 0) {
      return
    }
    try {
      const { data } = await supabase.from('subscription_plans').select('id, sessions_per_day')
      if (data) {
        const plans = new Map<string, number>()
        for (const plan of data) {
          plans.set(plan.id, plan.sessions_per_day ?? FALLBACK_SESSIONS_PER_DAY)
        }
        subscriptionPlansCache.value = { plans, lastFetched: Date.now() }
      }
    } catch {
      // Keep existing cache on error
    }
  }

  /**
   * Get sessions per day for a tier (from cache)
   */
  function getSessionsPerDayForTier(tier: string): number {
    return subscriptionPlansCache.value.plans.get(tier) ?? FALLBACK_SESSIONS_PER_DAY
  }

  /**
   * Get the basic tier's sessions per day from cache
   */
  async function getBasicTierSessionsPerDay(): Promise<number> {
    await fetchSubscriptionPlans()
    return getSessionsPerDayForTier('basic')
  }

  /**
   * Check if subscription status cache is stale
   */
  function isSubscriptionCacheStale(): boolean {
    if (!subscriptionStatusCache.value.status || !subscriptionStatusCache.value.lastFetched) {
      return true
    }
    return Date.now() - subscriptionStatusCache.value.lastFetched > SUBSCRIPTION_CACHE_TTL
  }

  /**
   * Get student's subscription status - checks if linked to parent and their subscription tier
   * Uses cache to avoid repeated database calls
   */
  async function getStudentSubscriptionStatus(force = false): Promise<StudentSubscriptionStatus> {
    // Return cached status if still valid
    if (!force && !isSubscriptionCacheStale() && subscriptionStatusCache.value.status) {
      return subscriptionStatusCache.value.status
    }

    if (!authStore.user || authStore.user.userType !== 'student') {
      const basicSessionsPerDay = await getBasicTierSessionsPerDay()
      const status: StudentSubscriptionStatus = {
        isLinkedToParent: false,
        tier: 'basic',
        sessionsPerDay: basicSessionsPerDay,
        canViewDetailedResults: false,
      }
      subscriptionStatusCache.value = { status, lastFetched: Date.now() }
      return status
    }

    try {
      // Fetch parent link, subscription data, and subscription plans in parallel
      const [linksResult, subscriptionResult] = await Promise.all([
        supabase
          .from('parent_student_links')
          .select('parent_id')
          .eq('student_id', authStore.user.id)
          .limit(1),
        supabase
          .from('child_subscriptions')
          .select('tier')
          .eq('student_id', authStore.user.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        fetchSubscriptionPlans(), // Pre-fetch plans in parallel
      ])

      if (linksResult.error) {
        console.error('Error checking parent links:', linksResult.error)
        const status: StudentSubscriptionStatus = {
          isLinkedToParent: false,
          tier: 'basic',
          sessionsPerDay: getSessionsPerDayForTier('basic'),
          canViewDetailedResults: false,
        }
        subscriptionStatusCache.value = { status, lastFetched: Date.now() }
        return status
      }

      const isLinkedToParent = (linksResult.data?.length ?? 0) > 0

      if (!isLinkedToParent) {
        const status: StudentSubscriptionStatus = {
          isLinkedToParent: false,
          tier: 'basic',
          sessionsPerDay: getSessionsPerDayForTier('basic'),
          canViewDetailedResults: false,
        }
        subscriptionStatusCache.value = { status, lastFetched: Date.now() }
        return status
      }

      if (subscriptionResult.error || !subscriptionResult.data) {
        const status: StudentSubscriptionStatus = {
          isLinkedToParent: true,
          tier: 'basic',
          sessionsPerDay: getSessionsPerDayForTier('basic'),
          canViewDetailedResults: false,
        }
        subscriptionStatusCache.value = { status, lastFetched: Date.now() }
        return status
      }

      const tier = subscriptionResult.data.tier as SubscriptionTier

      // Get sessions_per_day from cache (already fetched in parallel above)
      const sessionsPerDay = getSessionsPerDayForTier(tier)
      const canViewDetailedResults = tier === 'pro' || tier === 'max'

      const status: StudentSubscriptionStatus = {
        isLinkedToParent: true,
        tier,
        sessionsPerDay,
        canViewDetailedResults,
      }
      subscriptionStatusCache.value = { status, lastFetched: Date.now() }
      return status
    } catch (err) {
      console.error('Error getting subscription status:', err)
      const basicSessionsPerDay = await getBasicTierSessionsPerDay()
      const status: StudentSubscriptionStatus = {
        isLinkedToParent: false,
        tier: 'basic',
        sessionsPerDay: basicSessionsPerDay,
        canViewDetailedResults: false,
      }
      subscriptionStatusCache.value = { status, lastFetched: Date.now() }
      return status
    }
  }

  /**
   * Check if session limit cache is stale
   */
  function isSessionLimitCacheStale(): boolean {
    if (!sessionLimitCache.value.status || !sessionLimitCache.value.lastFetched) return true
    return Date.now() - sessionLimitCache.value.lastFetched > SESSION_LIMIT_CACHE_TTL
  }

  /**
   * Invalidate session limit cache (call after completing a session)
   */
  function invalidateSessionLimitCache(): void {
    sessionLimitCache.value = { status: null, lastFetched: null }
  }

  /**
   * Check session limit for current student (with caching)
   */
  async function checkSessionLimit(force = false): Promise<SessionLimitStatus> {
    if (!authStore.user || authStore.user.userType !== 'student') {
      return {
        canStartSession: false,
        sessionsToday: 0,
        sessionLimit: 0,
        remainingSessions: 0,
      }
    }

    // Return cached status if still valid
    if (!force && !isSessionLimitCacheStale() && sessionLimitCache.value.status) {
      return sessionLimitCache.value.status
    }

    const subscriptionStatus = await getStudentSubscriptionStatus()

    // Get today's date range
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Count completed sessions today
    const { count, error: countError } = await supabase
      .from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', authStore.user.id)
      .not('completed_at', 'is', null)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())

    if (countError) {
      console.error('Error counting sessions:', countError)
      const status: SessionLimitStatus = {
        canStartSession: true, // Allow on error to not block users
        sessionsToday: 0,
        sessionLimit: subscriptionStatus.sessionsPerDay,
        remainingSessions: subscriptionStatus.sessionsPerDay,
      }
      // Don't cache error results
      return status
    }

    const sessionsToday = count ?? 0
    const remainingSessions = Math.max(0, subscriptionStatus.sessionsPerDay - sessionsToday)

    const status: SessionLimitStatus = {
      canStartSession: sessionsToday < subscriptionStatus.sessionsPerDay,
      sessionsToday,
      sessionLimit: subscriptionStatus.sessionsPerDay,
      remainingSessions,
    }

    sessionLimitCache.value = { status, lastFetched: Date.now() }
    return status
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
      const limitStatus = await checkSessionLimit()
      if (!limitStatus.canStartSession) {
        return {
          session: null,
          error: `You have reached your daily session limit (${limitStatus.sessionLimit} sessions). Upgrade your plan for more sessions!`,
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

      // Create session in database
      const { data: sessionData, error: insertError } = await supabase
        .from('practice_sessions')
        .insert({
          student_id: authStore.user.id,
          topic_id: subTopicId, // topic_id column references sub_topics
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

      // Insert selected questions into session_questions table to preserve order
      const sessionQuestionsData = selectedQuestions.map((question, index) => ({
        session_id: sessionData.id,
        question_id: question.id,
        question_order: index,
      }))

      const { error: questionsInsertError } = await supabase
        .from('session_questions')
        .insert(sessionQuestionsData)

      if (questionsInsertError) {
        // If we fail to insert questions, delete the session and return error
        await supabase.from('practice_sessions').delete().eq('id', sessionData.id)
        return { session: null, error: questionsInsertError.message }
      }

      // Record question progress for cycling - mark all selected questions as "used" in current cycle
      const progressInsertData = selectedQuestions.map((question) => ({
        student_id: authStore.user!.id,
        topic_id: subTopicId, // topic_id column references sub_topics
        question_id: question.id,
        cycle_number: currentCycle,
      }))

      // Use upsert to handle any edge cases where a question might already be recorded
      // Requires unique constraint on (student_id, topic_id, question_id, cycle_number)
      const { error: progressError } = await supabase
        .from('student_question_progress')
        .upsert(progressInsertData, { onConflict: 'student_id,topic_id,question_id,cycle_number' })

      if (progressError) {
        console.error('Failed to record question progress:', progressError)
        // Don't fail the session, but log for debugging
      }

      const session: PracticeSession = {
        id: sessionData.id,
        studentId: sessionData.student_id,
        gradeLevelId: sessionData.grade_level_id,
        gradeLevelName: hierarchy.gradeLevel.name,
        subjectId: sessionData.subject_id,
        subjectName: hierarchy.subject.name,
        subTopicId: sessionData.topic_id, // topic_id column references sub_topics
        topicName: hierarchy.topic.name,
        subTopicName: hierarchy.subTopic.name,
        totalQuestions: sessionData.total_questions,
        currentQuestionIndex: 0,
        correctCount: 0,
        totalTimeSeconds: 0,
        xpEarned: null,
        coinsEarned: null,
        aiSummary: null,
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
      // Calculate total time from answers (sum of time_spent_seconds)
      const totalTimeSeconds = currentSession.value.answers.reduce(
        (sum, a) => sum + (a.timeSpentSeconds ?? 0),
        0,
      )

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
          total_time_seconds: totalTimeSeconds,
          xp_earned: totalXp,
          coins_earned: totalCoins,
        })
        .eq('id', currentSession.value.id)

      if (updateError) {
        return { session: null, error: updateError.message }
      }

      currentSession.value.completedAt = new Date().toISOString()
      currentSession.value.totalTimeSeconds = totalTimeSeconds
      currentSession.value.xpEarned = totalXp
      currentSession.value.coinsEarned = totalCoins

      // Award XP and coins to user
      authStore.addXp(totalXp)
      authStore.addCoins(totalCoins)

      // Invalidate session limit cache (session count changed)
      invalidateSessionLimitCache()

      // Generate AI summary for Max tier subscribers (non-blocking)
      generateAiSummary(currentSession.value.id)

      return { session: currentSession.value, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete session'
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
      const subscriptionStatus = await getStudentSubscriptionStatus()
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

    const dateRangeStart = dateRange ? getDateRangeStart(dateRange) : null

    return sessionHistory.value
      .filter((s) => s.studentId === authStore.user!.id)
      .filter((s) => {
        if (gradeLevelName && s.gradeLevelName !== gradeLevelName) return false
        if (subjectName && s.subjectName !== subjectName) return false
        if (topicName && s.topicName !== topicName) return false
        if (subTopicName && s.subTopicName !== subTopicName) return false
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
   * Get unique sub-topics from student's history
   */
  function getHistorySubTopics(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): string[] {
    if (!authStore.user) return []
    let sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    if (gradeLevelName) {
      sessions = sessions.filter((s) => s.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      sessions = sessions.filter((s) => s.subjectName === subjectName)
    }
    if (topicName) {
      sessions = sessions.filter((s) => s.topicName === topicName)
    }
    const subTopics = new Set(sessions.map((s) => s.subTopicName))
    return Array.from(subTopics).sort()
  }

  /**
   * Get a specific session by ID with full details
   * Uses parallel queries for better performance
   */
  async function getSessionById(
    sessionId: string,
  ): Promise<{ session: PracticeSession | null; error: string | null }> {
    try {
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
        return { session: null, error: sessionResult.error.message }
      }
      if (answersResult.error) {
        return { session: null, error: answersResult.error.message }
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

    // Fetch questions from session_questions table to get the original question order
    const { data: sessionQuestionsData, error: sqError } = await supabase
      .from('session_questions')
      .select('question_id, question_order')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true })

    if (sqError) {
      return { session: null, error: sqError.message }
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
      return { session: null, error: qError.message }
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

  // Reset store state (call on logout)
  function $reset() {
    currentSession.value = null
    sessionHistory.value = []
    isLoading.value = false
    error.value = null
    subscriptionStatusCache.value = { status: null, lastFetched: null }
    sessionLimitCache.value = { status: null, lastFetched: null }
    subscriptionPlansCache.value = { plans: new Map(), lastFetched: null }
    resetHistoryFilters()
    historyPagination.value = { pageIndex: 0, pageSize: 10 }
    resetPracticeNavigation()
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
    resumeSession,
    optionNumberToId,
    optionNumbersToIds,
    getStudentSubscriptionStatus,
    checkSessionLimit,
    $reset,
  }
})
