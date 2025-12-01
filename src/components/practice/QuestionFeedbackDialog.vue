<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFeedbackStore } from '@/stores/feedback'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Database } from '@/types/database.types'

type FeedbackCategory = Database['public']['Enums']['feedback_category']

const props = defineProps<{
  questionId: string
}>()

const open = defineModel<boolean>('open', { required: true })

const feedbackStore = useFeedbackStore()
const authStore = useAuthStore()

const selectedCategory = ref<FeedbackCategory | ''>('')
const comments = ref('')
const isSubmitting = ref(false)

const feedbackCategories: { value: FeedbackCategory; label: string }[] = [
  { value: 'question_error', label: 'Question has an error' },
  { value: 'image_error', label: 'Image is incorrect or missing' },
  { value: 'option_error', label: 'Answer options are wrong' },
  { value: 'answer_error', label: 'Correct answer is wrong' },
  { value: 'explanation_error', label: 'Explanation is incorrect' },
]

const canSubmit = computed(() => selectedCategory.value !== '' && !isSubmitting.value)

function resetForm() {
  selectedCategory.value = ''
  comments.value = ''
}

async function handleSubmit() {
  if (!selectedCategory.value || !authStore.user?.id) return

  isSubmitting.value = true

  const result = await feedbackStore.submitFeedback(
    props.questionId,
    selectedCategory.value,
    comments.value,
    authStore.user.id,
  )

  isSubmitting.value = false

  if (result.error) {
    toast.error('Failed to submit feedback', {
      description: result.error,
    })
    return
  }

  toast.success('Feedback submitted', {
    description: 'Thank you for helping us improve!',
  })

  resetForm()
  open.value = false
}

function handleOpenChange(value: boolean) {
  if (!value) {
    resetForm()
  }
  open.value = value
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Report an Issue</DialogTitle>
        <DialogDescription>
          Let us know if there's something wrong with this question.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="category">Issue Type</Label>
          <Select v-model="selectedCategory">
            <SelectTrigger id="category">
              <SelectValue placeholder="Select an issue type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="category in feedbackCategories"
                :key="category.value"
                :value="category.value"
              >
                {{ category.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="comments">Additional Details (optional)</Label>
          <Textarea
            id="comments"
            v-model="comments"
            placeholder="Describe the issue in more detail..."
            rows="3"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button :disabled="!canSubmit" @click="handleSubmit">
          {{ isSubmitting ? 'Submitting...' : 'Submit Feedback' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
