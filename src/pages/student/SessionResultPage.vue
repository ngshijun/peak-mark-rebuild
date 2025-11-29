<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePracticeStore } from '@/stores/practice'
import type { Question, PracticeAnswer } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, XCircle, Clock, Home, RotateCcw, ArrowLeft, History } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const practiceStore = usePracticeStore()

const sessionId = computed(() => route.params.sessionId as string)

const session = computed(() => {
  return practiceStore.getSessionById(sessionId.value)
})

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.questions.length
  const correctAnswers = session.value.answers.filter((a) => a.isCorrect).length
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  let durationSeconds = 0
  if (session.value.completedAt) {
    const start = new Date(session.value.startedAt).getTime()
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

onMounted(() => {
  if (!session.value) {
    router.push('/student/history')
  }
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

function goBack() {
  router.back()
}

function goToHistory() {
  router.push('/student/history')
}

function goToPractice() {
  router.push('/student/practice')
}

function retryTopic() {
  if (session.value) {
    practiceStore.startSession(
      session.value.subjectId,
      session.value.subjectName,
      session.value.topicId,
      session.value.topicName,
    )
    router.push('/student/practice/quiz')
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6">
      <Button variant="ghost" size="sm" class="mb-4" @click="goBack">
        <ArrowLeft class="mr-2 size-4" />
        Back
      </Button>

      <h1 class="text-2xl font-bold">Session Results</h1>
      <p v-if="session" class="text-muted-foreground">
        {{ session.subjectName }} - {{ session.topicName }} | {{ session.gradeLevelName }}
      </p>
    </div>

    <template v-if="session && summary">
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

      <div class="mb-4 text-sm text-muted-foreground">
        Completed: {{ formatDate(session.completedAt!) }}
      </div>

      <Separator class="mb-6" />

      <!-- Questions List -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Question Details</h2>

        <Card
          v-for="(question, index) in session.questions"
          :key="question.id"
          :class="{
            'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20':
              getAnswerForQuestion(question.id)?.isCorrect,
            'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20':
              getAnswerForQuestion(question.id) && !getAnswerForQuestion(question.id)?.isCorrect,
          }"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-2">
              <CardTitle class="text-sm font-medium"> Question {{ index + 1 }} </CardTitle>
              <Badge
                :variant="getAnswerForQuestion(question.id)?.isCorrect ? 'default' : 'destructive'"
                class="shrink-0"
              >
                {{ getAnswerForQuestion(question.id)?.isCorrect ? 'Correct' : 'Incorrect' }}
              </Badge>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <!-- Question Text -->
            <p class="text-sm">{{ question.question }}</p>

            <!-- Question Image if exists -->
            <img
              v-if="question.imageUrl"
              :src="question.imageUrl"
              :alt="`Question ${index + 1} image`"
              class="max-h-40 rounded-md object-contain"
            />

            <!-- MCQ Options -->
            <div v-if="question.type === 'mcq'" class="space-y-2">
              <div
                v-for="option in question.options"
                :key="option.id"
                class="flex items-center gap-2 rounded-md border p-2 text-sm"
                :class="{
                  'border-green-500 bg-green-100 dark:bg-green-900/30': option.isCorrect,
                  'border-red-500 bg-red-100 dark:bg-red-900/30':
                    !option.isCorrect &&
                    getAnswerForQuestion(question.id)?.selectedOptionId === option.id,
                }"
              >
                <span v-if="option.isCorrect" class="text-green-600">
                  <CheckCircle2 class="size-4" />
                </span>
                <span
                  v-else-if="getAnswerForQuestion(question.id)?.selectedOptionId === option.id"
                  class="text-red-600"
                >
                  <XCircle class="size-4" />
                </span>
                <span v-else class="size-4" />
                <span>{{ option.text }}</span>
              </div>
            </div>

            <!-- Short Answer -->
            <div v-else-if="question.type === 'short_answer'" class="space-y-2 text-sm">
              <div class="flex gap-2">
                <span class="font-medium">Your Answer:</span>
                <span
                  :class="
                    getAnswerForQuestion(question.id)?.isCorrect ? 'text-green-600' : 'text-red-600'
                  "
                >
                  {{ getAnswerForQuestion(question.id)?.textAnswer || '-' }}
                </span>
              </div>
              <div v-if="!getAnswerForQuestion(question.id)?.isCorrect" class="flex gap-2">
                <span class="font-medium">Correct Answer:</span>
                <span class="text-green-600">{{ question.answer }}</span>
              </div>
            </div>

            <!-- Explanation -->
            <div
              v-if="question.explanation && !getAnswerForQuestion(question.id)?.isCorrect"
              class="rounded-md bg-muted p-3"
            >
              <p class="text-xs font-medium text-muted-foreground">Explanation</p>
              <p class="text-sm">{{ question.explanation }}</p>
            </div>
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
