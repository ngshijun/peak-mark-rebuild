<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore, type MCQOption } from '@/stores/questions'
import type { Database } from '@/types/database.types'
import { ImagePlus, X, Loader2 } from 'lucide-vue-next'
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
import { toast } from 'vue-sonner'

type QuestionType = Database['public']['Enums']['question_type']

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: []
}>()

const curriculumStore = useCurriculumStore()
const questionsStore = useQuestionsStore()

// Loading state
const isSaving = ref(false)

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
  { id: 'a', text: '', imagePath: null, isCorrect: false },
  { id: 'b', text: '', imagePath: null, isCorrect: false },
  { id: 'c', text: '', imagePath: null, isCorrect: false },
  { id: 'd', text: '', imagePath: null, isCorrect: false },
])

const imageInputRef = ref<HTMLInputElement | null>(null)
const optionImageInputRefs = ref<Record<string, HTMLInputElement | null>>({
  a: null,
  b: null,
  c: null,
  d: null,
})

// Store actual File objects for upload
const questionImageFile = ref<File | null>(null)
const optionImageFiles = ref<Record<string, File | null>>({
  a: null,
  b: null,
  c: null,
  d: null,
})

// Fetch curriculum on mount if needed
onMounted(async () => {
  if (curriculumStore.gradeLevels.length === 0) {
    await curriculumStore.fetchCurriculum()
  }
})

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

// Watch for dialog open to reset form
watch(
  () => props.open,
  (open) => {
    if (open) {
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
    { id: 'a', text: '', imagePath: null, isCorrect: false },
    { id: 'b', text: '', imagePath: null, isCorrect: false },
    { id: 'c', text: '', imagePath: null, isCorrect: false },
    { id: 'd', text: '', imagePath: null, isCorrect: false },
  ]
  // Clear file objects
  questionImageFile.value = null
  optionImageFiles.value = { a: null, b: null, c: null, d: null }
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    // Store the file for later upload
    questionImageFile.value = file
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      formImageUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeImage() {
  formImageUrl.value = ''
  questionImageFile.value = null
  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

function handleOptionImageUpload(event: Event, optionId: 'a' | 'b' | 'c' | 'd') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    // Store the file for later upload
    optionImageFiles.value[optionId] = file
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      const option = formOptions.value.find((o) => o.id === optionId)
      if (option) {
        option.imagePath = e.target?.result as string
      }
    }
    reader.readAsDataURL(file)
  }
}

function removeOptionImage(optionId: 'a' | 'b' | 'c' | 'd') {
  const option = formOptions.value.find((o) => o.id === optionId)
  if (option) {
    option.imagePath = null
  }
  optionImageFiles.value[optionId] = null
  const inputRef = optionImageInputRefs.value[optionId]
  if (inputRef) {
    inputRef.value = ''
  }
}

function setCorrectOption(optionId: string) {
  formOptions.value = formOptions.value.map((opt) => ({
    ...opt,
    isCorrect: opt.id === optionId,
  }))
}

