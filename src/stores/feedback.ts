import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QuestionFeedback } from '@/types'

export const useFeedbackStore = defineStore('feedback', () => {
  const feedbacks = ref<QuestionFeedback[]>([
    {
      id: '1',
      questionId: '1',
      question: 'What is 2 + 2?',
      category: 'option_error',
      comments: 'Option C shows "5" but should show a different number to avoid confusion.',
      reportedAt: '2024-01-20T10:30:00',
      reportedBy: 'student1@example.com',
    },
    {
      id: '2',
      questionId: '3',
      question: 'What is the first letter of the alphabet?',
      category: 'question_error',
      comments: 'The question could be more specific - should it be uppercase or lowercase?',
      reportedAt: '2024-01-21T14:15:00',
      reportedBy: 'parent2@example.com',
    },
    {
      id: '3',
      questionId: '4',
      question: 'What is 3 × 4?',
      category: 'explanation_error',
      comments:
        'The explanation says "3 multiplied by 4" but could show the step-by-step calculation.',
      reportedAt: '2024-01-22T09:45:00',
      reportedBy: 'student3@example.com',
    },
    {
      id: '4',
      questionId: '5',
      question: 'What do plants need to grow?',
      category: 'answer_error',
      comments:
        'The answer should also include "air" or "carbon dioxide" as plants need these too.',
      reportedAt: '2024-01-23T16:20:00',
      reportedBy: 'student4@example.com',
    },
    {
      id: '5',
      questionId: '6',
      question: 'Which animal is a mammal?',
      category: 'image_error',
      comments:
        'There is no image attached to this question. Would be helpful to have animal pictures.',
      reportedAt: '2024-01-24T11:00:00',
      reportedBy: 'parent5@example.com',
    },
    {
      id: '6',
      questionId: '2',
      question: 'What is 5 - 3?',
      category: 'other',
      comments:
        'This question seems too easy for Grade 1 students who have been learning for a while.',
      reportedAt: '2024-01-25T08:30:00',
      reportedBy: 'parent1@example.com',
    },
  ])

  function deleteFeedback(id: string) {
    const index = feedbacks.value.findIndex((f) => f.id === id)
    if (index !== -1) {
      feedbacks.value.splice(index, 1)
    }
  }

  function getFeedbackById(id: string) {
    return feedbacks.value.find((f) => f.id === id)
  }

  return {
    feedbacks,
    deleteFeedback,
    getFeedbackById,
  }
})
