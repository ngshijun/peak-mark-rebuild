<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useCurriculumStore, type Subject, type Topic, type SubTopic } from '@/stores/curriculum'
import { addCurriculumItemFormSchema } from '@/lib/validations'
import { Plus, Trash2, ImagePlus, Loader2, X, Pencil } from 'lucide-vue-next'
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

// Navigation state (from store for persistence)
const selectedGradeLevelId = computed({
  get: () => curriculumStore.adminCurriculumNavigation.selectedGradeLevelId,
  set: (val) => curriculumStore.setAdminCurriculumGradeLevel(val),
})
const selectedSubjectId = computed({
  get: () => curriculumStore.adminCurriculumNavigation.selectedSubjectId,
  set: (val) => curriculumStore.setAdminCurriculumSubject(val),
})
const selectedTopicId = computed({
  get: () => curriculumStore.adminCurriculumNavigation.selectedTopicId,
  set: (val) => curriculumStore.setAdminCurriculumTopic(val),
})

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

const selectedTopic = computed(() => {
  if (!selectedSubject.value || !selectedTopicId.value) return null
  return selectedSubject.value.topics.find((t) => t.id === selectedTopicId.value) ?? null
})

// Computed for dynamic add button
const currentAddType = computed<'grade' | 'subject' | 'topic' | 'subtopic'>(() => {
  if (!selectedGradeLevel.value) return 'grade'
  if (!selectedSubject.value) return 'subject'
  if (!selectedTopic.value) return 'topic'
  return 'subtopic'
})

const addButtonLabel = computed(() => {
  switch (currentAddType.value) {
    case 'grade':
      return 'Add Grade Level'
    case 'subject':
      return 'Add Subject'
    case 'topic':
      return 'Add Topic'
    case 'subtopic':
      return 'Add Sub-Topic'
  }
})

// Dialog state
const showAddDialog = ref(false)
const addType = ref<'grade' | 'subject' | 'topic' | 'subtopic'>('grade')
const newItemCoverImagePreview = ref('')
const newItemCoverImageFile = ref<File | null>(null)
const dialogGradeLevelId = ref('')
const dialogSubjectId = ref('')
const dialogTopicId = ref('')
const addImageInputRef = ref<HTMLInputElement | null>(null)

// Edit cover image dialog
const showEditImageDialog = ref(false)
const editImageType = ref<'subject' | 'topic' | 'subtopic'>('subject')
const editImagePreview = ref('')
const editImageFile = ref<File | null>(null)
const editImageGradeLevelId = ref('')
const editImageSubjectId = ref('')
const editImageTopicId = ref('')
const editImageSubTopicId = ref('')
const editImageItemName = ref('')
const editImageInputRef = ref<HTMLInputElement | null>(null)
const editImageHasCustomImage = ref(false)

// Delete confirmation dialog
const showDeleteDialog = ref(false)
const deleteType = ref<'grade' | 'subject' | 'topic' | 'subtopic'>('grade')
const deleteItemName = ref('')
const deleteGradeLevelId = ref('')
const deleteSubjectId = ref('')
const deleteTopicId = ref('')
const deleteSubTopicId = ref('')

// Edit name dialog
const showEditNameDialog = ref(false)
const editNameType = ref<'grade' | 'subject' | 'topic' | 'subtopic'>('grade')
const editNameValue = ref('')
const editNameGradeLevelId = ref('')
const editNameSubjectId = ref('')
const editNameTopicId = ref('')
const editNameSubTopicId = ref('')
const editNameCurrentName = ref('')

function getImageUrl(coverImagePath: string | null): string {
  if (!coverImagePath) return ''
  if (coverImagePath.startsWith('http')) {
    return coverImagePath
  }
  return curriculumStore.getOptimizedImageUrl(coverImagePath)
}

// Fetch curriculum on mount
onMounted(async () => {
  await curriculumStore.fetchCurriculum()
})

// Navigation functions
function selectGradeLevel(gradeLevelId: string) {
  selectedGradeLevelId.value = gradeLevelId
  selectedSubjectId.value = null
  selectedTopicId.value = null
}

function selectSubject(subjectId: string) {
  selectedSubjectId.value = subjectId
  selectedTopicId.value = null
}

function selectTopic(topicId: string) {
  selectedTopicId.value = topicId
}

function goBackToGradeLevels() {
  selectedGradeLevelId.value = null
  selectedSubjectId.value = null
  selectedTopicId.value = null
}

