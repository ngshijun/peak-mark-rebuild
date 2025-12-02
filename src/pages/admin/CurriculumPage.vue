<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useCurriculumStore, type Subject, type Topic } from '@/stores/curriculum'
import { addCurriculumItemFormSchema } from '@/lib/validations'
import { Plus, Trash2, ImagePlus, Loader2, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'vue-sonner'

const curriculumStore = useCurriculumStore()

// Add item form
const { handleSubmit: handleAddSubmit, resetForm: resetAddForm } = useForm({
  validationSchema: addCurriculumItemFormSchema,
  initialValues: {
    name: '',
  },
})

// Navigation state
const selectedGradeLevelId = ref<string | null>(null)
const selectedSubjectId = ref<string | null>(null)

// Loading states
const isSaving = ref(false)
const isDeleting = ref(false)

// Computed for navigation
const selectedGradeLevel = computed(() => {
  if (!selectedGradeLevelId.value) return null
  return curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevelId.value) ?? null
})

const selectedSubject = computed(() => {
  if (!selectedGradeLevel.value || !selectedSubjectId.value) return null
  return selectedGradeLevel.value.subjects.find((s) => s.id === selectedSubjectId.value) ?? null
})

// Computed for dynamic add button
const currentAddType = computed<'grade' | 'subject' | 'topic'>(() => {
  if (!selectedGradeLevel.value) return 'grade'
  if (!selectedSubject.value) return 'subject'
  return 'topic'
})

const addButtonLabel = computed(() => {
  switch (currentAddType.value) {
    case 'grade':
      return 'Add Grade Level'
    case 'subject':
      return 'Add Subject'
    case 'topic':
      return 'Add Topic'
  }
})

// Dialog state
const showAddDialog = ref(false)
const addType = ref<'grade' | 'subject' | 'topic'>('grade')
const newItemCoverImagePreview = ref('')
const newItemCoverImageFile = ref<File | null>(null)
const dialogGradeLevelId = ref('')
const dialogSubjectId = ref('')
const addImageInputRef = ref<HTMLInputElement | null>(null)

// Edit cover image dialog
const showEditImageDialog = ref(false)
const editImageType = ref<'subject' | 'topic'>('subject')
const editImagePreview = ref('')
const editImageFile = ref<File | null>(null)
const editImageGradeLevelId = ref('')
const editImageSubjectId = ref('')
const editImageTopicId = ref('')
const editImageItemName = ref('')
const editImageInputRef = ref<HTMLInputElement | null>(null)

// Delete confirmation dialog
const showDeleteDialog = ref(false)
const deleteType = ref<'grade' | 'subject' | 'topic'>('grade')
const deleteItemName = ref('')
const deleteGradeLevelId = ref('')
const deleteSubjectId = ref('')
const deleteTopicId = ref('')

// Default images
const defaultSubjectImage =
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'
const defaultTopicImage =
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=300&fit=crop'

// Subject images mapping (fallback)
const subjectImages: Record<string, string> = {
  Mathematics: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
  Science: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=300&fit=crop',
  English: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
  Chinese: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  History: 'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop',
  Geography: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop',
}

// Topic images mapping (fallback)
const topicImages: Record<string, string> = {
  Addition: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
  Subtraction: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop',
  Multiplication:
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
  Division: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400&h=300&fit=crop',
  Fractions: 'https://images.unsplash.com/photo-1632571401005-458e9d244591?w=400&h=300&fit=crop',
  Geometry: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=400&h=300&fit=crop',
  Counting: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
  Shapes: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=400&h=300&fit=crop',
  Plants: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
  Animals: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&h=300&fit=crop',
  Weather: 'https://images.unsplash.com/photo-1504253163759-c23fccaebb55?w=400&h=300&fit=crop',
  Matter: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=300&fit=crop',
  Energy: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
  Alphabet: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  Phonics: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  Grammar: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  Vocabulary: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
  Reading: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop',
  Writing: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop',
  Spelling: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  Pinyin: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  Characters: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  'Local History':
    'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop',
  'Famous People':
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop',
  Maps: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop',
  Continents: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
  Countries: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&h=300&fit=crop',
}

function getSubjectImage(subject: Subject): string {
  // If there's a stored image path, get the public URL
  if (subject.coverImagePath) {
    // Check if it's a full URL or a storage path
    if (subject.coverImagePath.startsWith('http')) {
      return subject.coverImagePath
    }
    return curriculumStore.getCurriculumImageUrl(subject.coverImagePath)
  }
  return subjectImages[subject.name] || defaultSubjectImage
}

