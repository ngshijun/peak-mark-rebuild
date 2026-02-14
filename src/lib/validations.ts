import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

// ==========================================
// Base field schemas (reusable primitives)
// ==========================================

export const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address')

export const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(6, 'Password must be at least 6 characters')

export const nameSchema = z.string().min(1, 'Name is required').trim()

export const requiredStringSchema = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`).trim()

export const optionalStringSchema = z.string().optional()

// ==========================================
// Form schemas
// ==========================================

// Auth forms
const loginFormZod = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})
export const loginFormSchema = toTypedSchema(loginFormZod)
export type LoginFormValues = z.infer<typeof loginFormZod>

const signupFormZod = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    userType: z.enum(['student', 'parent'], {
      required_error: 'Please select a user type',
    }),
    dateOfBirth: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export const signupFormSchema = toTypedSchema(signupFormZod)
export type SignupFormValues = z.infer<typeof signupFormZod>

// Invitation forms
const inviteEmailFormZod = z.object({
  email: emailSchema,
})
export const inviteEmailFormSchema = toTypedSchema(inviteEmailFormZod)
export type InviteEmailFormValues = z.infer<typeof inviteEmailFormZod>

// Profile forms
const editNameFormZod = z.object({
  name: nameSchema,
})
export const editNameFormSchema = toTypedSchema(editNameFormZod)
export type EditNameFormValues = z.infer<typeof editNameFormZod>

// Question feedback form
const questionFeedbackFormZod = z.object({
  category: z.enum(
    ['question_error', 'image_error', 'option_error', 'answer_error', 'explanation_error', 'other'],
    {
      required_error: 'Please select an issue type',
    },
  ),
  details: z.string().optional(),
})
export const questionFeedbackFormSchema = toTypedSchema(questionFeedbackFormZod)
export type QuestionFeedbackFormValues = z.infer<typeof questionFeedbackFormZod>

// Curriculum forms
const addCurriculumItemFormZod = z.object({
  name: requiredStringSchema('Name'),
})
export const addCurriculumItemFormSchema = toTypedSchema(addCurriculumItemFormZod)
export type AddCurriculumItemFormValues = z.infer<typeof addCurriculumItemFormZod>

// Pet forms
const petFormZod = z.object({
  name: requiredStringSchema('Name'),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary'], {
    required_error: 'Please select a rarity',
  }),
})
export const petFormSchema = toTypedSchema(petFormZod)
export type PetFormValues = z.infer<typeof petFormZod>

// Announcement forms
const announcementFormZod = z.object({
  title: requiredStringSchema('Title'),
  content: z.string().min(1, 'Content is required'),
  targetAudience: z.enum(['all', 'students_only', 'parents_only'], {
    required_error: 'Please select target audience',
  }),
  expiresAt: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
})
export const announcementFormSchema = toTypedSchema(announcementFormZod)
export type AnnouncementFormValues = z.infer<typeof announcementFormZod>

// Question form - this is complex, so we define it as a raw zod schema for flexibility
export const questionFormSchemaBase = z.object({
  type: z.enum(['mcq', 'short_answer']),
  gradeLevelId: z.string().min(1, 'Grade level is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  topicId: z.string().min(1, 'Topic is required'),
  question: z.string().min(1, 'Question text is required').trim(),
  explanation: z.string().optional(),
})

export const mcqOptionSchema = z.object({
  id: z.enum(['a', 'b', 'c', 'd']),
  text: z.string().nullable(),
  imagePath: z.string().nullable(),
  isCorrect: z.boolean(),
})

// Helper to check if an option is filled
const isOptionFilled = (opt: { text: string | null; imagePath: string | null }) =>
  (opt.text && opt.text.trim()) || opt.imagePath

// For MCQ questions
export const mcqQuestionFormSchema = questionFormSchemaBase.extend({
  type: z.literal('mcq'),
  options: z
    .array(mcqOptionSchema)
    .length(4)
    .refine(
      (options) => {
        const filledCount = options.filter(isOptionFilled).length
        return filledCount >= 2
      },
      { message: 'At least 2 options must have text or an image' },
    )
    .refine(
      (options) => {
        // Options must be filled consecutively from the beginning (A, B, C, D order)
        // E.g., if 3 options are filled, they must be A, B, C (not A, C, D)
        let foundEmpty = false
        for (const opt of options) {
          const isFilled = isOptionFilled(opt)
          if (foundEmpty && isFilled) {
            // Found a filled option after an empty one - invalid
            return false
          }
          if (!isFilled) {
            foundEmpty = true
          }
        }
        return true
      },
      { message: 'Options must be filled consecutively from Option A' },
    )
    .refine((options) => options.some((opt) => opt.isCorrect), {
      message: 'Please select the correct answer',
    }),
})

// For short answer questions
export const shortAnswerQuestionFormSchema = questionFormSchemaBase.extend({
  type: z.literal('short_answer'),
  answer: z.string().min(1, 'Answer is required').trim(),
})

// Union schema for question form
export const questionFormSchema = z.discriminatedUnion('type', [
  mcqQuestionFormSchema,
  shortAnswerQuestionFormSchema,
])

// Question form type export
export type QuestionFormValues = z.infer<typeof questionFormSchema>