function goBackToSubjects() {
  selectedSubjectId.value = null
  selectedTopicId.value = null
}

function goBackToTopics() {
  selectedTopicId.value = null
}

// Dialog functions
function openAddDialog(
  type: 'grade' | 'subject' | 'topic' | 'subtopic',
  gradeLevelId?: string,
  subjectId?: string,
  topicId?: string,
) {
  addType.value = type
  resetAddForm()
  newItemCoverImagePreview.value = ''
  newItemCoverImageFile.value = null
  dialogGradeLevelId.value = gradeLevelId ?? selectedGradeLevelId.value ?? ''
  dialogSubjectId.value = subjectId ?? selectedSubjectId.value ?? ''
  dialogTopicId.value = topicId ?? selectedTopicId.value ?? ''
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
    } else if (
      addType.value === 'subtopic' &&
      dialogGradeLevelId.value &&
      dialogSubjectId.value &&
      dialogTopicId.value
    ) {
      // First create the sub-topic without image
      const result = await curriculumStore.addSubTopic(
        dialogGradeLevelId.value,
        dialogSubjectId.value,
        dialogTopicId.value,
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
          'subtopic',
          itemId,
        )
        if (uploadResult.success && uploadResult.path) {
          await curriculumStore.updateSubTopicCoverImage(
            dialogGradeLevelId.value,
            dialogSubjectId.value,
            dialogTopicId.value,
            itemId,
            uploadResult.path,
          )
        }
      }
      toast.success('Sub-topic added successfully')
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
  type: 'subject' | 'topic' | 'subtopic',
  gradeLevelId: string,
  subjectId: string,
  itemName: string,
  currentImage: string,
  hasCustomImage: boolean,
  topicId?: string,
  subTopicId?: string,
) {
  editImageType.value = type
  editImageGradeLevelId.value = gradeLevelId
  editImageSubjectId.value = subjectId
  editImageTopicId.value = topicId ?? ''
  editImageSubTopicId.value = subTopicId ?? ''
  editImageItemName.value = itemName
  editImagePreview.value = currentImage
  editImageFile.value = null
  editImageHasCustomImage.value = hasCustomImage
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
    let itemId: string
    if (editImageType.value === 'subject') {
      itemId = editImageSubjectId.value
    } else if (editImageType.value === 'topic') {
      itemId = editImageTopicId.value
    } else {
      itemId = editImageSubTopicId.value
    }

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
    } else if (editImageType.value === 'subtopic') {
      const result = await curriculumStore.updateSubTopicCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        editImageTopicId.value,
        editImageSubTopicId.value,
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

async function handleRemoveImage() {
  isSaving.value = true

  try {
    let result: { success: boolean; error: string | null }

    if (editImageType.value === 'subject') {
      result = await curriculumStore.updateSubjectCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        null,
      )
    } else if (editImageType.value === 'topic') {
      result = await curriculumStore.updateTopicCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        editImageTopicId.value,
        null,
      )
    } else {
      result = await curriculumStore.updateSubTopicCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        editImageTopicId.value,
        editImageSubTopicId.value,
        null,
      )
    }

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Cover image removed successfully')
    showEditImageDialog.value = false
    editImagePreview.value = ''
    editImageFile.value = null
    editImageHasCustomImage.value = false
  } finally {
    isSaving.value = false
  }
}

// Delete dialog functions
function openDeleteDialog(
  type: 'grade' | 'subject' | 'topic' | 'subtopic',
  itemName: string,
  gradeLevelId: string,
  subjectId?: string,
  topicId?: string,
  subTopicId?: string,
) {
  deleteType.value = type
  deleteItemName.value = itemName
  deleteGradeLevelId.value = gradeLevelId
  deleteSubjectId.value = subjectId ?? ''
  deleteTopicId.value = topicId ?? ''
  deleteSubTopicId.value = subTopicId ?? ''
  showDeleteDialog.value = true
}

