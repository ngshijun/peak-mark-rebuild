<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore, type SubTopic } from '@/stores/curriculum'
import { usePracticeStore, type SessionLimitStatus } from '@/stores/practice'
import { Loader2, Clock, CircleCheck, GraduationCap } from 'lucide-vue-next'
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
import { Progress } from '@/components/ui/progress'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()
const curriculumStore = useCurriculumStore()
const practiceStore = usePracticeStore()

// Navigation state (from store for persistence)
const selectedSubjectId = computed({
  get: () => practiceStore.practiceNavigation.selectedSubjectId,
  set: (val) => practiceStore.setPracticeSubject(val),
})
const selectedTopicId = computed({
  get: () => practiceStore.practiceNavigation.selectedTopicId,
  set: (val) => practiceStore.setPracticeTopic(val),
})
const isStartingSession = ref(false)
const sessionLimitStatus = ref<SessionLimitStatus | null>(null)
const isLoadingLimit = ref(true)

// Confirmation dialog state
const showConfirmDialog = ref(false)
const pendingSubTopicId = ref<string | null>(null)

// Fetch curriculum, session limit, and sub-topic progress on mount
onMounted(async () => {
  if (curriculumStore.gradeLevels.length === 0) {
    await curriculumStore.fetchCurriculum()
  }
  // Check session limit status and fetch sub-topic progress in parallel
  const [limitStatus] = await Promise.all([
    practiceStore.checkSessionLimit(),
    practiceStore.fetchSubTopicProgress(),
  ])
  sessionLimitStatus.value = limitStatus
  isLoadingLimit.value = false
})

// Get student's grade level ID
const studentGradeLevelId = computed(() => {
  if (authStore.user?.userType === 'student') {
    return authStore.studentProfile?.gradeLevelId ?? null
  }
  return null
})

