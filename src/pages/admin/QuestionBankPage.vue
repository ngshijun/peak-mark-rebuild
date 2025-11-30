<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useQuestionsStore, type Question } from '@/stores/questions'
import { Search, Plus, Upload, Trash2, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
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
import { QuestionAddDialog } from '@/components/admin'
import { toast } from 'vue-sonner'

const questionsStore = useQuestionsStore()

const ALL_VALUE = '__all__'

const searchQuery = ref('')
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedQuestion = ref<Question | null>(null)
const isDeleting = ref(false)

// Filter state
const selectedGradeLevel = ref<string>(ALL_VALUE)
const selectedSubject = ref<string>(ALL_VALUE)
const selectedTopic = ref<string>(ALL_VALUE)

// Fetch questions on mount
onMounted(async () => {
  await questionsStore.fetchQuestions()
})

// Reset subject and topic when grade level changes
watch(selectedGradeLevel, () => {
  selectedSubject.value = ALL_VALUE
  selectedTopic.value = ALL_VALUE
})

// Reset topic when subject changes
watch(selectedSubject, () => {
  selectedTopic.value = ALL_VALUE
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  selectedGradeLevel.value === ALL_VALUE ? undefined : selectedGradeLevel.value,
)
const subjectFilter = computed(() =>
  selectedSubject.value === ALL_VALUE ? undefined : selectedSubject.value,
)
const topicFilter = computed(() =>
  selectedTopic.value === ALL_VALUE ? undefined : selectedTopic.value,
)

// Get available filter options
const availableGradeLevels = computed(() => questionsStore.getGradeLevels())
const availableSubjects = computed(() => questionsStore.getSubjects(gradeLevelFilter.value))
const availableTopics = computed(() =>
  questionsStore.getTopics(gradeLevelFilter.value, subjectFilter.value),
)

// Filter questions based on dropdown filters and search
const filteredQuestions = computed(() => {
  // First apply dropdown filters
  let filtered = questionsStore.getFilteredQuestions(
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
  )

  // Then apply search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (q) =>
        q.question.toLowerCase().includes(query) ||
        q.gradeLevelName.toLowerCase().includes(query) ||
        q.subjectName.toLowerCase().includes(query) ||
        q.topicName.toLowerCase().includes(query),
    )
  }

  return filtered
})

// Helper to get answer display
function getAnswerDisplay(question: Question): string {
  if (question.type === 'mcq') {
    const correctOption = question.options.find((o) => o.isCorrect)
    return correctOption?.text ?? 'N/A'
  }
  return question.answer ?? 'N/A'
}

// Column definitions
const columns: ColumnDef<Question>[] = [
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      const question = row.original.question
      return h('div', { class: 'max-w-[300px] truncate font-medium' }, question)
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.type
      return h(Badge, { variant: type === 'mcq' ? 'default' : 'secondary' }, () =>
        type === 'mcq' ? 'MCQ' : 'Short Answer',
      )
    },
  },
  {
    accessorKey: 'gradeLevelName',
    header: 'Grade Level',
  },
  {
    accessorKey: 'subjectName',
    header: 'Subject',
  },
  {
    accessorKey: 'topicName',
    header: 'Topic',
  },
  {
    id: 'answer',
    header: 'Answer',
    cell: ({ row }) => {
      const answer = getAnswerDisplay(row.original)
      return h('div', { class: 'max-w-[150px] truncate' }, answer)
    },
  },
  {
    accessorKey: 'explanation',
    header: 'Explanation',
    cell: ({ row }) => {
      const explanation = row.original.explanation
      return h('div', { class: 'max-w-[200px] truncate text-muted-foreground' }, explanation ?? '')
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const question = row.original
      return h(
        Button,
        {
          variant: 'ghost',
          size: 'icon',
          class: 'size-8 text-destructive hover:text-destructive',
          onClick: () => openDeleteDialog(question),
        },
        () => h(Trash2, { class: 'size-4' }),
      )
    },
  },
]

function openAddDialog() {
  selectedQuestion.value = null
  showAddDialog.value = true
}

function openDeleteDialog(question: Question) {
  selectedQuestion.value = question
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!selectedQuestion.value) return

  isDeleting.value = true
  try {
    const result = await questionsStore.deleteQuestion(selectedQuestion.value.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Question deleted successfully')
    showDeleteDialog.value = false
    selectedQuestion.value = null
    // Refresh questions list after delete
    await questionsStore.fetchQuestions()
  } finally {
    isDeleting.value = false
  }
}

async function handleSave() {
  showAddDialog.value = false
  selectedQuestion.value = null
  // Refresh questions list after add
  await questionsStore.fetchQuestions()
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Question Bank</h1>
        <p class="text-muted-foreground">Manage your question library.</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline">
          <Upload class="mr-2 size-4" />
          Bulk Upload
        </Button>
        <Button @click="openAddDialog">
          <Plus class="mr-2 size-4" />
          Add Question
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="questionsStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Filters Row -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <!-- Search Bar -->
        <div class="relative w-[250px]">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search questions..." class="pl-9" />
        </div>

        <!-- Grade Level Selector -->
        <Select v-model="selectedGradeLevel">
          <SelectTrigger class="w-[130px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Grades</SelectItem>
            <SelectItem v-for="grade in availableGradeLevels" :key="grade" :value="grade">
              {{ grade }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Subject Selector -->
        <Select v-model="selectedSubject" :disabled="selectedGradeLevel === ALL_VALUE">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Subjects</SelectItem>
            <SelectItem v-for="subject in availableSubjects" :key="subject" :value="subject">
              {{ subject }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Topic Selector -->
        <Select v-model="selectedTopic" :disabled="selectedSubject === ALL_VALUE">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All Topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Topics</SelectItem>
            <SelectItem v-for="topic in availableTopics" :key="topic" :value="topic">
              {{ topic }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Data Table -->
      <DataTable :columns="columns" :data="filteredQuestions" />

      <!-- Empty State -->
      <div
        v-if="filteredQuestions.length === 0 && !searchQuery"
        class="rounded-lg border border-dashed p-12 text-center"
      >
        <div class="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
          <Plus class="size-6 text-muted-foreground" />
        </div>
        <h3 class="mt-4 text-lg font-medium">No questions yet</h3>
        <p class="mt-2 text-sm text-muted-foreground">Get started by adding your first question.</p>
        <Button class="mt-4" @click="openAddDialog">
          <Plus class="mr-2 size-4" />
          Add Question
        </Button>
      </div>
    </template>

    <!-- Add Question Dialog -->
    <QuestionAddDialog v-model:open="showAddDialog" @save="handleSave" />

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Question</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this question? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedQuestion" class="py-4">
          <p class="text-sm text-muted-foreground">"{{ selectedQuestion.question }}"</p>
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="isDeleting" @click="showDeleteDialog = false"
            >Cancel</Button
          >
          <Button variant="destructive" :disabled="isDeleting" @click="handleDelete">
            <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
