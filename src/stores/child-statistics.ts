import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChildLinkStore } from './child-link'
import type { Question, PracticeAnswer } from '@/types'

export type DateRangeFilter = 'today' | 'last7days' | 'last30days' | 'alltime'

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

export interface ChildPracticeSession {
  id: string
  gradeLevelName: string
  subjectName: string
  topicName: string
  score: number // percentage
  totalQuestions: number
  correctAnswers: number
  durationMinutes: number
  completedAt: string
}

// Full session data including questions and answers for detail view
export interface ChildPracticeSessionFull extends ChildPracticeSession {
  subjectId: string
  topicId: string
  gradeLevelId: string
  questions: Question[]
  answers: PracticeAnswer[]
  startedAt: string
}

export interface ChildStatistics {
  childId: string
  childName: string
  sessions: ChildPracticeSession[]
}

export const useChildStatisticsStore = defineStore('childStatistics', () => {
  const childLinkStore = useChildLinkStore()

  // Mock full session data (with questions and answers) for detail view
  const childrenSessionsFull = ref<Record<string, ChildPracticeSessionFull[]>>({
    s1: [
      {
        id: 'sess-1',
        gradeLevelId: '1',
        gradeLevelName: 'Grade 1',
        subjectId: '1-1',
        subjectName: 'Mathematics',
        topicId: '1-1-1',
        topicName: 'Addition',
        score: 80,
        totalQuestions: 10,
        correctAnswers: 8,
        durationMinutes: 15,
        startedAt: '2024-01-20T10:00:00',
        completedAt: '2024-01-20T10:15:00',
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            question: 'What is 2 + 2?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 2 and 2 together, you get 4.',
            options: [
              { id: 'a', text: '3', isCorrect: false },
              { id: 'b', text: '4', isCorrect: true },
              { id: 'c', text: '5', isCorrect: false },
              { id: 'd', text: '6', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q2',
            type: 'mcq',
            question: 'What is 3 + 4?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 3 and 4 together, you get 7.',
            options: [
              { id: 'a', text: '6', isCorrect: false },
              { id: 'b', text: '7', isCorrect: true },
              { id: 'c', text: '8', isCorrect: false },
              { id: 'd', text: '9', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q3',
            type: 'short_answer',
            question: 'What is 5 + 3?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 5 and 3 together, you get 8.',
            answer: '8',
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q4',
            type: 'mcq',
            question: 'What is 1 + 6?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 1 and 6 together, you get 7.',
            options: [
              { id: 'a', text: '5', isCorrect: false },
              { id: 'b', text: '6', isCorrect: false },
              { id: 'c', text: '7', isCorrect: true },
              { id: 'd', text: '8', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q5',
            type: 'mcq',
            question: 'What is 6 + 3?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 6 and 3 together, you get 9.',
            options: [
              { id: 'a', text: '8', isCorrect: false },
              { id: 'b', text: '9', isCorrect: true },
              { id: 'c', text: '10', isCorrect: false },
              { id: 'd', text: '11', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q6',
            type: 'mcq',
            question: 'What is 4 + 2?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 4 and 2 together, you get 6.',
            options: [
              { id: 'a', text: '5', isCorrect: false },
              { id: 'b', text: '6', isCorrect: true },
              { id: 'c', text: '7', isCorrect: false },
              { id: 'd', text: '8', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q7',
            type: 'mcq',
            question: 'What is 2 + 5?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 2 and 5 together, you get 7.',
            options: [
              { id: 'a', text: '6', isCorrect: false },
              { id: 'b', text: '7', isCorrect: true },
              { id: 'c', text: '8', isCorrect: false },
              { id: 'd', text: '9', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q8',
            type: 'mcq',
            question: 'What is 3 + 3?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 3 and 3 together, you get 6.',
            options: [
              { id: 'a', text: '5', isCorrect: false },
              { id: 'b', text: '6', isCorrect: true },
              { id: 'c', text: '7', isCorrect: false },
              { id: 'd', text: '8', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q9',
            type: 'short_answer',
            question: 'What is 4 + 4?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 4 and 4 together, you get 8.',
            answer: '8',
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
          {
            id: 'q10',
            type: 'mcq',
            question: 'What is 1 + 1?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-1',
            topicName: 'Addition',
            explanation: 'When you add 1 and 1 together, you get 2.',
            options: [
              { id: 'a', text: '1', isCorrect: false },
              { id: 'b', text: '2', isCorrect: true },
              { id: 'c', text: '3', isCorrect: false },
              { id: 'd', text: '4', isCorrect: false },
            ],
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15',
          },
        ],
        answers: [
          {
            questionId: 'q1',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-20T10:01:00',
          },
          {
            questionId: 'q2',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-20T10:02:00',
          },
          { questionId: 'q3', textAnswer: '8', isCorrect: true, answeredAt: '2024-01-20T10:03:00' },
          {
            questionId: 'q4',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-20T10:04:00',
          },
          {
            questionId: 'q5',
            selectedOptionId: 'a',
            isCorrect: false,
            answeredAt: '2024-01-20T10:05:00',
          },
          {
            questionId: 'q6',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-20T10:06:00',
          },
          {
            questionId: 'q7',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-20T10:07:00',
          },
          {
            questionId: 'q8',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-20T10:08:00',
          },
          {
            questionId: 'q9',
            textAnswer: '9',
            isCorrect: false,
            answeredAt: '2024-01-20T10:09:00',
          },
          {
            questionId: 'q10',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-20T10:10:00',
          },
        ],
      },
      // Session 2 - English Alphabet (100%)
      {
        id: 'sess-2',
        gradeLevelId: '1',
        gradeLevelName: 'Grade 1',
        subjectId: '1-2',
        subjectName: 'English',
        topicId: '1-2-1',
        topicName: 'Alphabet',
        score: 100,
        totalQuestions: 5,
        correctAnswers: 5,
        durationMinutes: 20,
        startedAt: '2024-01-21T14:00:00',
        completedAt: '2024-01-21T14:20:00',
        questions: [
          {
            id: 's2-q1',
            type: 'mcq',
            question: 'Which letter comes after "B"?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-2',
            subjectName: 'English',
            topicId: '1-2-1',
            topicName: 'Alphabet',
            explanation: 'The alphabet goes A, B, C, D... So C comes after B.',
            options: [
              { id: 'a', text: 'A', isCorrect: false },
              { id: 'b', text: 'C', isCorrect: true },
              { id: 'c', text: 'D', isCorrect: false },
              { id: 'd', text: 'E', isCorrect: false },
            ],
            createdAt: '2024-01-17',
            updatedAt: '2024-01-17',
          },
          {
            id: 's2-q2',
            type: 'short_answer',
            question: 'What is the first letter of the alphabet?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-2',
            subjectName: 'English',
            topicId: '1-2-1',
            topicName: 'Alphabet',
            explanation: 'The alphabet starts with the letter A.',
            answer: 'A',
            createdAt: '2024-01-17',
            updatedAt: '2024-01-17',
          },
          {
            id: 's2-q3',
            type: 'mcq',
            question: 'Which letter is a vowel?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-2',
            subjectName: 'English',
            topicId: '1-2-1',
            topicName: 'Alphabet',
            explanation: 'The vowels are A, E, I, O, U. From the options, I is a vowel.',
            options: [
              { id: 'a', text: 'B', isCorrect: false },
              { id: 'b', text: 'C', isCorrect: false },
              { id: 'c', text: 'D', isCorrect: false },
              { id: 'd', text: 'I', isCorrect: true },
            ],
            createdAt: '2024-01-17',
            updatedAt: '2024-01-17',
          },
          {
            id: 's2-q4',
            type: 'mcq',
            question: 'How many letters are in the English alphabet?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-2',
            subjectName: 'English',
            topicId: '1-2-1',
            topicName: 'Alphabet',
            explanation: 'The English alphabet has 26 letters from A to Z.',
            options: [
              { id: 'a', text: '24', isCorrect: false },
              { id: 'b', text: '25', isCorrect: false },
              { id: 'c', text: '26', isCorrect: true },
              { id: 'd', text: '27', isCorrect: false },
            ],
            createdAt: '2024-01-17',
            updatedAt: '2024-01-17',
          },
          {
            id: 's2-q5',
            type: 'short_answer',
            question: 'What is the last letter of the alphabet?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-2',
            subjectName: 'English',
            topicId: '1-2-1',
            topicName: 'Alphabet',
            explanation: 'The alphabet ends with the letter Z.',
            answer: 'Z',
            createdAt: '2024-01-17',
            updatedAt: '2024-01-17',
          },
        ],
        answers: [
          {
            questionId: 's2-q1',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-21T14:04:00',
          },
          {
            questionId: 's2-q2',
            textAnswer: 'A',
            isCorrect: true,
            answeredAt: '2024-01-21T14:08:00',
          },
          {
            questionId: 's2-q3',
            selectedOptionId: 'd',
            isCorrect: true,
            answeredAt: '2024-01-21T14:12:00',
          },
          {
            questionId: 's2-q4',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-21T14:16:00',
          },
          {
            questionId: 's2-q5',
            textAnswer: 'Z',
            isCorrect: true,
            answeredAt: '2024-01-21T14:20:00',
          },
        ],
      },
      // Session 3 - Mathematics Subtraction (70%)
      {
        id: 'sess-3',
        gradeLevelId: '1',
        gradeLevelName: 'Grade 1',
        subjectId: '1-1',
        subjectName: 'Mathematics',
        topicId: '1-1-2',
        topicName: 'Subtraction',
        score: 70,
        totalQuestions: 10,
        correctAnswers: 7,
        durationMinutes: 18,
        startedAt: '2024-01-23T16:00:00',
        completedAt: '2024-01-23T16:18:00',
        questions: [
          {
            id: 's3-q1',
            type: 'mcq',
            question: 'What is 5 - 3?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 3 from 5, you get 2.',
            options: [
              { id: 'a', text: '1', isCorrect: false },
              { id: 'b', text: '2', isCorrect: true },
              { id: 'c', text: '3', isCorrect: false },
              { id: 'd', text: '4', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q2',
            type: 'mcq',
            question: 'What is 8 - 2?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 2 from 8, you get 6.',
            options: [
              { id: 'a', text: '5', isCorrect: false },
              { id: 'b', text: '6', isCorrect: true },
              { id: 'c', text: '7', isCorrect: false },
              { id: 'd', text: '8', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q3',
            type: 'short_answer',
            question: 'What is 9 - 4?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 4 from 9, you get 5.',
            answer: '5',
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q4',
            type: 'mcq',
            question: 'What is 7 - 5?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 5 from 7, you get 2.',
            options: [
              { id: 'a', text: '1', isCorrect: false },
              { id: 'b', text: '2', isCorrect: true },
              { id: 'c', text: '3', isCorrect: false },
              { id: 'd', text: '4', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q5',
            type: 'mcq',
            question: 'What is 10 - 3?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 3 from 10, you get 7.',
            options: [
              { id: 'a', text: '6', isCorrect: false },
              { id: 'b', text: '7', isCorrect: true },
              { id: 'c', text: '8', isCorrect: false },
              { id: 'd', text: '9', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q6',
            type: 'mcq',
            question: 'What is 6 - 4?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 4 from 6, you get 2.',
            options: [
              { id: 'a', text: '1', isCorrect: false },
              { id: 'b', text: '2', isCorrect: true },
              { id: 'c', text: '3', isCorrect: false },
              { id: 'd', text: '4', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q7',
            type: 'mcq',
            question: 'What is 8 - 5?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 5 from 8, you get 3.',
            options: [
              { id: 'a', text: '2', isCorrect: false },
              { id: 'b', text: '3', isCorrect: true },
              { id: 'c', text: '4', isCorrect: false },
              { id: 'd', text: '5', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q8',
            type: 'short_answer',
            question: 'What is 10 - 7?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 7 from 10, you get 3.',
            answer: '3',
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q9',
            type: 'mcq',
            question: 'What is 9 - 6?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 6 from 9, you get 3.',
            options: [
              { id: 'a', text: '2', isCorrect: false },
              { id: 'b', text: '3', isCorrect: true },
              { id: 'c', text: '4', isCorrect: false },
              { id: 'd', text: '5', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
          {
            id: 's3-q10',
            type: 'mcq',
            question: 'What is 7 - 3?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-1',
            subjectName: 'Mathematics',
            topicId: '1-1-2',
            topicName: 'Subtraction',
            explanation: 'When you subtract 3 from 7, you get 4.',
            options: [
              { id: 'a', text: '3', isCorrect: false },
              { id: 'b', text: '4', isCorrect: true },
              { id: 'c', text: '5', isCorrect: false },
              { id: 'd', text: '6', isCorrect: false },
            ],
            createdAt: '2024-01-16',
            updatedAt: '2024-01-16',
          },
        ],
        answers: [
          {
            questionId: 's3-q1',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-23T16:02:00',
          },
          {
            questionId: 's3-q2',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-23T16:04:00',
          },
          {
            questionId: 's3-q3',
            textAnswer: '5',
            isCorrect: true,
            answeredAt: '2024-01-23T16:06:00',
          },
          {
            questionId: 's3-q4',
            selectedOptionId: 'a',
            isCorrect: false,
            answeredAt: '2024-01-23T16:08:00',
          },
          {
            questionId: 's3-q5',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-23T16:10:00',
          },
          {
            questionId: 's3-q6',
            selectedOptionId: 'c',
            isCorrect: false,
            answeredAt: '2024-01-23T16:12:00',
          },
          {
            questionId: 's3-q7',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-23T16:14:00',
          },
          {
            questionId: 's3-q8',
            textAnswer: '4',
            isCorrect: false,
            answeredAt: '2024-01-23T16:15:00',
          },
          {
            questionId: 's3-q9',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-23T16:17:00',
          },
          {
            questionId: 's3-q10',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-23T16:18:00',
          },
        ],
      },
      // Session 4 - Chinese Pinyin (50%)
      {
        id: 'sess-4',
        gradeLevelId: '1',
        gradeLevelName: 'Grade 1',
        subjectId: '1-4',
        subjectName: 'Chinese',
        topicId: '1-4-1',
        topicName: 'Pinyin',
        score: 50,
        totalQuestions: 4,
        correctAnswers: 2,
        durationMinutes: 25,
        startedAt: '2024-01-24T11:00:00',
        completedAt: '2024-01-24T11:25:00',
        questions: [
          {
            id: 's4-q1',
            type: 'mcq',
            question: 'What is the pinyin for "hello"?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-4',
            subjectName: 'Chinese',
            topicId: '1-4-1',
            topicName: 'Pinyin',
            explanation: 'The pinyin for "hello" is "nǐ hǎo".',
            options: [
              { id: 'a', text: 'zài jiàn', isCorrect: false },
              { id: 'b', text: 'nǐ hǎo', isCorrect: true },
              { id: 'c', text: 'xiè xiè', isCorrect: false },
              { id: 'd', text: 'duì bù qǐ', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's4-q2',
            type: 'mcq',
            question: 'What is the pinyin for "thank you"?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-4',
            subjectName: 'Chinese',
            topicId: '1-4-1',
            topicName: 'Pinyin',
            explanation: 'The pinyin for "thank you" is "xiè xiè".',
            options: [
              { id: 'a', text: 'zài jiàn', isCorrect: false },
              { id: 'b', text: 'nǐ hǎo', isCorrect: false },
              { id: 'c', text: 'xiè xiè', isCorrect: true },
              { id: 'd', text: 'duì bù qǐ', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's4-q3',
            type: 'mcq',
            question: 'What is the pinyin for "goodbye"?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-4',
            subjectName: 'Chinese',
            topicId: '1-4-1',
            topicName: 'Pinyin',
            explanation: 'The pinyin for "goodbye" is "zài jiàn".',
            options: [
              { id: 'a', text: 'zài jiàn', isCorrect: true },
              { id: 'b', text: 'nǐ hǎo', isCorrect: false },
              { id: 'c', text: 'xiè xiè', isCorrect: false },
              { id: 'd', text: 'duì bù qǐ', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's4-q4',
            type: 'mcq',
            question: 'What is the pinyin for "sorry"?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-4',
            subjectName: 'Chinese',
            topicId: '1-4-1',
            topicName: 'Pinyin',
            explanation: 'The pinyin for "sorry" is "duì bù qǐ".',
            options: [
              { id: 'a', text: 'zài jiàn', isCorrect: false },
              { id: 'b', text: 'nǐ hǎo', isCorrect: false },
              { id: 'c', text: 'xiè xiè', isCorrect: false },
              { id: 'd', text: 'duì bù qǐ', isCorrect: true },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
        ],
        answers: [
          {
            questionId: 's4-q1',
            selectedOptionId: 'a',
            isCorrect: false,
            answeredAt: '2024-01-24T11:06:00',
          },
          {
            questionId: 's4-q2',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-24T11:12:00',
          },
          {
            questionId: 's4-q3',
            selectedOptionId: 'b',
            isCorrect: false,
            answeredAt: '2024-01-24T11:18:00',
          },
          {
            questionId: 's4-q4',
            selectedOptionId: 'd',
            isCorrect: true,
            answeredAt: '2024-01-24T11:25:00',
          },
        ],
      },
      // Session 5 - Science Plants (90%)
      {
        id: 'sess-5',
        gradeLevelId: '1',
        gradeLevelName: 'Grade 1',
        subjectId: '1-3',
        subjectName: 'Science',
        topicId: '1-3-1',
        topicName: 'Plants',
        score: 90,
        totalQuestions: 10,
        correctAnswers: 9,
        durationMinutes: 12,
        startedAt: '2024-01-25T09:00:00',
        completedAt: '2024-01-25T09:12:00',
        questions: [
          {
            id: 's5-q1',
            type: 'mcq',
            question: 'What do plants need to grow?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'Plants need sunlight, water, and soil to grow.',
            options: [
              { id: 'a', text: 'Only water', isCorrect: false },
              { id: 'b', text: 'Sunlight, water, and soil', isCorrect: true },
              { id: 'c', text: 'Only sunlight', isCorrect: false },
              { id: 'd', text: 'Only soil', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q2',
            type: 'mcq',
            question: 'Which part of the plant absorbs water from the soil?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'The roots absorb water from the soil.',
            options: [
              { id: 'a', text: 'Leaves', isCorrect: false },
              { id: 'b', text: 'Stem', isCorrect: false },
              { id: 'c', text: 'Roots', isCorrect: true },
              { id: 'd', text: 'Flower', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q3',
            type: 'mcq',
            question: 'What is the green color in leaves called?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'The green color in leaves is called chlorophyll.',
            options: [
              { id: 'a', text: 'Water', isCorrect: false },
              { id: 'b', text: 'Chlorophyll', isCorrect: true },
              { id: 'c', text: 'Sugar', isCorrect: false },
              { id: 'd', text: 'Oxygen', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q4',
            type: 'mcq',
            question: 'Which part of the plant makes food?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'The leaves make food for the plant through photosynthesis.',
            options: [
              { id: 'a', text: 'Leaves', isCorrect: true },
              { id: 'b', text: 'Roots', isCorrect: false },
              { id: 'c', text: 'Stem', isCorrect: false },
              { id: 'd', text: 'Flower', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q5',
            type: 'mcq',
            question: 'What do plants release into the air?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'Plants release oxygen into the air.',
            options: [
              { id: 'a', text: 'Carbon dioxide', isCorrect: false },
              { id: 'b', text: 'Oxygen', isCorrect: true },
              { id: 'c', text: 'Nitrogen', isCorrect: false },
              { id: 'd', text: 'Water', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q6',
            type: 'mcq',
            question: 'What part of the plant holds it upright?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'The stem holds the plant upright.',
            options: [
              { id: 'a', text: 'Leaves', isCorrect: false },
              { id: 'b', text: 'Roots', isCorrect: false },
              { id: 'c', text: 'Stem', isCorrect: true },
              { id: 'd', text: 'Flower', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q7',
            type: 'mcq',
            question: 'Seeds grow into new ___.',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'Seeds grow into new plants.',
            options: [
              { id: 'a', text: 'Animals', isCorrect: false },
              { id: 'b', text: 'Plants', isCorrect: true },
              { id: 'c', text: 'Rocks', isCorrect: false },
              { id: 'd', text: 'Water', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q8',
            type: 'mcq',
            question: 'Where are seeds often found?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'Seeds are often found inside fruits.',
            options: [
              { id: 'a', text: 'In leaves', isCorrect: false },
              { id: 'b', text: 'In stems', isCorrect: false },
              { id: 'c', text: 'In roots', isCorrect: false },
              { id: 'd', text: 'Inside fruits', isCorrect: true },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q9',
            type: 'mcq',
            question: 'What process do plants use to make food?',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'Plants use photosynthesis to make food.',
            options: [
              { id: 'a', text: 'Respiration', isCorrect: false },
              { id: 'b', text: 'Photosynthesis', isCorrect: true },
              { id: 'c', text: 'Digestion', isCorrect: false },
              { id: 'd', text: 'Absorption', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
          {
            id: 's5-q10',
            type: 'mcq',
            question: 'Flowers help plants to ___.',
            gradeLevelId: '1',
            gradeLevelName: 'Grade 1',
            subjectId: '1-3',
            subjectName: 'Science',
            topicId: '1-3-1',
            topicName: 'Plants',
            explanation: 'Flowers help plants to reproduce and make seeds.',
            options: [
              { id: 'a', text: 'Absorb water', isCorrect: false },
              { id: 'b', text: 'Make seeds', isCorrect: true },
              { id: 'c', text: 'Stay warm', isCorrect: false },
              { id: 'd', text: 'Move around', isCorrect: false },
            ],
            createdAt: '2024-01-19',
            updatedAt: '2024-01-19',
          },
        ],
        answers: [
          {
            questionId: 's5-q1',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-25T09:01:00',
          },
          {
            questionId: 's5-q2',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-25T09:02:00',
          },
          {
            questionId: 's5-q3',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-25T09:03:00',
          },
          {
            questionId: 's5-q4',
            selectedOptionId: 'a',
            isCorrect: true,
            answeredAt: '2024-01-25T09:04:00',
          },
          {
            questionId: 's5-q5',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-25T09:05:00',
          },
          {
            questionId: 's5-q6',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-25T09:06:00',
          },
          {
            questionId: 's5-q7',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-25T09:07:00',
          },
          {
            questionId: 's5-q8',
            selectedOptionId: 'd',
            isCorrect: true,
            answeredAt: '2024-01-25T09:08:00',
          },
          {
            questionId: 's5-q9',
            selectedOptionId: 'a',
            isCorrect: false,
            answeredAt: '2024-01-25T09:10:00',
          },
          {
            questionId: 's5-q10',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-25T09:12:00',
          },
        ],
      },
      // Session 6 - Grade 2 Mathematics Multiplication (85%)
      {
        id: 'sess-6',
        gradeLevelId: '2',
        gradeLevelName: 'Grade 2',
        subjectId: '2-1',
        subjectName: 'Mathematics',
        topicId: '2-1-1',
        topicName: 'Multiplication',
        score: 85,
        totalQuestions: 10,
        correctAnswers: 8,
        durationMinutes: 22,
        startedAt: '2024-01-26T15:00:00',
        completedAt: '2024-01-26T15:22:00',
        questions: [
          {
            id: 's6-q1',
            type: 'mcq',
            question: 'What is 2 x 3?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '2 multiplied by 3 equals 6.',
            options: [
              { id: 'a', text: '5', isCorrect: false },
              { id: 'b', text: '6', isCorrect: true },
              { id: 'c', text: '7', isCorrect: false },
              { id: 'd', text: '8', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q2',
            type: 'mcq',
            question: 'What is 3 x 4?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '3 multiplied by 4 equals 12.',
            options: [
              { id: 'a', text: '10', isCorrect: false },
              { id: 'b', text: '11', isCorrect: false },
              { id: 'c', text: '12', isCorrect: true },
              { id: 'd', text: '14', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q3',
            type: 'short_answer',
            question: 'What is 5 x 2?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '5 multiplied by 2 equals 10.',
            answer: '10',
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q4',
            type: 'mcq',
            question: 'What is 4 x 4?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '4 multiplied by 4 equals 16.',
            options: [
              { id: 'a', text: '14', isCorrect: false },
              { id: 'b', text: '15', isCorrect: false },
              { id: 'c', text: '16', isCorrect: true },
              { id: 'd', text: '18', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q5',
            type: 'mcq',
            question: 'What is 6 x 2?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '6 multiplied by 2 equals 12.',
            options: [
              { id: 'a', text: '10', isCorrect: false },
              { id: 'b', text: '11', isCorrect: false },
              { id: 'c', text: '12', isCorrect: true },
              { id: 'd', text: '14', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q6',
            type: 'mcq',
            question: 'What is 7 x 1?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: 'Any number multiplied by 1 equals itself. 7 x 1 = 7.',
            options: [
              { id: 'a', text: '6', isCorrect: false },
              { id: 'b', text: '7', isCorrect: true },
              { id: 'c', text: '8', isCorrect: false },
              { id: 'd', text: '1', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q7',
            type: 'mcq',
            question: 'What is 5 x 5?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '5 multiplied by 5 equals 25.',
            options: [
              { id: 'a', text: '20', isCorrect: false },
              { id: 'b', text: '25', isCorrect: true },
              { id: 'c', text: '30', isCorrect: false },
              { id: 'd', text: '10', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q8',
            type: 'short_answer',
            question: 'What is 3 x 3?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '3 multiplied by 3 equals 9.',
            answer: '9',
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q9',
            type: 'mcq',
            question: 'What is 8 x 2?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '8 multiplied by 2 equals 16.',
            options: [
              { id: 'a', text: '14', isCorrect: false },
              { id: 'b', text: '15', isCorrect: false },
              { id: 'c', text: '16', isCorrect: true },
              { id: 'd', text: '18', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
          {
            id: 's6-q10',
            type: 'mcq',
            question: 'What is 2 x 9?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-1',
            subjectName: 'Mathematics',
            topicId: '2-1-1',
            topicName: 'Multiplication',
            explanation: '2 multiplied by 9 equals 18.',
            options: [
              { id: 'a', text: '16', isCorrect: false },
              { id: 'b', text: '17', isCorrect: false },
              { id: 'c', text: '18', isCorrect: true },
              { id: 'd', text: '19', isCorrect: false },
            ],
            createdAt: '2024-01-18',
            updatedAt: '2024-01-18',
          },
        ],
        answers: [
          {
            questionId: 's6-q1',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-26T15:02:00',
          },
          {
            questionId: 's6-q2',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-26T15:04:00',
          },
          {
            questionId: 's6-q3',
            textAnswer: '10',
            isCorrect: true,
            answeredAt: '2024-01-26T15:06:00',
          },
          {
            questionId: 's6-q4',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-26T15:08:00',
          },
          {
            questionId: 's6-q5',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-26T15:10:00',
          },
          {
            questionId: 's6-q6',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-26T15:12:00',
          },
          {
            questionId: 's6-q7',
            selectedOptionId: 'a',
            isCorrect: false,
            answeredAt: '2024-01-26T15:14:00',
          },
          {
            questionId: 's6-q8',
            textAnswer: '10',
            isCorrect: false,
            answeredAt: '2024-01-26T15:17:00',
          },
          {
            questionId: 's6-q9',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-26T15:20:00',
          },
          {
            questionId: 's6-q10',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-26T15:22:00',
          },
        ],
      },
      // Session 7 - Grade 2 English Grammar (75%)
      {
        id: 'sess-7',
        gradeLevelId: '2',
        gradeLevelName: 'Grade 2',
        subjectId: '2-2',
        subjectName: 'English',
        topicId: '2-2-1',
        topicName: 'Grammar',
        score: 75,
        totalQuestions: 4,
        correctAnswers: 3,
        durationMinutes: 19,
        startedAt: '2024-01-27T10:00:00',
        completedAt: '2024-01-27T10:19:00',
        questions: [
          {
            id: 's7-q1',
            type: 'mcq',
            question: 'Choose the correct sentence:',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-2',
            subjectName: 'English',
            topicId: '2-2-1',
            topicName: 'Grammar',
            explanation:
              'The correct sentence is "She is playing." It uses the correct form of the verb.',
            options: [
              { id: 'a', text: 'She is playing.', isCorrect: true },
              { id: 'b', text: 'She are playing.', isCorrect: false },
              { id: 'c', text: 'She am playing.', isCorrect: false },
              { id: 'd', text: 'She be playing.', isCorrect: false },
            ],
            createdAt: '2024-01-20',
            updatedAt: '2024-01-20',
          },
          {
            id: 's7-q2',
            type: 'mcq',
            question: 'Which word is a noun?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-2',
            subjectName: 'English',
            topicId: '2-2-1',
            topicName: 'Grammar',
            explanation:
              'A noun is a word that represents a person, place, thing, or idea. "Dog" is a noun.',
            options: [
              { id: 'a', text: 'Run', isCorrect: false },
              { id: 'b', text: 'Beautiful', isCorrect: false },
              { id: 'c', text: 'Dog', isCorrect: true },
              { id: 'd', text: 'Quickly', isCorrect: false },
            ],
            createdAt: '2024-01-20',
            updatedAt: '2024-01-20',
          },
          {
            id: 's7-q3',
            type: 'mcq',
            question: 'Fill in the blank: The cat ___ on the mat.',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-2',
            subjectName: 'English',
            topicId: '2-2-1',
            topicName: 'Grammar',
            explanation: 'The correct answer is "sat" which is the past tense of "sit".',
            options: [
              { id: 'a', text: 'sitted', isCorrect: false },
              { id: 'b', text: 'sat', isCorrect: true },
              { id: 'c', text: 'sats', isCorrect: false },
              { id: 'd', text: 'sitting', isCorrect: false },
            ],
            createdAt: '2024-01-20',
            updatedAt: '2024-01-20',
          },
          {
            id: 's7-q4',
            type: 'mcq',
            question: 'Which is a plural noun?',
            gradeLevelId: '2',
            gradeLevelName: 'Grade 2',
            subjectId: '2-2',
            subjectName: 'English',
            topicId: '2-2-1',
            topicName: 'Grammar',
            explanation:
              'A plural noun refers to more than one. "Books" is plural because it means more than one book.',
            options: [
              { id: 'a', text: 'Book', isCorrect: false },
              { id: 'b', text: 'Books', isCorrect: true },
              { id: 'c', text: 'Booking', isCorrect: false },
              { id: 'd', text: 'Booked', isCorrect: false },
            ],
            createdAt: '2024-01-20',
            updatedAt: '2024-01-20',
          },
        ],
        answers: [
          {
            questionId: 's7-q1',
            selectedOptionId: 'a',
            isCorrect: true,
            answeredAt: '2024-01-27T10:05:00',
          },
          {
            questionId: 's7-q2',
            selectedOptionId: 'c',
            isCorrect: true,
            answeredAt: '2024-01-27T10:09:00',
          },
          {
            questionId: 's7-q3',
            selectedOptionId: 'a',
            isCorrect: false,
            answeredAt: '2024-01-27T10:14:00',
          },
          {
            questionId: 's7-q4',
            selectedOptionId: 'b',
            isCorrect: true,
            answeredAt: '2024-01-27T10:19:00',
          },
        ],
      },
    ],
  })

  // Get full session by child ID and session ID
  function getSessionById(childId: string, sessionId: string): ChildPracticeSessionFull | null {
    const sessions = childrenSessionsFull.value[childId]
    if (!sessions) return null
    return sessions.find((s) => s.id === sessionId) ?? null
  }

  // Mock statistics data for linked children
  const childrenStatistics = ref<ChildStatistics[]>([
    {
      childId: 's1',
      childName: 'Alex Johnson',
      sessions: [
        {
          id: 'sess-1',
          gradeLevelName: 'Grade 1',
          subjectName: 'Mathematics',
          topicName: 'Addition',
          score: 80,
          totalQuestions: 10,
          correctAnswers: 8,
          durationMinutes: 15,
          completedAt: '2024-01-20T10:15:00',
        },
        {
          id: 'sess-2',
          gradeLevelName: 'Grade 1',
          subjectName: 'English',
          topicName: 'Alphabet',
          score: 100,
          totalQuestions: 10,
          correctAnswers: 10,
          durationMinutes: 20,
          completedAt: '2024-01-21T14:20:00',
        },
        {
          id: 'sess-3',
          gradeLevelName: 'Grade 1',
          subjectName: 'Mathematics',
          topicName: 'Subtraction',
          score: 70,
          totalQuestions: 10,
          correctAnswers: 7,
          durationMinutes: 18,
          completedAt: '2024-01-23T16:18:00',
        },
        {
          id: 'sess-4',
          gradeLevelName: 'Grade 1',
          subjectName: 'Chinese',
          topicName: 'Pinyin',
          score: 50,
          totalQuestions: 10,
          correctAnswers: 5,
          durationMinutes: 25,
          completedAt: '2024-01-24T11:25:00',
        },
        {
          id: 'sess-5',
          gradeLevelName: 'Grade 1',
          subjectName: 'Science',
          topicName: 'Plants',
          score: 90,
          totalQuestions: 10,
          correctAnswers: 9,
          durationMinutes: 12,
          completedAt: '2024-01-25T09:12:00',
        },
        {
          id: 'sess-6',
          gradeLevelName: 'Grade 2',
          subjectName: 'Mathematics',
          topicName: 'Multiplication',
          score: 85,
          totalQuestions: 10,
          correctAnswers: 8,
          durationMinutes: 22,
          completedAt: '2024-01-26T15:22:00',
        },
        {
          id: 'sess-7',
          gradeLevelName: 'Grade 2',
          subjectName: 'English',
          topicName: 'Grammar',
          score: 75,
          totalQuestions: 10,
          correctAnswers: 7,
          durationMinutes: 19,
          completedAt: '2024-01-27T10:19:00',
        },
      ],
    },
  ])

  // Get statistics only for linked children
  const linkedChildrenStatistics = computed(() => {
    const linkedIds = childLinkStore.linkedChildren.map((c) => c.id)
    return childrenStatistics.value.filter((stat) => linkedIds.includes(stat.childId))
  })

  // Get statistics for a specific child
  function getChildStatistics(childId: string) {
    return childrenStatistics.value.find((stat) => stat.childId === childId)
  }

  // Get filtered sessions for a child
  function getFilteredSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): ChildPracticeSession[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []

    const dateRangeStart = dateRange ? getDateRangeStart(dateRange) : null

    return stats.sessions.filter((s) => {
      if (gradeLevelName && s.gradeLevelName !== gradeLevelName) return false
      if (subjectName && s.subjectName !== subjectName) return false
      if (topicName && s.topicName !== topicName) return false
      if (dateRangeStart) {
        const sessionDate = new Date(s.completedAt)
        if (sessionDate < dateRangeStart) return false
      }
      return true
    })
  }

  // Calculate average score for filtered sessions
  function getAverageScore(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)
    if (sessions.length === 0) return 0
    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0)
    return Math.round(totalScore / sessions.length)
  }

  // Get total practice sessions count for filtered sessions
  function getTotalSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    return getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange).length
  }

  // Get total study time in minutes for filtered sessions
  function getTotalStudyTime(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): number {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)
    return sessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  }

  // Get unique topics practiced by a child (from filtered sessions)
  function getTopicsPracticed(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
  ): { topicName: string; subjectName: string; count: number }[] {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)

    const topicMap = new Map<string, { topicName: string; subjectName: string; count: number }>()
    sessions.forEach((s) => {
      const key = `${s.subjectName}-${s.topicName}`
      if (topicMap.has(key)) {
        topicMap.get(key)!.count++
      } else {
        topicMap.set(key, { topicName: s.topicName, subjectName: s.subjectName, count: 1 })
      }
    })

    return Array.from(topicMap.values()).sort((a, b) => b.count - a.count)
  }

  // Get unique grade levels for a child
  function getGradeLevels(childId: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    const gradeLevels = new Set(stats.sessions.map((s) => s.gradeLevelName))
    return Array.from(gradeLevels).sort()
  }

  // Get unique subjects for a child (optionally filtered by grade level)
  function getSubjects(childId: string, gradeLevelName?: string): string[] {
    const stats = getChildStatistics(childId)
    if (!stats) return []
    const sessions = gradeLevelName
      ? stats.sessions.filter((s) => s.gradeLevelName === gradeLevelName)
      : stats.sessions
    const subjects = new Set(sessions.map((s) => s.subjectName))
    return Array.from(subjects).sort()
  }

  // Get unique topics for a child (optionally filtered by grade level and subject)
  function getTopics(childId: string, gradeLevelName?: string, subjectName?: string): string[] {
    const stats = getChildStatistics(childId)
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

  // Get recent sessions for a child (sorted by date descending)
  function getRecentSessions(
    childId: string,
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    dateRange?: DateRangeFilter,
    limit?: number,
  ): ChildPracticeSession[] {
    const sessions = getFilteredSessions(childId, gradeLevelName, subjectName, topicName, dateRange)
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
    return limit ? sorted.slice(0, limit) : sorted
  }

  return {
    childrenStatistics,
    linkedChildrenStatistics,
    getChildStatistics,
    getFilteredSessions,
    getAverageScore,
    getTotalSessions,
    getTotalStudyTime,
    getTopicsPracticed,
    getGradeLevels,
    getSubjects,
    getTopics,
    getRecentSessions,
    getSessionById,
  }
})
