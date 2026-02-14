import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
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

// Cache TTL for student statistics (re-fetch when navigating back after this period)
const STATISTICS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export type { DateRangeFilter }

type QuestionRow = Database['public']['Tables']['questions']['Row']
type SubscriptionTier = Database['public']['Enums']['subscription_tier']

export interface QuestionOption {
  id: string // 'a', 'b', 'c', 'd'
  text: string | null
  imagePath: string | null
  isCorrect: boolean
}

export interface AdminStudent {
  id: string
  name: string
  email: string
  dateOfBirth: string | null
  subscriptionTier: SubscriptionTier | null
  parentName: string | null
  parentEmail: string | null
  joinedAt: string | null
  lastActive: string | null
  gradeLevelName: string | null
  xp: number
  coins: number
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

export interface StudentEngagementData {
  coins: number
  xp: number
  level: number
  xpProgress: number
  currentStreak: number
  food: number
  selectedPetId: string | null
  ownedPets: StudentOwnedPet[]
  moodHistory: MoodEntry[]
  subscription: StudentSubscriptionDetail | null
}

export interface StudentOwnedPet {
  petId: string
  petName: string
  rarity: string
  tier: number
  count: number
  imagePath: string
  tier2ImagePath: string | null
  tier3ImagePath: string | null
}

export interface MoodEntry {
  date: string
  mood: 'sad' | 'neutral' | 'happy' | null
  hasPracticed: boolean
}

export interface StudentSubscriptionDetail {
  tier: string
  isActive: boolean
  stripeStatus: string | null
  startDate: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingDate: string | null
  cancelAtPeriodEnd: boolean
  scheduledTier: string | null
  scheduledChangeDate: string | null
  paymentHistory: PaymentHistoryEntry[]
}

export interface PaymentHistoryEntry {
  id: string
  amountCents: number
  currency: string
  status: string
  tier: string | null
  description: string | null
  createdAt: string
}

export const useAdminStudentsStore = defineStore('adminStudents', () => {
  const authStore = useAuthStore()

  // Students list state
  const students = ref<AdminStudent[]>([])
  const isLoadingStudents = ref(false)
  const studentsError = ref<string | null>(null)

  // Student statistics state
  const studentStatistics = ref<StudentStatistics[]>([])
  const isLoadingStatistics = ref(false)
  const statisticsError = ref<string | null>(null)

  // Track when each student's statistics were last fetched (for TTL-based cache)
  const statsLastFetched = ref<Map<string, number>>(new Map())

  // Student engagement data
  const studentEngagement = ref<Map<string, StudentEngagementData>>(new Map())
  const engagementLastFetched = ref<Map<string, number>>(new Map())
  const isLoadingEngagement = ref(false)

  // Students table filter state
  const studentsFilters = ref({
    search: '',
  })

  // Students table pagination state
  const studentsPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  // Statistics page filter state
  const statisticsFilters = ref({
    dateRange: 'alltime' as DateRangeFilter,
    gradeLevel: '__all__',
    subject: '__all__',
    topic: '__all__',
    subTopic: '__all__',
  })

  // Statistics page table pagination state
  const statisticsPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  /**
   * Fetch all students with joined data
   */
  async function fetchAllStudents(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { error: 'Not authenticated as admin' }
    }

    isLoadingStudents.value = true
    studentsError.value = null

    try {
      // Fetch all student profiles with their subscriptions and parent links
      const { data: studentsData, error: fetchError } = await supabase
        .from('profiles')
        .select(
          `
          id,
          email,
          name,
          date_of_birth,
          created_at,
          parent_student_links!parent_student_links_student_id_fkey (
            parent:profiles!parent_student_links_parent_id_fkey (
              name,
              email
            )
          ),
          daily_statuses!daily_statuses_student_id_fkey (
            date
          ),
          student_profiles!student_profiles_id_fkey (
            xp,
            coins,
            subscription_tier,
            grade_levels (
              name
            )
          )
        `,
        )
        .eq('user_type', 'student')
        .order('name')

      if (fetchError) throw fetchError

      // Transform the data
      students.value = (studentsData ?? []).map((student) => {
        // Get parent info - handle both array and single object cases
        const parentLinksRaw = student.parent_student_links
        const parentLinks = Array.isArray(parentLinksRaw)
          ? parentLinksRaw
          : parentLinksRaw
            ? [parentLinksRaw]
            : []
        const parentInfo = (parentLinks as { parent: { name: string; email: string } | null }[])[0]
          ?.parent

        // Get last active from most recent daily status (logged in date)
        const statusesRaw = student.daily_statuses
        const statuses = Array.isArray(statusesRaw) ? statusesRaw : statusesRaw ? [statusesRaw] : []
        const statusDates = (statuses as { date: string | null }[])
          .map((s) => s.date)
          .filter(Boolean) as string[]
        const lastActive =
          statusDates.length > 0
            ? (statusDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null)
            : null

        // Get student profile data (xp, coins, tier, and grade level)
        const studentProfile = student.student_profiles as {
          xp: number | null
          coins: number | null
          subscription_tier: SubscriptionTier
          grade_levels: { name: string } | null
        } | null
        const xp = studentProfile?.xp ?? 0
        const coins = studentProfile?.coins ?? 0
        const gradeLevelName = studentProfile?.grade_levels?.name ?? null

        return {
          id: student.id,
          name: student.name ?? 'Unknown',
          email: student.email ?? '',
          dateOfBirth: student.date_of_birth,
          subscriptionTier: studentProfile?.subscription_tier ?? null,
          parentName: parentInfo?.name ?? null,
          parentEmail: parentInfo?.email ?? null,
          joinedAt: student.created_at,
          lastActive,
          gradeLevelName,
          xp,
          coins,
        }
      })

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch students.')
      studentsError.value = message
      return { error: message }
    } finally {
      isLoadingStudents.value = false
    }
  }

  /**
   * Fetch engagement data for a specific student (pets, mood, subscription)
   */
  async function fetchStudentEngagement(studentId: string): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { error: 'Not authenticated as admin' }
    }

