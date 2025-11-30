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
export type QuestionType = 'mcq' | 'short_answer'

export interface MCQOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface BaseQuestion {
  id: string
  type: QuestionType
  question: string
  imageUrl?: string
  gradeLevelId: string
  gradeLevelName: string
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  explanation: string
  createdAt: string
  updatedAt: string
}

export interface MCQQuestion extends BaseQuestion {
  type: 'mcq'
  options: MCQOption[]
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short_answer'
  answer: string
}

export type Question = MCQQuestion | ShortAnswerQuestion

// Input types for creating/updating questions
export type CreateMCQQuestion = Omit<MCQQuestion, 'id' | 'createdAt' | 'updatedAt'>
export type CreateShortAnswerQuestion = Omit<ShortAnswerQuestion, 'id' | 'createdAt' | 'updatedAt'>
export type CreateQuestion = CreateMCQQuestion | CreateShortAnswerQuestion

export type UpdateMCQQuestion = Partial<Omit<MCQQuestion, 'id' | 'createdAt'>>
export type UpdateShortAnswerQuestion = Partial<Omit<ShortAnswerQuestion, 'id' | 'createdAt'>>
export type UpdateQuestion = UpdateMCQQuestion | UpdateShortAnswerQuestion

// Question statistics
export interface QuestionStatistics {
  questionId: string
  attempts: number
  correctCount: number
  correctnessRate: number
  averageTimeSeconds: number
}

export type QuestionWithStats = Question & {
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
export interface PracticeAnswer {
  questionId: string
  selectedOptionId?: string // For MCQ
  textAnswer?: string // For short answer
  isCorrect: boolean
  answeredAt: string
}

export interface PracticeSession {
  id: string
  studentId: string
  gradeLevelId: string | null
  gradeLevelName: string
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  questions: Question[]
  answers: PracticeAnswer[]
  currentQuestionIndex: number
  startedAt: string
  completedAt?: string
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
