import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Question,
  CreateQuestion,
  UpdateQuestion,
  QuestionStatistics,
  QuestionWithStats,
} from '@/types'

export const useQuestionsStore = defineStore('questions', () => {
  const questions = ref<Question[]>([
    // Grade 1 - Mathematics - Addition
    {
      id: '1',
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
      id: 'add-2',
      type: 'mcq',
      question: 'How many apples are there in total?',
      imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      explanation: 'Count all the apples in the image. There are 3 + 2 = 5 apples.',
      options: [
        { id: 'a', text: '3', isCorrect: false },
        { id: 'b', text: '4', isCorrect: false },
        { id: 'c', text: '5', isCorrect: true },
        { id: 'd', text: '6', isCorrect: false },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    {
      id: 'add-3',
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
      id: 'add-4',
      type: 'mcq',
      question: 'Look at the picture. How many flowers are there if we add 2 more?',
      imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      explanation: 'There are 4 flowers in the picture. Adding 2 more gives us 4 + 2 = 6 flowers.',
      options: [
        { id: 'a', text: '4', isCorrect: false },
        { id: 'b', text: '5', isCorrect: false },
        { id: 'c', text: '6', isCorrect: true },
        { id: 'd', text: '7', isCorrect: false },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    {
      id: 'add-5',
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
      id: 'add-6',
      type: 'mcq',
      question: 'Count the stars and add them together. What is the total?',
      imageUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      explanation: 'In the night sky image, imagine there are 4 + 5 = 9 bright stars.',
      options: [
        { id: 'a', text: '7', isCorrect: false },
        { id: 'b', text: '8', isCorrect: false },
        { id: 'c', text: '9', isCorrect: true },
        { id: 'd', text: '10', isCorrect: false },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    {
      id: 'add-7',
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
      id: 'add-8',
      type: 'mcq',
      question: 'How many balloons are there in total?',
      imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      explanation: 'Count 3 red balloons and 5 blue balloons. 3 + 5 = 8 balloons total.',
      options: [
        { id: 'a', text: '6', isCorrect: false },
        { id: 'b', text: '7', isCorrect: false },
        { id: 'c', text: '8', isCorrect: true },
        { id: 'd', text: '9', isCorrect: false },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    {
      id: 'add-9',
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
      id: 'add-10',
      type: 'mcq',
      question:
        'Look at the picture of cookies. If you have 2 cookies and your friend gives you 3 more, how many do you have?',
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      explanation: '2 cookies plus 3 more cookies equals 5 cookies. 2 + 3 = 5.',
      options: [
        { id: 'a', text: '4', isCorrect: false },
        { id: 'b', text: '5', isCorrect: true },
        { id: 'c', text: '6', isCorrect: false },
        { id: 'd', text: '7', isCorrect: false },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    {
      id: 'add-11',
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
      id: 'add-12',
      type: 'mcq',
      question: 'How many pencils are there altogether?',
      imageUrl: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-1',
      topicName: 'Addition',
      explanation: 'Count 4 pencils in one group and 3 in another. 4 + 3 = 7 pencils.',
      options: [
        { id: 'a', text: '5', isCorrect: false },
        { id: 'b', text: '6', isCorrect: false },
        { id: 'c', text: '7', isCorrect: true },
        { id: 'd', text: '8', isCorrect: false },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    // Grade 1 - Mathematics - Subtraction
    {
      id: '2',
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
      id: 'sub-2',
      type: 'mcq',
      question: 'There were 7 birds on the tree. 3 flew away. How many are left?',
      imageUrl: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-2',
      topicName: 'Subtraction',
      explanation: '7 birds minus 3 birds that flew away equals 4 birds remaining. 7 - 3 = 4.',
      options: [
        { id: 'a', text: '3', isCorrect: false },
        { id: 'b', text: '4', isCorrect: true },
        { id: 'c', text: '5', isCorrect: false },
        { id: 'd', text: '6', isCorrect: false },
      ],
      createdAt: '2024-01-16',
      updatedAt: '2024-01-16',
    },
    {
      id: 'sub-3',
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
      id: 'sub-4',
      type: 'mcq',
      question: 'You had 6 candies and ate 2. How many candies do you have now?',
      imageUrl: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-2',
      topicName: 'Subtraction',
      explanation: '6 candies minus 2 candies eaten equals 4 candies left. 6 - 2 = 4.',
      options: [
        { id: 'a', text: '3', isCorrect: false },
        { id: 'b', text: '4', isCorrect: true },
        { id: 'c', text: '5', isCorrect: false },
        { id: 'd', text: '6', isCorrect: false },
      ],
      createdAt: '2024-01-16',
      updatedAt: '2024-01-16',
    },
    {
      id: 'sub-5',
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
      id: 'sub-6',
      type: 'mcq',
      question:
        'There were 10 fish in the tank. 4 were moved to another tank. How many fish are left?',
      imageUrl: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-2',
      topicName: 'Subtraction',
      explanation: '10 fish minus 4 fish equals 6 fish remaining. 10 - 4 = 6.',
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
      id: 'sub-7',
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
      id: 'sub-8',
      type: 'mcq',
      question:
        'A basket had 8 oranges. Mom took 3 for juice. How many oranges are in the basket now?',
      imageUrl: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-2',
      topicName: 'Subtraction',
      explanation: '8 oranges minus 3 oranges equals 5 oranges left. 8 - 3 = 5.',
      options: [
        { id: 'a', text: '4', isCorrect: false },
        { id: 'b', text: '5', isCorrect: true },
        { id: 'c', text: '6', isCorrect: false },
        { id: 'd', text: '7', isCorrect: false },
      ],
      createdAt: '2024-01-16',
      updatedAt: '2024-01-16',
    },
    {
      id: 'sub-9',
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
      id: 'sub-10',
      type: 'mcq',
      question: 'You had 9 stickers and gave 5 to your friend. How many stickers do you have left?',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-1',
      subjectName: 'Mathematics',
      topicId: '1-1-2',
      topicName: 'Subtraction',
      explanation: '9 stickers minus 5 stickers given away equals 4 stickers remaining. 9 - 5 = 4.',
      options: [
        { id: 'a', text: '3', isCorrect: false },
        { id: 'b', text: '4', isCorrect: true },
        { id: 'c', text: '5', isCorrect: false },
        { id: 'd', text: '6', isCorrect: false },
      ],
      createdAt: '2024-01-16',
      updatedAt: '2024-01-16',
    },
    // Grade 1 - English - Alphabet
    {
      id: '3',
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
      id: 'alpha-2',
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
      id: 'alpha-3',
      type: 'mcq',
      question: 'What letter does this animal start with?',
      imageUrl: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-2',
      subjectName: 'English',
      topicId: '1-2-1',
      topicName: 'Alphabet',
      explanation: 'The elephant in the picture starts with the letter E.',
      options: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'D', isCorrect: false },
        { id: 'c', text: 'E', isCorrect: true },
        { id: 'd', text: 'F', isCorrect: false },
      ],
      createdAt: '2024-01-17',
      updatedAt: '2024-01-17',
    },
    {
      id: 'alpha-4',
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
      id: 'alpha-5',
      type: 'mcq',
      question: 'What letter does this fruit start with?',
      imageUrl: 'https://images.unsplash.com/photo-1568702846914-96b305d2uj48?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-2',
      subjectName: 'English',
      topicId: '1-2-1',
      topicName: 'Alphabet',
      explanation: 'Banana starts with the letter B.',
      options: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
        { id: 'c', text: 'C', isCorrect: false },
        { id: 'd', text: 'D', isCorrect: false },
      ],
      createdAt: '2024-01-17',
      updatedAt: '2024-01-17',
    },
    {
      id: 'alpha-6',
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
    {
      id: 'alpha-7',
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
      id: 'alpha-8',
      type: 'mcq',
      question: 'What letter does this animal start with?',
      imageUrl: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-2',
      subjectName: 'English',
      topicId: '1-2-1',
      topicName: 'Alphabet',
      explanation: 'Cat starts with the letter C.',
      options: [
        { id: 'a', text: 'B', isCorrect: false },
        { id: 'b', text: 'C', isCorrect: true },
        { id: 'c', text: 'D', isCorrect: false },
        { id: 'd', text: 'K', isCorrect: false },
      ],
      createdAt: '2024-01-17',
      updatedAt: '2024-01-17',
    },
    {
      id: 'alpha-9',
      type: 'mcq',
      question: 'Which letter comes before "F"?',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-2',
      subjectName: 'English',
      topicId: '1-2-1',
      topicName: 'Alphabet',
      explanation: 'The alphabet goes D, E, F... So E comes before F.',
      options: [
        { id: 'a', text: 'D', isCorrect: false },
        { id: 'b', text: 'E', isCorrect: true },
        { id: 'c', text: 'G', isCorrect: false },
        { id: 'd', text: 'H', isCorrect: false },
      ],
      createdAt: '2024-01-17',
      updatedAt: '2024-01-17',
    },
    {
      id: 'alpha-10',
      type: 'mcq',
      question: 'What letter does the word "Sun" start with?',
      imageUrl: 'https://images.unsplash.com/photo-1532978379173-523e16f371f2?w=400&h=300&fit=crop',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      subjectId: '1-2',
      subjectName: 'English',
      topicId: '1-2-1',
      topicName: 'Alphabet',
      explanation: 'Sun starts with the letter S.',
      options: [
        { id: 'a', text: 'R', isCorrect: false },
        { id: 'b', text: 'S', isCorrect: true },
        { id: 'c', text: 'T', isCorrect: false },
        { id: 'd', text: 'U', isCorrect: false },
      ],
      createdAt: '2024-01-17',
      updatedAt: '2024-01-17',
    },
    // Grade 2 questions
    {
      id: '4',
      type: 'mcq',
      question: 'What is 3 × 4?',
      gradeLevelId: '2',
      gradeLevelName: 'Grade 2',
      subjectId: '2-1',
      subjectName: 'Mathematics',
      topicId: '2-1-1',
      topicName: 'Multiplication',
      explanation: '3 multiplied by 4 equals 12.',
      options: [
        { id: 'a', text: '7', isCorrect: false },
        { id: 'b', text: '10', isCorrect: false },
        { id: 'c', text: '12', isCorrect: true },
        { id: 'd', text: '14', isCorrect: false },
      ],
      createdAt: '2024-01-18',
      updatedAt: '2024-01-18',
    },
    {
      id: '5',
      type: 'short_answer',
      question: 'What do plants need to grow?',
      gradeLevelId: '2',
      gradeLevelName: 'Grade 2',
      subjectId: '2-2',
      subjectName: 'Science',
      topicId: '2-2-1',
      topicName: 'Plants',
      explanation: 'Plants need sunlight, water, and soil to grow.',
      answer: 'Sunlight, water, and soil',
      createdAt: '2024-01-19',
      updatedAt: '2024-01-19',
    },
    {
      id: '6',
      type: 'mcq',
      question: 'Which animal is a mammal?',
      gradeLevelId: '2',
      gradeLevelName: 'Grade 2',
      subjectId: '2-2',
      subjectName: 'Science',
      topicId: '2-2-2',
      topicName: 'Animals',
      explanation: 'Dogs are mammals because they have fur and give birth to live young.',
      options: [
        { id: 'a', text: 'Fish', isCorrect: false },
        { id: 'b', text: 'Bird', isCorrect: false },
        { id: 'c', text: 'Dog', isCorrect: true },
        { id: 'd', text: 'Snake', isCorrect: false },
      ],
      createdAt: '2024-01-20',
      updatedAt: '2024-01-20',
    },
  ])

  function generateId() {
    return Math.random().toString(36).substring(2, 9)
  }

  function addQuestion(question: CreateQuestion) {
    const now = new Date().toISOString().split('T')[0]
    const newQuestion = {
      ...question,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    } as Question
    questions.value.push(newQuestion)
    return newQuestion
  }

  function updateQuestion(id: string, updates: UpdateQuestion) {
    const index = questions.value.findIndex((q) => q.id === id)
    if (index !== -1) {
      const now = new Date().toISOString().split('T')[0]
      questions.value[index] = {
        ...questions.value[index],
        ...updates,
        updatedAt: now,
      } as Question
    }
  }

  function deleteQuestion(id: string) {
    const index = questions.value.findIndex((q) => q.id === id)
    if (index !== -1) {
      questions.value.splice(index, 1)
    }
  }

  function getQuestionById(id: string) {
    return questions.value.find((q) => q.id === id)
  }

  // Mock statistics data
  const questionStatistics = ref<QuestionStatistics[]>([
    {
      questionId: '1',
      attempts: 150,
      correctCount: 135,
      correctnessRate: 90,
      averageTimeSeconds: 12,
    },
    {
      questionId: '2',
      attempts: 120,
      correctCount: 96,
      correctnessRate: 80,
      averageTimeSeconds: 18,
    },
    {
      questionId: '3',
      attempts: 200,
      correctCount: 180,
      correctnessRate: 90,
      averageTimeSeconds: 8,
    },
    {
      questionId: '4',
      attempts: 80,
      correctCount: 52,
      correctnessRate: 65,
      averageTimeSeconds: 25,
    },
    {
      questionId: '5',
      attempts: 95,
      correctCount: 57,
      correctnessRate: 60,
      averageTimeSeconds: 45,
    },
    {
      questionId: '6',
      attempts: 110,
      correctCount: 88,
      correctnessRate: 80,
      averageTimeSeconds: 20,
    },
  ])

  const questionsWithStats = computed<QuestionWithStats[]>(() => {
    return questions.value.map((q) => {
      const stats = questionStatistics.value.find((s) => s.questionId === q.id) ?? {
        questionId: q.id,
        attempts: 0,
        correctCount: 0,
        correctnessRate: 0,
        averageTimeSeconds: 0,
      }
      return { ...q, stats }
    })
  })

  function getStatsByQuestionId(id: string) {
    return questionStatistics.value.find((s) => s.questionId === id)
  }

  // Get unique grade levels from all questions
  function getGradeLevels(): string[] {
    const gradeLevels = new Set(questions.value.map((q) => q.gradeLevelName))
    return Array.from(gradeLevels).sort()
  }

  // Get unique subjects (optionally filtered by grade level)
  function getSubjects(gradeLevelName?: string): string[] {
    const filteredQuestions = gradeLevelName
      ? questions.value.filter((q) => q.gradeLevelName === gradeLevelName)
      : questions.value
    const subjects = new Set(filteredQuestions.map((q) => q.subjectName))
    return Array.from(subjects).sort()
  }

  // Get unique topics (optionally filtered by grade level and subject)
  function getTopics(gradeLevelName?: string, subjectName?: string): string[] {
    let filteredQuestions = questions.value
    if (gradeLevelName) {
      filteredQuestions = filteredQuestions.filter((q) => q.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      filteredQuestions = filteredQuestions.filter((q) => q.subjectName === subjectName)
    }
    const topics = new Set(filteredQuestions.map((q) => q.topicName))
    return Array.from(topics).sort()
  }

  // Filter questions by grade level, subject, and topic
  function getFilteredQuestions(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): Question[] {
    let filtered = questions.value
    if (gradeLevelName) {
      filtered = filtered.filter((q) => q.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      filtered = filtered.filter((q) => q.subjectName === subjectName)
    }
    if (topicName) {
      filtered = filtered.filter((q) => q.topicName === topicName)
    }
    return filtered
  }

  // Filter questions with stats by grade level, subject, and topic
  function getFilteredQuestionsWithStats(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): QuestionWithStats[] {
    let filtered = questionsWithStats.value
    if (gradeLevelName) {
      filtered = filtered.filter((q) => q.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      filtered = filtered.filter((q) => q.subjectName === subjectName)
    }
    if (topicName) {
      filtered = filtered.filter((q) => q.topicName === topicName)
    }
    return filtered
  }

  return {
    questions,
    questionStatistics,
    questionsWithStats,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    getQuestionById,
    getStatsByQuestionId,
    getGradeLevels,
    getSubjects,
    getTopics,
    getFilteredQuestions,
    getFilteredQuestionsWithStats,
  }
})
