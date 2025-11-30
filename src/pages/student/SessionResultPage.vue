<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePracticeStore, type PracticeSession, type PracticeAnswer } from '@/stores/practice'
import { useQuestionsStore } from '@/stores/questions'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Home,
  RotateCcw,
  ArrowLeft,
  History,
  Loader2,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const practiceStore = usePracticeStore()
const questionsStore = useQuestionsStore()
const dashboardStore = useStudentDashboardStore()

const sessionId = computed(() => route.params.sessionId as string)
const session = ref<PracticeSession | null>(null)
const isLoading = ref(true)

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.questions.length || session.value.totalQuestions
  const correctAnswers = session.value.answers.filter((a) => a.isCorrect).length
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  let durationSeconds = 0
  if (session.value.completedAt && session.value.createdAt) {
    const start = new Date(session.value.createdAt).getTime()
    const end = new Date(session.value.completedAt).getTime()
    durationSeconds = Math.round((end - start) / 1000)
  }

  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    score,
    durationSeconds,
  }
})

onMounted(async () => {
  const result = await practiceStore.getSessionById(sessionId.value)
  if (result.session) {
    session.value = result.session
    // Mark that user has practiced today (if session was just completed)
    if (result.session.completedAt) {
      await dashboardStore.markPracticedToday()
    }
  } else {
    router.push('/student/history')
  }
  isLoading.value = false
})

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getAnswerForQuestion(questionId: string): PracticeAnswer | undefined {
  return session.value?.answers.find((a) => a.questionId === questionId)
}

// Convert selectedOption (number) to option id (letter)
function getSelectedOptionId(answer: PracticeAnswer | undefined): string | undefined {
  if (!answer?.selectedOption) return undefined
  return practiceStore.optionNumberToId(answer.selectedOption)
}

// Check if question is deleted
function isQuestionDeleted(question: unknown): boolean {
  return (question as { isDeleted?: boolean })?.isDeleted === true
}

// Get answer by index (for deleted questions where questionId is null)
function getAnswerByIndex(index: number): PracticeAnswer | undefined {
  return session.value?.answers[index]
}

function goBack() {
  router.back()
}

function goToHistory() {
  router.push('/student/history')
}

function goToPractice() {
  router.push('/student/practice')
}

