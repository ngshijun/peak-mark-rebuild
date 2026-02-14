import type { Database } from '@/types/database.types'

export type { DateRangeFilter } from '@/lib/sessionFilters'
export type { StudentSubscriptionStatus, SessionLimitStatus } from '@/stores/student-subscription'

type PracticeAnswerRow = Database['public']['Tables']['practice_answers']['Row']

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
  questions: import('@/stores/questions').Question[]
  answers: PracticeAnswer[]
}

/**
 * Fisher-Yates shuffle - O(n) time, uniform distribution
 * Preferred over sort(() => Math.random() - 0.5) which is O(n log n) and biased
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/**
 * Convert option ID ('a', 'b', 'c', 'd') to number (1, 2, 3, 4) for database storage
 */
export function optionIdToNumber(optionId: string): number {
  const mapping: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 }
  return mapping[optionId] ?? 1
}

/**
 * Convert option number (1, 2, 3, 4) to ID ('a', 'b', 'c', 'd') for UI display
 */
export function optionNumberToId(optionNumber: number): string {
  const mapping: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }
  return mapping[optionNumber] ?? 'a'
}

/**
 * Convert array of option numbers to array of IDs for UI display
 */
export function optionNumbersToIds(optionNumbers: number[] | null): string[] {
  if (!optionNumbers) return []
  return optionNumbers.map((num) => optionNumberToId(num))
}

/**
 * Convert database row to PracticeAnswer
 */
export function rowToAnswer(row: PracticeAnswerRow): PracticeAnswer {
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
