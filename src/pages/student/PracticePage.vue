<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore, type SubTopic } from '@/stores/curriculum'
import { usePracticeStore, type SessionLimitStatus } from '@/stores/practice'
import { Loader2, AlertCircle } from 'lucide-vue-next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()
const curriculumStore = useCurriculumStore()
const practiceStore = usePracticeStore()

const selectedSubjectId = ref<string | null>(null)
const selectedTopicId = ref<string | null>(null)
const isStartingSession = ref(false)
const sessionLimitStatus = ref<SessionLimitStatus | null>(null)
const isLoadingLimit = ref(true)

// Confirmation dialog state
const showConfirmDialog = ref(false)
const pendingSubTopicId = ref<string | null>(null)

// Fetch curriculum and session limit on mount
onMounted(async () => {
  if (curriculumStore.gradeLevels.length === 0) {
    await curriculumStore.fetchCurriculum()
  }
  // Check session limit status
  sessionLimitStatus.value = await practiceStore.checkSessionLimit()
  isLoadingLimit.value = false
})

// Get student's grade level ID
const studentGradeLevelId = computed(() => {
  if (authStore.user?.userType === 'student') {
    return authStore.studentProfile?.gradeLevelId ?? null
  }
  return null
})

// Get available subjects for student's grade level
const availableSubjects = computed(() => {
  if (!studentGradeLevelId.value) return []
  const grade = curriculumStore.gradeLevels.find((g) => g.id === studentGradeLevelId.value)
  return grade?.subjects ?? []
})

// Get selected subject
const selectedSubject = computed(() => {
  if (!selectedSubjectId.value) return null
  return availableSubjects.value.find((s) => s.id === selectedSubjectId.value) ?? null
})

// Get selected topic
const selectedTopic = computed(() => {
  if (!selectedSubject.value || !selectedTopicId.value) return null
  return selectedSubject.value.topics.find((t) => t.id === selectedTopicId.value) ?? null
})

// Get pending sub-topic for confirmation dialog
const pendingSubTopic = computed(() => {
  if (!selectedTopic.value || !pendingSubTopicId.value) return null
  return selectedTopic.value.subTopics.find((st) => st.id === pendingSubTopicId.value) ?? null
})

function getImageUrl(coverImagePath: string | null): string {
  if (!coverImagePath) return ''
  if (coverImagePath.startsWith('http')) {
    return coverImagePath
  }
  return curriculumStore.getOptimizedImageUrl(coverImagePath)
}

function selectSubject(subjectId: string) {
  selectedSubjectId.value = subjectId
  selectedTopicId.value = null
}

function goBackToSubjects() {
  selectedSubjectId.value = null
  selectedTopicId.value = null
}

function selectTopic(topicId: string) {
  selectedTopicId.value = topicId
}

function goBackToTopics() {
  selectedTopicId.value = null
}

function selectSubTopic(subTopicId: string) {
  if (!selectedTopic.value || isStartingSession.value) return

  // Check limit before showing dialog
  if (sessionLimitStatus.value && !sessionLimitStatus.value.canStartSession) {
    toast.warning(
      `You have reached your daily session limit (${sessionLimitStatus.value.sessionLimit} sessions). Upgrade your plan for more sessions!`,
    )
    return
  }

  // Show confirmation dialog
  pendingSubTopicId.value = subTopicId
  showConfirmDialog.value = true
}