async function retryTopic() {
  if (session.value) {
    const result = await practiceStore.startSession(session.value.topicId)
    if (result.session) {
      router.push('/student/practice/quiz')
    }
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="session && summary">
      <!-- Header -->
      <div class="mb-6">
        <Button variant="ghost" size="sm" class="mb-4" @click="goBack">
          <ArrowLeft class="mr-2 size-4" />
          Back
        </Button>

        <h1 class="text-2xl font-bold">Session Results</h1>
        <p class="text-muted-foreground">
          {{ session.subjectName }} - {{ session.topicName }} | {{ session.gradeLevelName }}
        </p>
      </div>

      <!-- Summary Cards -->
      <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent class="flex flex-col items-center justify-center p-4">
            <div
              class="text-3xl font-bold"
              :class="{
                'text-green-600': summary.score >= 80,
                'text-yellow-600': summary.score >= 60 && summary.score < 80,
                'text-red-600': summary.score < 60,
              }"
            >
              {{ summary.score }}%
            </div>
            <div class="text-sm text-muted-foreground">Score</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="flex flex-col items-center justify-center p-4">
            <div class="flex items-center gap-1 text-3xl font-bold text-green-600">
              <CheckCircle2 class="size-6" />
              {{ summary.correctAnswers }}
            </div>
            <div class="text-sm text-muted-foreground">Correct</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="flex flex-col items-center justify-center p-4">
            <div class="flex items-center gap-1 text-3xl font-bold text-red-600">
              <XCircle class="size-6" />
              {{ summary.incorrectAnswers }}
            </div>
            <div class="text-sm text-muted-foreground">Incorrect</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="flex flex-col items-center justify-center p-4">
            <div class="flex items-center gap-1 text-3xl font-bold">
              <Clock class="size-6 text-muted-foreground" />
              {{ formatDuration(summary.durationSeconds) }}
            </div>
            <div class="text-sm text-muted-foreground">Duration</div>
          </CardContent>
        </Card>
      </div>

      <!-- Action Buttons -->
      <div class="mb-6 flex flex-wrap gap-3">
        <Button variant="outline" @click="goToPractice">
          <Home class="mr-2 size-4" />
          Back to Practice
        </Button>
        <Button variant="outline" @click="goToHistory">
          <History class="mr-2 size-4" />
          View History
        </Button>
        <Button @click="retryTopic">
          <RotateCcw class="mr-2 size-4" />
          Try Again
        </Button>
      </div>

      <div v-if="session.completedAt" class="mb-4 text-sm text-muted-foreground">
        Completed: {{ formatDate(session.completedAt) }}
      </div>

      <Separator class="mb-6" />

      <!-- Questions List -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Question Details</h2>

        <Card
          v-for="(question, index) in session.questions"
          :key="question.id"
          :class="{
            'border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/20':
              isQuestionDeleted(question),
            'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20':
              !isQuestionDeleted(question) && getAnswerByIndex(index)?.isCorrect,
            'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20':
              !isQuestionDeleted(question) && getAnswerByIndex(index) && !getAnswerByIndex(index)?.isCorrect,
          }"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-2">
              <CardTitle class="text-sm font-medium"> Question {{ index + 1 }} </CardTitle>
              <Badge
                v-if="isQuestionDeleted(question)"
                variant="secondary"
                class="shrink-0"
              >
                Deleted
              </Badge>
              <Badge
                v-else
                :variant="getAnswerByIndex(index)?.isCorrect ? 'default' : 'destructive'"
                class="shrink-0"
              >
                {{ getAnswerByIndex(index)?.isCorrect ? 'Correct' : 'Incorrect' }}
              </Badge>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <!-- Deleted Question Notice -->
            <div v-if="isQuestionDeleted(question)" class="text-sm text-muted-foreground italic">
              <p>This question has been deleted from the question bank.</p>
              <p class="mt-2">
                Your answer was:
                <span :class="getAnswerByIndex(index)?.isCorrect ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                  {{ getAnswerByIndex(index)?.isCorrect ? 'Correct' : 'Incorrect' }}
                </span>
              </p>
            </div>

            <!-- Question Text -->
            <template v-else>
              <p class="text-sm">{{ question.question }}</p>

              <!-- Question Image if exists -->
              <img
                v-if="question.imagePath"
                :src="questionsStore.getQuestionImageUrl(question.imagePath)"
                :alt="`Question ${index + 1} image`"
                class="max-h-40 rounded-md object-contain"
              />

              <!-- MCQ Options -->
              <div v-if="question.type === 'mcq' && question.options" class="space-y-2">
                <div
                  v-for="option in question.options"
                  :key="option.id"
                  class="flex items-center gap-2 rounded-md border p-2 text-sm"
                  :class="{
                    'border-green-500 bg-green-100 dark:bg-green-900/30': option.isCorrect,
                    'border-red-500 bg-red-100 dark:bg-red-900/30':
                      !option.isCorrect &&
                      getSelectedOptionId(getAnswerByIndex(index)) === option.id,
                  }"
                >
                  <span v-if="option.isCorrect" class="text-green-600">
                    <CheckCircle2 class="size-4" />
                  </span>
                  <span
                    v-else-if="getSelectedOptionId(getAnswerByIndex(index)) === option.id"
                    class="text-red-600"
                  >
                    <XCircle class="size-4" />
                  </span>
                  <span v-else class="size-4" />
                  <div class="flex flex-1 items-center gap-2">
                    <span v-if="option.text">{{ option.text }}</span>
                    <img
                      v-if="option.imagePath"
                      :src="questionsStore.getQuestionImageUrl(option.imagePath)"
                      :alt="`Option ${option.id.toUpperCase()}`"
                      class="max-h-12 rounded border object-contain"
                    />
                  </div>
                </div>
              </div>

              <!-- Short Answer -->
              <div v-else-if="question.type === 'short_answer'" class="space-y-2 text-sm">
                <div class="flex gap-2">
                  <span class="font-medium">Your Answer:</span>
                  <span
                    :class="
                      getAnswerByIndex(index)?.isCorrect ? 'text-green-600' : 'text-red-600'
                    "
                  >
                    {{ getAnswerByIndex(index)?.textAnswer || '-' }}
                  </span>
                </div>
                <div v-if="!getAnswerByIndex(index)?.isCorrect" class="flex gap-2">
                  <span class="font-medium">Correct Answer:</span>
                  <span class="text-green-600">{{ question.answer }}</span>
                </div>
              </div>

              <!-- Explanation -->
              <div
                v-if="question.explanation && !getAnswerByIndex(index)?.isCorrect"
                class="rounded-md bg-muted p-3"
              >
                <p class="text-xs font-medium text-muted-foreground">Explanation</p>
                <p class="text-sm">{{ question.explanation }}</p>
              </div>
            </template>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goToHistory">Go to History</Button>
    </div>
  </div>
</template>
