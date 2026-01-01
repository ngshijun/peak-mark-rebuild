import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'

type GradeLevelRow = Database['public']['Tables']['grade_levels']['Row']
type SubjectRow = Database['public']['Tables']['subjects']['Row']
type TopicRow = Database['public']['Tables']['topics']['Row']
type SubTopicRow = Database['public']['Tables']['sub_topics']['Row']

export interface SubTopic {
  id: string
  name: string
  coverImagePath: string | null
  displayOrder: number
  topicId: string
  questionCount: number
}

export interface Topic {
  id: string
  name: string
  coverImagePath: string | null
  displayOrder: number
  subjectId: string
  subTopics: SubTopic[]
}

export interface Subject {
  id: string
  name: string
  coverImagePath: string | null
  displayOrder: number
  gradeLevelId: string
  topics: Topic[]
}

export interface GradeLevel {
  id: string
  name: string
  displayOrder: number
  subjects: Subject[]
}

// Cache TTL for curriculum data (rarely changes)
const CURRICULUM_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export const useCurriculumStore = defineStore('curriculum', () => {
  const gradeLevels = ref<GradeLevel[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Flat lists for easier access
  const allSubjects = ref<SubjectRow[]>([])
  const allTopics = ref<TopicRow[]>([])
  const allSubTopics = ref<SubTopicRow[]>([])

  // Cache timestamp for staleness tracking
  const lastFetched = ref<number | null>(null)

  // Admin CurriculumPage navigation state (persisted across navigation)
  const adminCurriculumNavigation = ref({
    selectedGradeLevelId: null as string | null,
    selectedSubjectId: null as string | null,
    selectedTopicId: null as string | null,
  })

  /**
   * Check if curriculum cache is stale
   */
  function isCacheStale(): boolean {
    if (!lastFetched.value || gradeLevels.value.length === 0) return true
    return Date.now() - lastFetched.value > CURRICULUM_CACHE_TTL
  }

  /**
   * Fetch all curriculum data (grade levels, subjects, topics, sub_topics)
   * Uses parallel queries for better performance
   */
  async function fetchCurriculum(force = false): Promise<void> {
    // Skip if cache is still valid and not forced
    if (!force && !isCacheStale()) {
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Fetch all data in parallel for better performance
      const [gradeResult, subjectResult, topicResult, subTopicResult, questionCountResult] =
        await Promise.all([
          supabase.from('grade_levels').select('*').order('display_order', { ascending: true }),
          supabase.from('subjects').select('*').order('display_order', { ascending: true }),
          supabase.from('topics').select('*').order('display_order', { ascending: true }),
          supabase.from('sub_topics').select('*').order('display_order', { ascending: true }),
          supabase.from('questions').select('topic_id'),
        ])

      // Check for errors
      if (gradeResult.error) throw gradeResult.error
      if (subjectResult.error) throw subjectResult.error
      if (topicResult.error) throw topicResult.error
      if (subTopicResult.error) throw subTopicResult.error
      if (questionCountResult.error) throw questionCountResult.error

      const gradeData = gradeResult.data
      const subjectData = subjectResult.data
      const topicData = topicResult.data
      const subTopicData = subTopicResult.data
      const questionCounts = questionCountResult.data

      // Build question count map
      const questionCountMap = new Map<string, number>()
      for (const q of questionCounts ?? []) {
        const count = questionCountMap.get(q.topic_id) ?? 0
        questionCountMap.set(q.topic_id, count + 1)
      }

      // Store flat lists
      allSubjects.value = subjectData ?? []
      allTopics.value = topicData ?? []
      allSubTopics.value = subTopicData ?? []

      // Build hierarchical structure
      const gradeMap = new Map<string, GradeLevel>()

      // Initialize grade levels
      for (const grade of gradeData ?? []) {
        gradeMap.set(grade.id, {
          id: grade.id,
          name: grade.name,
          displayOrder: grade.display_order ?? 0,
          subjects: [],
        })
      }

      // Map subjects to grade levels
      const subjectMap = new Map<string, Subject>()
      for (const subject of subjectData ?? []) {
        const gradeLevel = gradeMap.get(subject.grade_level_id)
        if (gradeLevel) {
          const subjectObj: Subject = {
            id: subject.id,
            name: subject.name,
            coverImagePath: subject.cover_image_path,
            displayOrder: subject.display_order ?? 0,
            gradeLevelId: subject.grade_level_id,
            topics: [],
          }
          subjectMap.set(subject.id, subjectObj)
          gradeLevel.subjects.push(subjectObj)
        }
      }

      // Map topics to subjects
      const topicMap = new Map<string, Topic>()
      for (const topic of topicData ?? []) {
        const subject = subjectMap.get(topic.subject_id)
        if (subject) {
          const topicObj: Topic = {
            id: topic.id,
            name: topic.name,
            coverImagePath: topic.cover_image_path,
            displayOrder: topic.display_order ?? 0,
            subjectId: topic.subject_id,
            subTopics: [],
          }
          topicMap.set(topic.id, topicObj)
          subject.topics.push(topicObj)
        }
      }

      // Map sub_topics to topics
      for (const subTopic of subTopicData ?? []) {
        const topic = topicMap.get(subTopic.topic_id)
        if (topic) {
          topic.subTopics.push({
            id: subTopic.id,
            name: subTopic.name,
            coverImagePath: subTopic.cover_image_path,
            displayOrder: subTopic.display_order ?? 0,
            topicId: subTopic.topic_id,
            questionCount: questionCountMap.get(subTopic.id) ?? 0,
          })
        }
      }

      gradeLevels.value = Array.from(gradeMap.values())
      lastFetched.value = Date.now()
    } catch (err) {
      console.error('Error fetching curriculum:', err)
      error.value = err instanceof Error ? err.message : 'Failed to fetch curriculum'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add a new grade level
   */
  async function addGradeLevel(
    name: string,
  ): Promise<{ success: boolean; error: string | null; id?: string }> {
    try {
      // Get max display order
      const maxOrder = Math.max(0, ...gradeLevels.value.map((g) => g.displayOrder))

      const { data, error: insertError } = await supabase
        .from('grade_levels')
        .insert({
          name,
          display_order: maxOrder + 1,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state
      gradeLevels.value.push({
        id: data.id,
        name: data.name,
        displayOrder: data.display_order ?? 0,
        subjects: [],
      })

      return { success: true, error: null, id: data.id }
    } catch (err) {
      console.error('Error adding grade level:', err)
      const message = err instanceof Error ? err.message : 'Failed to add grade level'
      return { success: false, error: message }
    }
  }

  /**
   * Update a grade level
   */
  async function updateGradeLevel(
    id: string,
    name: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: updateError } = await supabase
        .from('grade_levels')
        .update({ name })
        .eq('id', id)

      if (updateError) throw updateError

      // Update local state
      const grade = gradeLevels.value.find((g) => g.id === id)
      if (grade) {
        grade.name = name
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error updating grade level:', err)
      const message = err instanceof Error ? err.message : 'Failed to update grade level'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a grade level
   */
  async function deleteGradeLevel(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('grade_levels').delete().eq('id', id)

      if (deleteError) throw deleteError

      // Remove from local state
      const index = gradeLevels.value.findIndex((g) => g.id === id)
      if (index !== -1) {
        gradeLevels.value.splice(index, 1)
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting grade level:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete grade level'
      return { success: false, error: message }
    }
  }

  /**
   * Add a new subject
   */
  async function addSubject(
    gradeLevelId: string,
    name: string,
    coverImagePath?: string,
  ): Promise<{ success: boolean; error: string | null; id?: string }> {
    try {
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      if (!gradeLevel) {
        return { success: false, error: 'Grade level not found' }
      }

      // Get max display order for this grade level
      const maxOrder = Math.max(0, ...gradeLevel.subjects.map((s) => s.displayOrder))

      const { data, error: insertError } = await supabase
        .from('subjects')
        .insert({
          grade_level_id: gradeLevelId,
          name,
          cover_image_path: coverImagePath ?? null,
          display_order: maxOrder + 1,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state
      gradeLevel.subjects.push({
        id: data.id,
        name: data.name,
        coverImagePath: data.cover_image_path,
        displayOrder: data.display_order ?? 0,
        gradeLevelId: data.grade_level_id,
        topics: [],
      })

      return { success: true, error: null, id: data.id }
    } catch (err) {
      console.error('Error adding subject:', err)
      const message = err instanceof Error ? err.message : 'Failed to add subject'
      return { success: false, error: message }
    }
  }

  /**
   * Update a subject
   */
  async function updateSubject(
    gradeLevelId: string,
    subjectId: string,
    updates: { name?: string; coverImagePath?: string | null },
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const updateData: { name?: string; cover_image_path?: string | null } = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.coverImagePath !== undefined) updateData.cover_image_path = updates.coverImagePath

      const { error: updateError } = await supabase
        .from('subjects')
        .update(updateData)
        .eq('id', subjectId)

      if (updateError) throw updateError

      // Update local state
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      if (subject) {
        if (updates.name !== undefined) subject.name = updates.name
        if (updates.coverImagePath !== undefined) subject.coverImagePath = updates.coverImagePath
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error updating subject:', err)
      const message = err instanceof Error ? err.message : 'Failed to update subject'
      return { success: false, error: message }
    }
  }

  /**
   * Update subject cover image (convenience method)
   */
  async function updateSubjectCoverImage(
    gradeLevelId: string,
    subjectId: string,
    coverImagePath: string | null,
  ): Promise<{ success: boolean; error: string | null }> {
    return updateSubject(gradeLevelId, subjectId, { coverImagePath })
  }

  /**
   * Delete a subject
   */
  async function deleteSubject(
    gradeLevelId: string,
    subjectId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('subjects').delete().eq('id', subjectId)

      if (deleteError) throw deleteError

      // Remove from local state
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      if (gradeLevel) {
        const index = gradeLevel.subjects.findIndex((s) => s.id === subjectId)
        if (index !== -1) {
          gradeLevel.subjects.splice(index, 1)
        }
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting subject:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete subject'
      return { success: false, error: message }
    }
  }

  /**
   * Add a new topic
   */
  async function addTopic(
    gradeLevelId: string,
    subjectId: string,
    name: string,
    coverImagePath?: string,
  ): Promise<{ success: boolean; error: string | null; id?: string }> {
    try {
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      if (!subject) {
        return { success: false, error: 'Subject not found' }
      }

      // Get max display order for this subject
      const maxOrder = Math.max(0, ...subject.topics.map((t) => t.displayOrder))

      const { data, error: insertError } = await supabase
        .from('topics')
        .insert({
          subject_id: subjectId,
          name,
          cover_image_path: coverImagePath ?? null,
          display_order: maxOrder + 1,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state
      subject.topics.push({
        id: data.id,
        name: data.name,
        coverImagePath: data.cover_image_path,
        displayOrder: data.display_order ?? 0,
        subjectId: data.subject_id,
        subTopics: [],
      })

      return { success: true, error: null, id: data.id }
    } catch (err) {
      console.error('Error adding topic:', err)
      const message = err instanceof Error ? err.message : 'Failed to add topic'
      return { success: false, error: message }
    }
  }

  /**
   * Update a topic
   */
  async function updateTopic(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    updates: { name?: string; coverImagePath?: string | null },
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const updateData: { name?: string; cover_image_path?: string | null } = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.coverImagePath !== undefined) updateData.cover_image_path = updates.coverImagePath

      const { error: updateError } = await supabase
        .from('topics')
        .update(updateData)
        .eq('id', topicId)

      if (updateError) throw updateError

      // Update local state
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      const topic = subject?.topics.find((t) => t.id === topicId)
      if (topic) {
        if (updates.name !== undefined) topic.name = updates.name
        if (updates.coverImagePath !== undefined) topic.coverImagePath = updates.coverImagePath
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error updating topic:', err)
      const message = err instanceof Error ? err.message : 'Failed to update topic'
      return { success: false, error: message }
    }
  }

  /**
   * Update topic cover image (convenience method)
   */
  async function updateTopicCoverImage(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    coverImagePath: string | null,
  ): Promise<{ success: boolean; error: string | null }> {
    return updateTopic(gradeLevelId, subjectId, topicId, { coverImagePath })
  }

  /**
   * Delete a topic
   */
  async function deleteTopic(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('topics').delete().eq('id', topicId)

      if (deleteError) throw deleteError

      // Remove from local state
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      if (subject) {
        const index = subject.topics.findIndex((t) => t.id === topicId)
        if (index !== -1) {
          subject.topics.splice(index, 1)
        }
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting topic:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete topic'
      return { success: false, error: message }
    }
  }

  /**
   * Add a new sub_topic
   */
  async function addSubTopic(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    name: string,
    coverImagePath?: string,
  ): Promise<{ success: boolean; error: string | null; id?: string }> {
    try {
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      const topic = subject?.topics.find((t) => t.id === topicId)
      if (!topic) {
        return { success: false, error: 'Topic not found' }
      }

      // Get max display order for this topic
      const maxOrder = Math.max(0, ...topic.subTopics.map((st) => st.displayOrder))

      const { data, error: insertError } = await supabase
        .from('sub_topics')
        .insert({
          topic_id: topicId,
          name,
          cover_image_path: coverImagePath ?? null,
          display_order: maxOrder + 1,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state
      topic.subTopics.push({
        id: data.id,
        name: data.name,
        coverImagePath: data.cover_image_path,
        displayOrder: data.display_order ?? 0,
        topicId: data.topic_id,
        questionCount: 0,
      })

      return { success: true, error: null, id: data.id }
    } catch (err) {
      console.error('Error adding sub_topic:', err)
      const message = err instanceof Error ? err.message : 'Failed to add sub_topic'
      return { success: false, error: message }
    }
  }

  /**
   * Update a sub_topic
   */
  async function updateSubTopic(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    subTopicId: string,
    updates: { name?: string; coverImagePath?: string | null },
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const updateData: { name?: string; cover_image_path?: string | null } = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.coverImagePath !== undefined) updateData.cover_image_path = updates.coverImagePath

      const { error: updateError } = await supabase
        .from('sub_topics')
        .update(updateData)
        .eq('id', subTopicId)

      if (updateError) throw updateError

      // Update local state
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      const topic = subject?.topics.find((t) => t.id === topicId)
      const subTopic = topic?.subTopics.find((st) => st.id === subTopicId)
      if (subTopic) {
        if (updates.name !== undefined) subTopic.name = updates.name
        if (updates.coverImagePath !== undefined) subTopic.coverImagePath = updates.coverImagePath
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error updating sub_topic:', err)
      const message = err instanceof Error ? err.message : 'Failed to update sub_topic'
      return { success: false, error: message }
    }
  }

  /**
   * Update sub_topic cover image (convenience method)
   */
  async function updateSubTopicCoverImage(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    subTopicId: string,
    coverImagePath: string | null,
  ): Promise<{ success: boolean; error: string | null }> {
    return updateSubTopic(gradeLevelId, subjectId, topicId, subTopicId, { coverImagePath })
  }

  /**
   * Delete a sub_topic
   */
  async function deleteSubTopic(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    subTopicId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('sub_topics').delete().eq('id', subTopicId)

      if (deleteError) throw deleteError

      // Remove from local state
      const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
      const subject = gradeLevel?.subjects.find((s) => s.id === subjectId)
      const topic = subject?.topics.find((t) => t.id === topicId)
      if (topic) {
        const index = topic.subTopics.findIndex((st) => st.id === subTopicId)
        if (index !== -1) {
          topic.subTopics.splice(index, 1)
        }
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting sub_topic:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete sub_topic'
      return { success: false, error: message }
    }
  }

  /**
   * Upload an image to Supabase storage
   */
  async function uploadCurriculumImage(
    file: File,
    type: 'subject' | 'topic' | 'subtopic',
    id: string,
  ): Promise<{ success: boolean; path: string | null; error: string | null }> {
    try {
      const fileExt = file.name.split('.').pop()
      // For subtopic, store in subtopics folder
      const folder = type === 'subtopic' ? 'subtopics' : `${type}s`
      const filePath = `${folder}/${id}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('curriculum-images')
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '31536000', // 1 year cache for CDN
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
   * Image transformation options for Supabase Storage
   */
  interface ImageTransformOptions {
    width?: number
    height?: number
    quality?: number
    resize?: 'cover' | 'contain' | 'fill'
  }

  /**
   * Get public URL for a curriculum image with optional transformation
   */
  function getCurriculumImageUrl(path: string | null, transform?: ImageTransformOptions): string {
    if (!path) return ''

    if (transform) {
      const { data } = supabase.storage.from('curriculum-images').getPublicUrl(path, {
        transform: {
          width: transform.width,
          height: transform.height,
          quality: transform.quality ?? 80,
          resize: transform.resize ?? 'contain',
        },
      })
      return data.publicUrl
    }

    const { data } = supabase.storage.from('curriculum-images').getPublicUrl(path)
    return data.publicUrl
  }

  /**
   * Get optimized image URL for curriculum display (cards)
   */
  function getOptimizedImageUrl(path: string | null): string {
    return getCurriculumImageUrl(path, { width: 400, quality: 80 })
  }

  // Helper to find a grade level by ID
  function getGradeLevelById(id: string): GradeLevel | undefined {
    return gradeLevels.value.find((g) => g.id === id)
  }

  // Helper to find a subject by ID
  function getSubjectById(subjectId: string): Subject | undefined {
    for (const grade of gradeLevels.value) {
      const subject = grade.subjects.find((s) => s.id === subjectId)
      if (subject) return subject
    }
    return undefined
  }

  // Helper to find a topic by ID
  function getTopicById(topicId: string): Topic | undefined {
    for (const grade of gradeLevels.value) {
      for (const subject of grade.subjects) {
        const topic = subject.topics.find((t) => t.id === topicId)
        if (topic) return topic
      }
    }
    return undefined
  }

  // Get topic with full hierarchy info
  function getTopicWithHierarchy(topicId: string): {
    topic: Topic
    subject: Subject
    gradeLevel: GradeLevel
  } | null {
    for (const gradeLevel of gradeLevels.value) {
      for (const subject of gradeLevel.subjects) {
        const topic = subject.topics.find((t) => t.id === topicId)
        if (topic) {
          return { topic, subject, gradeLevel }
        }
      }
    }
    return null
  }

  // Helper to find a sub_topic by ID
  function getSubTopicById(subTopicId: string): SubTopic | undefined {
    for (const grade of gradeLevels.value) {
      for (const subject of grade.subjects) {
        for (const topic of subject.topics) {
          const subTopic = topic.subTopics.find((st) => st.id === subTopicId)
          if (subTopic) return subTopic
        }
      }
    }
    return undefined
  }

  // Get sub_topic with full hierarchy info (now used by questions/practice stores)
  function getSubTopicWithHierarchy(subTopicId: string): {
    subTopic: SubTopic
    topic: Topic
    subject: Subject
    gradeLevel: GradeLevel
  } | null {
    for (const gradeLevel of gradeLevels.value) {
      for (const subject of gradeLevel.subjects) {
        for (const topic of subject.topics) {
          const subTopic = topic.subTopics.find((st) => st.id === subTopicId)
          if (subTopic) {
            return { subTopic, topic, subject, gradeLevel }
          }
        }
      }
    }
    return null
  }

  // Admin CurriculumPage navigation setters
  function setAdminCurriculumGradeLevel(gradeLevelId: string | null) {
    adminCurriculumNavigation.value.selectedGradeLevelId = gradeLevelId
    // Reset dependent selections when grade level changes
    if (gradeLevelId === null) {
      adminCurriculumNavigation.value.selectedSubjectId = null
      adminCurriculumNavigation.value.selectedTopicId = null
    }
  }

  function setAdminCurriculumSubject(subjectId: string | null) {
    adminCurriculumNavigation.value.selectedSubjectId = subjectId
    // Reset dependent selection when subject changes
    if (subjectId === null) {
      adminCurriculumNavigation.value.selectedTopicId = null
    }
  }

  function setAdminCurriculumTopic(topicId: string | null) {
    adminCurriculumNavigation.value.selectedTopicId = topicId
  }

  function resetAdminCurriculumNavigation() {
    adminCurriculumNavigation.value = {
      selectedGradeLevelId: null,
      selectedSubjectId: null,
      selectedTopicId: null,
    }
  }

  return {
    // State
    gradeLevels,
    allSubjects,
    allTopics,
    allSubTopics,
    isLoading,
    error,

    // Admin CurriculumPage navigation state
    adminCurriculumNavigation,
    setAdminCurriculumGradeLevel,
    setAdminCurriculumSubject,
    setAdminCurriculumTopic,
    resetAdminCurriculumNavigation,

    // Actions
    fetchCurriculum,
    addGradeLevel,
    updateGradeLevel,
    deleteGradeLevel,
    addSubject,
    updateSubject,
    updateSubjectCoverImage,
    deleteSubject,
    addTopic,
    updateTopic,
    updateTopicCoverImage,
    deleteTopic,
    addSubTopic,
    updateSubTopic,
    updateSubTopicCoverImage,
    deleteSubTopic,
    uploadCurriculumImage,
    getCurriculumImageUrl,
    getOptimizedImageUrl,

    // Helpers
    getGradeLevelById,
    getSubjectById,
    getTopicById,
    getTopicWithHierarchy,
    getSubTopicById,
    getSubTopicWithHierarchy,
  }
})