async function handleSave() {
  isSaving.value = true

  try {
    // Get hierarchy info for grade_level_id and subject_id
    const hierarchy = curriculumStore.getTopicWithHierarchy(formTopicId.value)
    const gradeLevelId = hierarchy?.gradeLevel.id ?? formGradeLevelId.value
    const subjectId = hierarchy?.subject.id ?? formSubjectId.value

    // First, create the question without images
    const result = await questionsStore.addQuestion({
      type: formType.value,
      question: formQuestion.value,
      imagePath: null, // Will be updated after upload
      topicId: formTopicId.value,
      gradeLevelId,
      subjectId,
      explanation: formExplanation.value || null,
      answer: formType.value === 'short_answer' ? formAnswer.value : null,
      options:
        formType.value === 'mcq'
          ? formOptions.value.map((opt) => ({ ...opt, imagePath: null })) // Clear image paths for initial creation
          : undefined,
    })

    if (result.error || !result.id) {
      toast.error(result.error ?? 'Failed to create question')
      return
    }

    const questionId = result.id
    let questionImagePath: string | null = null
    const optionImagePaths: Record<string, string | null> = { a: null, b: null, c: null, d: null }

    // Upload question image if present
    if (questionImageFile.value) {
      const uploadResult = await questionsStore.uploadQuestionImage(
        questionImageFile.value,
        questionId,
      )
      if (uploadResult.success && uploadResult.path) {
        questionImagePath = uploadResult.path
      } else {
        console.error('Failed to upload question image:', uploadResult.error)
      }
    }

    // Upload option images if present (for MCQ)
    if (formType.value === 'mcq') {
      for (const optionId of ['a', 'b', 'c', 'd'] as const) {
        const file = optionImageFiles.value[optionId]
        if (file) {
          const uploadResult = await questionsStore.uploadQuestionImage(file, questionId, optionId)
          if (uploadResult.success && uploadResult.path) {
            optionImagePaths[optionId] = uploadResult.path
          } else {
            console.error(`Failed to upload option ${optionId} image:`, uploadResult.error)
          }
        }
      }
    }

    // Update question with image paths if any were uploaded
    const hasImages =
      questionImagePath || Object.values(optionImagePaths).some((path) => path !== null)

    if (hasImages) {
      const updateOptions =
        formType.value === 'mcq'
          ? formOptions.value.map((opt) => ({
              ...opt,
              imagePath: optionImagePaths[opt.id] ?? null,
            }))
          : undefined

      await questionsStore.updateQuestion(questionId, {
        imagePath: questionImagePath,
        options: updateOptions,
      })
    }

    toast.success('Question added successfully')

    emit('save')
    emit('update:open', false)
    resetForm()
  } finally {
    isSaving.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add Question</DialogTitle>
        <DialogDescription>Create a new question for the question bank.</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Question Type -->
        <div class="space-y-2">
          <Label>Question Type</Label>
          <Select v-model="formType" :disabled="isSaving">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq">Multiple Choice</SelectItem>
              <SelectItem value="short_answer">Short Answer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Grade Level, Subject, Topic Row -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Grade Level -->
          <div class="space-y-2">
            <Label>Grade Level</Label>
            <Select
              v-model="formGradeLevelId"
              :disabled="isSaving"
              @update:model-value="
                () => {
                  formSubjectId = ''
                  formTopicId = ''
                }
              "
            >
              <SelectTrigger class="w-full">
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
              :disabled="!formGradeLevelId || isSaving"
              @update:model-value="formTopicId = ''"
            >
              <SelectTrigger class="w-full">
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
            <Select v-model="formTopicId" :disabled="!formSubjectId || isSaving">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="topic in availableTopics" :key="topic.id" :value="topic.id">
                  {{ topic.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Question -->
        <div class="space-y-2">
          <Label>Question</Label>
          <Textarea
            v-model="formQuestion"
            placeholder="Enter the question"
            rows="3"
            :disabled="isSaving"
          />
        </div>

        <!-- Question Image -->
        <div class="space-y-2">
          <Label>Question Image (Optional)</Label>
          <div v-if="formImageUrl" class="relative inline-block">
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
              :disabled="isSaving"
              @click="removeImage"
            >
              <X class="size-4" />
            </Button>
          </div>
          <div v-else>
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageUpload"
            />
            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="isSaving"
              @click="imageInputRef?.click()"
            >
              <ImagePlus class="mr-2 size-4" />
              Add Image
            </Button>
          </div>
        </div>

        <!-- MCQ Options -->
        <div v-if="formType === 'mcq'" class="space-y-3">
          <Label>Options (select the correct answer)</Label>
          <p class="text-xs text-muted-foreground">Each option can have text, an image, or both.</p>
          <div v-for="option in formOptions" :key="option.id" class="space-y-2">
            <div class="flex items-start gap-2">
              <Button
                type="button"
                :variant="option.isCorrect ? 'default' : 'outline'"
                size="sm"
                class="mt-1 w-8 shrink-0"
                :disabled="isSaving"
                @click="setCorrectOption(option.id)"
              >
                {{ option.id.toUpperCase() }}
              </Button>
              <div class="flex-1 space-y-2">
                <Input
                  :model-value="option.text ?? ''"
                  :placeholder="`Option ${option.id.toUpperCase()} text`"
                  :disabled="isSaving"
                  @update:model-value="option.text = ($event as string) || null"
                />
                <!-- Option Image -->
                <div v-if="option.imagePath" class="relative inline-block">
                  <img
                    :src="option.imagePath"
                    :alt="`Option ${option.id.toUpperCase()} image`"
                    class="max-h-24 rounded border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    class="absolute -right-2 -top-2 size-5"
                    :disabled="isSaving"
                    @click="removeOptionImage(option.id)"
                  >
                    <X class="size-3" />
                  </Button>
                </div>
                <div v-else class="flex gap-2">
                  <input
                    :ref="(el) => (optionImageInputRefs[option.id] = el as HTMLInputElement)"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleOptionImageUpload($event, option.id)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    :disabled="isSaving"
                    @click="optionImageInputRefs[option.id]?.click()"
                  >
                    <ImagePlus class="mr-1 size-3" />
                    Add Image
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Short Answer -->
        <div v-else class="space-y-2">
          <Label>Answer</Label>
          <Input v-model="formAnswer" placeholder="Enter the correct answer" :disabled="isSaving" />
        </div>

        <!-- Explanation -->
        <div class="space-y-2">
          <Label>Explanation</Label>
          <Textarea
            v-model="formExplanation"
            placeholder="Explain the answer"
            rows="2"
            :disabled="isSaving"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isSaving" @click="handleCancel">Cancel</Button>
        <Button @click="handleSave" :disabled="!formQuestion || !formTopicId || isSaving">
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          Add Question
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
