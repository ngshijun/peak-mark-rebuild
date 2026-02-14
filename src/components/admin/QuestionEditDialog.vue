<script setup lang="ts">
import { watch } from 'vue'
import { Field as VeeField } from 'vee-validate'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore, type Question } from '@/stores/questions'
import { useQuestionForm } from '@/composables/useQuestionForm'
import { computeQuestionImageHash } from '@/lib/imageHash'
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

const {
  handleSubmit,
  values,
  setFieldValue,
  errors,
  isSaving,
  availableSubjects,
  availableTopics,
  availableSubTopics,
  formImageUrl,
  imageInputRef,
  optionImageInputRefs,
  questionImageFile,
  optionImageFiles,
  handleImageUpload,
  removeImage,
  handleOptionImageUpload,
  removeOptionImage,
  setCorrectOption,
  toggleCorrectOption,
  updateOptionText,
  getOptionImageUrl,
  initializeEditForm,
  originalImagePath,
  originalOptionImagePaths,
  questionImageRemoved,
  optionImagesRemoved,
} = useQuestionForm()

// Populate form when dialog opens with a question
watch(
  () => props.open,
  (open) => {
    if (open && props.question) {
      initializeEditForm(props.question)
    }
  },
)

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

    // Handle option image changes (for MCQ/MRQ)
    if (formValues.type === 'mcq' || formValues.type === 'mrq') {
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

    // Build update options with correct image paths (for MCQ/MRQ)
    const updateOptions =
      formValues.type === 'mcq' || formValues.type === 'mrq'
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

    // Recompute image hash if any images were changed
    const imagesChanged =
      questionImageFile.value ||
      questionImageRemoved.value ||
      Object.values(optionImageFiles.value).some((f) => f !== null) ||
      Object.values(optionImagesRemoved.value).some((removed) => removed)

    if (imagesChanged) {
      // Compute hash using File objects for new images (fast), URLs for existing (parallel fetch)
      const imageHash = await computeQuestionImageHash({
        // Use File if new, URL if existing unchanged, null if removed
        questionImage: questionImageFile.value
          ? questionImageFile.value
          : questionImageRemoved.value
            ? null
            : questionImagePath
              ? questionsStore.getQuestionImageUrl(questionImagePath)
              : null,
        optionAImage: optionImageFiles.value.a
          ? optionImageFiles.value.a
          : optionImagesRemoved.value.a
            ? null
            : optionImagePaths.a
              ? questionsStore.getQuestionImageUrl(optionImagePaths.a)
              : null,
        optionBImage: optionImageFiles.value.b
          ? optionImageFiles.value.b
          : optionImagesRemoved.value.b
            ? null
            : optionImagePaths.b
              ? questionsStore.getQuestionImageUrl(optionImagePaths.b)
              : null,
        optionCImage: optionImageFiles.value.c
          ? optionImageFiles.value.c
          : optionImagesRemoved.value.c
            ? null
            : optionImagePaths.c
              ? questionsStore.getQuestionImageUrl(optionImagePaths.c)
              : null,
        optionDImage: optionImageFiles.value.d
          ? optionImageFiles.value.d
          : optionImagesRemoved.value.d
            ? null
            : optionImagePaths.d
              ? questionsStore.getQuestionImageUrl(optionImagePaths.d)
              : null,
      })

      await questionsStore.updateQuestion(questionId, { imageHash: imageHash || null })
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
                  <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                  <SelectItem value="mrq">Multiple Response (MRQ)</SelectItem>
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
                  values.type === 'mrq'
                    ? toggleCorrectOption(option.id)
                    : setCorrectOption(option.id)
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
        <VeeField
          v-if="values.type === 'short_answer'"
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
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
