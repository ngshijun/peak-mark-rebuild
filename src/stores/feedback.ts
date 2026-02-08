import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'
import { handleError } from '@/lib/errors'

type FeedbackCategory = Database['public']['Enums']['feedback_category']

export interface QuestionFeedback {
  id: string
  questionId: string
  question: string // Denormalized for display
  category: FeedbackCategory
  comments: string | null
  reportedAt: string
  reportedBy: string
  reportedByName?: string
}

export const useFeedbackStore = defineStore('feedback', () => {
  const feedbacks = ref<QuestionFeedback[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Fetch all feedbacks with question text joined
  async function fetchFeedbacks(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('question_feedback')
        .select(
          `
          id,
          question_id,
          category,
          comments,
          created_at,
          reported_by,
          questions!inner (
            question
          ),
          profiles!question_feedback_reported_by_fkey (
            name
          )
        `,
        )
        .order('created_at', { ascending: false })

      if (fetchError) {
        const message = handleError(fetchError, 'Failed to fetch feedbacks.')
        error.value = message
        return { error: message }
      }

      type FeedbackRow = {
        id: string
        question_id: string
        category: FeedbackCategory
        comments: string | null
        created_at: string | null
        reported_by: string
        questions: { question: string } | null
        profiles: { name: string } | null
      }

      feedbacks.value = ((data || []) as FeedbackRow[]).map((item) => ({
        id: item.id,
        questionId: item.question_id,
        question: item.questions?.question || 'Question not available',
        category: item.category,
        comments: item.comments,
        reportedAt: item.created_at || new Date().toISOString(),
        reportedBy: item.reported_by,
        reportedByName: item.profiles?.name || 'Unknown',
      }))

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch feedbacks.')
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Delete a feedback
  async function deleteFeedback(id: string): Promise<{ error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('question_feedback').delete().eq('id', id)

      if (deleteError) {
        return { error: handleError(deleteError, 'Failed to delete feedback.') }
      }

      // Remove from local state
      const index = feedbacks.value.findIndex((f) => f.id === id)
      if (index !== -1) {
        feedbacks.value.splice(index, 1)
      }

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to delete feedback.')
      return { error: message }
    }
  }

  // Submit feedback (for students/parents)
  async function submitFeedback(
    questionId: string,
    category: FeedbackCategory,
    comments: string,
    reportedBy: string,
  ): Promise<{ error: string | null }> {
    try {
      const { error: insertError } = await supabase.from('question_feedback').insert({
        question_id: questionId,
        category,
        comments: comments || null,
        reported_by: reportedBy,
      })

      if (insertError) {
        return { error: handleError(insertError, 'Failed to submit feedback.') }
      }

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to submit feedback.')
      return { error: message }
    }
  }

  function getFeedbackById(id: string) {
    return feedbacks.value.find((f) => f.id === id)
  }

  return {
    feedbacks,
    isLoading,
    error,
    fetchFeedbacks,
    deleteFeedback,
    submitFeedback,
    getFeedbackById,
  }
})