    // Skip if cache is still valid
    const lastFetched = engagementLastFetched.value.get(studentId)
    if (lastFetched && Date.now() - lastFetched < STATISTICS_CACHE_TTL) {
      return { error: null }
    }

    isLoadingEngagement.value = true

    try {
      // Parallel fetch all engagement data
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]!

      const [profileResult, petsResult, moodResult, subscriptionResult, paymentResult] =
        await Promise.all([
          supabase
            .from('student_profiles')
            .select('coins, xp, current_streak, food, selected_pet_id')
            .eq('id', studentId)
            .single(),
          supabase
            .from('owned_pets')
            .select(
              'pet_id, tier, count, pets (name, rarity, image_path, tier2_image_path, tier3_image_path)',
            )
            .eq('student_id', studentId),
          supabase
            .from('daily_statuses')
            .select('date, mood, has_practiced')
            .eq('student_id', studentId)
            .gte('date', thirtyDaysAgoStr)
            .order('date', { ascending: false }),
          supabase
            .from('child_subscriptions')
            .select(
              'tier, is_active, stripe_status, start_date, current_period_start, current_period_end, next_billing_date, cancel_at_period_end, scheduled_tier, scheduled_change_date',
            )
            .eq('student_id', studentId)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('payment_history')
            .select('id, amount_cents, currency, status, tier, description, created_at')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(10),
        ])

      if (profileResult.error) throw profileResult.error
      if (petsResult.error) throw petsResult.error
      if (moodResult.error) throw moodResult.error
      if (subscriptionResult.error) throw subscriptionResult.error
      if (paymentResult.error) throw paymentResult.error

      const profile = profileResult.data
      const xp = profile?.xp ?? 0
      const level = Math.floor(xp / 500) + 1
      const xpProgress = xp % 500

      // Transform owned pets
      const ownedPets: StudentOwnedPet[] = (petsResult.data ?? []).map((op) => {
        const pet = op.pets as unknown as {
          name: string
          rarity: string
          image_path: string
          tier2_image_path: string | null
          tier3_image_path: string | null
        } | null
        return {
          petId: op.pet_id,
          petName: pet?.name ?? 'Unknown',
          rarity: pet?.rarity ?? 'common',
          tier: op.tier,
          count: op.count ?? 1,
          imagePath: pet?.image_path ?? '',
          tier2ImagePath: pet?.tier2_image_path ?? null,
          tier3ImagePath: pet?.tier3_image_path ?? null,
        }
      })

      // Transform mood history
      const moodHistory: MoodEntry[] = (moodResult.data ?? []).map((d) => ({
        date: d.date,
        mood: d.mood as MoodEntry['mood'],
        hasPracticed: d.has_practiced ?? false,
      }))

      // Transform payment history
      const paymentHistory: PaymentHistoryEntry[] = (paymentResult.data ?? []).map((p) => ({
        id: p.id,
        amountCents: p.amount_cents,
        currency: p.currency,
        status: p.status,
        tier: p.tier,
        description: p.description,
        createdAt: p.created_at ?? new Date().toISOString(),
      }))

      // Transform subscription
      const sub = subscriptionResult.data
      const subscription: StudentSubscriptionDetail | null = sub
        ? {
            tier: sub.tier,
            isActive: sub.is_active ?? false,
            stripeStatus: sub.stripe_status,
            startDate: sub.start_date,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            nextBillingDate: sub.next_billing_date,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            scheduledTier: sub.scheduled_tier,
            scheduledChangeDate: sub.scheduled_change_date,
            paymentHistory,
          }
        : null

      studentEngagement.value.set(studentId, {
        coins: profile?.coins ?? 0,
        xp,
        level,
        xpProgress,
        currentStreak: profile?.current_streak ?? 0,
        food: profile?.food ?? 0,
        selectedPetId: profile?.selected_pet_id ?? null,
        ownedPets,
        moodHistory,
        subscription,
      })