function getTopicImage(topic: Topic): string {
  // If there's a stored image path, get the public URL
  if (topic.coverImagePath) {
    // Check if it's a full URL or a storage path
    if (topic.coverImagePath.startsWith('http')) {
      return topic.coverImagePath
    }
    return curriculumStore.getCurriculumImageUrl(topic.coverImagePath)
  }
  return topicImages[topic.name] || defaultTopicImage
}

// Fetch curriculum on mount
onMounted(async () => {
  await curriculumStore.fetchCurriculum()
})

// Navigation functions
function selectGradeLevel(gradeLevelId: string) {
  selectedGradeLevelId.value = gradeLevelId
  selectedSubjectId.value = null
}

function selectSubject(subjectId: string) {
  selectedSubjectId.value = subjectId
}

function goBackToGradeLevels() {
  selectedGradeLevelId.value = null
  selectedSubjectId.value = null
}

function goBackToSubjects() {
  selectedSubjectId.value = null
}

// Dialog functions
function openAddDialog(
  type: 'grade' | 'subject' | 'topic',
  gradeLevelId?: string,
  subjectId?: string,
) {
  addType.value = type
  resetAddForm()
  newItemCoverImagePreview.value = ''
  newItemCoverImageFile.value = null
  dialogGradeLevelId.value = gradeLevelId ?? selectedGradeLevelId.value ?? ''
  dialogSubjectId.value = subjectId ?? selectedSubjectId.value ?? ''
  showAddDialog.value = true
}

function handleAddImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    newItemCoverImageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      newItemCoverImagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeAddImage() {
  newItemCoverImagePreview.value = ''
  newItemCoverImageFile.value = null
  if (addImageInputRef.value) {
    addImageInputRef.value.value = ''
  }
}

