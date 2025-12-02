<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useCurriculumStore } from '@/stores/curriculum'
import {
  parseQuestionExcel,
  generateQuestionTemplate,
  type ParseResult,
} from '@/lib/excel/questionExcel'
import {
  validateQuestions,
  executeBulkUpload,
  type UploadValidationResult,
  type BulkUploadResult,
} from '@/lib/excel/questionBulkUpload'

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Download,
} from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  uploaded: []
}>()

const curriculumStore = useCurriculumStore()

// State
type Step = 'upload' | 'preview' | 'progress' | 'complete'
const step = ref<Step>('upload')
const file = ref<File | null>(null)
const isDragging = ref(false)
const parseResult = ref<ParseResult | null>(null)
const validationResult = ref<UploadValidationResult | null>(null)
const uploadProgress = ref(0)
const uploadTotal = ref(0)
const uploadResult = ref<BulkUploadResult | null>(null)
const isLoading = ref(false)

// Collapsible states
const parseErrorsOpen = ref(false)
const curriculumErrorsOpen = ref(false)
const duplicatesOpen = ref(false)
const withinFileDuplicatesOpen = ref(false)
const failedOpen = ref(false)

// Computed
const canUpload = computed(() => {
  return validationResult.value && validationResult.value.valid.length > 0
})

const totalErrors = computed(() => {
  return (
    (parseResult.value?.errors.length || 0) + (validationResult.value?.curriculumErrors.length || 0)
  )
})

// Methods
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const droppedFile = e.dataTransfer?.files[0]
  if (droppedFile?.name.endsWith('.xlsx')) {
    file.value = droppedFile
    processFile()
  } else {
    toast.error('Please upload an .xlsx file')
  }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const selectedFile = input.files?.[0]
  if (selectedFile) {
    file.value = selectedFile
    processFile()
  }
  // Reset input so same file can be selected again
  input.value = ''
}

async function processFile() {
  if (!file.value) return

  isLoading.value = true
  try {
    // Ensure curriculum is loaded
    if (curriculumStore.gradeLevels.length === 0) {
      await curriculumStore.fetchCurriculum()
    }

    // Parse Excel file
    parseResult.value = await parseQuestionExcel(file.value)

    if (parseResult.value.errors.length > 0 && parseResult.value.questions.length === 0) {
      toast.error('Failed to parse file. Please check the format.')
      isLoading.value = false
      return
    }

    // Validate questions
    validationResult.value = await validateQuestions(parseResult.value.questions)
    step.value = 'preview'
  } catch (error) {
    console.error('Error processing file:', error)
    toast.error(`Error processing file: ${error}`)
  } finally {
    isLoading.value = false
  }
}

async function executeUpload() {
  if (!validationResult.value) return

  step.value = 'progress'
  uploadTotal.value = validationResult.value.valid.length
  uploadProgress.value = 0

  try {
    uploadResult.value = await executeBulkUpload({
      questions: validationResult.value.valid,
      onProgress: (current) => {
        uploadProgress.value = current
      },
    })

    step.value = 'complete'
    emit('uploaded')
  } catch (error) {
    console.error('Upload failed:', error)
    toast.error(`Upload failed: ${error}`)
    step.value = 'preview'
  }
}

function reset() {
  step.value = 'upload'
  file.value = null
  parseResult.value = null
  validationResult.value = null
  uploadProgress.value = 0
  uploadTotal.value = 0
  uploadResult.value = null
  parseErrorsOpen.value = false
  curriculumErrorsOpen.value = false
  duplicatesOpen.value = false
  withinFileDuplicatesOpen.value = false
  failedOpen.value = false
}

function close() {
  emit('update:open', false)
  setTimeout(reset, 300)
}

async function downloadTemplate() {
  try {
    // Ensure curriculum is loaded
    if (curriculumStore.gradeLevels.length === 0) {
      await curriculumStore.fetchCurriculum()
    }
    await generateQuestionTemplate(curriculumStore.gradeLevels)
    toast.success('Template downloaded')
  } catch (error) {
    console.error('Error downloading template:', error)
    toast.error('Failed to download template')
  }
}

