/**
 * Shared session-fetching logic for parent and admin statistics stores.
 *
 * Both child-statistics (parent) and admin-student-stats (admin) need to
 * fetch sessions with curriculum hierarchy + batch-fetch answers to compute
 * scores and durations. This module extracts that duplicated pattern.
 */

import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'
import type { SubTopicHierarchy } from '@/types/supabase-helpers'
import type { PracticeSessionSummary, PracticeSessionFull } from '@/types/session'
import {
  computeScorePercent,
  buildQuestionsFromAnswers,
  mapAnswerRows,
  assembleSessionFull,
} from '@/lib/questionHelpers'

/** Answer shape needed for summary computation */
interface AnswerSummaryRow {
  session_id: string
  is_correct: boolean | null
  time_spent_seconds: number | null
}

/** Group an array by a key function into a Map */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(item)
  }
  return map
}

/**
 * Fetch practice sessions with scores for a student.
 * Shared by child-statistics (parent view) and admin-student-stats (admin view).
 *
 * Callers are responsible for auth guards and child-link validation before calling.
 */
export async function fetchSessionSummaries(studentId: string): Promise<PracticeSessionSummary[]> {
  // Fetch all practice sessions with curriculum hierarchy
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

  const sessionIds = (sessionsData ?? []).map((s) => s.id)
  if (sessionIds.length === 0) return []

  // Batch fetch all answers in a single request
  const { data: answersData } = await supabase
    .from('practice_answers')
    .select('session_id, is_correct, time_spent_seconds')
    .in('session_id', sessionIds)

  const answersBySession = groupBy((answersData ?? []) as AnswerSummaryRow[], (a) => a.session_id)

  // Build session summaries
  return (sessionsData ?? []).map((session) => {
    const answers = answersBySession.get(session.id) ?? []
    const correctAnswers = answers.filter((a) => a.is_correct).length
    const totalQuestions = session.total_questions ?? answers.length
    const isCompleted = !!session.completed_at

    const subTopic = session.sub_topics as unknown as SubTopicHierarchy

    const durationSeconds = isCompleted
      ? answers.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0)
      : null

    return {
      id: session.id,
      gradeLevelName: subTopic?.topics?.subjects?.grade_levels?.name ?? 'Unknown',
      subjectName: subTopic?.topics?.subjects?.name ?? 'Unknown',
      topicName: subTopic?.topics?.name ?? 'Unknown',
      subTopicName: subTopic?.name ?? 'Unknown',
      score: isCompleted ? computeScorePercent(correctAnswers, totalQuestions) || null : null,
      totalQuestions,
      correctAnswers,
      durationSeconds,
      createdAt: session.created_at ?? new Date().toISOString(),
      completedAt: session.completed_at,
      status: (isCompleted ? 'completed' : 'in_progress') as 'completed' | 'in_progress',
    }
  })
}

type QuestionRow = Database['public']['Tables']['questions']['Row']

/**
 * Fetch full session details (session + answers + questions) and assemble
 * into a PracticeSessionFull.
 *
 * Shared by child-statistics (parent view, when subscription allows)
 * and admin-student-stats (admin view).
 *
 * Callers are responsible for auth guards before calling.
 * Returns null if session is not found.
 */
export async function fetchFullSessionDetails(
  studentId: string,
  sessionId: string,
): Promise<PracticeSessionFull | null> {
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
  if (!sessionResult.data) return null
  if (answersResult.error) throw answersResult.error

  const sessionData = sessionResult.data
  const answersData = answersResult.data

  // Fetch questions by IDs from answers
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

  // Build questions and answers from DB rows
  const questions = buildQuestionsFromAnswers(answersData ?? [], questionsMap)
  const answers = mapAnswerRows(answersData ?? [])
  const subTopic = sessionData.sub_topics as unknown as SubTopicHierarchy

  const correctAnswers = answers.filter((a) => a.isCorrect).length
  const durationSeconds = answers.reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0)

  return assembleSessionFull(
    sessionData,
    subTopic,
    questions,
    answers,
    correctAnswers,
    durationSeconds,
  )
}
