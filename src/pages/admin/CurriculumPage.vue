<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import CurriculumAddDialog from '@/components/admin/CurriculumAddDialog.vue'
import CurriculumEditImageDialog from '@/components/admin/CurriculumEditImageDialog.vue'
import CurriculumDeleteDialog from '@/components/admin/CurriculumDeleteDialog.vue'
import CurriculumEditNameDialog from '@/components/admin/CurriculumEditNameDialog.vue'
import { Plus, Trash2, ImagePlus, Loader2, Pencil } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent } from '@/components/ui/card'

const curriculumStore = useCurriculumStore()

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

// Add dialog state
const showAddDialog = ref(false)
const addType = ref<'grade' | 'subject' | 'topic' | 'subtopic'>('grade')
const addDialogGradeLevelId = ref('')
const addDialogSubjectId = ref('')
const addDialogTopicId = ref('')

function openAddDialog(type: 'grade' | 'subject' | 'topic' | 'subtopic') {
  addType.value = type
  addDialogGradeLevelId.value = selectedGradeLevelId.value ?? ''
  addDialogSubjectId.value = selectedSubjectId.value ?? ''
  addDialogTopicId.value = selectedTopicId.value ?? ''
  showAddDialog.value = true
}

// Edit image dialog state
const showEditImageDialog = ref(false)
const editImageType = ref<'subject' | 'topic' | 'subtopic'>('subject')
const editImageGradeLevelId = ref('')
const editImageSubjectId = ref('')
const editImageTopicId = ref('')
const editImageSubTopicId = ref('')
const editImageItemName = ref('')
const editImageCurrentUrl = ref('')
const editImageHasCustomImage = ref(false)

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
  editImageCurrentUrl.value = currentImage
  editImageHasCustomImage.value = hasCustomImage
  showEditImageDialog.value = true
}

// Delete dialog state
const showDeleteDialog = ref(false)
const deleteType = ref<'grade' | 'subject' | 'topic' | 'subtopic'>('grade')
const deleteItemName = ref('')
const deleteGradeLevelId = ref('')
const deleteSubjectId = ref('')
const deleteTopicId = ref('')
const deleteSubTopicId = ref('')

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

function handleDeleted(
  type: 'grade' | 'subject' | 'topic' | 'subtopic',
  ids: { subjectId: string; topicId: string },
) {
  if (type === 'subject' && selectedSubjectId.value === ids.subjectId) {
    selectedSubjectId.value = null
    selectedTopicId.value = null
  }
  if (type === 'topic' && selectedTopicId.value === ids.topicId) {
    selectedTopicId.value = null
  }
}

// Edit name dialog state
const showEditNameDialog = ref(false)
const editNameType = ref<'grade' | 'subject' | 'topic' | 'subtopic'>('grade')
const editNameCurrentName = ref('')
const editNameGradeLevelId = ref('')
const editNameSubjectId = ref('')
const editNameTopicId = ref('')
const editNameSubTopicId = ref('')

function openEditNameDialog(
  type: 'grade' | 'subject' | 'topic' | 'subtopic',
  currentName: string,
  gradeLevelId: string,
  subjectId?: string,
  topicId?: string,
  subTopicId?: string,
) {
  editNameType.value = type
  editNameCurrentName.value = currentName
  editNameGradeLevelId.value = gradeLevelId
  editNameSubjectId.value = subjectId ?? ''
  editNameTopicId.value = topicId ?? ''
  editNameSubTopicId.value = subTopicId ?? ''
  showEditNameDialog.value = true
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
          class="group relative flex h-full cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-lg"
          @click="selectSubject(subject.id)"
        >
          <div v-if="subject.coverImagePath" class="aspect-video w-full overflow-hidden">
            <img
              :src="getImageUrl(subject.coverImagePath)"
              :alt="subject.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="mt-auto p-4">
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
          class="group relative flex h-full cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-lg"
          @click="selectTopic(topic.id)"
        >
          <div v-if="topic.coverImagePath" class="aspect-video w-full overflow-hidden">
            <img
              :src="getImageUrl(topic.coverImagePath)"
              :alt="topic.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="mt-auto p-4">
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
          class="group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg"
        >
          <div v-if="subTopic.coverImagePath" class="aspect-video w-full overflow-hidden">
            <img
              :src="getImageUrl(subTopic.coverImagePath)"
              :alt="subTopic.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <CardContent class="mt-auto p-4">
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

    <!-- Dialogs -->
    <CurriculumAddDialog
      v-model:open="showAddDialog"
      :add-type="addType"
      :grade-level-id="addDialogGradeLevelId"
      :subject-id="addDialogSubjectId"
      :topic-id="addDialogTopicId"
    />

    <CurriculumEditImageDialog
      v-model:open="showEditImageDialog"
      :image-type="editImageType"
      :grade-level-id="editImageGradeLevelId"
      :subject-id="editImageSubjectId"
      :topic-id="editImageTopicId"
      :sub-topic-id="editImageSubTopicId"
      :item-name="editImageItemName"
      :current-image-url="editImageCurrentUrl"
      :has-custom-image="editImageHasCustomImage"
    />

    <CurriculumDeleteDialog
      v-model:open="showDeleteDialog"
      :delete-type="deleteType"
      :item-name="deleteItemName"
      :grade-level-id="deleteGradeLevelId"
      :subject-id="deleteSubjectId"
      :topic-id="deleteTopicId"
      :sub-topic-id="deleteSubTopicId"
      @deleted="handleDeleted"
    />

    <CurriculumEditNameDialog
      v-model:open="showEditNameDialog"
      :edit-type="editNameType"
      :current-name="editNameCurrentName"
      :grade-level-id="editNameGradeLevelId"
      :subject-id="editNameSubjectId"
      :topic-id="editNameTopicId"
      :sub-topic-id="editNameSubTopicId"
    />
  </div>
</template>
