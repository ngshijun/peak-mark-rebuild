<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useQuestionsStore, type Question } from '@/stores/questions'
import { useCurriculumStore } from '@/stores/curriculum'
import {
  Search,
  Plus,
  Upload,
  Trash2,
  Loader2,
  Download,
  FileDown,
  MoreHorizontal,
  Pencil,
} from 'lucide-vue-next'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  QuestionAddDialog,
  QuestionEditDialog,
  QuestionPreviewDialog,
  QuestionBulkUploadDialog,
} from '@/components/admin'
import { toast } from 'vue-sonner'
import { generateQuestionTemplate, exportQuestionsToExcel } from '@/lib/excel/questionExcel'

const questionsStore = useQuestionsStore()
const curriculumStore = useCurriculumStore()

const ALL_VALUE = '__all__'

const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showPreviewDialog = ref(false)
const showBulkUploadDialog = ref(false)
const showExportDialog = ref(false)
const selectedQuestion = ref<Question | null>(null)
const editingQuestion = ref<Question | null>(null)
const previewQuestion = ref<Question | null>(null)
const isDeleting = ref(false)
const isExporting = ref(false)

// Fetch questions on mount
onMounted(async () => {
  await questionsStore.fetchQuestions()
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  questionsStore.questionBankFilters.gradeLevel === ALL_VALUE
    ? undefined
    : questionsStore.questionBankFilters.gradeLevel,
)
const subjectFilter = computed(() =>
  questionsStore.questionBankFilters.subject === ALL_VALUE
    ? undefined
    : questionsStore.questionBankFilters.subject,
)
const topicFilter = computed(() =>
  questionsStore.questionBankFilters.topic === ALL_VALUE
    ? undefined
    : questionsStore.questionBankFilters.topic,
)
const subTopicFilter = computed(() =>
  questionsStore.questionBankFilters.subTopic === ALL_VALUE
    ? undefined
    : questionsStore.questionBankFilters.subTopic,
)

// Get available filter options
const availableGradeLevels = computed(() => questionsStore.getGradeLevels())
const availableSubjects = computed(() => questionsStore.getSubjects(gradeLevelFilter.value))
const availableTopics = computed(() =>
  questionsStore.getTopics(gradeLevelFilter.value, subjectFilter.value),
)
const availableSubTopics = computed(() =>
  questionsStore.getSubTopics(gradeLevelFilter.value, subjectFilter.value, topicFilter.value),
)

// Filter questions based on dropdown filters and search
const filteredQuestions = computed(() => {
  // First apply dropdown filters
  let filtered = questionsStore.getFilteredQuestions(
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    subTopicFilter.value,
  )

  // Then apply search query
  const searchQuery = questionsStore.questionBankFilters.search
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (q) =>
        q.question.toLowerCase().includes(query) ||
        q.gradeLevelName.toLowerCase().includes(query) ||
        q.subjectName.toLowerCase().includes(query) ||
        q.topicName.toLowerCase().includes(query) ||
        q.subTopicName.toLowerCase().includes(query),
    )
  }

  return filtered
})

