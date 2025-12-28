<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore, type MCQOption } from '@/stores/questions'
import { computeQuestionImageHash } from '@/lib/imageHash'
import type { Database } from '@/types/database.types'
import { ImagePlus, X, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
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

// Define MCQ option schema
const mcqOptionSchema = z.object({
  id: z.enum(['a', 'b', 'c', 'd']),
  text: z.string().nullable(),
  imagePath: z.string().nullable(),
  isCorrect: z.boolean(),
})

// Helper to check if an option is filled
const isOptionFilled = (opt: { text: string | null; imagePath: string | null }) =>
  (opt.text && opt.text.trim()) || opt.imagePath

// Dynamic validation schema based on question type
const questionFormSchema = toTypedSchema(
  z
    .object({
      type: z.enum(['mcq', 'mrq', 'short_answer']),
      gradeLevelId: z.string().min(1, 'Grade level is required'),
      subjectId: z.string().min(1, 'Subject is required'),
      topicId: z.string().min(1, 'Topic is required'),
      subTopicId: z.string().min(1, 'Sub-topic is required'),
      question: z.string().min(1, 'Question text is required'),
      explanation: z.string().optional(),
      answer: z.string().optional(),
      options: z.array(mcqOptionSchema).optional(),
    })
    .superRefine((data, ctx) => {
      if ((data.type === 'mcq' || data.type === 'mrq') && data.options) {
        const filledOptions = data.options.filter(isOptionFilled)
        if (filledOptions.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'At least 2 options must have text or an image',
            path: ['options'],
          })
        }

        // Check that options are filled consecutively from the beginning (A, B, C, D order)
        let foundEmpty = false
        for (const opt of data.options) {
          const isFilled = isOptionFilled(opt)
          if (foundEmpty && isFilled) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Options must be filled consecutively from Option A',
              path: ['options'],
            })
            break
          }
          if (!isFilled) {
            foundEmpty = true
          }
        }

        const correctCount = data.options.filter((opt) => opt.isCorrect).length
        if (data.type === 'mcq' && correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'MCQ must have exactly one correct answer',
            path: ['options'],
          })
        }
        if (data.type === 'mrq' && correctCount < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'MRQ must have at least one correct answer',
            path: ['options'],
          })
        }
      }
      if (data.type === 'short_answer' && (!data.answer || !data.answer.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Answer is required',
          path: ['answer'],
        })
      }
    }),
)

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

const defaultOptions: MCQOption[] = [
  { id: 'a', text: '', imagePath: null, isCorrect: false },
  { id: 'b', text: '', imagePath: null, isCorrect: false },
  { id: 'c', text: '', imagePath: null, isCorrect: false },
  { id: 'd', text: '', imagePath: null, isCorrect: false },
]

const { handleSubmit, values, setFieldValue, resetForm, errors, setFieldTouched } = useForm({
  validationSchema: questionFormSchema,
  initialValues: {
    type: 'mcq' as QuestionType,
    gradeLevelId: '',
    subjectId: '',
    topicId: '',
    subTopicId: '',
    question: '',
    explanation: '',
    answer: '',
    options: [...defaultOptions],
  },
})

// Image handling refs (not part of validation)
const formImageUrl = ref('')
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
  const grade = curriculumStore.gradeLevels.find((g) => g.id === values.gradeLevelId)
  return grade?.subjects ?? []
})

const availableTopics = computed(() => {
  const grade = curriculumStore.gradeLevels.find((g) => g.id === values.gradeLevelId)
  const subject = grade?.subjects.find((s) => s.id === values.subjectId)
  return subject?.topics ?? []
})

const availableSubTopics = computed(() => {
  const grade = curriculumStore.gradeLevels.find((g) => g.id === values.gradeLevelId)
  const subject = grade?.subjects.find((s) => s.id === values.subjectId)
  const topic = subject?.topics.find((t) => t.id === values.topicId)
  return topic?.subTopics ?? []
})

// Watch for dialog open to reset form
watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm({
        values: {
          type: 'mcq',
          gradeLevelId: '',
          subjectId: '',
          topicId: '',
          subTopicId: '',
          question: '',
          explanation: '',
          answer: '',
          options: [...defaultOptions.map((o) => ({ ...o }))],
        },
      })
      // Clear image state
      formImageUrl.value = ''
      questionImageFile.value = null
      optionImageFiles.value = { a: null, b: null, c: null, d: null }
    }
  },
)

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    questionImageFile.value = file
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
    optionImageFiles.value[optionId] = file
    const reader = new FileReader()
    reader.onload = (e) => {
      const currentOptions = values.options || []
      const options = currentOptions.map((opt) =>
        opt.id === optionId ? { ...opt, imagePath: e.target?.result as string } : opt,
      )
      setFieldValue('options', options)
    }
    reader.readAsDataURL(file)
  }
}

