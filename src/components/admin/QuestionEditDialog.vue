<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore } from '@/stores/questions'
import type { Question, QuestionType, MCQOption } from '@/types'
import { ImagePlus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  open: boolean
  question: Question | null
  mode: 'add' | 'edit'
  title?: string
  description?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [question: Question | null]
}>()

const curriculumStore = useCurriculumStore()
const questionsStore = useQuestionsStore()

// Form state
const formType = ref<QuestionType>('mcq')
const formQuestion = ref('')
const formGradeLevelId = ref('')
const formSubjectId = ref('')
const formTopicId = ref('')
const formExplanation = ref('')
const formAnswer = ref('')
const formImageUrl = ref('')
const formOptions = ref<MCQOption[]>([
  { id: 'a', text: '', isCorrect: false },
  { id: 'b', text: '', isCorrect: false },
  { id: 'c', text: '', isCorrect: false },
  { id: 'd', text: '', isCorrect: false },
])

const imageInputRef = ref<HTMLInputElement | null>(null)

// Computed for cascading selects
const availableSubjects = computed(() => {
  const grade = curriculumStore.gradeLevels.find((g) => g.id === formGradeLevelId.value)
  return grade?.subjects ?? []
})

const availableTopics = computed(() => {
  const grade = curriculumStore.gradeLevels.find((g) => g.id === formGradeLevelId.value)
  const subject = grade?.subjects.find((s) => s.id === formSubjectId.value)
  return subject?.topics ?? []
})

