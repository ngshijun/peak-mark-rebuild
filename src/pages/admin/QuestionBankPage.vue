<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useQuestionsStore } from '@/stores/questions'
import type { Question } from '@/types'
import { Search, Plus, Upload, MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QuestionEditDialog } from '@/components/admin'

const questionsStore = useQuestionsStore()

const ALL_VALUE = '__all__'

const searchQuery = ref('')
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedQuestion = ref<Question | null>(null)

// Filter state
const selectedGradeLevel = ref<string>(ALL_VALUE)
const selectedSubject = ref<string>(ALL_VALUE)
const selectedTopic = ref<string>(ALL_VALUE)

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
  return question.answer
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
      return h('div', { class: 'max-w-[200px] truncate text-muted-foreground' }, explanation)
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const question = row.original
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
              h(DropdownMenuItem, { onClick: () => openEditDialog(question) }, () => [
                h(Pencil, { class: 'mr-2 size-4' }),
                'Edit',
              ]),
              h(
                DropdownMenuItem,
                {
                  class: 'text-destructive focus:text-destructive',
                  onClick: () => openDeleteDialog(question),
                },
                () => [h(Trash2, { class: 'mr-2 size-4' }), 'Delete'],
              ),
            ]),
          ],
        },
      )
    },
  },
]

function openAddDialog() {
  selectedQuestion.value = null
  showAddDialog.value = true
}

function openEditDialog(question: Question) {
  selectedQuestion.value = question
  showEditDialog.value = true
}

function openDeleteDialog(question: Question) {
  selectedQuestion.value = question
  showDeleteDialog.value = true
}

function handleDelete() {
  if (selectedQuestion.value) {
    questionsStore.deleteQuestion(selectedQuestion.value.id)
  }
  showDeleteDialog.value = false
  selectedQuestion.value = null
}

function handleSave() {
  showAddDialog.value = false
  showEditDialog.value = false
  selectedQuestion.value = null
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

    <!-- Add Question Dialog -->
    <QuestionEditDialog
      v-model:open="showAddDialog"
      :question="null"
      mode="add"
      @save="handleSave"
    />

    <!-- Edit Question Dialog -->
    <QuestionEditDialog
      v-model:open="showEditDialog"
      :question="selectedQuestion"
      mode="edit"
      @save="handleSave"
    />

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
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="handleDelete">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
