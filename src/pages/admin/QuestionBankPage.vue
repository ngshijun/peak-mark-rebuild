<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
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

const searchQuery = ref('')
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

// Filter state
const selectedGradeLevel = ref<string>(ALL_VALUE)
const selectedSubject = ref<string>(ALL_VALUE)
const selectedTopic = ref<string>(ALL_VALUE)
const selectedSubTopic = ref<string>(ALL_VALUE)

// Fetch questions on mount
onMounted(async () => {
  await questionsStore.fetchQuestions()
})

// Reset subject, topic, and sub-topic when grade level changes
watch(selectedGradeLevel, () => {
  selectedSubject.value = ALL_VALUE
  selectedTopic.value = ALL_VALUE
  selectedSubTopic.value = ALL_VALUE
})

// Reset topic and sub-topic when subject changes
watch(selectedSubject, () => {
  selectedTopic.value = ALL_VALUE
  selectedSubTopic.value = ALL_VALUE
})

// Reset sub-topic when topic changes
watch(selectedTopic, () => {
  selectedSubTopic.value = ALL_VALUE
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
const subTopicFilter = computed(() =>
  selectedSubTopic.value === ALL_VALUE ? undefined : selectedSubTopic.value,
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
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
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
      const variant = type === 'mcq' ? 'default' : type === 'mrq' ? 'default' : 'secondary'
      const label = type === 'mcq' ? 'MCQ' : type === 'mrq' ? 'MRQ' : 'Short Answer'
      return h(Badge, { variant }, () => label)
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

async function handleEditSave() {
  showEditDialog.value = false
  editingQuestion.value = null
  // Refresh questions list after edit
  await questionsStore.fetchQuestions()
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
  if (searchQuery.value) filters.push(`Search: "${searchQuery.value}"`)
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
      } catch {
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

        <!-- Sub-Topic Selector -->
        <Select v-model="selectedSubTopic" :disabled="selectedTopic === ALL_VALUE">
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
      <DataTable :columns="columns" :data="filteredQuestions" :on-row-click="handleRowClick" />
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
