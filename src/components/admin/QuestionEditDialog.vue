<script setup lang="ts">
import { watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore, type Question } from '@/stores/questions'
import { useQuestionForm } from '@/composables/useQuestionForm'
import { computeQuestionImageHash } from '@/lib/imageHash'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import QuestionFormFields from './QuestionFormFields.vue'

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

const form = useQuestionForm()

// Populate form when dialog opens with a question
watch(
  () => props.open,
  (open) => {
    if (open && props.question) {
      form.initializeEditForm(props.question)
    }
  },
)

const onSubmit = form.handleSubmit(async (formValues) => {
  if (!props.question) return

  form.isSaving.value = true

  try {
    const questionId = props.question.id

    // Get hierarchy info for grade_level_id and subject_id
    const hierarchy = curriculumStore.getSubTopicWithHierarchy(formValues.subTopicId)
    const gradeLevelId = hierarchy?.gradeLevel.id ?? formValues.gradeLevelId
    const subjectId = hierarchy?.subject.id ?? formValues.subjectId

    // Track image paths to update
    let questionImagePath: string | null = props.question.imagePath
    const optionImagePaths: Record<string, string | null> = {
      a: form.originalOptionImagePaths.value.a ?? null,
      b: form.originalOptionImagePaths.value.b ?? null,
      c: form.originalOptionImagePaths.value.c ?? null,
      d: form.originalOptionImagePaths.value.d ?? null,
    }

    // Handle question image changes
    if (form.questionImageFile.value) {
      if (form.originalImagePath.value) {
        await questionsStore.deleteQuestionImage(form.originalImagePath.value)
      }
      const uploadResult = await questionsStore.uploadQuestionImage(
        form.questionImageFile.value,
        questionId,
      )
      if (uploadResult.path) {
        questionImagePath = uploadResult.path
      } else {
        console.error('Failed to upload question image:', uploadResult.error)
      }
    } else if (form.questionImageRemoved.value && form.originalImagePath.value) {
      await questionsStore.deleteQuestionImage(form.originalImagePath.value)
      questionImagePath = null
    }

    // Handle option image changes (for MCQ/MRQ)
    if (formValues.type === 'mcq' || formValues.type === 'mrq') {
      for (const optionId of ['a', 'b', 'c', 'd'] as const) {
        const file = form.optionImageFiles.value[optionId]
        if (file) {
          if (form.originalOptionImagePaths.value[optionId]) {
            await questionsStore.deleteQuestionImage(form.originalOptionImagePaths.value[optionId]!)
          }
          const uploadResult = await questionsStore.uploadQuestionImage(file, questionId, optionId)
          if (uploadResult.path) {
            optionImagePaths[optionId] = uploadResult.path
          } else {
            console.error(`Failed to upload option ${optionId} image:`, uploadResult.error)
          }
        } else if (
          form.optionImagesRemoved.value[optionId] &&
          form.originalOptionImagePaths.value[optionId]
        ) {
          await questionsStore.deleteQuestionImage(form.originalOptionImagePaths.value[optionId]!)
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
      form.questionImageFile.value ||
      form.questionImageRemoved.value ||
      Object.values(form.optionImageFiles.value).some((f) => f !== null) ||
      Object.values(form.optionImagesRemoved.value).some((removed) => removed)

    if (imagesChanged) {
      const imageHash = await computeQuestionImageHash({
        questionImage: form.questionImageFile.value
          ? form.questionImageFile.value
          : form.questionImageRemoved.value
            ? null
            : questionImagePath
              ? questionsStore.getQuestionImageUrl(questionImagePath)
              : null,
        optionAImage: form.optionImageFiles.value.a
          ? form.optionImageFiles.value.a
          : form.optionImagesRemoved.value.a
            ? null
            : optionImagePaths.a
              ? questionsStore.getQuestionImageUrl(optionImagePaths.a)
              : null,
        optionBImage: form.optionImageFiles.value.b
          ? form.optionImageFiles.value.b
          : form.optionImagesRemoved.value.b
            ? null
            : optionImagePaths.b
              ? questionsStore.getQuestionImageUrl(optionImagePaths.b)
              : null,
        optionCImage: form.optionImageFiles.value.c
          ? form.optionImageFiles.value.c
          : form.optionImagesRemoved.value.c
            ? null
            : optionImagePaths.c
              ? questionsStore.getQuestionImageUrl(optionImagePaths.c)
              : null,
        optionDImage: form.optionImageFiles.value.d
          ? form.optionImageFiles.value.d
          : form.optionImagesRemoved.value.d
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
    form.isSaving.value = false
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Edit Question</DialogTitle>
        <DialogDescription>Update the question details.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4 py-4" @submit="onSubmit">
        <QuestionFormFields :form="form" :option-image-url-getter="form.getOptionImageUrl" />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="form.isSaving.value"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="form.isSaving.value">
            <Loader2 v-if="form.isSaving.value" class="mr-2 size-4 animate-spin" />
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