// Watch for question changes to populate form
watch(
  () => props.question,
  (question) => {
    if (question) {
      formType.value = question.type
      formQuestion.value = question.question
      formGradeLevelId.value = question.gradeLevelId
      formSubjectId.value = question.subjectId
      formTopicId.value = question.topicId
      formExplanation.value = question.explanation
      formImageUrl.value = question.imageUrl ?? ''

      if (question.type === 'mcq') {
        formOptions.value = [...question.options]
        formAnswer.value = ''
      } else {
        formAnswer.value = question.answer
        formOptions.value = [
          { id: 'a', text: '', isCorrect: false },
          { id: 'b', text: '', isCorrect: false },
          { id: 'c', text: '', isCorrect: false },
          { id: 'd', text: '', isCorrect: false },
        ]
      }
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

// Watch for dialog open to reset form on add mode
watch(
  () => props.open,
  (open) => {
    if (open && props.mode === 'add' && !props.question) {
      resetForm()
    }
  },
)

function resetForm() {
  formType.value = 'mcq'
  formQuestion.value = ''
  formGradeLevelId.value = ''
  formSubjectId.value = ''
  formTopicId.value = ''
  formExplanation.value = ''
  formAnswer.value = ''
  formImageUrl.value = ''
  formOptions.value = [
    { id: 'a', text: '', isCorrect: false },
    { id: 'b', text: '', isCorrect: false },
    { id: 'c', text: '', isCorrect: false },
    { id: 'd', text: '', isCorrect: false },
  ]
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      formImageUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeImage() {
  formImageUrl.value = ''
  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

function setCorrectOption(optionId: string) {
  formOptions.value = formOptions.value.map((opt) => ({
    ...opt,
    isCorrect: opt.id === optionId,
  }))
}

function getCurriculumNames() {
  const grade = curriculumStore.gradeLevels.find((g) => g.id === formGradeLevelId.value)
  const subject = grade?.subjects.find((s) => s.id === formSubjectId.value)
  const topic = subject?.topics.find((t) => t.id === formTopicId.value)

  return {
    gradeLevelName: grade?.name ?? '',
    subjectName: subject?.name ?? '',
    topicName: topic?.name ?? '',
  }
}

function handleSave() {
  const names = getCurriculumNames()

  if (props.mode === 'add') {
    // Add new question
    if (formType.value === 'mcq') {
      questionsStore.addQuestion({
        type: 'mcq',
        question: formQuestion.value,
        imageUrl: formImageUrl.value || undefined,
        gradeLevelId: formGradeLevelId.value,
        gradeLevelName: names.gradeLevelName,
        subjectId: formSubjectId.value,
        subjectName: names.subjectName,
        topicId: formTopicId.value,
        topicName: names.topicName,
        explanation: formExplanation.value,
        options: formOptions.value,
      })
    } else {
      questionsStore.addQuestion({
        type: 'short_answer',
        question: formQuestion.value,
        imageUrl: formImageUrl.value || undefined,
        gradeLevelId: formGradeLevelId.value,
        gradeLevelName: names.gradeLevelName,
        subjectId: formSubjectId.value,
        subjectName: names.subjectName,
        topicId: formTopicId.value,
        topicName: names.topicName,
        explanation: formExplanation.value,
        answer: formAnswer.value,
      })
    }
  } else if (props.question) {
    // Update existing question
    if (formType.value === 'mcq') {
      questionsStore.updateQuestion(props.question.id, {
        type: 'mcq',
        question: formQuestion.value,
        imageUrl: formImageUrl.value || undefined,
        gradeLevelId: formGradeLevelId.value,
        gradeLevelName: names.gradeLevelName,
        subjectId: formSubjectId.value,
        subjectName: names.subjectName,
        topicId: formTopicId.value,
        topicName: names.topicName,
        explanation: formExplanation.value,
        options: formOptions.value,
      })
    } else {
      questionsStore.updateQuestion(props.question.id, {
        type: 'short_answer',
        question: formQuestion.value,
        imageUrl: formImageUrl.value || undefined,
        gradeLevelId: formGradeLevelId.value,
        gradeLevelName: names.gradeLevelName,
        subjectId: formSubjectId.value,
        subjectName: names.subjectName,
        topicId: formTopicId.value,
        topicName: names.topicName,
        explanation: formExplanation.value,
        answer: formAnswer.value,
      })
    }
  }

  emit('save', props.question)
  emit('update:open', false)
  resetForm()
}

function handleCancel() {
  emit('update:open', false)
}

const dialogTitle = computed(
  () => props.title ?? (props.mode === 'add' ? 'Add Question' : 'Edit Question'),
)
const dialogDescription = computed(
  () =>
    props.description ??
    (props.mode === 'add'
      ? 'Create a new question for the question bank.'
      : 'Update the question details.'),
)
const saveButtonText = computed(() => (props.mode === 'add' ? 'Add Question' : 'Save Changes'))
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>{{ dialogDescription }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Question Type -->
        <div class="space-y-2">
          <Label>Question Type</Label>
          <Select v-model="formType">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq">Multiple Choice</SelectItem>
              <SelectItem value="short_answer">Short Answer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Grade Level -->
        <div class="space-y-2">
          <Label>Grade Level</Label>
          <Select
            v-model="formGradeLevelId"
            @update:model-value="() => {
              formSubjectId = ''
              formTopicId = ''
            }"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select grade level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="grade in curriculumStore.gradeLevels"
                :key="grade.id"
                :value="grade.id"
              >
                {{ grade.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Subject -->
        <div class="space-y-2">
          <Label>Subject</Label>
          <Select
            v-model="formSubjectId"
            :disabled="!formGradeLevelId"
            @update:model-value="formTopicId = ''"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="subject in availableSubjects"
                :key="subject.id"
                :value="subject.id"
              >
                {{ subject.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Topic -->
        <div class="space-y-2">
          <Label>Topic</Label>
          <Select v-model="formTopicId" :disabled="!formSubjectId">
            <SelectTrigger>
              <SelectValue placeholder="Select topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="topic in availableTopics" :key="topic.id" :value="topic.id">
                {{ topic.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Question -->
        <div class="space-y-2">
          <Label>Question</Label>
          <Textarea v-model="formQuestion" placeholder="Enter the question" rows="3" />
        </div>

        <!-- Question Image -->
        <div class="space-y-2">
          <Label>Question Image (Optional)</Label>
          <div v-if="formImageUrl" class="relative">
            <img
              :src="formImageUrl"
              alt="Question image"
              class="max-h-48 rounded-lg border object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              class="absolute -right-2 -top-2 size-6"
              @click="removeImage"
            >
              <X class="size-4" />
            </Button>
          </div>
          <div v-else class="flex gap-2">
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageUpload"
            />
            <Button type="button" variant="outline" class="w-full" @click="imageInputRef?.click()">
              <ImagePlus class="mr-2 size-4" />
              Upload Image
            </Button>
          </div>
          <Input v-model="formImageUrl" placeholder="Or paste an image URL" class="mt-2" />
        </div>

        <!-- MCQ Options -->
        <div v-if="formType === 'mcq'" class="space-y-3">
          <Label>Options (select the correct answer)</Label>
          <div v-for="option in formOptions" :key="option.id" class="flex items-center gap-2">
            <Button
              type="button"
              :variant="option.isCorrect ? 'default' : 'outline'"
              size="sm"
              class="w-8 shrink-0"
              @click="setCorrectOption(option.id)"
            >
              {{ option.id.toUpperCase() }}
            </Button>
            <Input
              v-model="option.text"
              :placeholder="`Option ${option.id.toUpperCase()}`"
              class="flex-1"
            />
          </div>
        </div>

        <!-- Short Answer -->
        <div v-else class="space-y-2">
          <Label>Answer</Label>
          <Input v-model="formAnswer" placeholder="Enter the correct answer" />
        </div>

        <!-- Explanation -->
        <div class="space-y-2">
          <Label>Explanation</Label>
          <Textarea v-model="formExplanation" placeholder="Explain the answer" rows="2" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel">Cancel</Button>
        <Button @click="handleSave" :disabled="!formQuestion || !formTopicId">{{
          saveButtonText
        }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
