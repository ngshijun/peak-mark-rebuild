<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore } from '@/stores/curriculum'
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
const isStartingSession = ref(false)
const sessionLimitStatus = ref<SessionLimitStatus | null>(null)
const isLoadingLimit = ref(true)

// Confirmation dialog state
const showConfirmDialog = ref(false)
const pendingTopicId = ref<string | null>(null)

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

// Get pending topic for confirmation dialog
const pendingTopic = computed(() => {
  if (!selectedSubject.value || !pendingTopicId.value) return null
  return selectedSubject.value.topics.find((t) => t.id === pendingTopicId.value) ?? null
})

// Subject images mapping
const subjectImages: Record<string, string> = {
  Mathematics: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
  Science: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=300&fit=crop',
  English: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
  Chinese: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  History: 'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop',
  Geography: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop',
}

const defaultSubjectImage =
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'

// Topic images mapping
const topicImages: Record<string, string> = {
  // Mathematics topics
  Addition: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
  Subtraction: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop',
  Multiplication:
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
  Division: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400&h=300&fit=crop',
  Fractions: 'https://images.unsplash.com/photo-1632571401005-458e9d244591?w=400&h=300&fit=crop',
  Geometry: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=400&h=300&fit=crop',
  Counting: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
  Shapes: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=400&h=300&fit=crop',
  // Science topics
  Plants: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
  Animals: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&h=300&fit=crop',
  Weather: 'https://images.unsplash.com/photo-1504253163759-c23fccaebb55?w=400&h=300&fit=crop',
  Matter: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=300&fit=crop',
  Energy: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
  // English topics
  Alphabet: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  Phonics: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  Grammar: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  Vocabulary: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
  Reading: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop',
  Writing: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop',
  Spelling: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  // Chinese topics
  Pinyin: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  Characters: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  // History topics
  'Local History':
    'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop',
  'Famous People':
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop',
  // Geography topics
  Maps: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop',
  Continents: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
  Countries: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&h=300&fit=crop',
}

const defaultTopicImage =
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=300&fit=crop'

function getSubjectImage(subject: { name: string; coverImage?: string | null }): string {
  return subject.coverImage || subjectImages[subject.name] || defaultSubjectImage
}

function getTopicImage(topic: { name: string; coverImage?: string | null }): string {
  return topic.coverImage || topicImages[topic.name] || defaultTopicImage
}

function selectSubject(subjectId: string) {
  selectedSubjectId.value = subjectId
}

function goBackToSubjects() {
  selectedSubjectId.value = null
}

function selectTopic(topicId: string) {
  if (!selectedSubject.value || isStartingSession.value) return

  // Check limit before showing dialog
  if (sessionLimitStatus.value && !sessionLimitStatus.value.canStartSession) {
    toast.warning(
      `You have reached your daily session limit (${sessionLimitStatus.value.sessionLimit} sessions). Upgrade your plan for more sessions!`,
    )
    return
  }

  // Show confirmation dialog
  pendingTopicId.value = topicId
  showConfirmDialog.value = true
}

async function confirmStartSession() {
  if (!pendingTopicId.value) return

  showConfirmDialog.value = false
  isStartingSession.value = true

  try {
    const result = await practiceStore.startSession(pendingTopicId.value)

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
    pendingTopicId.value = null
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
            selectedSubject
              ? 'Select a topic to start practicing'
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
                <BreadcrumbPage>{{ selectedSubject.name }}</BreadcrumbPage>
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
            <div class="aspect-video w-full overflow-hidden">
              <img
                :src="getSubjectImage(subject)"
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
      <div v-else>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="topic in selectedSubject.topics"
            :key="topic.id"
            class="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
            :class="{
              'opacity-50 pointer-events-none':
                isStartingSession || !sessionLimitStatus?.canStartSession,
            }"
            @click="selectTopic(topic.id)"
          >
            <div class="aspect-video w-full overflow-hidden">
              <img
                :src="getTopicImage(topic)"
                :alt="topic.name"
                class="size-full object-cover transition-transform hover:scale-105"
              />
            </div>
            <CardContent class="p-4">
              <h3 class="text-lg font-semibold">{{ topic.name }}</h3>
              <p class="text-sm text-muted-foreground">10 questions</p>
            </CardContent>
          </Card>
        </div>

        <div v-if="selectedSubject.topics.length === 0" class="py-12 text-center">
          <p class="text-muted-foreground">No topics available for this subject.</p>
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
            <span class="font-medium text-foreground">{{ pendingTopic?.name }}</span
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