function getDeleteDialogDescription() {
  switch (deleteType.value) {
    case 'grade':
      return 'This will permanently delete this grade level and all its subjects, topics, and sub-topics. This action cannot be undone.'
    case 'subject':
      return 'This will permanently delete this subject and all its topics and sub-topics. This action cannot be undone.'
    case 'topic':
      return 'This will permanently delete this topic and all its sub-topics. This action cannot be undone.'
    case 'subtopic':
      return 'This will permanently delete this sub-topic. This action cannot be undone.'
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
            selectedTopicId.value = null
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
          if (selectedTopicId.value === deleteTopicId.value) {
            selectedTopicId.value = null
          }
          toast.success('Topic deleted successfully')
        }
        break
      case 'subtopic':
        result = await curriculumStore.deleteSubTopic(
          deleteGradeLevelId.value,
          deleteSubjectId.value,
          deleteTopicId.value,
          deleteSubTopicId.value,
        )
        if (!result.error) {
          toast.success('Sub-topic deleted successfully')
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
    case 'subtopic':
      return 'Add Sub-Topic'
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
    case 'subtopic':
      return 'Add a new sub-topic with an optional cover image.'
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
    case 'subtopic':
      return 'Sub-Topic Name'
  }
}

// Edit name dialog functions
function openEditNameDialog(
  type: 'grade' | 'subject' | 'topic' | 'subtopic',
  currentName: string,
  gradeLevelId: string,
  subjectId?: string,
  topicId?: string,
  subTopicId?: string,
) {
  editNameType.value = type
  editNameValue.value = currentName
  editNameCurrentName.value = currentName
  editNameGradeLevelId.value = gradeLevelId
  editNameSubjectId.value = subjectId ?? ''
  editNameTopicId.value = topicId ?? ''
  editNameSubTopicId.value = subTopicId ?? ''
  showEditNameDialog.value = true
}

function getEditNameDialogTitle() {
  switch (editNameType.value) {
    case 'grade':
      return 'Edit Grade Level Name'
    case 'subject':
      return 'Edit Subject Name'
    case 'topic':
      return 'Edit Topic Name'
    case 'subtopic':
      return 'Edit Sub-Topic Name'
  }
}

function getEditNameInputLabel() {
  switch (editNameType.value) {
    case 'grade':
      return 'Grade Level Name'
    case 'subject':
      return 'Subject Name'
    case 'topic':
      return 'Topic Name'
    case 'subtopic':
      return 'Sub-Topic Name'
  }
}

