<script setup lang="ts">
import { ref, computed, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useFeedbackStore } from '@/stores/feedback'
import { useQuestionsStore } from '@/stores/questions'
import type { QuestionFeedback, FeedbackCategory, Question } from '@/types'
import { Search, MoreHorizontal, Pencil, Trash2, ArrowUpDown } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { QuestionEditDialog } from '@/components/admin'

const feedbackStore = useFeedbackStore()
const questionsStore = useQuestionsStore()

const searchQuery = ref('')

// Filter feedbacks based on search
const filteredFeedbacks = computed(() => {
  if (!searchQuery.value) return feedbackStore.feedbacks
  const query = searchQuery.value.toLowerCase()
  return feedbackStore.feedbacks.filter(
    (f) =>
      f.question.toLowerCase().includes(query) ||
      f.comments.toLowerCase().includes(query) ||
      getCategoryLabel(f.category).toLowerCase().includes(query),
  )
})

// Category labels and colors
function getCategoryLabel(category: FeedbackCategory): string {
  const labels: Record<FeedbackCategory, string> = {
    question_error: 'Question Error',
    image_error: 'Image Error',
    option_error: 'Option Error',
    answer_error: 'Answer Error',
    explanation_error: 'Explanation Error',
    other: 'Other',
  }
  return labels[category]
}

function getCategoryVariant(
  category: FeedbackCategory,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<FeedbackCategory, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    question_error: 'destructive',
    image_error: 'secondary',
    option_error: 'default',
    answer_error: 'destructive',
    explanation_error: 'secondary',
    other: 'outline',
  }
  return variants[category]
}

// Format date display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Edit Question Dialog
const showEditDialog = ref(false)
const editingQuestion = ref<Question | null>(null)

function openEditDialog(feedback: QuestionFeedback) {
  const question = questionsStore.getQuestionById(feedback.questionId)
  if (question) {
    editingQuestion.value = question
    showEditDialog.value = true
  }
}

function handleSave() {
  showEditDialog.value = false
  editingQuestion.value = null
}

// Delete Feedback Dialog
const showDeleteDialog = ref(false)
const deletingFeedback = ref<QuestionFeedback | null>(null)

function openDeleteDialog(feedback: QuestionFeedback) {
  deletingFeedback.value = feedback
  showDeleteDialog.value = true
}

function confirmDelete() {
  if (deletingFeedback.value) {
    feedbackStore.deleteFeedback(deletingFeedback.value.id)
  }
  showDeleteDialog.value = false
  deletingFeedback.value = null
}

// Column definitions
const columns: ColumnDef<QuestionFeedback>[] = [
  {
    accessorKey: 'reportedAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Time Reported', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-sm text-muted-foreground' },
        formatDate(row.original.reportedAt),
      )
    },
  },
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      return h('div', { class: 'max-w-[200px] truncate font-medium' }, row.original.question)
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const category = row.original.category
      return h(Badge, { variant: getCategoryVariant(category) }, () => getCategoryLabel(category))
    },
  },
  {
    accessorKey: 'comments',
    header: 'Comments',
    cell: ({ row }) => {
      return h('div', { class: 'text-sm whitespace-nowrap' }, row.original.comments)
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const feedback = row.original
      return h(
        DropdownMenu,
        {},
        {
          default: () => [
            h(DropdownMenuTrigger, { asChild: true }, () =>
              h(Button, { variant: 'ghost', class: 'size-4 p-0' }, () =>
                h(MoreHorizontal, { class: 'size-4' }),
              ),
            ),
            h(DropdownMenuContent, { align: 'end' }, () => [
              h(DropdownMenuItem, { onClick: () => openEditDialog(feedback) }, () => [
                h(Pencil, { class: 'mr-2 size-4' }),
                'Edit Question',
              ]),
              h(
                DropdownMenuItem,
                { class: 'text-destructive', onClick: () => openDeleteDialog(feedback) },
                () => [h(Trash2, { class: 'mr-2 size-4' }), 'Delete Feedback'],
              ),
            ]),
          ],
        },
      )
    },
  },
]
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Question Feedback</h1>
      <p class="text-muted-foreground">Review and manage feedback reports from users.</p>
    </div>

    <!-- Search Bar -->
    <div class="mb-4 flex items-center gap-2">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search feedback..." class="pl-9" />
      </div>
    </div>

    <!-- Data Table -->
    <DataTable :columns="columns" :data="filteredFeedbacks" />

    <!-- Edit Question Dialog -->
    <QuestionEditDialog
      v-model:open="showEditDialog"
      :question="editingQuestion"
      mode="edit"
      title="Edit Question"
      description="Make changes to the question based on the feedback."
      @save="handleSave"
    />

    <!-- Delete Feedback Confirmation -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this feedback? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