// Column definitions
const columns: ColumnDef<Question>[] = [
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      const question = row.original.question
      return h(
        'div',
        { class: 'max-w-[20rem] lg:max-w-[40rem] truncate font-medium', title: question },
        question,
      )
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.type
      const config: Record<string, { label: string; color: string; bgColor: string }> = {
        mcq: {
          label: 'MCQ',
          color: 'text-blue-700 dark:text-blue-300',
          bgColor: 'bg-blue-100 dark:bg-blue-900/50',
        },
        mrq: {
          label: 'MRQ',
          color: 'text-purple-700 dark:text-purple-300',
          bgColor: 'bg-purple-100 dark:bg-purple-900/50',
        },
        short_answer: {
          label: 'Short Answer',
          color: 'text-green-700 dark:text-green-300',
          bgColor: 'bg-green-100 dark:bg-green-900/50',
        },
      }
      const typeConfig = config[type] ?? config.mcq
      return h(
        Badge,
        { variant: 'secondary', class: `${typeConfig!.bgColor} ${typeConfig!.color}` },
        () => typeConfig!.label,
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
    accessorKey: 'subTopicName',
    header: 'Sub-Topic',
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
                  onClick: (event: Event) => openEditDialog(question, event),
                },
                () => [h(Pencil, { class: 'mr-2 size-4' }), 'Edit'],
              ),
              h(
                DropdownMenuItem,
                {
                  class: 'text-destructive focus:text-destructive',
                  onClick: (event: Event) => openDeleteDialog(question, event),
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

function openEditDialog(question: Question, event: Event) {
  event.stopPropagation()
  editingQuestion.value = question
  showEditDialog.value = true
}

function openDeleteDialog(question: Question, event: Event) {
  event.stopPropagation()
  selectedQuestion.value = question
  showDeleteDialog.value = true
}

function handleRowClick(question: Question) {
  previewQuestion.value = question
  showPreviewDialog.value = true
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
    // Note: Store already removes from local array, no refetch needed
  } finally {
    isDeleting.value = false
  }
}

async function handleSave() {
  showAddDialog.value = false
  selectedQuestion.value = null
  // Note: Store already adds to local array, no refetch needed
}

async function handleEditSave() {
  showEditDialog.value = false
  editingQuestion.value = null
  // Note: Store already updates local array, no refetch needed
}

async function handleBulkUploadComplete() {
  // Refresh questions list after bulk upload
  await questionsStore.fetchQuestions()
  toast.success('Questions uploaded successfully')
}

async function downloadTemplate() {
  try {
    // Ensure curriculum is loaded
    if (curriculumStore.gradeLevels.length === 0) {
      await curriculumStore.fetchCurriculum()
    }
    await generateQuestionTemplate(curriculumStore.gradeLevels)
    toast.info('Template downloaded')
  } catch (error) {
    console.error('Error downloading template:', error)
    toast.error('Failed to download template')
  }
}

// Get export summary for confirmation dialog
const exportSummary = computed(() => {
  const filters: string[] = []
  if (gradeLevelFilter.value) filters.push(`Grade: ${gradeLevelFilter.value}`)
  if (subjectFilter.value) filters.push(`Subject: ${subjectFilter.value}`)
  if (topicFilter.value) filters.push(`Topic: ${topicFilter.value}`)
  if (subTopicFilter.value) filters.push(`Sub-Topic: ${subTopicFilter.value}`)
  if (questionsStore.questionBankFilters.search)
    filters.push(`Search: "${questionsStore.questionBankFilters.search}"`)
  return {
    filters: filters.length > 0 ? filters : ['All questions (no filters applied)'],
    count: filteredQuestions.value.length,
    isFiltered: filters.length > 0,
  }
})

function openExportDialog() {
  if (filteredQuestions.value.length === 0) {
    toast.warning('No questions to export')
    return
  }
  showExportDialog.value = true
}

async function confirmExport() {
  showExportDialog.value = false
  isExporting.value = true
  try {
    await exportQuestionsToExcel(filteredQuestions.value, async (imagePath: string) => {
      // Fetch image from Supabase storage and convert to base64
      try {
        const url = questionsStore.getQuestionImageUrl(imagePath)
        if (!url) return null

        const response = await fetch(url)
        if (!response.ok) return null

        const blob = await response.blob()
        return new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64 = reader.result as string
            // Remove data URL prefix to get just the base64 data
            const base64Data = base64.split(',')[1]
            resolve(base64Data || null)
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        console.error('Failed to convert image to base64:', err)
        return null
      }
    })
    toast.info(`Exported ${filteredQuestions.value.length} questions`)
  } catch (error) {
    console.error('Error exporting questions:', error)
    toast.error('Failed to export questions')
  } finally {
    isExporting.value = false
  }
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
        <Button variant="outline" :disabled="questionsStore.isLoading" @click="downloadTemplate">
          <Download class="mr-2 size-4" />
          Template
        </Button>
        <Button
          variant="outline"
          :disabled="questionsStore.isLoading || isExporting || filteredQuestions.length === 0"
          @click="openExportDialog"
        >
          <Loader2 v-if="isExporting" class="mr-2 size-4 animate-spin" />
          <FileDown v-else class="mr-2 size-4" />
          Export
        </Button>
        <Button
          variant="outline"
          :disabled="questionsStore.isLoading"
          @click="showBulkUploadDialog = true"
        >
          <Upload class="mr-2 size-4" />
          Bulk Upload
        </Button>
        <Button :disabled="questionsStore.isLoading" @click="openAddDialog">
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
          <Input
            :model-value="questionsStore.questionBankFilters.search"
            placeholder="Search questions..."
            class="pl-9"
            @update:model-value="questionsStore.setQuestionBankSearch(String($event))"
          />
        </div>

        <!-- Grade Level Selector -->
        <Select
          :model-value="questionsStore.questionBankFilters.gradeLevel"
          @update:model-value="questionsStore.setQuestionBankGradeLevel(String($event))"
        >
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
        <Select
          :model-value="questionsStore.questionBankFilters.subject"
          :disabled="questionsStore.questionBankFilters.gradeLevel === ALL_VALUE"
          @update:model-value="questionsStore.setQuestionBankSubject(String($event))"
        >
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
        <Select
          :model-value="questionsStore.questionBankFilters.topic"
          :disabled="questionsStore.questionBankFilters.subject === ALL_VALUE"
          @update:model-value="questionsStore.setQuestionBankTopic(String($event))"
        >
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

        <!-- Sub-Topic Selector -->
        <Select
          :model-value="questionsStore.questionBankFilters.subTopic"
          :disabled="questionsStore.questionBankFilters.topic === ALL_VALUE"
          @update:model-value="questionsStore.setQuestionBankSubTopic(String($event))"
        >
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All Sub-Topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_VALUE">All Sub-Topics</SelectItem>
            <SelectItem v-for="subTopic in availableSubTopics" :key="subTopic" :value="subTopic">
              {{ subTopic }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Data Table -->
      <DataTable
        :columns="columns"
        :data="filteredQuestions"
        :on-row-click="handleRowClick"
        :page-index="questionsStore.questionBankPagination.pageIndex"
        :page-size="questionsStore.questionBankPagination.pageSize"
        :on-page-index-change="questionsStore.setQuestionBankPageIndex"
        :on-page-size-change="questionsStore.setQuestionBankPageSize"
      />
    </template>

    <!-- Add Question Dialog -->
    <QuestionAddDialog v-model:open="showAddDialog" @save="handleSave" />

    <!-- Edit Question Dialog -->
    <QuestionEditDialog
      v-model:open="showEditDialog"
      :question="editingQuestion"
      @save="handleEditSave"
    />

    <!-- Question Preview Dialog -->
    <QuestionPreviewDialog v-model:open="showPreviewDialog" :question="previewQuestion" />

    <!-- Bulk Upload Dialog -->
    <QuestionBulkUploadDialog
      v-model:open="showBulkUploadDialog"
      @uploaded="handleBulkUploadComplete"
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

    <!-- Export Confirmation Dialog -->
    <Dialog v-model:open="showExportDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Questions</DialogTitle>
          <DialogDescription>
            You are about to export the following questions to an Excel file.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-4">
          <div class="rounded-lg border bg-muted/50 p-3">
            <p class="text-sm font-medium">Filters Applied:</p>
            <ul class="mt-1 list-inside list-disc text-sm text-muted-foreground">
              <li v-for="filter in exportSummary.filters" :key="filter">{{ filter }}</li>
            </ul>
          </div>
          <p class="text-sm">
            <span class="font-medium">{{ exportSummary.count }}</span> question(s) will be exported.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showExportDialog = false">Cancel</Button>
          <Button @click="confirmExport">
            <FileDown class="mr-2 size-4" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
