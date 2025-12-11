<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore, type MCQOption, type Question } from '@/stores/questions'
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
      type: z.enum(['mcq', 'short_answer']),
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
      if (data.type === 'mcq' && data.options) {
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

        if (!data.options.some((opt) => opt.isCorrect)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select the correct answer',
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
  question: Question | null
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

const { handleSubmit, values, setFieldValue, resetForm, errors, setFieldTouched, setValues } =
  useForm({
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

// Store actual File objects for upload (new images)
const questionImageFile = ref<File | null>(null)
const optionImageFiles = ref<Record<string, File | null>>({
  a: null,
  b: null,
  c: null,
  d: null,
})

// Track original image paths for cleanup
const originalImagePath = ref<string | null>(null)
const originalOptionImagePaths = ref<Record<string, string | null>>({
  a: null,
  b: null,
  c: null,
  d: null,
})

// Track if images were removed (to delete from storage)
const questionImageRemoved = ref(false)
const optionImagesRemoved = ref<Record<string, boolean>>({
  a: false,
  b: false,
  c: false,
  d: false,
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

// Watch for dialog open to populate form with question data
watch(
  () => props.open,
  (open) => {
    if (open && props.question) {
      const q = props.question

      // Store original image paths for cleanup
      originalImagePath.value = q.imagePath
      originalOptionImagePaths.value = {
        a: q.options.find((o) => o.id === 'a')?.imagePath ?? null,
        b: q.options.find((o) => o.id === 'b')?.imagePath ?? null,
        c: q.options.find((o) => o.id === 'c')?.imagePath ?? null,
        d: q.options.find((o) => o.id === 'd')?.imagePath ?? null,
      }

      // Reset removal tracking
      questionImageRemoved.value = false
      optionImagesRemoved.value = { a: false, b: false, c: false, d: false }

      // Set form values
      // q.subTopicId contains the sub-topic ID (topic_id column references sub_topics)
      // Get topic ID from hierarchy
      const hierarchy = curriculumStore.getSubTopicWithHierarchy(q.subTopicId)
      setValues({
        type: q.type,
        gradeLevelId: q.gradeLevelId ?? '',
        subjectId: q.subjectId ?? '',
        topicId: hierarchy?.topic.id ?? '',
        subTopicId: q.subTopicId,
        question: q.question,
        explanation: q.explanation ?? '',
        answer: q.answer ?? '',
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          imagePath: opt.imagePath,
          isCorrect: opt.isCorrect,
        })),
      })

      // Set question image URL for display
      if (q.imagePath) {
        formImageUrl.value = questionsStore.getQuestionImageUrl(q.imagePath)
      } else {
        formImageUrl.value = ''
      }

      // Clear file refs (these are for new uploads only)
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
  // Mark for deletion if there was an original image
  if (originalImagePath.value) {
    questionImageRemoved.value = true
  }
  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

function handleOptionImageUpload(event: Event, optionId: 'a' | 'b' | 'c' | 'd') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    optionImageFiles.value[optionId] = file
    // Reset removal flag since we're adding a new image
    optionImagesRemoved.value[optionId] = false
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
  // Mark for deletion if there was an original image
  if (originalOptionImagePaths.value[optionId]) {
    optionImagesRemoved.value[optionId] = true
  }
  const inputRef = optionImageInputRefs.value[optionId]
  if (inputRef) {
    inputRef.value = ''
  }
}

function setCorrectOption(optionId: string) {
  const options = (values.options || []).map((opt) => ({
    ...opt,
    isCorrect: opt.id === optionId,
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

// Helper to get display URL for option images
function getOptionImageUrl(optionId: 'a' | 'b' | 'c' | 'd'): string {
  const option = values.options?.find((o) => o.id === optionId)
  if (!option?.imagePath) return ''

  // If it's a data URL (newly uploaded), return as-is
  if (option.imagePath.startsWith('data:')) {
    return option.imagePath
  }

  // Otherwise, get the public URL from storage
  return questionsStore.getQuestionImageUrl(option.imagePath)
}

const onSubmit = handleSubmit(async (formValues) => {
  if (!props.question) return

  isSaving.value = true

  try {
    const questionId = props.question.id

    // Get hierarchy info for grade_level_id and subject_id
    const hierarchy = curriculumStore.getSubTopicWithHierarchy(formValues.subTopicId)
    const gradeLevelId = hierarchy?.gradeLevel.id ?? formValues.gradeLevelId
    const subjectId = hierarchy?.subject.id ?? formValues.subjectId

    // Track image paths to update
    let questionImagePath: string | null = props.question.imagePath
    const optionImagePaths: Record<string, string | null> = {
      a: originalOptionImagePaths.value.a ?? null,
      b: originalOptionImagePaths.value.b ?? null,
      c: originalOptionImagePaths.value.c ?? null,
      d: originalOptionImagePaths.value.d ?? null,
    }

    // Handle question image changes
    if (questionImageFile.value) {
      // Delete old image if exists
      if (originalImagePath.value) {
        await questionsStore.deleteQuestionImage(originalImagePath.value)
      }
      // Upload new image
      const uploadResult = await questionsStore.uploadQuestionImage(
        questionImageFile.value,
        questionId,
      )
      if (uploadResult.success && uploadResult.path) {
        questionImagePath = uploadResult.path
      } else {
        console.error('Failed to upload question image:', uploadResult.error)
      }
    } else if (questionImageRemoved.value && originalImagePath.value) {
      // Image was removed, delete from storage
      await questionsStore.deleteQuestionImage(originalImagePath.value)
      questionImagePath = null
    }

    // Handle option image changes (for MCQ)
    if (formValues.type === 'mcq') {
      for (const optionId of ['a', 'b', 'c', 'd'] as const) {
        const file = optionImageFiles.value[optionId]
        if (file) {
          // Delete old image if exists
          if (originalOptionImagePaths.value[optionId]) {
            await questionsStore.deleteQuestionImage(originalOptionImagePaths.value[optionId]!)
          }
          // Upload new image
          const uploadResult = await questionsStore.uploadQuestionImage(file, questionId, optionId)
          if (uploadResult.success && uploadResult.path) {
            optionImagePaths[optionId] = uploadResult.path
          } else {
            console.error(`Failed to upload option ${optionId} image:`, uploadResult.error)
          }
        } else if (
          optionImagesRemoved.value[optionId] &&
          originalOptionImagePaths.value[optionId]
        ) {
          // Image was removed, delete from storage
          await questionsStore.deleteQuestionImage(originalOptionImagePaths.value[optionId]!)
          optionImagePaths[optionId] = null
        }
      }
    }

    // Build update options with correct image paths
    const updateOptions =
      formValues.type === 'mcq'
        ? (formValues.options || []).map((opt) => ({
            id: opt.id,
            text: opt.text,
            imagePath: optionImagePaths[opt.id] ?? null,
            isCorrect: opt.isCorrect,
          }))
        : undefined

    // Update the question
    const result = await questionsStore.updateQuestion(questionId, {
      type: formValues.type,
      question: formValues.question,
      imagePath: questionImagePath,
      subTopicId: formValues.subTopicId,
      gradeLevelId,
      subjectId,
      explanation: formValues.explanation || null,
      answer: formValues.type === 'short_answer' ? formValues.answer || null : null,
      options: updateOptions,
    })

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Question updated successfully')

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
        <DialogTitle>Edit Question</DialogTitle>
        <DialogDescription>Update the question details.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4 py-4" @submit="onSubmit">
        <!-- Question Type -->
        <VeeField v-slot="{ handleChange, value }" name="type">
          <Field>
            <FieldLabel>Question Type</FieldLabel>
            <Select :model-value="value" :disabled="isSaving" @update:model-value="handleChange">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple Choice</SelectItem>
                <SelectItem value="short_answer">Short Answer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>

        <!-- Grade Level, Subject, Topic Row -->
        <div class="grid grid-cols-3 gap-4">
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

        <!-- MCQ Options -->
        <div v-if="values.type === 'mcq'" class="space-y-3">
          <Field :data-invalid="!!errors.options">
            <FieldLabel>
              Options <span class="text-destructive">*</span>
              <span class="ml-1 text-xs font-normal text-muted-foreground">
                (select the correct answer)
              </span>
            </FieldLabel>
            <p class="text-xs text-muted-foreground">
              Each option can have text, an image, or both.
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
                @click="setCorrectOption(option.id)"
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
                    :src="getOptionImageUrl(option.id)"
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
        <VeeField v-else v-slot="{ field, errors: fieldErrors }" name="answer">
          <Field :data-invalid="!!fieldErrors.length">
            <FieldLabel> Answer <span class="text-destructive">*</span> </FieldLabel>
            <Input
              v-bind="field"
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
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