// Get student's grade level name
const studentGradeLevelName = computed(() => {
  if (!studentGradeLevelId.value) return ''
  const grade = curriculumStore.gradeLevels.find((g) => g.id === studentGradeLevelId.value)
  return grade?.name ?? ''
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

// Progress calculation helpers
function isSubTopicFullyPracticed(subTopic: { id: string; questionCount: number }) {
  return (
    subTopic.questionCount > 0 &&
    practiceStore.getSubTopicAnsweredCount(subTopic.id) >= subTopic.questionCount
  )
}

function getTopicProgress(topic: (typeof availableSubjects.value)[0]['topics'][0]) {
  const totalSubTopics = topic.subTopics.length
  const completedSubTopics = topic.subTopics.filter(isSubTopicFullyPracticed).length
  return { total: totalSubTopics, completed: completedSubTopics }
}

function isTopicFullyPracticed(topic: (typeof availableSubjects.value)[0]['topics'][0]) {
  const { total, completed } = getTopicProgress(topic)
  return total > 0 && completed >= total
}

function getSubjectProgress(subject: (typeof availableSubjects.value)[0]) {
  const totalTopics = subject.topics.length
  const completedTopics = subject.topics.filter(isTopicFullyPracticed).length
  return { total: totalTopics, completed: completedTopics }
}

function isSubjectFullyPracticed(subject: (typeof availableSubjects.value)[0]) {
  const { total, completed } = getSubjectProgress(subject)
  return total > 0 && completed >= total
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
                <button @click="goBackToSubjects">{{ studentGradeLevelName }}</button>
              </BreadcrumbLink>
              <BreadcrumbPage v-else>{{ studentGradeLevelName }}</BreadcrumbPage>
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
        <span :class="sessionLimitStatus.remainingSessions <= 1 ? 'text-yellow-600' : ''">
          {{ sessionLimitStatus.remainingSessions }} of
          {{ sessionLimitStatus.sessionLimit }} sessions remaining
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="curriculumStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- No Grade Level Set -->
    <Card
      v-else-if="!studentGradeLevelId"
      class="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 text-center dark:border-blue-800 dark:from-blue-950/30 dark:to-indigo-950/30"
    >
      <CardContent class="py-8">
        <div
          class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50"
        >
          <GraduationCap class="size-7 text-blue-500" />
        </div>
        <h3 class="text-lg font-semibold">Grade Level Not Set</h3>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Please set your grade level in your profile to start practicing.
        </p>
        <Button class="mt-4" @click="router.push('/student/profile')">Go to Profile</Button>
      </CardContent>
    </Card>

    <template v-else>
      <!-- Session Limit Reached -->
      <Card
        v-if="!isLoadingLimit && sessionLimitStatus && !sessionLimitStatus.canStartSession"
        class="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 text-center dark:border-amber-800 dark:from-amber-950/30 dark:to-yellow-950/30"
      >
        <CardContent class="py-8">
          <div
            class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50"
          >
            <Clock class="size-7 text-amber-500" />
          </div>
          <h3 class="text-lg font-semibold">Daily Limit Reached</h3>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            You have used all {{ sessionLimitStatus.sessionLimit }} sessions for today. Come back
            tomorrow or ask your parent to upgrade your subscription for more sessions.
          </p>
        </CardContent>
      </Card>

      <!-- Subject Selection -->
      <div v-if="!selectedSubject">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="subject in availableSubjects"
            :key="subject.id"
            class="flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
            :class="{
              'border-2 border-green-500 bg-green-50 dark:bg-green-950':
                isSubjectFullyPracticed(subject),
            }"
            @click="selectSubject(subject.id)"
          >
            <div v-if="subject.coverImagePath" class="aspect-video w-full overflow-hidden">
              <img
                :src="getImageUrl(subject.coverImagePath)"
                :alt="subject.name"
                loading="lazy"
                class="size-full object-cover"
              />
            </div>
            <CardContent class="mt-auto p-4">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold">{{ subject.name }}</h3>
                <CircleCheck
                  v-if="isSubjectFullyPracticed(subject)"
                  class="size-5 text-green-600"
                />
              </div>
              <p
                class="text-sm"
                :class="
                  isSubjectFullyPracticed(subject) ? 'text-green-600' : 'text-muted-foreground'
                "
              >
                {{ getSubjectProgress(subject).completed }}/{{ getSubjectProgress(subject).total }}
                {{ getSubjectProgress(subject).total === 1 ? 'topic' : 'topics' }} completed
              </p>
              <Progress
                :model-value="
                  getSubjectProgress(subject).total > 0
                    ? (getSubjectProgress(subject).completed / getSubjectProgress(subject).total) *
                      100
                    : 0
                "
                class="mt-2 h-1.5"
                :class="isSubjectFullyPracticed(subject) ? '[&>div]:bg-green-500' : ''"
              />
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
            class="flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
            :class="{
              'border-2 border-green-500 bg-green-50 dark:bg-green-950':
                isTopicFullyPracticed(topic),
            }"
            @click="selectTopic(topic.id)"
          >
            <div v-if="topic.coverImagePath" class="aspect-video w-full overflow-hidden">
              <img
                :src="getImageUrl(topic.coverImagePath)"
                :alt="topic.name"
                loading="lazy"
                class="size-full object-cover"
              />
            </div>
            <CardContent class="mt-auto p-4">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold">{{ topic.name }}</h3>
                <CircleCheck v-if="isTopicFullyPracticed(topic)" class="size-5 text-green-600" />
              </div>
              <p
                class="text-sm"
                :class="isTopicFullyPracticed(topic) ? 'text-green-600' : 'text-muted-foreground'"
              >
                {{ getTopicProgress(topic).completed }}/{{ getTopicProgress(topic).total }}
                {{ getTopicProgress(topic).total === 1 ? 'sub-topic' : 'sub-topics' }} completed
              </p>
              <Progress
                :model-value="
                  getTopicProgress(topic).total > 0
                    ? (getTopicProgress(topic).completed / getTopicProgress(topic).total) * 100
                    : 0
                "
                class="mt-2 h-1.5"
                :class="isTopicFullyPracticed(topic) ? '[&>div]:bg-green-500' : ''"
              />
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
            class="flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
            :class="{
              'opacity-50 pointer-events-none':
                isStartingSession || !sessionLimitStatus?.canStartSession,
              'border-2 border-green-500 bg-green-50 dark:bg-green-950':
                subTopic.questionCount > 0 &&
                practiceStore.getSubTopicAnsweredCount(subTopic.id) >= subTopic.questionCount,
            }"
            @click="selectSubTopic(subTopic.id)"
          >
            <div v-if="subTopic.coverImagePath" class="aspect-video w-full overflow-hidden">
              <img
                :src="getImageUrl(subTopic.coverImagePath)"
                :alt="subTopic.name"
                loading="lazy"
                class="size-full object-cover"
              />
            </div>
            <CardContent class="mt-auto p-4">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold">{{ subTopic.name }}</h3>
                <CircleCheck
                  v-if="isSubTopicFullyPracticed(subTopic)"
                  class="size-5 text-green-600"
                />
              </div>
              <p
                class="text-sm"
                :class="
                  subTopic.questionCount > 0 &&
                  practiceStore.getSubTopicAnsweredCount(subTopic.id) >= subTopic.questionCount
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                "
              >
                {{ practiceStore.getSubTopicAnsweredCount(subTopic.id) }}/{{
                  subTopic.questionCount
                }}
                {{ subTopic.questionCount === 1 ? 'question' : 'questions' }} practiced
              </p>
              <Progress
                :model-value="
                  subTopic.questionCount > 0
                    ? (practiceStore.getSubTopicAnsweredCount(subTopic.id) /
                        subTopic.questionCount) *
                      100
                    : 0
                "
                class="mt-2 h-1.5"
                :class="isSubTopicFullyPracticed(subTopic) ? '[&>div]:bg-green-500' : ''"
              />
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
