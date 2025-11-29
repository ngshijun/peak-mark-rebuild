import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GradeLevel, Subject, Topic } from '@/types'

export const useCurriculumStore = defineStore('curriculum', () => {
  const gradeLevels = ref<GradeLevel[]>([
    {
      id: '1',
      name: 'Grade 1',
      subjects: [
        {
          id: '1-1',
          name: 'Mathematics',
          topics: [
            { id: '1-1-1', name: 'Addition' },
            { id: '1-1-2', name: 'Subtraction' },
            { id: '1-1-3', name: 'Counting' },
            { id: '1-1-4', name: 'Shapes' },
          ],
        },
        {
          id: '1-2',
          name: 'English',
          topics: [
            { id: '1-2-1', name: 'Alphabet' },
            { id: '1-2-2', name: 'Phonics' },
            { id: '1-2-3', name: 'Vocabulary' },
            { id: '1-2-4', name: 'Reading' },
          ],
        },
        {
          id: '1-3',
          name: 'Science',
          topics: [
            { id: '1-3-1', name: 'Plants' },
            { id: '1-3-2', name: 'Animals' },
            { id: '1-3-3', name: 'Weather' },
          ],
        },
        {
          id: '1-4',
          name: 'Chinese',
          topics: [
            { id: '1-4-1', name: 'Pinyin' },
            { id: '1-4-2', name: 'Characters' },
            { id: '1-4-3', name: 'Vocabulary' },
          ],
        },
      ],
    },
    {
      id: '2',
      name: 'Grade 2',
      subjects: [
        {
          id: '2-1',
          name: 'Mathematics',
          topics: [
            { id: '2-1-1', name: 'Multiplication' },
            { id: '2-1-2', name: 'Division' },
            { id: '2-1-3', name: 'Fractions' },
            { id: '2-1-4', name: 'Geometry' },
          ],
        },
        {
          id: '2-2',
          name: 'Science',
          topics: [
            { id: '2-2-1', name: 'Plants' },
            { id: '2-2-2', name: 'Animals' },
            { id: '2-2-3', name: 'Matter' },
            { id: '2-2-4', name: 'Energy' },
          ],
        },
        {
          id: '2-3',
          name: 'English',
          topics: [
            { id: '2-3-1', name: 'Grammar' },
            { id: '2-3-2', name: 'Writing' },
            { id: '2-3-3', name: 'Spelling' },
          ],
        },
        {
          id: '2-4',
          name: 'History',
          topics: [
            { id: '2-4-1', name: 'Local History' },
            { id: '2-4-2', name: 'Famous People' },
          ],
        },
        {
          id: '2-5',
          name: 'Geography',
          topics: [
            { id: '2-5-1', name: 'Maps' },
            { id: '2-5-2', name: 'Continents' },
            { id: '2-5-3', name: 'Countries' },
          ],
        },
      ],
    },
  ])

  function generateId() {
    return Math.random().toString(36).substring(2, 9)
  }

  function addGradeLevel(name: string) {
    gradeLevels.value.push({
      id: generateId(),
      name,
      subjects: [],
    })
  }

  function addSubject(gradeLevelId: string, name: string, coverImage?: string) {
    const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
    if (gradeLevel) {
      gradeLevel.subjects.push({
        id: generateId(),
        name,
        coverImage,
        topics: [],
      })
    }
  }

  function addTopic(gradeLevelId: string, subjectId: string, name: string, coverImage?: string) {
    const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
    if (gradeLevel) {
      const subject = gradeLevel.subjects.find((s) => s.id === subjectId)
      if (subject) {
        subject.topics.push({
          id: generateId(),
          name,
          coverImage,
        })
      }
    }
  }

  function updateSubjectCoverImage(gradeLevelId: string, subjectId: string, coverImage: string) {
    const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
    if (gradeLevel) {
      const subject = gradeLevel.subjects.find((s) => s.id === subjectId)
      if (subject) {
        subject.coverImage = coverImage
      }
    }
  }

  function updateTopicCoverImage(
    gradeLevelId: string,
    subjectId: string,
    topicId: string,
    coverImage: string,
  ) {
    const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
    if (gradeLevel) {
      const subject = gradeLevel.subjects.find((s) => s.id === subjectId)
      if (subject) {
        const topic = subject.topics.find((t) => t.id === topicId)
        if (topic) {
          topic.coverImage = coverImage
        }
      }
    }
  }

  function deleteGradeLevel(id: string) {
    const index = gradeLevels.value.findIndex((g) => g.id === id)
    if (index !== -1) {
      gradeLevels.value.splice(index, 1)
    }
  }

  function deleteSubject(gradeLevelId: string, subjectId: string) {
    const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
    if (gradeLevel) {
      const index = gradeLevel.subjects.findIndex((s) => s.id === subjectId)
      if (index !== -1) {
        gradeLevel.subjects.splice(index, 1)
      }
    }
  }

  function deleteTopic(gradeLevelId: string, subjectId: string, topicId: string) {
    const gradeLevel = gradeLevels.value.find((g) => g.id === gradeLevelId)
    if (gradeLevel) {
      const subject = gradeLevel.subjects.find((s) => s.id === subjectId)
      if (subject) {
        const index = subject.topics.findIndex((t) => t.id === topicId)
        if (index !== -1) {
          subject.topics.splice(index, 1)
        }
      }
    }
  }

  return {
    gradeLevels,
    addGradeLevel,
    addSubject,
    addTopic,
    deleteGradeLevel,
    deleteSubject,
    deleteTopic,
    updateSubjectCoverImage,
    updateTopicCoverImage,
  }
})
