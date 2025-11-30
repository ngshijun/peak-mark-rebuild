<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useFeedbackStore, type QuestionFeedback } from '@/stores/feedback'
import type { Database } from '@/types/database.types'
import { Search, Trash2, ArrowUpDown, Loader2 } from 'lucide-vue-next'
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
import { toast } from 'vue-sonner'

type FeedbackCategory = Database['public']['Enums']['feedback_category']

const feedbackStore = useFeedbackStore()

const searchQuery = ref('')
const isDeleting = ref(false)

// Fetch feedbacks on mount
onMounted(async () => {
  await feedbackStore.fetchFeedbacks()
})

// Filter feedbacks based on search
const filteredFeedbacks = computed(() => {
  if (!searchQuery.value) return feedbackStore.feedbacks
  const query = searchQuery.value.toLowerCase()
  return feedbackStore.feedbacks.filter(
    (f) =>
      f.question.toLowerCase().includes(query) ||
      (f.comments?.toLowerCase().includes(query) ?? false) ||
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

// Delete Feedback Dialog
const showDeleteDialog = ref(false)
const deletingFeedback = ref<QuestionFeedback | null>(null)

function openDeleteDialog(feedback: QuestionFeedback) {
  deletingFeedback.value = feedback
  showDeleteDialog.value = true
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
      return h('div', { class: 'max-w-[300px] truncate text-sm' }, row.original.comments || '-')
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
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const feedback = row.original
      return h(
        Button,
        {
          variant: 'ghost',
          size: 'icon',
          class: 'size-8 text-destructive hover:text-destructive',
          onClick: () => openDeleteDialog(feedback),
        },
        () => h(Trash2, { class: 'size-4' }),
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
          <Input v-model="searchQuery" placeholder="Search feedback..." class="pl-9" />
        </div>
      </div>

      <!-- Data Table -->
      <DataTable :columns="columns" :data="filteredFeedbacks" />
    </template>

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
          <AlertDialogAction :disabled="isDeleting" @click="confirmDelete">
            <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