const progressPercent = computed(() => {
  if (uploadTotal.value === 0) return 0
  return Math.round((uploadProgress.value / uploadTotal.value) * 100)
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Bulk Upload Questions</DialogTitle>
        <DialogDescription> Upload multiple questions from an Excel file </DialogDescription>
      </DialogHeader>

      <!-- Step 1: Upload -->
      <div v-if="step === 'upload'" class="space-y-4">
        <!-- Drop zone -->
        <div
          class="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors"
          :class="
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          "
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="($refs.fileInput as HTMLInputElement)?.click()"
        >
          <Upload class="mx-auto mb-4 size-10 text-muted-foreground" />
          <p class="mb-2 text-sm text-muted-foreground">
            Drag and drop your Excel file here, or click to select
          </p>
          <p class="text-xs text-muted-foreground/70">Supports .xlsx files only</p>
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx"
            class="hidden"
            @change="handleFileSelect"
          />
        </div>

        <!-- Download template button -->
        <div class="flex justify-center">
          <Button variant="link" size="sm" @click="downloadTemplate">
            <Download class="mr-2 size-4" />
            Download Template
          </Button>
        </div>

        <!-- Loading state -->
        <div v-if="isLoading" class="flex items-center justify-center gap-2 py-4">
          <Loader2 class="size-5 animate-spin" />
          <span class="text-sm text-muted-foreground">Processing file...</span>
        </div>
      </div>

      <!-- Step 2: Preview -->
      <div v-else-if="step === 'preview'" class="space-y-4">
        <!-- File name -->
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet class="size-4" />
          <span>{{ file?.name }}</span>
        </div>

        <!-- Summary cards -->
        <div class="grid grid-cols-3 gap-3">
          <div
            class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/20"
          >
            <div class="flex items-center gap-2 text-green-600">
              <CheckCircle2 class="size-5" />
              <span class="text-2xl font-bold">{{ validationResult?.valid.length || 0 }}</span>
            </div>
            <p class="text-sm text-green-600/80">Ready to upload</p>
          </div>
          <div
            class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950/20"
          >
            <div class="flex items-center gap-2 text-yellow-600">
              <AlertTriangle class="size-5" />
              <span class="text-2xl font-bold">{{ validationResult?.duplicates.length || 0 }}</span>
            </div>
            <p class="text-sm text-yellow-600/80">Duplicates (skipped)</p>
          </div>
          <div
            class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20"
          >
            <div class="flex items-center gap-2 text-red-600">
              <XCircle class="size-5" />
              <span class="text-2xl font-bold">{{ totalErrors }}</span>
            </div>
            <p class="text-sm text-red-600/80">Errors</p>
          </div>
        </div>

        <!-- Parse Errors -->
        <Collapsible
          v-if="parseResult?.errors.length"
          v-model:open="parseErrorsOpen"
          class="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10"
        >
          <CollapsibleTrigger
            class="flex w-full items-center justify-between p-3 text-sm font-medium text-red-600"
          >
            <span>Parse Errors ({{ parseResult.errors.length }})</span>
            <component :is="parseErrorsOpen ? ChevronDown : ChevronRight" class="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent class="px-3 pb-3">
            <div class="max-h-32 space-y-1 overflow-y-auto">
              <div
                v-for="err in parseResult.errors"
                :key="`${err.row}-${err.column}`"
                class="rounded bg-red-100 p-2 text-xs dark:bg-red-900/30"
              >
                Row {{ err.row }}, Column {{ err.column }}: {{ err.message }}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Curriculum Errors -->
        <Collapsible
          v-if="validationResult?.curriculumErrors.length"
          v-model:open="curriculumErrorsOpen"
          class="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10"
        >
          <CollapsibleTrigger
            class="flex w-full items-center justify-between p-3 text-sm font-medium text-red-600"
          >
            <span>Curriculum Errors ({{ validationResult.curriculumErrors.length }})</span>
            <component :is="curriculumErrorsOpen ? ChevronDown : ChevronRight" class="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent class="px-3 pb-3">
            <div class="max-h-32 space-y-1 overflow-y-auto">
              <div
                v-for="err in validationResult.curriculumErrors"
                :key="err.row"
                class="rounded bg-red-100 p-2 text-xs dark:bg-red-900/30"
              >
                Row {{ err.row }}: {{ err.errors.join(', ') }}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Duplicates -->
        <Collapsible
          v-if="validationResult?.duplicates.length"
          v-model:open="duplicatesOpen"
          class="rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/10"
        >
          <CollapsibleTrigger
            class="flex w-full items-center justify-between p-3 text-sm font-medium text-yellow-600"
          >
            <span>Duplicates in Database ({{ validationResult.duplicates.length }})</span>
            <component :is="duplicatesOpen ? ChevronDown : ChevronRight" class="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent class="px-3 pb-3">
            <div class="max-h-32 space-y-1 overflow-y-auto">
              <div
                v-for="dup in validationResult.duplicates"
                :key="dup.row"
                class="rounded bg-yellow-100 p-2 text-xs dark:bg-yellow-900/30"
              >
                Row {{ dup.row }}: "{{ dup.question }}"
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Within-file duplicates -->
        <Alert
          v-if="validationResult?.withinFileDuplicates.length"
          class="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20"
        >
          <AlertTriangle class="size-4 text-yellow-600" />
          <AlertDescription class="text-yellow-700 dark:text-yellow-300">
            {{ validationResult.withinFileDuplicates.length }} duplicate(s) found within the file.
            Only the first occurrence of each will be uploaded.
          </AlertDescription>
        </Alert>

        <!-- Actions -->
        <div class="flex justify-between pt-2">
          <Button variant="outline" @click="reset"> Back </Button>
          <Button @click="executeUpload" :disabled="!canUpload">
            Upload {{ validationResult?.valid.length || 0 }} Questions
          </Button>
        </div>
      </div>

      <!-- Step 3: Progress -->
      <div v-else-if="step === 'progress'" class="space-y-6 py-8">
        <div class="text-center">
          <Loader2 class="mx-auto mb-4 size-10 animate-spin text-primary" />
          <p class="text-lg font-medium">Uploading Questions</p>
          <p class="text-sm text-muted-foreground">
            {{ uploadProgress }} of {{ uploadTotal }} complete
          </p>
        </div>
        <Progress :model-value="progressPercent" class="h-2" />
        <p class="text-center text-xs text-muted-foreground">
          Please don't close this dialog while uploading...
        </p>
      </div>

      <!-- Step 4: Complete -->
      <div v-else-if="step === 'complete'" class="space-y-4 py-6">
        <div class="text-center">
          <CheckCircle2 class="mx-auto mb-4 size-14 text-green-600" />
          <p class="text-xl font-medium">Upload Complete!</p>
        </div>

        <div class="grid grid-cols-2 gap-4 text-center">
          <div class="rounded-lg bg-green-50 p-4 dark:bg-green-950/20">
            <p class="text-3xl font-bold text-green-600">{{ uploadResult?.success || 0 }}</p>
            <p class="text-sm text-muted-foreground">Questions Created</p>
          </div>
          <div class="rounded-lg bg-red-50 p-4 dark:bg-red-950/20">
            <p class="text-3xl font-bold text-red-600">{{ uploadResult?.failed.length || 0 }}</p>
            <p class="text-sm text-muted-foreground">Failed</p>
          </div>
        </div>

        <!-- Failed items -->
        <Collapsible
          v-if="uploadResult?.failed.length"
          v-model:open="failedOpen"
          class="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10"
        >
          <CollapsibleTrigger
            class="flex w-full items-center justify-between p-3 text-sm font-medium text-red-600"
          >
            <span>Failed Items ({{ uploadResult.failed.length }})</span>
            <component :is="failedOpen ? ChevronDown : ChevronRight" class="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent class="px-3 pb-3">
            <div class="max-h-32 space-y-1 overflow-y-auto">
              <div
                v-for="fail in uploadResult.failed"
                :key="fail.row"
                class="rounded bg-red-100 p-2 text-xs dark:bg-red-900/30"
              >
                Row {{ fail.row }}: {{ fail.error }}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div class="flex justify-center pt-2">
          <Button @click="close">Done</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
