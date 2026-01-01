<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useFeedbackStore, type QuestionFeedback } from '@/stores/feedback'
import { useQuestionsStore, type Question } from '@/stores/questions'
import type { Database } from '@/types/database.types'
import { Search, Trash2, ArrowUpDown, Loader2, MoreHorizontal, Pencil } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'vue-sonner'
import { QuestionPreviewDialog, QuestionEditDialog } from '@/components/admin'

type FeedbackCategory = Database['public']['Enums']['feedback_category']

const feedbackStore = useFeedbackStore()
const questionsStore = useQuestionsStore()

const isDeleting = ref(false)
const showPreviewDialog = ref(false)
const showEditDialog = ref(false)
const previewQuestion = ref<Question | null>(null)
const previewFeedback = ref<QuestionFeedback | null>(null)
const editingQuestion = ref<Question | null>(null)

// Category config with colors
const categoryConfig: Record<FeedbackCategory, { label: string; color: string; bgColor: string }> =
  {
    question_error: { label: 'Question Error', color: 'text-red-700', bgColor: 'bg-red-100' },
    image_error: { label: 'Image Error', color: 'text-orange-700', bgColor: 'bg-orange-100' },
    option_error: { label: 'Option Error', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    answer_error: { label: 'Answer Error', color: 'text-red-700', bgColor: 'bg-red-100' },
    explanation_error: {
      label: 'Explanation Error',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
    },
    other: { label: 'Other', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  }

// Fetch feedbacks on mount (question text is already joined in the feedback query)
// Full question data is fetched on-demand when preview/edit is needed
onMounted(async () => {
  await feedbackStore.fetchFeedbacks()
})

// Filter feedbacks based on search
const filteredFeedbacks = computed(() => {
  const searchQuery = questionsStore.questionFeedbackFilters.search
  if (!searchQuery) return feedbackStore.feedbacks
  const query = searchQuery.toLowerCase()
  return feedbackStore.feedbacks.filter(
    (f) =>
      f.question.toLowerCase().includes(query) ||
      (f.comments?.toLowerCase().includes(query) ?? false) ||
      categoryConfig[f.category].label.toLowerCase().includes(query),
  )
})

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

// Delete Feedback Dialog
const showDeleteDialog = ref(false)
const deletingFeedback = ref<QuestionFeedback | null>(null)

function openDeleteDialog(feedback: QuestionFeedback, event: Event) {
  event.stopPropagation()
  deletingFeedback.value = feedback
  showDeleteDialog.value = true
}

const isLoadingQuestion = ref(false)

async function openEditDialog(feedback: QuestionFeedback, event: Event) {
  event.stopPropagation()
  isLoadingQuestion.value = true
  try {
    // Try cache first, then fetch on-demand
    let question = questionsStore.getQuestionById(feedback.questionId)
    if (!question) {
      await questionsStore.fetchQuestionById(feedback.questionId)
      question = questionsStore.getQuestionById(feedback.questionId)
    }
    if (question) {
      editingQuestion.value = question
      showEditDialog.value = true
    } else {
      toast.error('Question not found', {
        description: 'The question may have been deleted.',
      })
    }
  } finally {
    isLoadingQuestion.value = false
  }
}

async function handleEditSave() {
  // Save the question id before clearing state
  const questionId = editingQuestion.value?.id
  showEditDialog.value = false
  editingQuestion.value = null
  // Refresh only the edited question, not all questions
  if (questionId) {
    await questionsStore.fetchQuestionById(questionId)
  }
}

async function handleRowClick(feedback: QuestionFeedback) {
  isLoadingQuestion.value = true
  try {
    // Try cache first, then fetch on-demand
    let question = questionsStore.getQuestionById(feedback.questionId)
    if (!question) {
      await questionsStore.fetchQuestionById(feedback.questionId)
      question = questionsStore.getQuestionById(feedback.questionId)
    }
    if (question) {
      previewQuestion.value = question
      previewFeedback.value = feedback
      showPreviewDialog.value = true
    } else {
      toast.error('Question not found', {
        description: 'The question may have been deleted.',
      })
    }
  } finally {
    isLoadingQuestion.value = false
  }
}

async function confirmDelete() {
  if (!deletingFeedback.value) return

  isDeleting.value = true
  try {
    const result = await feedbackStore.deleteFeedback(deletingFeedback.value.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Feedback deleted successfully')
    }
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
    deletingFeedback.value = null
  }
}

// Column definitions
const columns: ColumnDef<QuestionFeedback>[] = [
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      return h(
        'div',
        {
          class: 'max-w-[20rem] lg:max-w-[30rem] truncate font-medium',
          title: row.original.question,
        },
        row.original.question,
      )
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const category = row.original.category
      const config = categoryConfig[category]
      return h(
        Badge,
        { variant: 'secondary', class: `${config.bgColor} ${config.color}` },
        () => config.label,
      )
    },
  },
  {
    accessorKey: 'comments',
    header: 'Comments',
    cell: ({ row }) => {
      return h('div', { class: 'max-w-[20rem] truncate text-sm' }, row.original.comments || '-')
    },
  },
  {
    accessorKey: 'reportedByName',
    header: 'Reported By',
    cell: ({ row }) => {
      return h('div', { class: 'text-sm' }, row.original.reportedByName || 'Unknown')
    },
  },
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
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const feedback = row.original
      return h(
        DropdownMenu,
        {},
        {
          default: () => [
            h(DropdownMenuTrigger, { asChild: true }, () =>
              h(
                Button,
                {
                  variant: 'ghost',
                  size: 'icon',
                  class: 'size-6',
                  onClick: (event: Event) => event.stopPropagation(),
                },
                () => h(MoreHorizontal, { class: 'size-4' }),
              ),
            ),
            h(DropdownMenuContent, { align: 'end' }, () => [
              h(
                DropdownMenuItem,
                {
                  onClick: (event: Event) => openEditDialog(feedback, event),
                },
                () => [h(Pencil, { class: 'mr-2 size-4' }), 'Edit Question'],
              ),
              h(
                DropdownMenuItem,
                {
                  class: 'text-destructive focus:text-destructive',
                  onClick: (event: Event) => openDeleteDialog(feedback, event),
                },
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

    <!-- Loading State -->
    <div v-if="feedbackStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Search Bar -->
      <div class="mb-4 flex items-center gap-2">
        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="questionsStore.questionFeedbackFilters.search"
            placeholder="Search feedback..."
            class="pl-9"
            @update:model-value="questionsStore.setQuestionFeedbackSearch(String($event))"
          />
        </div>
      </div>

      <!-- Data Table -->
      <DataTable
        :columns="columns"
        :data="filteredFeedbacks"
        :on-row-click="handleRowClick"
        :page-index="questionsStore.questionFeedbackPagination.pageIndex"
        :page-size="questionsStore.questionFeedbackPagination.pageSize"
        :on-page-index-change="questionsStore.setQuestionFeedbackPageIndex"
        :on-page-size-change="questionsStore.setQuestionFeedbackPageSize"
      />
    </template>

    <!-- Question Preview Dialog -->
    <QuestionPreviewDialog
      v-model:open="showPreviewDialog"
      :question="previewQuestion"
      :feedback="previewFeedback"
    />

    <!-- Edit Question Dialog -->
    <QuestionEditDialog
      v-model:open="showEditDialog"
      :question="editingQuestion"
      @save="handleEditSave"
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
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="isDeleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
