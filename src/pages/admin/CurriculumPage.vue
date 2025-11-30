<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCurriculumStore, type Subject, type Topic } from '@/stores/curriculum'
import { ChevronLeft, Plus, Trash2, ImagePlus, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import { toast } from 'vue-sonner'

const curriculumStore = useCurriculumStore()

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

// Dialog state
const showAddDialog = ref(false)
const addType = ref<'grade' | 'subject' | 'topic'>('grade')
const newItemName = ref('')
const newItemCoverImage = ref('')
const dialogGradeLevelId = ref('')
const dialogSubjectId = ref('')

// Edit cover image dialog
const showEditImageDialog = ref(false)
const editImageType = ref<'subject' | 'topic'>('subject')
const editImageUrl = ref('')
const editImageGradeLevelId = ref('')
const editImageSubjectId = ref('')
const editImageTopicId = ref('')
const editImageItemName = ref('')

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
  newItemName.value = ''
  newItemCoverImage.value = ''
  dialogGradeLevelId.value = gradeLevelId ?? selectedGradeLevelId.value ?? ''
  dialogSubjectId.value = subjectId ?? selectedSubjectId.value ?? ''
  showAddDialog.value = true
}

async function handleAdd() {
  if (!newItemName.value.trim()) return

  isSaving.value = true
  const coverImage = newItemCoverImage.value.trim() || undefined

  try {
    if (addType.value === 'grade') {
      const result = await curriculumStore.addGradeLevel(newItemName.value.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Grade level added successfully')
    } else if (addType.value === 'subject' && dialogGradeLevelId.value) {
      const result = await curriculumStore.addSubject(
        dialogGradeLevelId.value,
        newItemName.value.trim(),
        coverImage,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Subject added successfully')
    } else if (addType.value === 'topic' && dialogGradeLevelId.value && dialogSubjectId.value) {
      const result = await curriculumStore.addTopic(
        dialogGradeLevelId.value,
        dialogSubjectId.value,
        newItemName.value.trim(),
        coverImage,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Topic added successfully')
    }

    showAddDialog.value = false
    newItemName.value = ''
    newItemCoverImage.value = ''
  } finally {
    isSaving.value = false
  }
}

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
  editImageUrl.value = currentImage
  showEditImageDialog.value = true
}

async function handleEditImage() {
  if (!editImageUrl.value.trim()) return

  isSaving.value = true

  try {
    if (editImageType.value === 'subject') {
      const result = await curriculumStore.updateSubjectCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        editImageUrl.value.trim(),
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Cover image updated successfully')
    } else if (editImageType.value === 'topic') {
      const result = await curriculumStore.updateTopicCoverImage(
        editImageGradeLevelId.value,
        editImageSubjectId.value,
        editImageTopicId.value,
        editImageUrl.value.trim(),
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Cover image updated successfully')
    }

    showEditImageDialog.value = false
    editImageUrl.value = ''
  } finally {
    isSaving.value = false
  }
}

// Delete handlers
async function handleDeleteGradeLevel(gradeId: string) {
  isDeleting.value = true
  try {
    const result = await curriculumStore.deleteGradeLevel(gradeId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Grade level deleted successfully')
  } finally {
    isDeleting.value = false
  }
}

async function handleDeleteSubject(gradeLevelId: string, subjectId: string) {
  isDeleting.value = true
  try {
    const result = await curriculumStore.deleteSubject(gradeLevelId, subjectId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (selectedSubjectId.value === subjectId) {
      selectedSubjectId.value = null
    }
    toast.success('Subject deleted successfully')
  } finally {
    isDeleting.value = false
  }
}

async function handleDeleteTopic(gradeLevelId: string, subjectId: string, topicId: string) {
  isDeleting.value = true
  try {
    const result = await curriculumStore.deleteTopic(gradeLevelId, subjectId, topicId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Topic deleted successfully')
  } finally {
    isDeleting.value = false
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
    <!-- Loading State -->
    <div v-if="curriculumStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Grade Level Selection (Level 1) -->
    <div v-else-if="!selectedGradeLevel">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">Curriculum</h1>
          <p class="text-muted-foreground">Select a grade level to manage subjects and topics</p>
        </div>
        <Button @click="openAddDialog('grade')">
          <Plus class="mr-2 size-4" />
          Add Grade Level
        </Button>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="grade in curriculumStore.gradeLevels"
          :key="grade.id"
          class="group relative cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
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
            @click.stop="handleDeleteGradeLevel(grade.id)"
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
      <div class="mb-6">
        <Button variant="ghost" size="sm" class="mb-2 -ml-2" @click="goBackToGradeLevels">
          <ChevronLeft class="mr-1 size-4" />
          Back to Grade Levels
        </Button>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{{ selectedGradeLevel.name }}</h1>
            <p class="text-muted-foreground">Manage subjects for this grade level</p>
          </div>
          <Button @click="openAddDialog('subject')">
            <Plus class="mr-2 size-4" />
            Add Subject
          </Button>
        </div>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="subject in selectedGradeLevel.subjects"
          :key="subject.id"
          class="group relative cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
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
              @click.stop="handleDeleteSubject(selectedGradeLevel.id, subject.id)"
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
      <div class="mb-6">
        <Button variant="ghost" size="sm" class="mb-2 -ml-2" @click="goBackToSubjects">
          <ChevronLeft class="mr-1 size-4" />
          Back to Subjects
        </Button>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{{ selectedSubject.name }}</h1>
            <p class="text-muted-foreground">
              Manage topics for {{ selectedGradeLevel.name }} - {{ selectedSubject.name }}
            </p>
          </div>
          <Button @click="openAddDialog('topic')">
            <Plus class="mr-2 size-4" />
            Add Topic
          </Button>
        </div>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="topic in selectedSubject.topics"
          :key="topic.id"
          class="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
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
              @click.stop="handleDeleteTopic(selectedGradeLevel.id, selectedSubject.id, topic.id)"
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

        <div class="space-y-4 py-4">
          <!-- Grade Level Select (for subject when not in context) -->
          <div v-if="addType === 'subject' && !dialogGradeLevelId" class="space-y-2">
            <Label>Grade Level</Label>
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
            <Label>Subject</Label>
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
          <div class="space-y-2">
            <Label :for="addType + '-name'">{{ getInputLabel() }}</Label>
            <Input
              :id="addType + '-name'"
              v-model="newItemName"
              :placeholder="'Enter ' + getInputLabel().toLowerCase()"
              :disabled="isSaving"
              @keyup.enter="handleAdd"
            />
          </div>

          <!-- Cover Image URL Input (for subject/topic) -->
          <div v-if="addType !== 'grade'" class="space-y-2">
            <Label for="cover-image">Cover Image URL (optional)</Label>
            <Input
              id="cover-image"
              v-model="newItemCoverImage"
              placeholder="https://example.com/image.jpg"
              :disabled="isSaving"
            />
            <p class="text-xs text-muted-foreground">
              Leave empty to use a default image based on the name.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showAddDialog = false"
            >Cancel</Button
          >
          <Button @click="handleAdd" :disabled="!newItemName.trim() || isSaving">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Add
          </Button>
        </DialogFooter>
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
              :src="editImageUrl || defaultSubjectImage"
              :alt="editImageItemName"
              class="size-full object-cover"
            />
          </div>

          <!-- URL Input -->
          <div class="space-y-2">
            <Label for="edit-image-url">Image URL</Label>
            <Input
              id="edit-image-url"
              v-model="editImageUrl"
              placeholder="https://example.com/image.jpg"
              :disabled="isSaving"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showEditImageDialog = false"
            >Cancel</Button
          >
          <Button @click="handleEditImage" :disabled="!editImageUrl.trim() || isSaving">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
