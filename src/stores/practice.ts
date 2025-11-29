import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PracticeSession, PracticeAnswer } from '@/types'
import { useQuestionsStore } from './questions'
import { useAuthStore } from './auth'

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

export const usePracticeStore = defineStore('practice', () => {
  const currentSession = ref<PracticeSession | null>(null)
  const sessionHistory = ref<PracticeSession[]>([
    // Mock history data with full question data for detail view
    {
      id: 'hist-1',
      studentId: '2',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      questions: [
        {
          id: 'h1-q1',
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
          id: 'h1-q2',
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
          id: 'h1-q3',
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
          id: 'h1-q4',
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
          id: 'h1-q5',
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
          id: 'h1-q6',
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
          id: 'h1-q7',
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
          id: 'h1-q8',
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
          id: 'h1-q9',
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
          id: 'h1-q10',
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
          questionId: 'h1-q1',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-20T10:05:00',
        },
        {
          questionId: 'h1-q2',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-20T10:06:00',
        },
        {
          questionId: 'h1-q3',
          textAnswer: '9',
          isCorrect: false,
          answeredAt: '2024-01-20T10:07:00',
        },
        {
          questionId: 'h1-q4',
          selectedOptionId: 'c',
          isCorrect: true,
          answeredAt: '2024-01-20T10:08:00',
        },
        {
          questionId: 'h1-q5',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-20T10:09:00',
        },
        {
          questionId: 'h1-q6',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-20T10:10:00',
        },
        {
          questionId: 'h1-q7',
          selectedOptionId: 'a',
          isCorrect: false,
          answeredAt: '2024-01-20T10:11:00',
        },
        {
          questionId: 'h1-q8',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-20T10:12:00',
        },
        {
          questionId: 'h1-q9',
          textAnswer: '8',
          isCorrect: true,
          answeredAt: '2024-01-20T10:13:00',
        },
        {
          questionId: 'h1-q10',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-20T10:14:00',
        },
      ],
      currentQuestionIndex: 9,
      startedAt: '2024-01-20T10:00:00',
      completedAt: '2024-01-20T10:15:00',
    },
    {
      id: 'hist-2',
      studentId: '2',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-2',
      subjectName: 'English',
      topicId: '1-2-1',
      topicName: 'Alphabet',
      questions: [
        {
          id: 'h2-q1',
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
          id: 'h2-q2',
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
          id: 'h2-q3',
          type: 'mcq',
          question: 'Which letter is a vowel?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-2',
          subjectName: 'English',
          topicId: '1-2-1',
          topicName: 'Alphabet',
          explanation: 'The vowels are A, E, I, O, U.',
          options: [
            { id: 'a', text: 'B', isCorrect: false },
            { id: 'b', text: 'C', isCorrect: false },
            { id: 'c', text: 'D', isCorrect: false },
            { id: 'd', text: 'E', isCorrect: true },
          ],
          createdAt: '2024-01-17',
          updatedAt: '2024-01-17',
        },
        {
          id: 'h2-q4',
          type: 'mcq',
          question: 'How many letters are in the English alphabet?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-2',
          subjectName: 'English',
          topicId: '1-2-1',
          topicName: 'Alphabet',
          explanation: 'The English alphabet has 26 letters.',
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
          id: 'h2-q5',
          type: 'short_answer',
          question: 'What is the last letter of the alphabet?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-2',
          subjectName: 'English',
          topicId: '1-2-1',
          topicName: 'Alphabet',
          explanation: 'The alphabet ends with Z.',
          answer: 'Z',
          createdAt: '2024-01-17',
          updatedAt: '2024-01-17',
        },
      ],
      answers: [
        {
          questionId: 'h2-q1',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-21T14:05:00',
        },
        {
          questionId: 'h2-q2',
          textAnswer: 'A',
          isCorrect: true,
          answeredAt: '2024-01-21T14:08:00',
        },
        {
          questionId: 'h2-q3',
          selectedOptionId: 'd',
          isCorrect: true,
          answeredAt: '2024-01-21T14:11:00',
        },
        {
          questionId: 'h2-q4',
          selectedOptionId: 'c',
          isCorrect: true,
          answeredAt: '2024-01-21T14:14:00',
        },
        {
          questionId: 'h2-q5',
          textAnswer: 'Z',
          isCorrect: true,
          answeredAt: '2024-01-21T14:17:00',
        },
      ],
      currentQuestionIndex: 4,
      startedAt: '2024-01-21T14:00:00',
      completedAt: '2024-01-21T14:20:00',
    },
    {
      id: 'hist-3',
      studentId: '2',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-3',
      subjectName: 'Science',
      topicId: '1-3-1',
      topicName: 'Plants',
      questions: [],
      answers: [
        { questionId: '1', isCorrect: true, answeredAt: '2024-01-22T09:05:00' },
        { questionId: '2', isCorrect: false, answeredAt: '2024-01-22T09:06:00' },
        { questionId: '3', isCorrect: true, answeredAt: '2024-01-22T09:07:00' },
        { questionId: '4', isCorrect: false, answeredAt: '2024-01-22T09:08:00' },
        { questionId: '5', isCorrect: true, answeredAt: '2024-01-22T09:09:00' },
      ],
      currentQuestionIndex: 4,
      startedAt: '2024-01-22T09:00:00',
      // No completedAt - in progress
    },
    {
      id: 'hist-4',
      studentId: '2',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-2',
      topicName: 'Subtraction',
      questions: [
        {
          id: 'h4-q1',
          type: 'mcq',
          question: 'What is 5 - 3?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-1',
          subjectName: 'Mathematics',
          topicId: '1-1-2',
          topicName: 'Subtraction',
          explanation: '5 minus 3 equals 2.',
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
          id: 'h4-q2',
          type: 'mcq',
          question: 'What is 8 - 2?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-1',
          subjectName: 'Mathematics',
          topicId: '1-1-2',
          topicName: 'Subtraction',
          explanation: '8 minus 2 equals 6.',
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
          id: 'h4-q3',
          type: 'short_answer',
          question: 'What is 9 - 4?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-1',
          subjectName: 'Mathematics',
          topicId: '1-1-2',
          topicName: 'Subtraction',
          explanation: '9 minus 4 equals 5.',
          answer: '5',
          createdAt: '2024-01-16',
          updatedAt: '2024-01-16',
        },
        {
          id: 'h4-q4',
          type: 'mcq',
          question: 'What is 7 - 5?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-1',
          subjectName: 'Mathematics',
          topicId: '1-1-2',
          topicName: 'Subtraction',
          explanation: '7 minus 5 equals 2.',
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
          id: 'h4-q5',
          type: 'mcq',
          question: 'What is 10 - 3?',
          gradeLevelId: '1',
          gradeLevelName: 'Grade 1',
          subjectId: '1-1',
          subjectName: 'Mathematics',
          topicId: '1-1-2',
          topicName: 'Subtraction',
          explanation: '10 minus 3 equals 7.',
          options: [
            { id: 'a', text: '6', isCorrect: false },
            { id: 'b', text: '7', isCorrect: true },
            { id: 'c', text: '8', isCorrect: false },
            { id: 'd', text: '9', isCorrect: false },
          ],
          createdAt: '2024-01-16',
          updatedAt: '2024-01-16',
        },
      ],
      answers: [
        {
          questionId: 'h4-q1',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-23T16:05:00',
        },
        {
          questionId: 'h4-q2',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-23T16:07:00',
        },
        {
          questionId: 'h4-q3',
          textAnswer: '5',
          isCorrect: true,
          answeredAt: '2024-01-23T16:09:00',
        },
        {
          questionId: 'h4-q4',
          selectedOptionId: 'a',
          isCorrect: false,
          answeredAt: '2024-01-23T16:12:00',
        },
        {
          questionId: 'h4-q5',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-23T16:15:00',
        },
      ],
      currentQuestionIndex: 4,
      startedAt: '2024-01-23T16:00:00',
      completedAt: '2024-01-23T16:18:00',
    },
    {
      id: 'hist-5',
      studentId: '2',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-4',
      subjectName: 'Chinese',
      topicId: '1-4-1',
      topicName: 'Pinyin',
      questions: [
        {
          id: 'h5-q1',
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
          id: 'h5-q2',
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
          id: 'h5-q3',
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
          id: 'h5-q4',
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
          questionId: 'h5-q1',
          selectedOptionId: 'a',
          isCorrect: false,
          answeredAt: '2024-01-24T11:06:00',
        },
        {
          questionId: 'h5-q2',
          selectedOptionId: 'c',
          isCorrect: true,
          answeredAt: '2024-01-24T11:12:00',
        },
        {
          questionId: 'h5-q3',
          selectedOptionId: 'b',
          isCorrect: false,
          answeredAt: '2024-01-24T11:18:00',
        },
        {
          questionId: 'h5-q4',
          selectedOptionId: 'd',
          isCorrect: true,
          answeredAt: '2024-01-24T11:25:00',
        },
      ],
      currentQuestionIndex: 3,
      startedAt: '2024-01-24T11:00:00',
      completedAt: '2024-01-24T11:25:00',
    },
    // Additional mock data with Grade 2 to demonstrate grade level filter
    {
      id: 'hist-6',
      studentId: '2',
      gradeLevelId: '2',
      gradeLevelName: 'Grade 2',
      subjectId: '2-1',
      subjectName: 'Mathematics',
      topicId: '2-1-1',
      topicName: 'Multiplication',
      questions: [
        {
          id: 'h6-q1',
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
          id: 'h6-q2',
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
          id: 'h6-q3',
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
          id: 'h6-q4',
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
          id: 'h6-q5',
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
      ],
      answers: [
        {
          questionId: 'h6-q1',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-25T10:05:00',
        },
        {
          questionId: 'h6-q2',
          selectedOptionId: 'c',
          isCorrect: true,
          answeredAt: '2024-01-25T10:08:00',
        },
        {
          questionId: 'h6-q3',
          textAnswer: '10',
          isCorrect: true,
          answeredAt: '2024-01-25T10:11:00',
        },
        {
          questionId: 'h6-q4',
          selectedOptionId: 'a',
          isCorrect: false,
          answeredAt: '2024-01-25T10:14:00',
        },
        {
          questionId: 'h6-q5',
          selectedOptionId: 'b',
          isCorrect: true,
          answeredAt: '2024-01-25T10:17:00',
        },
      ],
      currentQuestionIndex: 4,
      startedAt: '2024-01-25T10:00:00',
      completedAt: '2024-01-25T10:20:00',
    },
  ])

  const questionsStore = useQuestionsStore()
  const authStore = useAuthStore()

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
    return currentSession.value.questions.length
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
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  })

  function startSession(
    subjectId: string,
    subjectName: string,
    topicId: string,
    topicName: string,
  ) {
    if (!authStore.user || authStore.user.type !== 'student') return null

    // Get questions for the topic and student's grade level
    const gradeLevelId = authStore.user.gradeLevelId
    const gradeLevelName = authStore.user.gradeLevelName
    const availableQuestions = questionsStore.questions.filter(
      (q) => q.gradeLevelId === gradeLevelId && q.topicId === topicId,
    )

    // Shuffle and pick 10 questions (or all if less than 10)
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
    const selectedQuestions = shuffled.slice(0, 10)

    if (selectedQuestions.length === 0) return null

    const session: PracticeSession = {
      id: crypto.randomUUID(),
      studentId: authStore.user.id,
      gradeLevelId,
      gradeLevelName,
      subjectId,
      subjectName,
      topicId,
      topicName,
      questions: selectedQuestions,
      answers: [],
      currentQuestionIndex: 0,
      startedAt: new Date().toISOString(),
    }

    currentSession.value = session
    // Add to history immediately
    sessionHistory.value.push(session)
    return session
  }

  function submitAnswer(selectedOptionId?: string, textAnswer?: string) {
    if (!currentSession.value || !currentQuestion.value) return null

    const question = currentQuestion.value
    let isCorrect = false

    if (question.type === 'mcq' && selectedOptionId) {
      const selectedOption = question.options.find((o) => o.id === selectedOptionId)
      isCorrect = selectedOption?.isCorrect ?? false
    } else if (question.type === 'short_answer' && textAnswer) {
      // Simple case-insensitive comparison for short answers
      isCorrect = textAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase()
    }

    const answer: PracticeAnswer = {
      questionId: question.id,
      selectedOptionId,
      textAnswer,
      isCorrect,
      answeredAt: new Date().toISOString(),
    }

    currentSession.value.answers.push(answer)
    return answer
  }

  function nextQuestion() {
    if (!currentSession.value) return false

    if (currentSession.value.currentQuestionIndex < currentSession.value.questions.length - 1) {
      currentSession.value.currentQuestionIndex++
      return true
    }
    return false
  }

  function previousQuestion() {
    if (!currentSession.value) return false

    if (currentSession.value.currentQuestionIndex > 0) {
      currentSession.value.currentQuestionIndex--
      return true
    }
    return false
  }

  function goToQuestion(index: number) {
    if (!currentSession.value) return false

    if (index >= 0 && index < currentSession.value.questions.length) {
      currentSession.value.currentQuestionIndex = index
      return true
    }
    return false
  }

  function completeSession() {
    if (!currentSession.value) return null

    currentSession.value.completedAt = new Date().toISOString()

    // Award XP based on score
    const correctAnswers = currentSession.value.answers.filter((a) => a.isCorrect).length
    const baseXp = 50 // Base XP for completing a session
    const bonusXp = correctAnswers * 10 // Bonus XP per correct answer
    const totalXp = baseXp + bonusXp

    // Award coins based on score
    const baseCoins = 20 // Base coins for completing a session
    const bonusCoins = correctAnswers * 5 // Bonus coins per correct answer
    const totalCoins = baseCoins + bonusCoins

    authStore.addXp(totalXp)
    authStore.addCoins(totalCoins)

    return currentSession.value
  }

  function endSession() {
    currentSession.value = null
  }

  // Get filtered sessions for current student
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
        if (dateRangeStart) {
          const sessionDate = new Date(s.startedAt)
          if (sessionDate < dateRangeStart) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }

  // Get unique grade levels from student's history
  function getHistoryGradeLevels(): string[] {
    if (!authStore.user) return []
    const gradeLevels = new Set(
      sessionHistory.value
        .filter((s) => s.studentId === authStore.user!.id)
        .map((s) => s.gradeLevelName),
    )
    return Array.from(gradeLevels).sort()
  }

  // Get unique subjects from student's history (optionally filtered by grade level)
  function getHistorySubjects(gradeLevelName?: string): string[] {
    if (!authStore.user) return []
    const sessions = sessionHistory.value.filter((s) => s.studentId === authStore.user!.id)
    const filtered = gradeLevelName
      ? sessions.filter((s) => s.gradeLevelName === gradeLevelName)
      : sessions
    const subjects = new Set(filtered.map((s) => s.subjectName))
    return Array.from(subjects).sort()
  }

  // Get unique topics from student's history (optionally filtered by grade level and subject)
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

  // Get a specific session by ID
  function getSessionById(sessionId: string): PracticeSession | null {
    return sessionHistory.value.find((s) => s.id === sessionId) ?? null
  }

  return {
    currentSession,
    sessionHistory,
    studentHistory,
    isSessionActive,
    currentQuestion,
    currentQuestionNumber,
    totalQuestions,
    currentAnswer,
    isCurrentQuestionAnswered,
    sessionResults,
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
  }
})
