import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'
import { useCurriculumStore } from './curriculum'

type QuestionRow = Database['public']['Tables']['questions']['Row']
export type QuestionType = Database['public']['Enums']['question_type']

export interface MCQOption {
  id: 'a' | 'b' | 'c' | 'd'
  text: string | null
  imagePath: string | null
  isCorrect: boolean
}

export interface Question {
  id: string
  type: QuestionType
  question: string
  imagePath: string | null
  subTopicId: string // topic_id column now references sub_topics
  gradeLevelId: string | null
  subjectId: string | null
  explanation: string | null
  answer: string | null // For short_answer type
  options: MCQOption[] // For MCQ type
  createdAt: string | null
  updatedAt: string | null
  imageHash: string | null // SHA-256 hash of all images for duplicate detection
  // Denormalized names for display
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
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

export interface CreateQuestionInput {
  type: QuestionType
  question: string
  imagePath?: string | null
  subTopicId: string // topic_id column now references sub_topics
  gradeLevelId?: string | null
  subjectId?: string | null
  explanation?: string | null
  answer?: string | null
  options?: MCQOption[]
  imageHash?: string | null // SHA-256 hash of all images for duplicate detection
}

export interface UpdateQuestionInput {
  type?: QuestionType
  question?: string
  imagePath?: string | null
  subTopicId?: string // topic_id column now references sub_topics
  gradeLevelId?: string | null
  subjectId?: string | null
  explanation?: string | null
  answer?: string | null
  options?: MCQOption[]
  imageHash?: string | null // SHA-256 hash of all images for duplicate detection
}

/**
 * Convert database row to Question interface
 * Note: topic_id in DB now references sub_topics table
 */
function rowToQuestion(
  row: QuestionRow,
  curriculumStore: ReturnType<typeof useCurriculumStore>,
): Question {
  const options: MCQOption[] = [
    {
      id: 'a',
      text: row.option_1_text,
      imagePath: row.option_1_image_path,
      isCorrect: row.option_1_is_correct ?? false,
    },
    {
      id: 'b',
      text: row.option_2_text,
      imagePath: row.option_2_image_path,
      isCorrect: row.option_2_is_correct ?? false,
    },
    {
      id: 'c',
      text: row.option_3_text,
      imagePath: row.option_3_image_path,
      isCorrect: row.option_3_is_correct ?? false,
    },
    {
      id: 'd',
      text: row.option_4_text,
      imagePath: row.option_4_image_path,
      isCorrect: row.option_4_is_correct ?? false,
    },
  ]

  // Get names from curriculum store using sub_topic hierarchy
  let gradeLevelName = ''
  let subjectName = ''
  let topicName = ''
  let subTopicName = ''

  // topic_id now references sub_topics, so use getSubTopicWithHierarchy
  const hierarchy = curriculumStore.getSubTopicWithHierarchy(row.topic_id)
  if (hierarchy) {
    gradeLevelName = hierarchy.gradeLevel.name
    subjectName = hierarchy.subject.name
    topicName = hierarchy.topic.name
    subTopicName = hierarchy.subTopic.name
  }

  return {
    id: row.id,
    type: row.type,
    question: row.question,
    imagePath: row.image_path,
    subTopicId: row.topic_id, // topic_id column references sub_topics
    gradeLevelId: row.grade_level_id,
    subjectId: row.subject_id,
    explanation: row.explanation,
    answer: row.answer,
    options,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageHash: row.image_hash,
    gradeLevelName,
    subjectName,
    topicName,
    subTopicName,
  }
}

const ALL_VALUE = '__all__'

export const useQuestionsStore = defineStore('questions', () => {
  const curriculumStore = useCurriculumStore()

  const questions = ref<Question[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Question statistics (fetched separately or computed from practice_answers)
  const questionStatistics = ref<QuestionStatistics[]>([])

  // ============================================
  // Question Bank Page State (persisted across navigation)
  // ============================================
  const questionBankFilters = ref({
    gradeLevel: ALL_VALUE,
    subject: ALL_VALUE,
    topic: ALL_VALUE,
    subTopic: ALL_VALUE,
    search: '',
  })

  const questionBankPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  // ============================================
  // Question Feedback Page State (persisted across navigation)
  // ============================================
  const questionFeedbackFilters = ref({
    search: '',
  })

  const questionFeedbackPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  // ============================================
  // Question Statistics Page State (persisted across navigation)
  // ============================================
  const questionStatisticsFilters = ref({
    gradeLevel: ALL_VALUE,
    subject: ALL_VALUE,
    topic: ALL_VALUE,
    subTopic: ALL_VALUE,
    search: '',
  })

  const questionStatisticsPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  /**
   * Fetch all questions from the database
   */
  async function fetchQuestions(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Ensure curriculum is loaded first
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      const { data, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      questions.value = (data ?? []).map((row) => rowToQuestion(row, curriculumStore))
    } catch (err) {
      console.error('Error fetching questions:', err)
      error.value = err instanceof Error ? err.message : 'Failed to fetch questions'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch questions for a specific sub-topic
   * Note: topic_id column in DB now references sub_topics table
   */
  async function fetchQuestionsBySubTopic(
    subTopicId: string,
  ): Promise<{ questions: Question[]; error: string | null }> {
    try {
      // Ensure curriculum is loaded
      if (curriculumStore.gradeLevels.length === 0) {
        await curriculumStore.fetchCurriculum()
      }

      const { data, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .eq('topic_id', subTopicId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        return { questions: [], error: fetchError.message }
      }

      return {
        questions: (data ?? []).map((row) => rowToQuestion(row, curriculumStore)),
        error: null,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch questions'
      console.error('Error fetching questions by sub-topic:', err)
      return { questions: [], error: message }
    }
  }

  /**
   * Add a new question
   */
  async function addQuestion(
    input: CreateQuestionInput,
  ): Promise<{ success: boolean; error: string | null; id?: string }> {
    try {
      const insertData: Database['public']['Tables']['questions']['Insert'] = {
        type: input.type,
        question: input.question,
        image_path: input.imagePath ?? null,
        topic_id: input.subTopicId,
        grade_level_id: input.gradeLevelId ?? null,
        subject_id: input.subjectId ?? null,
        explanation: input.explanation ?? null,
        answer: input.type === 'short_answer' ? (input.answer ?? null) : null,
        image_hash: input.imageHash ?? null,
      }

      // Add MCQ/MRQ options if present
      if ((input.type === 'mcq' || input.type === 'mrq') && input.options) {
        const optionA = input.options.find((o) => o.id === 'a')
        const optionB = input.options.find((o) => o.id === 'b')
        const optionC = input.options.find((o) => o.id === 'c')
        const optionD = input.options.find((o) => o.id === 'd')

        insertData.option_1_text = optionA?.text ?? null
        insertData.option_1_image_path = optionA?.imagePath ?? null
        insertData.option_1_is_correct = optionA?.isCorrect ?? false

        insertData.option_2_text = optionB?.text ?? null
        insertData.option_2_image_path = optionB?.imagePath ?? null
        insertData.option_2_is_correct = optionB?.isCorrect ?? false

        insertData.option_3_text = optionC?.text ?? null
        insertData.option_3_image_path = optionC?.imagePath ?? null
        insertData.option_3_is_correct = optionC?.isCorrect ?? false

        insertData.option_4_text = optionD?.text ?? null
        insertData.option_4_image_path = optionD?.imagePath ?? null
        insertData.option_4_is_correct = optionD?.isCorrect ?? false
      }

      const { data, error: insertError } = await supabase
        .from('questions')
        .insert(insertData)
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state
      const newQuestion = rowToQuestion(data, curriculumStore)
      questions.value.unshift(newQuestion)

      return { success: true, error: null, id: data.id }
    } catch (err) {
      console.error('Error adding question:', err)
      const message = err instanceof Error ? err.message : 'Failed to add question'
      return { success: false, error: message }
    }
  }

  /**
   * Update an existing question
   */
  async function updateQuestion(
    id: string,
    input: UpdateQuestionInput,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const updateData: Database['public']['Tables']['questions']['Update'] = {}

      if (input.type !== undefined) updateData.type = input.type
      if (input.question !== undefined) updateData.question = input.question
      if (input.imagePath !== undefined) updateData.image_path = input.imagePath
      if (input.subTopicId !== undefined) updateData.topic_id = input.subTopicId
      if (input.gradeLevelId !== undefined) updateData.grade_level_id = input.gradeLevelId
      if (input.subjectId !== undefined) updateData.subject_id = input.subjectId
      if (input.explanation !== undefined) updateData.explanation = input.explanation
      if (input.answer !== undefined) updateData.answer = input.answer
      if (input.imageHash !== undefined) updateData.image_hash = input.imageHash

      // Update MCQ options if present
      if (input.options) {
        const optionA = input.options.find((o) => o.id === 'a')
        const optionB = input.options.find((o) => o.id === 'b')
        const optionC = input.options.find((o) => o.id === 'c')
        const optionD = input.options.find((o) => o.id === 'd')

        updateData.option_1_text = optionA?.text ?? null
        updateData.option_1_image_path = optionA?.imagePath ?? null
        updateData.option_1_is_correct = optionA?.isCorrect ?? false

        updateData.option_2_text = optionB?.text ?? null
        updateData.option_2_image_path = optionB?.imagePath ?? null
        updateData.option_2_is_correct = optionB?.isCorrect ?? false

        updateData.option_3_text = optionC?.text ?? null
        updateData.option_3_image_path = optionC?.imagePath ?? null
        updateData.option_3_is_correct = optionC?.isCorrect ?? false

        updateData.option_4_text = optionD?.text ?? null
        updateData.option_4_image_path = optionD?.imagePath ?? null
        updateData.option_4_is_correct = optionD?.isCorrect ?? false
      }

      const { data, error: updateError } = await supabase
        .from('questions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // Update local state
      const index = questions.value.findIndex((q) => q.id === id)
      if (index !== -1) {
        questions.value[index] = rowToQuestion(data, curriculumStore)
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error updating question:', err)
      const message = err instanceof Error ? err.message : 'Failed to update question'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a question
   */
  async function deleteQuestion(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('questions').delete().eq('id', id)

      if (deleteError) throw deleteError

      // Remove from local state
      const index = questions.value.findIndex((q) => q.id === id)
      if (index !== -1) {
        questions.value.splice(index, 1)
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting question:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete question'
      return { success: false, error: message }
    }
  }

  /**
   * Get a question by ID
   */
  function getQuestionById(id: string): Question | undefined {
    return questions.value.find((q) => q.id === id)
  }

  /**
   * Upload a question or option image
   * Sets high cache-control value for better CDN caching (1 year)
   */
  async function uploadQuestionImage(
    file: File,
    questionId: string,
    optionId?: 'a' | 'b' | 'c' | 'd',
  ): Promise<{ success: boolean; path: string | null; error: string | null }> {
    try {
      const fileExt = file.name.split('.').pop()
      const folder = optionId ? `options/${optionId}` : 'questions'
      const filePath = `${folder}/${questionId}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(filePath, file, {
          upsert: true,
          // High cache-control value (1 year) for better CDN caching
          // Smart CDN will auto-invalidate when file is updated
          cacheControl: '31536000',
        })

      if (uploadError) throw uploadError

      return { success: true, path: filePath, error: null }
    } catch (err) {
      console.error('Error uploading image:', err)
      const message = err instanceof Error ? err.message : 'Failed to upload image'
      return { success: false, path: null, error: message }
    }
  }

  /**
   * Delete a question image from storage
   */
  async function deleteQuestionImage(
    path: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: deleteError } = await supabase.storage.from('question-images').remove([path])

      if (deleteError) throw deleteError

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting image:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete image'
      return { success: false, error: message }
    }
  }

  /**
   * Image transformation options for Supabase Storage
   * Using transformations improves load times via:
   * - Automatic WebP conversion
   * - Size reduction
   * - CDN caching of transformed images
   */
  interface ImageTransformOptions {
    width?: number
    height?: number
    quality?: number
    resize?: 'cover' | 'contain' | 'fill'
  }

  /**
   * Get public URL for a question image with optional transformation
   * Transformations are cached at CDN edge for fast delivery
   */
  function getQuestionImageUrl(path: string | null, transform?: ImageTransformOptions): string {
    if (!path) return ''
    // Check if it's already a full URL
    if (path.startsWith('http')) return path

    // Apply transformation if provided (enables automatic WebP conversion)
    if (transform) {
      const { data } = supabase.storage.from('question-images').getPublicUrl(path, {
        transform: {
          width: transform.width,
          height: transform.height,
          quality: transform.quality ?? 80,
          resize: transform.resize ?? 'contain',
        },
      })
      return data.publicUrl
    }

    const { data } = supabase.storage.from('question-images').getPublicUrl(path)
    return data.publicUrl
  }

  /**
   * Get optimized image URL for question display (medium size)
   * Uses width=800 which is suitable for most question displays
   */
  function getOptimizedQuestionImageUrl(path: string | null): string {
    return getQuestionImageUrl(path, { width: 800, quality: 80 })
  }

  /**
   * Get thumbnail URL for question image (small size for lists/previews)
   */
  function getThumbnailQuestionImageUrl(path: string | null): string {
    return getQuestionImageUrl(path, { width: 200, quality: 70 })
  }

  /**
   * Fetch question statistics via admin-only RPC function
   */
  async function fetchQuestionStatistics(): Promise<void> {
    try {
      const { data, error: fetchError } = await supabase.rpc('get_question_statistics')

      if (fetchError) throw fetchError

      questionStatistics.value = (data ?? [])
        .filter((row) => row.question_id !== null)
        .map((row) => ({
          questionId: row.question_id!,
          attempts: row.attempts ?? 0,
          correctCount: row.correct_count ?? 0,
          correctnessRate: row.correctness_rate ?? 0,
          averageTimeSeconds: row.avg_time_seconds ?? 0,
        }))
    } catch (err) {
      console.error('Error fetching question statistics:', err)
    }
  }

  /**
   * Get statistics for a specific question
   */
  function getStatsByQuestionId(id: string): QuestionStatistics | undefined {
    return questionStatistics.value.find((s) => s.questionId === id)
  }

  /**
   * Get questions with statistics
   */
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

  // Filter helpers
  function getGradeLevels(): string[] {
    const gradeLevels = new Set(questions.value.map((q) => q.gradeLevelName).filter(Boolean))
    return Array.from(gradeLevels).sort()
  }

  function getSubjects(gradeLevelName?: string): string[] {
    const filtered = gradeLevelName
      ? questions.value.filter((q) => q.gradeLevelName === gradeLevelName)
      : questions.value
    const subjects = new Set(filtered.map((q) => q.subjectName).filter(Boolean))
    return Array.from(subjects).sort()
  }

  function getTopics(gradeLevelName?: string, subjectName?: string): string[] {
    let filtered = questions.value
    if (gradeLevelName) {
      filtered = filtered.filter((q) => q.gradeLevelName === gradeLevelName)
    }
    if (subjectName) {
      filtered = filtered.filter((q) => q.subjectName === subjectName)
    }
    const topics = new Set(filtered.map((q) => q.topicName).filter(Boolean))
    return Array.from(topics).sort()
  }

  function getSubTopics(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
  ): string[] {
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
    const subTopics = new Set(filtered.map((q) => q.subTopicName).filter(Boolean))
    return Array.from(subTopics).sort()
  }

  function getFilteredQuestions(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
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
    if (subTopicName) {
      filtered = filtered.filter((q) => q.subTopicName === subTopicName)
    }
    return filtered
  }

  function getFilteredQuestionsWithStats(
    gradeLevelName?: string,
    subjectName?: string,
    topicName?: string,
    subTopicName?: string,
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
    if (subTopicName) {
      filtered = filtered.filter((q) => q.subTopicName === subTopicName)
    }
    return filtered
  }

  // ============================================
  // Question Bank Page Setters
  // ============================================
  function setQuestionBankGradeLevel(value: string) {
    questionBankFilters.value.gradeLevel = value
    // Reset dependent filters
    questionBankFilters.value.subject = ALL_VALUE
    questionBankFilters.value.topic = ALL_VALUE
    questionBankFilters.value.subTopic = ALL_VALUE
    // Reset pagination
    questionBankPagination.value.pageIndex = 0
  }

  function setQuestionBankSubject(value: string) {
    questionBankFilters.value.subject = value
    // Reset dependent filters
    questionBankFilters.value.topic = ALL_VALUE
    questionBankFilters.value.subTopic = ALL_VALUE
    // Reset pagination
    questionBankPagination.value.pageIndex = 0
  }

  function setQuestionBankTopic(value: string) {
    questionBankFilters.value.topic = value
    // Reset dependent filter
    questionBankFilters.value.subTopic = ALL_VALUE
    // Reset pagination
    questionBankPagination.value.pageIndex = 0
  }

  function setQuestionBankSubTopic(value: string) {
    questionBankFilters.value.subTopic = value
    // Reset pagination
    questionBankPagination.value.pageIndex = 0
  }

  function setQuestionBankSearch(value: string) {
    questionBankFilters.value.search = value
    // Reset pagination
    questionBankPagination.value.pageIndex = 0
  }

  function setQuestionBankPageIndex(value: number) {
    questionBankPagination.value.pageIndex = value
  }

  function setQuestionBankPageSize(value: number) {
    questionBankPagination.value.pageSize = value
    questionBankPagination.value.pageIndex = 0
  }

  // ============================================
  // Question Feedback Page Setters
  // ============================================
  function setQuestionFeedbackSearch(value: string) {
    questionFeedbackFilters.value.search = value
    // Reset pagination
    questionFeedbackPagination.value.pageIndex = 0
  }

  function setQuestionFeedbackPageIndex(value: number) {
    questionFeedbackPagination.value.pageIndex = value
  }

  function setQuestionFeedbackPageSize(value: number) {
    questionFeedbackPagination.value.pageSize = value
    questionFeedbackPagination.value.pageIndex = 0
  }

  // ============================================
  // Question Statistics Page Setters
  // ============================================
  function setQuestionStatisticsGradeLevel(value: string) {
    questionStatisticsFilters.value.gradeLevel = value
    // Reset dependent filters
    questionStatisticsFilters.value.subject = ALL_VALUE
    questionStatisticsFilters.value.topic = ALL_VALUE
    questionStatisticsFilters.value.subTopic = ALL_VALUE
    // Reset pagination
    questionStatisticsPagination.value.pageIndex = 0
  }

  function setQuestionStatisticsSubject(value: string) {
    questionStatisticsFilters.value.subject = value
    // Reset dependent filters
    questionStatisticsFilters.value.topic = ALL_VALUE
    questionStatisticsFilters.value.subTopic = ALL_VALUE
    // Reset pagination
    questionStatisticsPagination.value.pageIndex = 0
  }

  function setQuestionStatisticsTopic(value: string) {
    questionStatisticsFilters.value.topic = value
    // Reset dependent filter
    questionStatisticsFilters.value.subTopic = ALL_VALUE
    // Reset pagination
    questionStatisticsPagination.value.pageIndex = 0
  }

  function setQuestionStatisticsSubTopic(value: string) {
    questionStatisticsFilters.value.subTopic = value
    // Reset pagination
    questionStatisticsPagination.value.pageIndex = 0
  }

  function setQuestionStatisticsSearch(value: string) {
    questionStatisticsFilters.value.search = value
    // Reset pagination
    questionStatisticsPagination.value.pageIndex = 0
  }

  function setQuestionStatisticsPageIndex(value: number) {
    questionStatisticsPagination.value.pageIndex = value
  }

  function setQuestionStatisticsPageSize(value: number) {
    questionStatisticsPagination.value.pageSize = value
    questionStatisticsPagination.value.pageIndex = 0
  }

  return {
    // State
    questions,
    questionStatistics,
    questionsWithStats,
    isLoading,
    error,

    // Actions
    fetchQuestions,
    fetchQuestionsBySubTopic,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    getQuestionById,
    uploadQuestionImage,
    deleteQuestionImage,
    getQuestionImageUrl,
    getOptimizedQuestionImageUrl,
    getThumbnailQuestionImageUrl,
    fetchQuestionStatistics,
    getStatsByQuestionId,

    // Filter helpers
    getGradeLevels,
    getSubjects,
    getTopics,
    getSubTopics,
    getFilteredQuestions,
    getFilteredQuestionsWithStats,

    // Question Bank Page State
    questionBankFilters,
    questionBankPagination,
    setQuestionBankGradeLevel,
    setQuestionBankSubject,
    setQuestionBankTopic,
    setQuestionBankSubTopic,
    setQuestionBankSearch,
    setQuestionBankPageIndex,
    setQuestionBankPageSize,

    // Question Feedback Page State
    questionFeedbackFilters,
    questionFeedbackPagination,
    setQuestionFeedbackSearch,
    setQuestionFeedbackPageIndex,
    setQuestionFeedbackPageSize,

    // Question Statistics Page State
    questionStatisticsFilters,
    questionStatisticsPagination,
    setQuestionStatisticsGradeLevel,
    setQuestionStatisticsSubject,
    setQuestionStatisticsTopic,
    setQuestionStatisticsSubTopic,
    setQuestionStatisticsSearch,
    setQuestionStatisticsPageIndex,
    setQuestionStatisticsPageSize,
  }
})