function removeOptionImage(optionId: 'a' | 'b' | 'c' | 'd') {
  const currentOptions = values.options || []
  const options = currentOptions.map((opt) =>
    opt.id === optionId ? { ...opt, imagePath: null } : opt,
  )
  setFieldValue('options', options)
  optionImageFiles.value[optionId] = null
  const inputRef = optionImageInputRefs.value[optionId]
  if (inputRef) {
    inputRef.value = ''
  }
}

function setCorrectOption(optionId: string) {
  // For MCQ: single correct answer (radio behavior)
  const options = (values.options || []).map((opt) => ({
    ...opt,
    isCorrect: opt.id === optionId,
  }))
  setFieldValue('options', options)
  setFieldTouched('options', true)
}

function toggleCorrectOption(optionId: string) {
  // For MRQ: multiple correct answers (checkbox behavior)
  const options = (values.options || []).map((opt) => ({
    ...opt,
    isCorrect: opt.id === optionId ? !opt.isCorrect : opt.isCorrect,
  }))
  setFieldValue('options', options)
  setFieldTouched('options', true)
}

function updateOptionText(optionId: string, text: string) {
  const currentOptions = values.options || []
  const options = currentOptions.map((opt) =>
    opt.id === optionId ? { ...opt, text: text || null } : opt,
  )
  setFieldValue('options', options)
}

