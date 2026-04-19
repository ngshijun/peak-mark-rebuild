/**
 * Shared types for edge functions.
 *
 * Deno edge functions don't import from `src/`, and Supabase's generated
 * `Database` types aren't pulled into this directory either. These shapes
 * mirror the query selects used in the functions so we don't have to
 * spread `any` across hot paths like the AI summary prompt builder.
 */

// --- Question / answer join (generate-session-summary) ---

export type QuestionType = 'mcq' | 'mrq' | 'short_answer'

/**
 * Shape of a `questions` row as projected by generate-session-summary's
 * `practice_answers -> questions!inner(...)` select. Columns omitted from
 * the select aren't listed here.
 */
export interface QuestionJoinRow {
  question: string
  type: QuestionType
  answer: string | null
  image_path: string | null
  option_1_text: string | null
  option_2_text: string | null
  option_3_text: string | null
  option_4_text: string | null
  option_1_image_path: string | null
  option_2_image_path: string | null
  option_3_image_path: string | null
  option_4_image_path: string | null
  option_1_is_correct: boolean | null
  option_2_is_correct: boolean | null
  option_3_is_correct: boolean | null
  option_4_is_correct: boolean | null
}

export interface AnswerWithQuestionRow {
  is_correct: boolean | null
  selected_options: number[] | null
  text_answer: string | null
  questions: QuestionJoinRow
}

// --- Curriculum hierarchy join (same shape as src/types/supabase-helpers) ---

export interface SubTopicHierarchy {
  name: string
  topics: {
    name: string
    subjects: {
      name: string
      grade_levels: { name: string }
    }
  }
}

// --- OpenAI Chat Completions payload shapes ---

export interface OpenAITextContent {
  type: 'text'
  text: string
}

export interface OpenAIImageContent {
  type: 'image_url'
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' }
}

export type OpenAIContent = OpenAITextContent | OpenAIImageContent

export interface OpenAISystemMessage {
  role: 'system'
  content: string
}

export interface OpenAIUserMessage {
  role: 'user'
  content: string | OpenAIContent[]
}

export type OpenAIMessage = OpenAISystemMessage | OpenAIUserMessage
