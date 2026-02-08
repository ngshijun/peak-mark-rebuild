import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type DateRangeFilter = 'today' | 'last7days' | 'last30days' | 'alltime'

type QuestionRow = Database['public']['Tables']['questions']['Row']
type SubscriptionTier = Database['public']['Enums']['subscription_tier']

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

  // Track which students have been loaded (for lazy loading)
  const loadedStudentIds = ref<Set<string>>(new Set())

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

        // Get student profile data (xp, tier, and grade level)
        const studentProfile = student.student_profiles as {
          xp: number | null
          subscription_tier: SubscriptionTier
          grade_levels: { name: string } | null
        } | null
        const xp = studentProfile?.xp ?? 0
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
        }
      })

      return { error: null }
    } catch (err) {
      console.error('Error fetching students:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch students'
      studentsError.value = message
      return { error: message }
    } finally {
      isLoadingStudents.value = false
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

    // Skip if already loaded
    if (loadedStudentIds.value.has(studentId)) {
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

      // Mark as loaded
      loadedStudentIds.value.add(studentId)

      return { error: null }
    } catch (err) {
      console.error('Error fetching student statistics:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch statistics'
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
      console.error('Error fetching session:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
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

    const dateRangeStart = dateRange ? getDateRangeStart(dateRange) : null

    return stats.sessions.filter((s) => {
      if (gradeLevelName && s.gradeLevelName !== gradeLevelName) return false
      if (subjectName && s.subjectName !== subjectName) return false
      if (topicName && s.topicName !== topicName) return false
      if (subTopicName && s.subTopicName !== subTopicName) return false
      if (dateRangeStart) {
        const sessionDate = new Date(s.completedAt ?? s.createdAt)
        if (sessionDate < dateRangeStart) return false
      }
      return true
    })
  }

  // Get unique grade levels for a student
  function getGradeLevels(studentId: string): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    const gradeLevels = new Set(stats.sessions.map((s) => s.gradeLevelName))
    return Array.from(gradeLevels).sort()
  }

  // Get unique subjects for a student (optionally filtered by grade level)
  function getSubjects(studentId: string, gradeLevelName?: string): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    const sessions = gradeLevelName
      ? stats.sessions.filter((s) => s.gradeLevelName === gradeLevelName)
      : stats.sessions
    const subjects = new Set(sessions.map((s) => s.subjectName))
    return Array.from(subjects).sort()
  }

  // Get unique topics for a student (optionally filtered by grade level and subject)
  function getTopics(studentId: string, gradeLevelName?: string, subjectName?: string): string[] {
    const stats = getStudentStatistics(studentId)
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

  // Get unique sub-topics for a student
  function getSubTopics(
    studentId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): string[] {
    const stats = getStudentStatistics(studentId)
    if (!stats) return []
    let sessions = stats.sessions
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
    studentsError.value = null
    statisticsError.value = null
    loadedStudentIds.value.clear()
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
    getStudentById,
    getStudentStatistics,
    getSessionById,
    getFilteredSessions,
    getGradeLevels,
    getSubjects,
    getTopics,
    getSubTopics,
    $reset,
  }
})