      // Update cache timestamp
      engagementLastFetched.value.set(studentId, Date.now())

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch engagement data.')
      return { error: message }
    } finally {
      isLoadingEngagement.value = false
    }
  }

  /**
   * Fetch daily statuses for a student for a specific month (calendar view)
   */
  async function fetchStudentDailyStatuses(
    studentId: string,
    year: number,
    month: number,
  ): Promise<{ statuses: MoodEntry[]; error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { statuses: [], error: 'Not authenticated as admin' }
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    try {
      const { data, error: fetchError } = await supabase
        .from('daily_statuses')
        .select('date, mood, has_practiced')
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (fetchError) {
        return { statuses: [], error: handleError(fetchError, 'Failed to fetch daily statuses.') }
      }

      const statuses: MoodEntry[] = (data ?? []).map((d) => ({
        date: d.date,
        mood: d.mood as MoodEntry['mood'],
        hasPracticed: d.has_practiced ?? false,
      }))

      return { statuses, error: null }
    } catch (err) {
      return { statuses: [], error: handleError(err, 'Failed to fetch daily statuses.') }
    }
  }

  /**
   * Get a student by ID from the loaded students
   */
  function getStudentById(studentId: string): AdminStudent | undefined {
    return students.value.find((s) => s.id === studentId)
  }

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
      const student = getStudentById(studentId)

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

  // Get engagement data for a specific student
  function getStudentEngagement(studentId: string): StudentEngagementData | undefined {
    return studentEngagement.value.get(studentId)
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

  // Filtered students computed (applies search filter)
  const filteredStudents = computed(() => {
    const searchQuery = studentsFilters.value.search.toLowerCase().trim()
    if (!searchQuery) return students.value

    return students.value.filter(
      (student) =>
        student.name.toLowerCase().includes(searchQuery) ||
        student.email.toLowerCase().includes(searchQuery) ||
        (student.parentName && student.parentName.toLowerCase().includes(searchQuery)) ||
        (student.parentEmail && student.parentEmail.toLowerCase().includes(searchQuery)),
    )
  })

  // Students filter setters
  function setStudentsSearch(value: string) {
    studentsFilters.value.search = value
    // Reset pagination when search changes
    studentsPagination.value.pageIndex = 0
  }

  // Students pagination setters
  function setStudentsPageIndex(value: number) {
    studentsPagination.value.pageIndex = value
  }

  function setStudentsPageSize(value: number) {
    studentsPagination.value.pageSize = value
    studentsPagination.value.pageIndex = 0
  }

  // Statistics filter setters
  function setStatisticsDateRange(value: DateRangeFilter) {
    statisticsFilters.value.dateRange = value
  }

  function setStatisticsGradeLevel(value: string) {
    statisticsFilters.value.gradeLevel = value
    statisticsFilters.value.subject = '__all__'
    statisticsFilters.value.topic = '__all__'
    statisticsFilters.value.subTopic = '__all__'
  }

  function setStatisticsSubject(value: string) {
    statisticsFilters.value.subject = value
    statisticsFilters.value.topic = '__all__'
    statisticsFilters.value.subTopic = '__all__'
  }

  function setStatisticsTopic(value: string) {
    statisticsFilters.value.topic = value
    statisticsFilters.value.subTopic = '__all__'
  }

  function setStatisticsSubTopic(value: string) {
    statisticsFilters.value.subTopic = value
  }

  function resetStatisticsFilters() {
    statisticsFilters.value = {
      dateRange: 'alltime',
      gradeLevel: '__all__',
      subject: '__all__',
      topic: '__all__',
      subTopic: '__all__',
    }
    statisticsPagination.value = {
      pageIndex: 0,
      pageSize: 10,
    }
  }

  // Statistics pagination setters
  function setStatisticsPageIndex(value: number) {
    statisticsPagination.value.pageIndex = value
  }

  function setStatisticsPageSize(value: number) {
    statisticsPagination.value.pageSize = value
    statisticsPagination.value.pageIndex = 0
  }

  // Reset store state
  function $reset() {
    students.value = []
    studentStatistics.value = []
    isLoadingStudents.value = false
    isLoadingStatistics.value = false
    isLoadingEngagement.value = false
    studentsError.value = null
    statisticsError.value = null
    statsLastFetched.value.clear()
    studentEngagement.value.clear()
    engagementLastFetched.value.clear()
    studentsFilters.value = { search: '' }
    studentsPagination.value = { pageIndex: 0, pageSize: 10 }
    resetStatisticsFilters()
  }

  return {
    // State
    students,
    isLoadingStudents,
    studentsError,
    studentStatistics,
    isLoadingStatistics,
    statisticsError,
    isLoadingEngagement,

    // Computed
    filteredStudents,

    // Students filters
    studentsFilters,
    setStudentsSearch,

    // Students pagination
    studentsPagination,
    setStudentsPageIndex,
    setStudentsPageSize,

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
    fetchAllStudents,
    fetchStudentStatistics,
    fetchStudentEngagement,
    fetchStudentDailyStatuses,
    getStudentById,
    getStudentStatistics,
    getStudentEngagement,
    getSessionById,
    getFilteredSessions,
    getGradeLevels,
    getSubjects,
    getTopics,
    getSubTopics,
    $reset,
  }
})