const onSubmit = handleSubmit(async (formValues) => {
  isSaving.value = true

  try {
    // Get hierarchy info for grade_level_id and subject_id
    const hierarchy = curriculumStore.getSubTopicWithHierarchy(formValues.subTopicId)
    const gradeLevelId = hierarchy?.gradeLevel.id ?? formValues.gradeLevelId
    const subjectId = hierarchy?.subject.id ?? formValues.subjectId

    // First, create the question without images
    const result = await questionsStore.addQuestion({
      type: formValues.type,
      question: formValues.question,
      imagePath: null,
      subTopicId: formValues.subTopicId,
      gradeLevelId,
      subjectId,
      explanation: formValues.explanation || null,
      answer: formValues.type === 'short_answer' ? formValues.answer || null : null,
      options:
        formValues.type === 'mcq' || formValues.type === 'mrq'
          ? (formValues.options || []).map((opt) => ({ ...opt, imagePath: null }))
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

    // Upload option images if present (for MCQ/MRQ)
    if (formValues.type === 'mcq' || formValues.type === 'mrq') {
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
        formValues.type === 'mcq' || formValues.type === 'mrq'
          ? (formValues.options || []).map((opt) => ({
              ...opt,
              imagePath: optionImagePaths[opt.id] ?? null,
            }))
          : undefined

      // Compute image hash from File objects (no network fetch needed)
      const imageHash = await computeQuestionImageHash({
        questionImage: questionImageFile.value,
        optionAImage: optionImageFiles.value.a,
        optionBImage: optionImageFiles.value.b,
        optionCImage: optionImageFiles.value.c,
        optionDImage: optionImageFiles.value.d,
      })

      await questionsStore.updateQuestion(questionId, {
        imagePath: questionImagePath,
        options: updateOptions,
        imageHash: imageHash || null,
      })
    }

    toast.success('Question added successfully')

    emit('save')
    emit('update:open', false)
  } finally {
    isSaving.value = false
  }
})

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

      <form class="space-y-4 py-4" @submit="onSubmit">
        <!-- Question Type + Grade Level Row -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Question Type -->
          <VeeField v-slot="{ handleChange, value }" name="type">
            <Field>
              <FieldLabel>Question Type</FieldLabel>
              <Select :model-value="value" :disabled="isSaving" @update:model-value="handleChange">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice (Single Answer)</SelectItem>
                  <SelectItem value="mrq">Multiple Response (Multiple Answers)</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </VeeField>

          <!-- Grade Level -->
          <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="gradeLevelId">
            <Field :data-invalid="!!fieldErrors.length">
              <FieldLabel> Grade Level <span class="text-destructive">*</span> </FieldLabel>
              <Select
                :model-value="value"
                :disabled="isSaving"
                @update:model-value="
                  (val) => {
                    handleChange(val)
                    setFieldValue('subjectId', '')
                    setFieldValue('topicId', '')
                  }
                "
              >
                <SelectTrigger
                  class="w-full"
                  :class="{ 'border-destructive': !!fieldErrors.length }"
                >
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
              <FieldError :errors="fieldErrors" />
            </Field>
          </VeeField>
        </div>

        <!-- Subject, Topic, Sub-Topic Row -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Subject -->
          <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="subjectId">
            <Field :data-invalid="!!fieldErrors.length">
              <FieldLabel> Subject <span class="text-destructive">*</span> </FieldLabel>
              <Select
                :model-value="value"
                :disabled="!values.gradeLevelId || isSaving"
                @update:model-value="
                  (val) => {
                    handleChange(val)
                    setFieldValue('topicId', '')
                    setFieldValue('subTopicId', '')
                  }
                "
              >
                <SelectTrigger
                  class="w-full"
                  :class="{ 'border-destructive': !!fieldErrors.length }"
                >
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
              <FieldError :errors="fieldErrors" />
            </Field>
          </VeeField>

          <!-- Topic -->
          <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="topicId">
            <Field :data-invalid="!!fieldErrors.length">
              <FieldLabel> Topic <span class="text-destructive">*</span> </FieldLabel>
              <Select
                :model-value="value"
                :disabled="!values.subjectId || isSaving"
                @update:model-value="
                  (val) => {
                    handleChange(val)
                    setFieldValue('subTopicId', '')
                  }
                "
              >
                <SelectTrigger
                  class="w-full"
                  :class="{ 'border-destructive': !!fieldErrors.length }"
                >
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="topic in availableTopics" :key="topic.id" :value="topic.id">
                    {{ topic.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError :errors="fieldErrors" />
            </Field>
          </VeeField>

          <!-- Sub-Topic -->
          <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="subTopicId">
            <Field :data-invalid="!!fieldErrors.length">
              <FieldLabel> Sub-Topic <span class="text-destructive">*</span> </FieldLabel>
              <Select
                :model-value="value"
                :disabled="!values.topicId || isSaving"
                @update:model-value="handleChange"
              >
                <SelectTrigger
                  class="w-full"
                  :class="{ 'border-destructive': !!fieldErrors.length }"
                >
                  <SelectValue placeholder="Select sub-topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="subTopic in availableSubTopics"
                    :key="subTopic.id"
                    :value="subTopic.id"
                  >
                    {{ subTopic.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError :errors="fieldErrors" />
            </Field>
          </VeeField>
        </div>

        <!-- Question -->
        <VeeField v-slot="{ value, handleChange, handleBlur, errors: fieldErrors }" name="question">
          <Field :data-invalid="!!fieldErrors.length">
            <FieldLabel> Question <span class="text-destructive">*</span> </FieldLabel>
            <Textarea
              :model-value="value"
              @update:model-value="handleChange"
              @blur="handleBlur"
              placeholder="Enter the question"
              rows="3"
              :disabled="isSaving"
              :aria-invalid="!!fieldErrors.length"
              :class="{ 'border-destructive': !!fieldErrors.length }"
            />
            <FieldError :errors="fieldErrors" />
          </Field>
        </VeeField>

        <!-- Question Image -->
        <Field>
          <FieldLabel>Question Image (Optional)</FieldLabel>
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
        </Field>

        <!-- MCQ/MRQ Options -->
        <div v-if="values.type === 'mcq' || values.type === 'mrq'" class="space-y-3">
          <Field :data-invalid="!!errors.options">
            <FieldLabel>
              Options <span class="text-destructive">*</span>
              <span class="ml-1 text-xs font-normal text-muted-foreground">
                ({{
                  values.type === 'mcq'
                    ? 'select the correct answer'
                    : 'select all correct answers'
                }})
              </span>
            </FieldLabel>
            <p class="text-xs text-muted-foreground">
              Each option can have text, an image, or both.
              {{ values.type === 'mrq' ? 'Click to toggle correct answers.' : '' }}
            </p>
            <FieldError v-if="errors.options" :errors="[errors.options]" />
          </Field>

          <div v-for="option in values.options" :key="option.id" class="space-y-2">
            <div class="flex items-start gap-2">
              <Button
                type="button"
                :variant="option.isCorrect ? 'default' : 'outline'"
                size="sm"
                class="mt-1 w-8 shrink-0"
                :disabled="isSaving"
                @click="
                  values.type === 'mcq'
                    ? setCorrectOption(option.id)
                    : toggleCorrectOption(option.id)
                "
              >
                {{ option.id.toUpperCase() }}
              </Button>
              <div class="flex-1 space-y-2">
                <Input
                  :model-value="option.text ?? ''"
                  :placeholder="`Option ${option.id.toUpperCase()} text`"
                  :disabled="isSaving"
                  @update:model-value="updateOptionText(option.id, $event as string)"
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
        <VeeField
          v-else-if="values.type === 'short_answer'"
          v-slot="{ value, handleChange, handleBlur, errors: fieldErrors }"
          name="answer"
        >
          <Field :data-invalid="!!fieldErrors.length">
            <FieldLabel> Answer <span class="text-destructive">*</span> </FieldLabel>
            <Input
              :model-value="value"
              @update:model-value="handleChange"
              @blur="handleBlur"
              placeholder="Enter the correct answer"
              :disabled="isSaving"
              :aria-invalid="!!fieldErrors.length"
              :class="{ 'border-destructive': !!fieldErrors.length }"
            />
            <FieldError :errors="fieldErrors" />
          </Field>
        </VeeField>

        <!-- Explanation -->
        <VeeField v-slot="{ value, handleChange, handleBlur }" name="explanation">
          <Field>
            <FieldLabel>Explanation</FieldLabel>
            <Textarea
              :model-value="value"
              @update:model-value="handleChange"
              @blur="handleBlur"
              placeholder="Explain the answer"
              rows="2"
              :disabled="isSaving"
            />
          </Field>
        </VeeField>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="handleCancel">
            Cancel
          </Button>
          <Button type="submit" :disabled="isSaving">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Add Question
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
