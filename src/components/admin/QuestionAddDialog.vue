<script setup lang="ts">
import { watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { useQuestionsStore } from '@/stores/questions'
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
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: []
}>()

const curriculumStore = useCurriculumStore()
const questionsStore = useQuestionsStore()

const form = useQuestionForm()

// Reset form when dialog opens
watch(
  () => props.open,
  (open) => {
    if (open) {
      form.resetToBlank()
    }
  },
)

const onSubmit = form.handleSubmit(async (formValues) => {
  form.isSaving.value = true

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
    if (form.questionImage.value.file) {
      const uploadResult = await questionsStore.uploadQuestionImage(
        form.questionImage.value.file,
        questionId,
      )
      if (uploadResult.path) {
        questionImagePath = uploadResult.path
      } else {
        console.error('Failed to upload question image:', uploadResult.error)
      }
    }

    // Upload option images if present (for MCQ/MRQ)
    if (formValues.type === 'mcq' || formValues.type === 'mrq') {
      for (const optionId of ['a', 'b', 'c', 'd'] as const) {
        const file = form.optionImages.value[optionId].file
        if (file) {
          const uploadResult = await questionsStore.uploadQuestionImage(file, questionId, optionId)
          if (uploadResult.path) {
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
        questionImage: form.questionImage.value.file,
        optionAImage: form.optionImages.value.a.file,
        optionBImage: form.optionImages.value.b.file,
        optionCImage: form.optionImages.value.c.file,
        optionDImage: form.optionImages.value.d.file,
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
    form.isSaving.value = false
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add Question</DialogTitle>
        <DialogDescription>Create a new question for the question bank.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4 py-4" @submit="onSubmit">
        <QuestionFormFields :form="form" />

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
            Add Question
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