async function handleEditName() {
  const trimmedName = editNameValue.value.trim()
  if (!trimmedName) {
    toast.error('Name cannot be empty')
    return
  }

  if (trimmedName === editNameCurrentName.value) {
    showEditNameDialog.value = false
    return
  }

  isSaving.value = true

  try {
    let result: { success: boolean; error: string | null }

    switch (editNameType.value) {
      case 'grade':
        result = await curriculumStore.updateGradeLevel(editNameGradeLevelId.value, trimmedName)
        break
      case 'subject':
        result = await curriculumStore.updateSubject(
          editNameGradeLevelId.value,
          editNameSubjectId.value,
          { name: trimmedName },
        )
        break
      case 'topic':
        result = await curriculumStore.updateTopic(
          editNameGradeLevelId.value,
          editNameSubjectId.value,
          editNameTopicId.value,
          { name: trimmedName },
        )
        break
      case 'subtopic':
        result = await curriculumStore.updateSubTopic(
          editNameGradeLevelId.value,
          editNameSubjectId.value,
          editNameTopicId.value,
          editNameSubTopicId.value,
          { name: trimmedName },
        )
        break
    }

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Name updated successfully')
      showEditNameDialog.value = false
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Curriculum</h1>
        <p class="text-muted-foreground">Manage grade levels, subjects, topics, and sub-topics</p>
      </div>
      <!-- Dynamic Add Button -->
      <Button :disabled="curriculumStore.isLoading" @click="openAddDialog(currentAddType)">
        <Plus class="mr-2 size-4" />
        {{ addButtonLabel }}
      </Button>
    </div>

    <!-- Breadcrumb Navigation -->
    <Breadcrumb class="mb-4">
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
            <BreadcrumbLink v-if="selectedTopic" as-child>
              <button @click="goBackToTopics">{{ selectedSubject.name }}</button>
            </BreadcrumbLink>
            <BreadcrumbPage v-else>{{ selectedSubject.name }}</BreadcrumbPage>
          </BreadcrumbItem>
        </template>
        <template v-if="selectedTopic">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{{ selectedTopic.name }}</BreadcrumbPage>
          </BreadcrumbItem>
        </template>
      </BreadcrumbList>
    </Breadcrumb>

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
          class="group relative cursor-pointer transition-shadow hover:shadow-lg"
          @click="selectGradeLevel(grade.id)"
        >
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ grade.name }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ grade.subjects.length }} {{ grade.subjects.length === 1 ? 'subject' : 'subjects' }}
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
              @click.stop="openEditNameDialog('grade', grade.name, grade.id)"
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              class="size-8"
              :disabled="isDeleting"
              @click.stop="openDeleteDialog('grade', grade.name, grade.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
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
          <div v-if="subject.coverImagePath" class="aspect-video w-full overflow-hidden">
            <img
              :src="getImageUrl(subject.coverImagePath)"
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
                openEditNameDialog('subject', subject.name, selectedGradeLevel.id, subject.id)
              "
            >
              <Pencil class="size-4" />
            </Button>
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
                  getImageUrl(subject.coverImagePath),
                  !!subject.coverImagePath,
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
    <div v-else-if="!selectedTopic">
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="topic in selectedSubject.topics"
          :key="topic.id"
          class="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
          @click="selectTopic(topic.id)"
        >
          <div v-if="topic.coverImagePath" class="aspect-video w-full overflow-hidden">
            <img
              :src="getImageUrl(topic.coverImagePath)"
              :alt="topic.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ topic.name }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ topic.subTopics.length }}
              {{ topic.subTopics.length === 1 ? 'sub-topic' : 'sub-topics' }}
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
                openEditNameDialog(
                  'topic',
                  topic.name,
                  selectedGradeLevel.id,
                  selectedSubject.id,
                  topic.id,
                )
              "
            >
              <Pencil class="size-4" />
            </Button>
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
                  getImageUrl(topic.coverImagePath),
                  !!topic.coverImagePath,
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

    <!-- Sub-Topic Selection (Level 4) -->
    <div v-else>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="subTopic in selectedTopic.subTopics"
          :key="subTopic.id"
          class="group relative overflow-hidden transition-shadow hover:shadow-lg"
        >
          <div v-if="subTopic.coverImagePath" class="aspect-video w-full overflow-hidden">
            <img
              :src="getImageUrl(subTopic.coverImagePath)"
              :alt="subTopic.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ subTopic.name }}</h3>
            <p class="text-sm text-muted-foreground">Sub-Topic</p>
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
                openEditNameDialog(
                  'subtopic',
                  subTopic.name,
                  selectedGradeLevel.id,
                  selectedSubject.id,
                  selectedTopic.id,
                  subTopic.id,
                )
              "
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              class="size-8"
              @click.stop="
                openEditImageDialog(
                  'subtopic',
                  selectedGradeLevel.id,
                  selectedSubject.id,
                  subTopic.name,
                  getImageUrl(subTopic.coverImagePath),
                  !!subTopic.coverImagePath,
                  selectedTopic.id,
                  subTopic.id,
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
                  'subtopic',
                  subTopic.name,
                  selectedGradeLevel.id,
                  selectedSubject.id,
                  selectedTopic.id,
                  subTopic.id,
                )
              "
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </Card>
      </div>

      <div
        v-if="selectedTopic.subTopics.length === 0"
        class="rounded-lg border border-dashed p-12 text-center"
      >
        <div class="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
          <Plus class="size-6 text-muted-foreground" />
        </div>
        <h3 class="mt-4 text-lg font-medium">No sub-topics yet</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          Add sub-topics to {{ selectedTopic.name }}.
        </p>
        <Button class="mt-4" @click="openAddDialog('subtopic')">
          <Plus class="mr-2 size-4" />
          Add Sub-Topic
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
          <div
            v-if="editImagePreview"
            class="aspect-video w-full overflow-hidden rounded-lg border"
          >
            <img :src="editImagePreview" :alt="editImageItemName" class="size-full object-cover" />
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

        <DialogFooter class="gap-2">
          <Button variant="outline" :disabled="isSaving" @click="showEditImageDialog = false">
            Cancel
          </Button>
          <Button
            v-if="editImageHasCustomImage && !editImageFile"
            variant="destructive"
            :disabled="isSaving"
            @click="handleRemoveImage"
          >
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Remove Image
          </Button>
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

    <!-- Edit Name Dialog -->
    <Dialog v-model:open="showEditNameDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ getEditNameDialogTitle() }}</DialogTitle>
          <DialogDescription> Update the name for "{{ editNameCurrentName }}" </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <Field>
            <FieldLabel for="edit-name-input">{{ getEditNameInputLabel() }}</FieldLabel>
            <Input
              id="edit-name-input"
              v-model="editNameValue"
              :placeholder="'Enter ' + getEditNameInputLabel().toLowerCase()"
              :disabled="isSaving"
              @keydown.enter.prevent="handleEditName"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showEditNameDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSaving || !editNameValue.trim()" @click="handleEditName">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
