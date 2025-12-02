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
export const loginFormSchema = toTypedSchema(
  z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
)

export const signupFormSchema = toTypedSchema(
  z
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
    }),
)

// Invitation forms
export const inviteEmailFormSchema = toTypedSchema(
  z.object({
    email: emailSchema,
  }),
)

// Profile forms
export const editNameFormSchema = toTypedSchema(
  z.object({
    name: nameSchema,
  }),
)

// Question feedback form
export const questionFeedbackFormSchema = toTypedSchema(
  z.object({
    category: z.enum(
      [
        'question_error',
        'image_error',
        'option_error',
        'answer_error',
        'explanation_error',
        'other',
      ],
      {
        required_error: 'Please select an issue type',
      },
    ),
    details: z.string().optional(),
  }),
)

// Curriculum forms
export const addCurriculumItemFormSchema = toTypedSchema(
  z.object({
    name: requiredStringSchema('Name'),
  }),
)

// Pet forms
export const petFormSchema = toTypedSchema(
  z.object({
    name: requiredStringSchema('Name'),
    rarity: z.enum(['common', 'rare', 'epic', 'legendary'], {
      required_error: 'Please select a rarity',
    }),
    gachaWeight: z.number().min(0, 'Weight must be positive'),
  }),
)

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

// For MCQ questions
export const mcqQuestionFormSchema = questionFormSchemaBase.extend({
  type: z.literal('mcq'),
  options: z
    .array(mcqOptionSchema)
    .length(4)
    .refine(
      (options) => {
        const filledOptions = options.filter(
          (opt) => (opt.text && opt.text.trim()) || opt.imagePath,
        )
        return filledOptions.length >= 2
      },
      { message: 'At least 2 options must have text or an image' },
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

// Raw Zod schemas for type inference (before toTypedSchema conversion)
const loginFormZodSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

const signupFormZodSchema = z
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

const inviteEmailFormZodSchema = z.object({
  email: emailSchema,
})

const editNameFormZodSchema = z.object({
  name: nameSchema,
})

const questionFeedbackFormZodSchema = z.object({
  category: z.enum(
    ['question_error', 'image_error', 'option_error', 'answer_error', 'explanation_error', 'other'],
    {
      required_error: 'Please select an issue type',
    },
  ),
  details: z.string().optional(),
})

const addCurriculumItemFormZodSchema = z.object({
  name: requiredStringSchema('Name'),
})

const petFormZodSchema = z.object({
  name: requiredStringSchema('Name'),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary'], {
    required_error: 'Please select a rarity',
  }),
  gachaWeight: z.number().min(0, 'Weight must be positive'),
})

// Type exports for form values
export type LoginFormValues = z.infer<typeof loginFormZodSchema>
export type SignupFormValues = z.infer<typeof signupFormZodSchema>
export type InviteEmailFormValues = z.infer<typeof inviteEmailFormZodSchema>
export type EditNameFormValues = z.infer<typeof editNameFormZodSchema>
export type QuestionFeedbackFormValues = z.infer<typeof questionFeedbackFormZodSchema>
export type AddCurriculumItemFormValues = z.infer<typeof addCurriculumItemFormZodSchema>
export type PetFormValues = z.infer<typeof petFormZodSchema>
export type QuestionFormValues = z.infer<typeof questionFormSchema>