async function confirmStartSession() {
  if (!pendingSubTopicId.value) return

  showConfirmDialog.value = false
  isStartingSession.value = true

  try {
    const result = await practiceStore.startSession(pendingSubTopicId.value)

    if (result.error) {
      toast.error(result.error)
      // Refresh limit status if limit was reached
      if (result.limitReached) {
        sessionLimitStatus.value = await practiceStore.checkSessionLimit()
      }
      return
    }

    if (result.session) {
      router.push('/student/practice/quiz')
    }
  } finally {
    isStartingSession.value = false
    pendingSubTopicId.value = null
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Practice</h1>
        <p class="text-muted-foreground">
          {{
            selectedTopic
              ? 'Select a sub-topic to start practicing'
              : selectedSubject
                ? 'Select a topic to continue'
                : 'Select a subject to start practicing'
          }}
        </p>
        <!-- Breadcrumb Navigation -->
        <Breadcrumb class="mt-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink v-if="selectedSubject" as-child>
                <button @click="goBackToSubjects">Subjects</button>
              </BreadcrumbLink>
              <BreadcrumbPage v-else>Subjects</BreadcrumbPage>
            </BreadcrumbItem>
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
      </div>
      <!-- Session Counter -->
      <div
        v-if="
          !curriculumStore.isLoading &&
          !isLoadingLimit &&
          sessionLimitStatus &&
          sessionLimitStatus.canStartSession
        "
        class="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
      >
        <span>
          Sessions today: {{ sessionLimitStatus.sessionsToday }} /
          {{ sessionLimitStatus.sessionLimit }}
        </span>
        <span v-if="sessionLimitStatus.remainingSessions <= 1" class="text-yellow-600">
          ({{ sessionLimitStatus.remainingSessions }} remaining)
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="curriculumStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- No Grade Level Set -->
    <div v-else-if="!studentGradeLevelId" class="py-12 text-center">
      <p class="text-muted-foreground">Please set your grade level in your profile first.</p>
      <Button class="mt-4" @click="router.push('/student/profile')">Go to Profile</Button>
    </div>

    <template v-else>
      <!-- Session Limit Alert -->
      <Alert
        v-if="!isLoadingLimit && sessionLimitStatus && !sessionLimitStatus.canStartSession"
        variant="destructive"
        class="mb-6"
      >
        <AlertCircle class="size-4" />
        <AlertTitle>Daily Limit Reached</AlertTitle>
        <AlertDescription>
          You have used all {{ sessionLimitStatus.sessionLimit }} sessions for today. Come back
          tomorrow or ask your parent to upgrade your subscription for more sessions.
        </AlertDescription>
      </Alert>

      <!-- Subject Selection -->
      <div v-if="!selectedSubject">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="subject in availableSubjects"
            :key="subject.id"
            class="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
            @click="selectSubject(subject.id)"
          >
            <div v-if="subject.coverImagePath" class="aspect-video w-full overflow-hidden">
              <img
                :src="getImageUrl(subject.coverImagePath)"
                :alt="subject.name"
                class="size-full object-cover transition-transform hover:scale-105"
              />
            </div>
            <CardContent class="p-4">
              <h3 class="text-lg font-semibold">{{ subject.name }}</h3>
              <p class="text-sm text-muted-foreground">
                {{ subject.topics.length }}
                {{ subject.topics.length === 1 ? 'topic' : 'topics' }} available
              </p>
            </CardContent>
          </Card>
        </div>

        <div v-if="availableSubjects.length === 0" class="py-12 text-center">
          <p class="text-muted-foreground">No subjects available for your grade level.</p>
        </div>
      </div>

      <!-- Topic Selection -->
      <div v-else-if="!selectedTopic">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="topic in selectedSubject.topics"
            :key="topic.id"
            class="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
            @click="selectTopic(topic.id)"
          >
            <div v-if="topic.coverImagePath" class="aspect-video w-full overflow-hidden">
              <img
                :src="getImageUrl(topic.coverImagePath)"
                :alt="topic.name"
                class="size-full object-cover transition-transform hover:scale-105"
              />
            </div>
            <CardContent class="p-4">
              <h3 class="text-lg font-semibold">{{ topic.name }}</h3>
              <p class="text-sm text-muted-foreground">
                {{ topic.subTopics.length }}
                {{ topic.subTopics.length === 1 ? 'sub-topic' : 'sub-topics' }} available
              </p>
            </CardContent>
          </Card>
        </div>

        <div v-if="selectedSubject.topics.length === 0" class="py-12 text-center">
          <p class="text-muted-foreground">No topics available for this subject.</p>
        </div>
      </div>

      <!-- Sub-Topic Selection -->
      <div v-else>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="subTopic in selectedTopic.subTopics"
            :key="subTopic.id"
            class="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
            :class="{
              'opacity-50 pointer-events-none':
                isStartingSession || !sessionLimitStatus?.canStartSession,
            }"
            @click="selectSubTopic(subTopic.id)"
          >
            <div v-if="subTopic.coverImagePath" class="aspect-video w-full overflow-hidden">
              <img
                :src="getImageUrl(subTopic.coverImagePath)"
                :alt="subTopic.name"
                class="size-full object-cover transition-transform hover:scale-105"
              />
            </div>
            <CardContent class="p-4">
              <h3 class="text-lg font-semibold">{{ subTopic.name }}</h3>
              <p class="text-sm text-muted-foreground">
                {{ subTopic.questionCount }}
                {{ subTopic.questionCount === 1 ? 'question' : 'questions' }}
              </p>
            </CardContent>
          </Card>
        </div>

        <div v-if="selectedTopic.subTopics.length === 0" class="py-12 text-center">
          <p class="text-muted-foreground">No sub-topics available for this topic.</p>
        </div>
      </div>
    </template>

    <!-- Loading Overlay -->
    <div
      v-if="isStartingSession"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
    >
      <div class="flex flex-col items-center gap-4">
        <Loader2 class="size-12 animate-spin text-primary" />
        <p class="text-lg font-medium">Starting practice session...</p>
      </div>
    </div>

    <!-- Start Session Confirmation Dialog -->
    <AlertDialog v-model:open="showConfirmDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start Practice Session?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to start a practice session for
            <span class="font-medium text-foreground">{{ pendingSubTopic?.name }}</span
            >. This will use 1 of your daily sessions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmStartSession">Start Session</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
