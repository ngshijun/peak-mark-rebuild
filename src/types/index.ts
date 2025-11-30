import type { Component } from 'vue'

export type UserType = 'admin' | 'student' | 'parent'

export interface BaseUser {
  id: string
  name: string
  email: string
  type: UserType
  avatar?: string
  dateJoined: string
}

export interface StudentUser extends BaseUser {
  type: 'student'
  gradeLevelId: string
  gradeLevelName: string
  xp: number
  level: number
  coins: number
  food: number
  selectedPetId?: string
  dateOfBirth?: string
  lastGradeChangeDate?: string
}

export interface AdminUser extends BaseUser {
  type: 'admin'
}

export interface ParentUser extends BaseUser {
  type: 'parent'
  childrenIds: string[]
}

export type User = StudentUser | AdminUser | ParentUser

export interface NavItem {
  title: string
  path: string
  icon: Component
}

export type SidebarNavConfig = Record<UserType, NavItem[]>

// Curriculum types
export interface Topic {
  id: string
  name: string
  coverImage?: string
}

export interface Subject {
  id: string
  name: string
  coverImage?: string
  topics: Topic[]
}

export interface GradeLevel {
  id: string
  name: string
  subjects: Subject[]
}

// Question types
// These are defined here for compatibility with mock data stores
// The questions store also exports its own types that are used for Supabase integration
export type QuestionType = 'mcq' | 'short_answer'

export interface MCQOption {
  id: string
  text: string | null
  imagePath?: string | null
  isCorrect: boolean
}

export interface Question {
  id: string
  type: QuestionType
  question: string
  imagePath?: string | null
  imageUrl?: string // Legacy support
  gradeLevelId: string | null
  gradeLevelName: string
  subjectId: string | null
  subjectName: string
  topicId: string
  topicName: string
  explanation: string | null
  answer?: string | null // For short_answer type
  options?: MCQOption[] // For MCQ type (optional for short_answer)
  createdAt?: string | null
  updatedAt?: string // Legacy support
}

export interface QuestionStatistics {
  questionId: string
  attempts: number
  correctCount: number
  correctnessRate: number
  averageTimeSeconds: number
}

export interface QuestionWithStats extends Question {
  stats: QuestionStatistics
}

// Feedback types
export type FeedbackCategory =
  | 'question_error'
  | 'image_error'
  | 'option_error'
  | 'answer_error'
  | 'explanation_error'
  | 'other'

export interface QuestionFeedback {
  id: string
  questionId: string
  question: string // Denormalized for display
  category: FeedbackCategory
  comments: string
  reportedAt: string
  reportedBy: string
}

// Practice session types
// These are defined here for compatibility with mock data stores
export interface PracticeAnswer {
  id?: string
  questionId: string | null
  selectedOptionId?: string // Legacy support (letter: a, b, c, d)
  selectedOption?: number | null // New format (number: 1, 2, 3, 4)
  textAnswer?: string | null
  isCorrect: boolean
  answeredAt: string | null
  timeSpentSeconds?: number | null
}

export interface PracticeSession {
  id: string
  studentId: string
  gradeLevelId: string | null
  gradeLevelName: string
  subjectId: string | null
  subjectName: string
  topicId: string
  topicName: string
  totalQuestions: number
  currentQuestionIndex: number
  correctCount?: number
  xpEarned?: number | null
  coinsEarned?: number | null
  createdAt?: string | null
  startedAt?: string // Legacy support
  completedAt?: string | null
  questions: Question[]
  answers: PracticeAnswer[]
}

// Parent-Student linking types
export type InvitationStatus = 'pending' | 'accepted' | 'rejected'
export type InvitationDirection = 'parent_to_student' | 'student_to_parent'

export interface ParentStudentInvitation {
  id: string
  parentId?: string // Set when parent initiates or accepts
  parentEmail: string
  parentName?: string
  studentId?: string // Set when student initiates or accepts
  studentEmail: string
  studentName?: string
  direction: InvitationDirection
  status: InvitationStatus
  createdAt: string
  respondedAt?: string
}

export interface LinkedParent {
  id: string
  name: string
  email: string
  linkedAt: string
}

export interface LinkedChild {
  id: string
  name: string
  email: string
  gradeLevelName: string
  linkedAt: string
}
