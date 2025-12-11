import type { ParsedQuestion, ParsedQuestionImage } from './questionExcel'
import { useQuestionsStore, type CreateQuestionInput } from '@/stores/questions'
import { useCurriculumStore } from '@/stores/curriculum'

// ============================================
// TYPES
// ============================================

export interface DuplicateInfo {
  row: number
  existingId: string
  question: string
}

export interface InvalidInfo {
  row: number
  errors: string[]
}

export interface WithinFileDuplicate {
  rows: number[]
  question: string
}

export interface UploadValidationResult {
  valid: ParsedQuestion[]
  duplicates: DuplicateInfo[]
  invalid: InvalidInfo[]
  withinFileDuplicates: WithinFileDuplicate[]
  curriculumErrors: InvalidInfo[]
}

export interface BulkUploadOptions {
  questions: ParsedQuestion[]
  onProgress?: (current: number, total: number) => void
}

export interface BulkUploadResult {
  success: number
  failed: Array<{ row: number; error: string }>
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

function getQuestionKey(
  question: string,
  gradeLevel: string,
  subject: string,
  topic: string,
): string {
  return `${normalizeText(question)}|${normalizeText(gradeLevel)}|${normalizeText(subject)}|${normalizeText(topic)}`
}

// ============================================
// VALIDATION
// ============================================

export async function validateQuestions(parsed: ParsedQuestion[]): Promise<UploadValidationResult> {
  const questionsStore = useQuestionsStore()
  const curriculumStore = useCurriculumStore()

  // Ensure curriculum and questions are loaded
  if (curriculumStore.gradeLevels.length === 0) {
    await curriculumStore.fetchCurriculum()
  }
  await questionsStore.fetchQuestions()

  const existingQuestions = questionsStore.questions

  // Build lookup map for existing questions
  const existingMap = new Map<string, string>()
  for (const q of existingQuestions) {
    const key = getQuestionKey(q.question, q.gradeLevelName, q.subjectName, q.topicName)
    existingMap.set(key, q.id)
  }

  const valid: ParsedQuestion[] = []
  const duplicates: DuplicateInfo[] = []
  const invalid: InvalidInfo[] = []
  const curriculumErrors: InvalidInfo[] = []

  // Track within-file duplicates
  const seenInFile = new Map<string, number[]>()

  for (const q of parsed) {
    const key = getQuestionKey(q.question, q.gradeLevelName, q.subjectName, q.topicName)
    const errors: string[] = []

    // Check curriculum hierarchy
    // New hierarchy: grade_level -> subject -> topic -> sub_topic
    // Excel topicName is treated as subTopicName (legacy naming)
    const gradeLevel = curriculumStore.gradeLevels.find(
      (g) => normalizeText(g.name) === normalizeText(q.gradeLevelName),
    )
    if (!gradeLevel) {
      errors.push(`Grade Level "${q.gradeLevelName}" not found`)
    } else {
      const subject = gradeLevel.subjects.find(
        (s) => normalizeText(s.name) === normalizeText(q.subjectName),
      )
      if (!subject) {
        errors.push(`Subject "${q.subjectName}" not found under "${q.gradeLevelName}"`)
      } else {
        // Find sub-topic by searching through all topics in the subject
        let subTopic = null
        for (const topic of subject.topics) {
          const found = topic.subTopics.find(
            (st) => normalizeText(st.name) === normalizeText(q.topicName),
          )
          if (found) {
            subTopic = found
            break
          }
        }
        if (!subTopic) {
          errors.push(`Topic "${q.topicName}" not found under "${q.subjectName}"`)
        }
      }
    }

    if (errors.length > 0) {
      curriculumErrors.push({ row: q.row, errors })
      continue
    }

    // Check for duplicates in database
    const existingId = existingMap.get(key)
    if (existingId) {
      duplicates.push({
        row: q.row,
        existingId,
        question: q.question.length > 100 ? q.question.slice(0, 100) + '...' : q.question,
      })
      continue
    }

    // Track within-file duplicates
    if (seenInFile.has(key)) {
      seenInFile.get(key)!.push(q.row)
    } else {
      seenInFile.set(key, [q.row])
      valid.push(q) // Only add first occurrence to valid
    }
  }

  // Extract within-file duplicates (where there's more than one row with same key)
  const withinFileDuplicates: WithinFileDuplicate[] = []
  for (const [key, rows] of seenInFile.entries()) {
    if (rows.length > 1) {
      const parts = key.split('|')
      const questionText = parts[0] ?? ''
      withinFileDuplicates.push({
        rows,
        question: questionText.length > 100 ? questionText.slice(0, 100) + '...' : questionText,
      })
    }
  }

  return {
    valid,
    duplicates,
    invalid,
    withinFileDuplicates,
    curriculumErrors,
  }
}

// ============================================
// BULK UPLOAD EXECUTION
// ============================================

export async function executeBulkUpload(options: BulkUploadOptions): Promise<BulkUploadResult> {
  const { questions, onProgress } = options
  const questionsStore = useQuestionsStore()
  const curriculumStore = useCurriculumStore()

  let success = 0
  const failed: Array<{ row: number; error: string }> = []

  for (const [i, q] of questions.entries()) {
    try {
      // Resolve curriculum IDs
      // New hierarchy: grade_level -> subject -> topic -> sub_topic
      // Excel topicName is treated as subTopicName (legacy naming)
      const gradeLevel = curriculumStore.gradeLevels.find(
        (g) => normalizeText(g.name) === normalizeText(q.gradeLevelName),
      )
      const subject = gradeLevel?.subjects.find(
        (s) => normalizeText(s.name) === normalizeText(q.subjectName),
      )

      // Find sub-topic by searching through all topics in the subject
      let subTopic = null
      for (const topic of subject?.topics || []) {
        const found = topic.subTopics.find(
          (st) => normalizeText(st.name) === normalizeText(q.topicName),
        )
        if (found) {
          subTopic = found
          break
        }
      }

      if (!gradeLevel || !subject || !subTopic) {
        failed.push({ row: q.row, error: 'Curriculum hierarchy not found' })
        onProgress?.(i + 1, questions.length)
        continue
      }

      // Build question input
      const input: CreateQuestionInput = {
        type: q.type,
        gradeLevelId: gradeLevel.id,
        subjectId: subject.id,
        subTopicId: subTopic.id, // topic_id column now references sub_topics
        question: q.question,
        explanation: q.explanation || undefined,
      }

      if (q.type === 'mcq') {
        const correctIndex = q.correctAnswer.charCodeAt(0) - 65 // A=0, B=1, etc
        input.options = [
          { id: 'a', text: q.optionA, imagePath: null, isCorrect: correctIndex === 0 },
          { id: 'b', text: q.optionB, imagePath: null, isCorrect: correctIndex === 1 },
          { id: 'c', text: q.optionC, imagePath: null, isCorrect: correctIndex === 2 },
          { id: 'd', text: q.optionD, imagePath: null, isCorrect: correctIndex === 3 },
        ]
      } else {
        input.answer = q.correctAnswer
      }

      // Create question
      const result = await questionsStore.addQuestion(input)
      if (result.error || !result.id) {
        failed.push({ row: q.row, error: result.error || 'Unknown error' })
        onProgress?.(i + 1, questions.length)
        continue
      }

      // Upload images if question was created
      await uploadQuestionImages(questionsStore, result.id, q)

      success++
    } catch (error) {
      failed.push({ row: q.row, error: String(error) })
    }

    onProgress?.(i + 1, questions.length)
  }

  return { success, failed }
}

async function uploadQuestionImages(
  store: ReturnType<typeof useQuestionsStore>,
  questionId: string,
  q: ParsedQuestion,
): Promise<void> {
  // Upload question image
  if (q.questionImage) {
    const file = base64ToFile(q.questionImage, `question_${questionId}`)
    const result = await store.uploadQuestionImage(file, questionId)
    if (result.success && result.path) {
      // Update the question with the image path
      await store.updateQuestion(questionId, { imagePath: result.path })
    }
  }

  // Upload option images
  const optionImages: Array<{
    optionId: 'a' | 'b' | 'c' | 'd'
    image: ParsedQuestionImage
  }> = []
  if (q.optionAImage) optionImages.push({ optionId: 'a', image: q.optionAImage })
  if (q.optionBImage) optionImages.push({ optionId: 'b', image: q.optionBImage })
  if (q.optionCImage) optionImages.push({ optionId: 'c', image: q.optionCImage })
  if (q.optionDImage) optionImages.push({ optionId: 'd', image: q.optionDImage })

  if (optionImages.length > 0) {
    // Get current question to get existing options
    const currentQuestion = store.getQuestionById(questionId)
    if (currentQuestion) {
      const updatedOptions = [...currentQuestion.options]

      for (const { optionId, image } of optionImages) {
        const file = base64ToFile(image, `option_${optionId}_${questionId}`)
        const result = await store.uploadQuestionImage(file, questionId, optionId)
        if (result.success && result.path) {
          const optionIndex = optionId.charCodeAt(0) - 97 // a=0, b=1, etc
          if (updatedOptions[optionIndex]) {
            updatedOptions[optionIndex] = {
              ...updatedOptions[optionIndex],
              imagePath: result.path,
            }
          }
        }
      }

      // Update the question with option image paths
      await store.updateQuestion(questionId, { options: updatedOptions })
    }
  }
}

function base64ToFile(image: ParsedQuestionImage, filename: string): File {
  const byteString = atob(image.base64)
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type: image.mimeType })
  return new File([blob], `${filename}.${image.extension}`, { type: image.mimeType })
}