const handleAdd = handleAddSubmit(async (values) => {
  isSaving.value = true

  try {
    let itemId: string | undefined

    if (addType.value === 'grade') {
      const result = await curriculumStore.addGradeLevel(values.name.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Grade level added successfully')
    } else if (addType.value === 'subject' && dialogGradeLevelId.value) {
      // First create the subject without image
      const result = await curriculumStore.addSubject(dialogGradeLevelId.value, values.name.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      itemId = result.id

      // Upload image if provided
      if (newItemCoverImageFile.value && itemId) {
        const uploadResult = await curriculumStore.uploadCurriculumImage(
          newItemCoverImageFile.value,
          'subject',
          itemId,
        )
        if (uploadResult.success && uploadResult.path) {
          await curriculumStore.updateSubjectCoverImage(
            dialogGradeLevelId.value,
            itemId,
            uploadResult.path,
          )
        }
      }
      toast.success('Subject added successfully')
    } else if (addType.value === 'topic' && dialogGradeLevelId.value && dialogSubjectId.value) {
      // First create the topic without image
      const result = await curriculumStore.addTopic(
        dialogGradeLevelId.value,
        dialogSubjectId.value,
        values.name.trim(),
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      itemId = result.id

      // Upload image if provided
      if (newItemCoverImageFile.value && itemId) {
        const uploadResult = await curriculumStore.uploadCurriculumImage(
          newItemCoverImageFile.value,
          'topic',
          itemId,
        )
        if (uploadResult.success && uploadResult.path) {
          await curriculumStore.updateTopicCoverImage(
            dialogGradeLevelId.value,
            dialogSubjectId.value,
            itemId,
            uploadResult.path,
          )
        }
      }
      toast.success('Topic added successfully')
    }

    showAddDialog.value = false
    resetAddForm()
    newItemCoverImagePreview.value = ''
    newItemCoverImageFile.value = null
  } finally {
    isSaving.value = false
  }
})

function openEditImageDialog(
  type: 'subject' | 'topic',
  gradeLevelId: string,
  subjectId: string,
  itemName: string,
  currentImage: string,
  topicId?: string,
) {
  editImageType.value = type
  editImageGradeLevelId.value = gradeLevelId
  editImageSubjectId.value = subjectId
  editImageTopicId.value = topicId ?? ''
  editImageItemName.value = itemName
  editImagePreview.value = currentImage
  editImageFile.value = null
  showEditImageDialog.value = true
}

function handleEditImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    editImageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      editImagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

async function handleEditImage() {
  if (!editImageFile.value) {
    showEditImageDialog.value = false
    return
  }

  isSaving.value = true

  try {
    const itemId =
      editImageType.value === 'subject' ? editImageSubjectId.value : editImageTopicId.value

    // Upload the image
    const uploadResult = await curriculumStore.uploadCurriculumImage(
      editImageFile.value,
      editImageType.value,
      itemId,
    )

    if (!uploadResult.success || !uploadResult.path) {
      toast.error(uploadResult.error ?? 'Failed to upload image')
      return
    }

    // Update the cover image path
    if (editImageType.value === 'subject') {
      const result = await curriculumStore.updateSubjectCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        uploadResult.path,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
    } else if (editImageType.value === 'topic') {
      const result = await curriculumStore.updateTopicCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        editImageTopicId.value,
        uploadResult.path,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
    }

    toast.success('Cover image updated successfully')
    showEditImageDialog.value = false
    editImagePreview.value = ''
    editImageFile.value = null
  } finally {
    isSaving.value = false
  }
}

// Delete dialog functions
function openDeleteDialog(
  type: 'grade' | 'subject' | 'topic',
  itemName: string,
  gradeLevelId: string,
  subjectId?: string,
  topicId?: string,
) {
  deleteType.value = type
  deleteItemName.value = itemName
  deleteGradeLevelId.value = gradeLevelId
  deleteSubjectId.value = subjectId ?? ''
  deleteTopicId.value = topicId ?? ''
  showDeleteDialog.value = true
}

function getDeleteDialogDescription() {
  switch (deleteType.value) {
    case 'grade':
      return 'This will permanently delete this grade level and all its subjects and topics. This action cannot be undone.'
    case 'subject':
      return 'This will permanently delete this subject and all its topics. This action cannot be undone.'
    case 'topic':
      return 'This will permanently delete this topic. This action cannot be undone.'
  }
}

async function confirmDelete() {
  isDeleting.value = true
  try {
    let result: { error: string | null }

    switch (deleteType.value) {
      case 'grade':
        result = await curriculumStore.deleteGradeLevel(deleteGradeLevelId.value)
        if (!result.error) {
          toast.success('Grade level deleted successfully')
        }
        break
      case 'subject':
        result = await curriculumStore.deleteSubject(
          deleteGradeLevelId.value,
          deleteSubjectId.value,
        )
        if (!result.error) {
          if (selectedSubjectId.value === deleteSubjectId.value) {
            selectedSubjectId.value = null
          }
          toast.success('Subject deleted successfully')
        }
        break
      case 'topic':
        result = await curriculumStore.deleteTopic(
          deleteGradeLevelId.value,
          deleteSubjectId.value,
          deleteTopicId.value,
        )
        if (!result.error) {
          toast.success('Topic deleted successfully')
        }
        break
    }

    if (result.error) {
      toast.error(result.error)
    }
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
  }
}

function getDialogTitle() {
  switch (addType.value) {
    case 'grade':
      return 'Add Grade Level'
    case 'subject':
      return 'Add Subject'
    case 'topic':
      return 'Add Topic'
  }
}

function getDialogDescription() {
  switch (addType.value) {
    case 'grade':
      return 'Add a new grade level to the curriculum.'
    case 'subject':
      return 'Add a new subject with an optional cover image.'
    case 'topic':
      return 'Add a new topic with an optional cover image.'
  }
}

function getInputLabel() {
  switch (addType.value) {
    case 'grade':
      return 'Grade Level Name'
    case 'subject':
      return 'Subject Name'
    case 'topic':
      return 'Topic Name'
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Curriculum</h1>
        <p class="text-muted-foreground">Manage grade levels, subjects, and topics</p>
        <!-- Breadcrumb Navigation -->
        <Breadcrumb class="mt-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink v-if="selectedGradeLevel" as-child>
                <button @click="goBackToGradeLevels">Grade Levels</button>
              </BreadcrumbLink>
              <BreadcrumbPage v-else>Grade Levels</BreadcrumbPage>
            </BreadcrumbItem>
            <template v-if="selectedGradeLevel">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink v-if="selectedSubject" as-child>
                  <button @click="goBackToSubjects">{{ selectedGradeLevel.name }}</button>
                </BreadcrumbLink>
                <BreadcrumbPage v-else>{{ selectedGradeLevel.name }}</BreadcrumbPage>
              </BreadcrumbItem>
            </template>
            <template v-if="selectedSubject">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{{ selectedSubject.name }}</BreadcrumbPage>
              </BreadcrumbItem>
            </template>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <!-- Dynamic Add Button -->
      <Button :disabled="curriculumStore.isLoading" @click="openAddDialog(currentAddType)">
        <Plus class="mr-2 size-4" />
        {{ addButtonLabel }}
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="curriculumStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Grade Level Selection (Level 1) -->
    <div v-else-if="!selectedGradeLevel">
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="grade in curriculumStore.gradeLevels"
          :key="grade.id"
          class="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
          @click="selectGradeLevel(grade.id)"
        >
          <div
            class="aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5"
          >
            <div class="flex size-full items-center justify-center">
              <span class="text-6xl font-bold text-primary/30">{{
                grade.name.replace(/\D/g, '') || '?'
              }}</span>
            </div>
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ grade.name }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ grade.subjects.length }} {{ grade.subjects.length === 1 ? 'subject' : 'subjects' }}
            </p>
          </CardContent>
          <!-- Delete button -->
          <Button
            variant="destructive"
            size="icon"
            class="absolute right-2 top-2 size-8 opacity-0 transition-opacity group-hover:opacity-100"
            :disabled="isDeleting"
            @click.stop="openDeleteDialog('grade', grade.name, grade.id)"
          >
            <Trash2 class="size-4" />
          </Button>
        </Card>
      </div>

      <div
        v-if="curriculumStore.gradeLevels.length === 0"
        class="rounded-lg border border-dashed p-12 text-center"
      >
        <div class="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
          <Plus class="size-6 text-muted-foreground" />
        </div>
        <h3 class="mt-4 text-lg font-medium">No grade levels yet</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          Get started by adding your first grade level.
        </p>
        <Button class="mt-4" @click="openAddDialog('grade')">
          <Plus class="mr-2 size-4" />
          Add Grade Level
        </Button>
      </div>
    </div>

    <!-- Subject Selection (Level 2) -->
    <div v-else-if="!selectedSubject">
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="subject in selectedGradeLevel.subjects"
          :key="subject.id"
          class="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
          @click="selectSubject(subject.id)"
        >
          <div class="aspect-video w-full overflow-hidden">
            <img
              :src="getSubjectImage(subject)"
              :alt="subject.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ subject.name }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ subject.topics.length }} {{ subject.topics.length === 1 ? 'topic' : 'topics' }}
            </p>
          </CardContent>
          <!-- Action buttons -->
          <div
            class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Button
              variant="secondary"
              size="icon"
              class="size-8"
              @click.stop="
                openEditImageDialog(
                  'subject',
                  selectedGradeLevel.id,
                  subject.id,
                  subject.name,
                  getSubjectImage(subject),
                )
              "
            >
              <ImagePlus class="size-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              class="size-8"
              :disabled="isDeleting"
              @click.stop="
                openDeleteDialog('subject', subject.name, selectedGradeLevel.id, subject.id)
              "
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </Card>
      </div>

      <div
        v-if="selectedGradeLevel.subjects.length === 0"
        class="rounded-lg border border-dashed p-12 text-center"
      >
        <div class="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
          <Plus class="size-6 text-muted-foreground" />
        </div>
        <h3 class="mt-4 text-lg font-medium">No subjects yet</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          Add subjects to {{ selectedGradeLevel.name }}.
        </p>
        <Button class="mt-4" @click="openAddDialog('subject')">
          <Plus class="mr-2 size-4" />
          Add Subject
        </Button>
      </div>
    </div>

    <!-- Topic Selection (Level 3) -->
    <div v-else>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="topic in selectedSubject.topics"
          :key="topic.id"
          class="group relative overflow-hidden transition-shadow hover:shadow-lg"
        >
          <div class="aspect-video w-full overflow-hidden">
            <img
              :src="getTopicImage(topic)"
              :alt="topic.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ topic.name }}</h3>
            <p class="text-sm text-muted-foreground">Topic</p>
          </CardContent>
          <!-- Action buttons -->
          <div
            class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Button
              variant="secondary"
              size="icon"
              class="size-8"
              @click.stop="
                openEditImageDialog(
                  'topic',
                  selectedGradeLevel.id,
                  selectedSubject.id,
                  topic.name,
                  getTopicImage(topic),
                  topic.id,
                )
              "
            >
              <ImagePlus class="size-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              class="size-8"
              :disabled="isDeleting"
              @click.stop="
                openDeleteDialog(
                  'topic',
                  topic.name,
                  selectedGradeLevel.id,
                  selectedSubject.id,
                  topic.id,
                )
              "
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </Card>
      </div>

      <div
        v-if="selectedSubject.topics.length === 0"
        class="rounded-lg border border-dashed p-12 text-center"
      >
        <div class="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
          <Plus class="size-6 text-muted-foreground" />
        </div>
        <h3 class="mt-4 text-lg font-medium">No topics yet</h3>
        <p class="mt-2 text-sm text-muted-foreground">Add topics to {{ selectedSubject.name }}.</p>
        <Button class="mt-4" @click="openAddDialog('topic')">
          <Plus class="mr-2 size-4" />
          Add Topic
        </Button>
      </div>
    </div>

    <!-- Add Dialog -->
    <Dialog v-model:open="showAddDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ getDialogTitle() }}</DialogTitle>
          <DialogDescription>{{ getDialogDescription() }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4 py-4" @submit="handleAdd">
          <!-- Grade Level Select (for subject when not in context) -->
          <div v-if="addType === 'subject' && !dialogGradeLevelId" class="space-y-2">
            <FieldLabel>Grade Level</FieldLabel>
            <Select v-model="dialogGradeLevelId">
              <SelectTrigger>
                <SelectValue placeholder="Select a grade level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="grade in curriculumStore.gradeLevels"
                  :key="grade.id"
                  :value="grade.id"
                >
                  {{ grade.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Subject Select (for topic when not in context) -->
          <div
            v-if="addType === 'topic' && dialogGradeLevelId && !dialogSubjectId"
            class="space-y-2"
          >
            <FieldLabel>Subject</FieldLabel>
            <Select v-model="dialogSubjectId">
              <SelectTrigger>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="subject in curriculumStore.gradeLevels.find(
                    (g) => g.id === dialogGradeLevelId,
                  )?.subjects ?? []"
                  :key="subject.id"
                  :value="subject.id"
                >
                  {{ subject.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Name Input -->
          <VeeField v-slot="{ field, errors }" name="name">
            <Field :data-invalid="!!errors.length">
              <FieldLabel :for="addType + '-name'">{{ getInputLabel() }}</FieldLabel>
              <Input
                :id="addType + '-name'"
                :placeholder="'Enter ' + getInputLabel().toLowerCase()"
                :disabled="isSaving"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <!-- Cover Image (for subject/topic) -->
          <div v-if="addType !== 'grade'" class="space-y-2">
            <FieldLabel>Cover Image (optional)</FieldLabel>
            <div v-if="newItemCoverImagePreview" class="relative">
              <div class="aspect-video w-full overflow-hidden rounded-lg border">
                <img
                  :src="newItemCoverImagePreview"
                  alt="Cover image preview"
                  class="size-full object-cover"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                class="absolute -right-2 -top-2 size-6"
                :disabled="isSaving"
                @click="removeAddImage"
              >
                <X class="size-4" />
              </Button>
            </div>
            <div v-else>
              <input
                ref="addImageInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAddImageSelect"
              />
              <Button
                type="button"
                variant="outline"
                class="w-full"
                :disabled="isSaving"
                @click="addImageInputRef?.click()"
              >
                <ImagePlus class="mr-2 size-4" />
                Add Cover Image
              </Button>
              <p class="mt-1 text-xs text-muted-foreground">Leave empty to use a default image.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="showAddDialog = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isSaving">
              <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Edit Image Dialog -->
    <Dialog v-model:open="showEditImageDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Cover Image</DialogTitle>
          <DialogDescription>
            Update the cover image for "{{ editImageItemName }}"
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Preview -->
          <div class="aspect-video w-full overflow-hidden rounded-lg border">
            <img
              :src="editImagePreview || defaultSubjectImage"
              :alt="editImageItemName"
              class="size-full object-cover"
            />
          </div>

          <!-- Upload Button -->
          <div>
            <input
              ref="editImageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleEditImageSelect"
            />
            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="isSaving"
              @click="editImageInputRef?.click()"
            >
              <ImagePlus class="mr-2 size-4" />
              {{ editImageFile ? 'Change Image' : 'Select New Image' }}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showEditImageDialog = false"
            >Cancel</Button
          >
          <Button @click="handleEditImage" :disabled="!editImageFile || isSaving">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{{ deleteItemName }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {{ getDeleteDialogDescription() }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
