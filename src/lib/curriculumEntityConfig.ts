import type { useCurriculumStore } from '@/stores/curriculum'

export type CurriculumLevel = 'grade' | 'subject' | 'topic' | 'subtopic'

export interface CurriculumIds {
  gradeLevelId: string
  subjectId: string
  topicId: string
  subTopicId: string
}

type CurriculumStore = ReturnType<typeof useCurriculumStore>

interface CurriculumEntityEntry {
  label: string
  inputLabel: string
  hasImage: boolean
  imageType: 'subject' | 'topic' | 'subtopic' | null
  addDescription: string
  deleteDescription: string
  add: (
    store: CurriculumStore,
    ids: CurriculumIds,
    name: string,
  ) => Promise<{ error: string | null; id?: string }>
  updateName: (
    store: CurriculumStore,
    ids: CurriculumIds,
    name: string,
  ) => Promise<{ error: string | null }>
  delete: (store: CurriculumStore, ids: CurriculumIds) => Promise<{ error: string | null }>
  updateCoverImage: (
    store: CurriculumStore,
    ids: CurriculumIds,
    path: string | null,
  ) => Promise<{ error: string | null }>
  getItemId: (ids: CurriculumIds) => string
}

export const curriculumEntityConfig: Record<CurriculumLevel, CurriculumEntityEntry> = {
  grade: {
    label: 'Grade Level',
    inputLabel: 'Grade Level Name',
    hasImage: false,
    imageType: null,
    addDescription: 'Add a new grade level to the curriculum.',
    deleteDescription:
      'This will permanently delete this grade level and all its subjects, topics, sub-topics, questions, and practice sessions. This action cannot be undone.',
    add: (store, _ids, name) => store.addGradeLevel(name),
    updateName: (store, ids, name) => store.updateGradeLevel(ids.gradeLevelId, name),
    delete: (store, ids) => store.deleteGradeLevel(ids.gradeLevelId),
    updateCoverImage: () => Promise.resolve({ success: true, error: null }),
    getItemId: (ids) => ids.gradeLevelId,
  },
  subject: {
    label: 'Subject',
    inputLabel: 'Subject Name',
    hasImage: true,
    imageType: 'subject',
    addDescription: 'Add a new subject with an optional cover image.',
    deleteDescription:
      'This will permanently delete this subject and all its topics, sub-topics, questions, and practice sessions. This action cannot be undone.',
    add: (store, ids, name) => store.addSubject(ids.gradeLevelId, name),
    updateName: (store, ids, name) =>
      store.updateSubject(ids.gradeLevelId, ids.subjectId, { name }),
    delete: (store, ids) => store.deleteSubject(ids.gradeLevelId, ids.subjectId),
    updateCoverImage: (store, ids, path) =>
      store.updateSubjectCoverImage(ids.gradeLevelId, ids.subjectId, path),
    getItemId: (ids) => ids.subjectId,
  },
  topic: {
    label: 'Topic',
    inputLabel: 'Topic Name',
    hasImage: true,
    imageType: 'topic',
    addDescription: 'Add a new topic with an optional cover image.',
    deleteDescription:
      'This will permanently delete this topic and all its sub-topics, questions, and practice sessions. This action cannot be undone.',
    add: (store, ids, name) => store.addTopic(ids.gradeLevelId, ids.subjectId, name),
    updateName: (store, ids, name) =>
      store.updateTopic(ids.gradeLevelId, ids.subjectId, ids.topicId, { name }),
    delete: (store, ids) => store.deleteTopic(ids.gradeLevelId, ids.subjectId, ids.topicId),
    updateCoverImage: (store, ids, path) =>
      store.updateTopicCoverImage(ids.gradeLevelId, ids.subjectId, ids.topicId, path),
    getItemId: (ids) => ids.topicId,
  },
  subtopic: {
    label: 'Sub-Topic',
    inputLabel: 'Sub-Topic Name',
    hasImage: true,
    imageType: 'subtopic',
    addDescription: 'Add a new sub-topic with an optional cover image.',
    deleteDescription:
      'This will permanently delete this sub-topic and all its questions and practice sessions. This action cannot be undone.',
    add: (store, ids, name) =>
      store.addSubTopic(ids.gradeLevelId, ids.subjectId, ids.topicId, name),
    updateName: (store, ids, name) =>
      store.updateSubTopic(ids.gradeLevelId, ids.subjectId, ids.topicId, ids.subTopicId, { name }),
    delete: (store, ids) =>
      store.deleteSubTopic(ids.gradeLevelId, ids.subjectId, ids.topicId, ids.subTopicId),
    updateCoverImage: (store, ids, path) =>
      store.updateSubTopicCoverImage(
        ids.gradeLevelId,
        ids.subjectId,
        ids.topicId,
        ids.subTopicId,
        path,
      ),
    getItemId: (ids) => ids.subTopicId,
  },
}
