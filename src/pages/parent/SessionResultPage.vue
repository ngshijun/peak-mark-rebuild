<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  useChildStatisticsStore,
  type ChildPracticeSessionFull,
  type PracticeAnswer,
} from '@/stores/child-statistics'
import { useChildLinkStore } from '@/stores/child-link'
import { useQuestionsStore } from '@/stores/questions'
import { parseSimpleMarkdown } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  Lock,
  Sparkles,
  BotMessageSquare,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const childStatisticsStore = useChildStatisticsStore()
const childLinkStore = useChildLinkStore()
const questionsStore = useQuestionsStore()

const childId = computed(() => route.params.childId as string)
const sessionId = computed(() => route.params.sessionId as string)

const child = computed(() => {
  return childLinkStore.linkedChildren.find((c) => c.id === childId.value)
})

const session = ref<ChildPracticeSessionFull | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const subscriptionRequired = ref(false)

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.questions.length || session.value.totalQuestions
  const correctAnswers = session.value.answers.filter((a) => a.isCorrect).length
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  // Use durationSeconds from session (sum of time spent on each question)
  // This accurately tracks actual time spent, even if student left and came back
  const durationSeconds = session.value.durationSeconds ?? 0

  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    score,
    durationSeconds,
  }
})

onMounted(async () => {
  const result = await childStatisticsStore.getSessionById(childId.value, sessionId.value)
  if (result.session) {
    session.value = result.session
  } else {
    error.value = result.error
    subscriptionRequired.value = result.subscriptionRequired ?? false
    // Only redirect if not a subscription error
    if (!result.subscriptionRequired) {
      router.push('/parent/statistics')
    }
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

function getAnswerByIndex(index: number): PracticeAnswer | undefined {
  return session.value?.answers[index]
}

// Convert selectedOptions (number[]) to option ids (letters)
function getSelectedOptionIds(answer: PracticeAnswer | undefined): string[] {
  if (!answer?.selectedOptions) return []
  const map: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }
  return answer.selectedOptions.map((n) => map[n] ?? 'a')
}

// Check if an option was selected
function wasOptionSelected(answer: PracticeAnswer | undefined, optionId: string): boolean {
  return getSelectedOptionIds(answer).includes(optionId)
}

// Check if question is deleted
function isQuestionDeleted(question: unknown): boolean {
  return (question as { isDeleted?: boolean })?.isDeleted === true
}

// Helper to check if an option is filled (has text or image)
function isOptionFilled(opt: { text?: string | null; imagePath?: string | null }): boolean {
  return !!(opt.text && opt.text.trim()) || !!opt.imagePath
}

function goBack() {
  router.back()
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
        <p v-if="child" class="text-muted-foreground">
          {{ child.name }} - {{ session.subjectName }} - {{ session.topicName }} |
          {{ session.gradeLevelName }}
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
            <div class="text-sm text-muted-foreground">Time Used</div>
          </CardContent>
        </Card>
      </div>

      <div v-if="session.completedAt" class="mb-4 text-sm text-muted-foreground">
        Completed: {{ formatDate(session.completedAt) }}
      </div>

      <!-- AI Summary (Max tier only) -->
      <Card
        v-if="session.aiSummary"
        class="mb-6 border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20"
      >
        <CardHeader class="pb-2">
          <CardTitle
            class="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300"
          >
            <BotMessageSquare class="size-4" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-sm leading-relaxed" v-html="parseSimpleMarkdown(session.aiSummary)" />
        </CardContent>
      </Card>

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
              !isQuestionDeleted(question) &&
              getAnswerByIndex(index) &&
              !getAnswerByIndex(index)?.isCorrect,
          }"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-2">
              <CardTitle class="text-sm font-medium"> Question {{ index + 1 }} </CardTitle>
              <div class="flex items-center gap-2">
                <span
                  v-if="getAnswerByIndex(index)?.timeSpentSeconds != null"
                  class="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <Clock class="size-3" />
                  {{ formatDuration(getAnswerByIndex(index)?.timeSpentSeconds ?? 0) }}
                </span>
                <Badge v-if="isQuestionDeleted(question)" variant="secondary" class="shrink-0">
                  Deleted
                </Badge>
                <template v-else>
                  <Badge variant="outline" class="shrink-0">
                    {{
                      question.type === 'mcq'
                        ? 'MCQ'
                        : question.type === 'mrq'
                          ? 'MRQ'
                          : 'Short Answer'
                    }}
                  </Badge>
                  <Badge
                    :variant="getAnswerByIndex(index)?.isCorrect ? 'default' : 'destructive'"
                    class="shrink-0"
                  >
                    {{ getAnswerByIndex(index)?.isCorrect ? 'Correct' : 'Incorrect' }}
                  </Badge>
                </template>
              </div>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <!-- Deleted Question Notice -->
            <div v-if="isQuestionDeleted(question)" class="text-sm italic text-muted-foreground">
              <p>This question has been deleted from the question bank.</p>
              <p class="mt-2">
                Your answer was:
                <span
                  :class="
                    getAnswerByIndex(index)?.isCorrect
                      ? 'font-medium text-green-600'
                      : 'font-medium text-red-600'
                  "
                >
                  {{ getAnswerByIndex(index)?.isCorrect ? 'Correct' : 'Incorrect' }}
                </span>
              </p>
            </div>

            <!-- Question Text -->
            <template v-else>
              <p class="text-sm whitespace-pre-line">{{ question.question }}</p>

              <!-- Question Image if exists (optimized for faster loading) -->
              <img
                v-if="question.imagePath"
                :src="questionsStore.getOptimizedQuestionImageUrl(question.imagePath)"
                :alt="`Question ${index + 1} image`"
                class="max-h-40 rounded-md object-contain"
                loading="lazy"
              />

              <!-- MCQ/MRQ Options (filtered to show only non-empty options) -->
              <div
                v-if="(question.type === 'mcq' || question.type === 'mrq') && question.options"
                class="space-y-2"
              >
                <div
                  v-for="option in question.options.filter(isOptionFilled)"
                  :key="option.id"
                  class="flex items-center gap-2 rounded-md border p-2 text-sm"
                  :class="{
                    'border-green-500 bg-green-100 dark:bg-green-900/30':
                      option.isCorrect &&
                      (question.type === 'mcq' ||
                        wasOptionSelected(getAnswerByIndex(index), option.id)),
                    'border-red-500 bg-red-100 dark:bg-red-900/30':
                      (!option.isCorrect &&
                        wasOptionSelected(getAnswerByIndex(index), option.id)) ||
                      (question.type === 'mrq' &&
                        option.isCorrect &&
                        !wasOptionSelected(getAnswerByIndex(index), option.id)),
                  }"
                >
                  <!-- Correct and selected -->
                  <span
                    v-if="option.isCorrect && wasOptionSelected(getAnswerByIndex(index), option.id)"
                    class="text-green-600"
                  >
                    <CheckCircle2 class="size-4" />
                  </span>
                  <!-- MCQ: Correct but NOT selected -->
                  <span
                    v-else-if="
                      question.type === 'mcq' &&
                      option.isCorrect &&
                      !wasOptionSelected(getAnswerByIndex(index), option.id)
                    "
                    class="text-green-600"
                  >
                    <CheckCircle2 class="size-4" />
                  </span>
                  <!-- MRQ: Correct but NOT selected (missed) -->
                  <span
                    v-else-if="
                      question.type === 'mrq' &&
                      option.isCorrect &&
                      !wasOptionSelected(getAnswerByIndex(index), option.id)
                    "
                    class="text-red-600"
                  >
                    <XCircle class="size-4" />
                  </span>
                  <!-- Incorrect and selected -->
                  <span
                    v-else-if="wasOptionSelected(getAnswerByIndex(index), option.id)"
                    class="text-red-600"
                  >
                    <XCircle class="size-4" />
                  </span>
                  <!-- Incorrect and not selected -->
                  <span v-else class="size-4" />
                  <div class="flex flex-1 items-center gap-2">
                    <span v-if="option.text">{{ option.text }}</span>
                    <img
                      v-if="option.imagePath"
                      :src="questionsStore.getThumbnailQuestionImageUrl(option.imagePath)"
                      :alt="`Option ${option.id.toUpperCase()}`"
                      class="max-h-12 rounded border object-contain"
                      loading="lazy"
                    />
                  </div>
                  <!-- Labels for clarity -->
                  <Badge
                    v-if="option.isCorrect && wasOptionSelected(getAnswerByIndex(index), option.id)"
                    variant="outline"
                    class="ml-auto shrink-0 border-green-500 text-green-600"
                  >
                    Your answer
                  </Badge>
                  <Badge
                    v-else-if="
                      question.type === 'mcq' &&
                      option.isCorrect &&
                      !wasOptionSelected(getAnswerByIndex(index), option.id)
                    "
                    variant="outline"
                    class="ml-auto shrink-0 border-green-500 text-green-600"
                  >
                    Correct answer
                  </Badge>
                  <Badge
                    v-else-if="
                      question.type === 'mrq' &&
                      option.isCorrect &&
                      !wasOptionSelected(getAnswerByIndex(index), option.id)
                    "
                    variant="outline"
                    class="ml-auto shrink-0 border-red-500 text-red-600"
                  >
                    Correct answer
                  </Badge>
                  <Badge
                    v-else-if="wasOptionSelected(getAnswerByIndex(index), option.id)"
                    variant="outline"
                    class="ml-auto shrink-0 border-red-500 text-red-600"
                  >
                    Your answer
                  </Badge>
                </div>
              </div>

              <!-- Short Answer -->
              <div v-else-if="question.type === 'short_answer'" class="space-y-2 text-sm">
                <div class="flex gap-2">
                  <span class="font-medium">Your Answer:</span>
                  <span
                    :class="getAnswerByIndex(index)?.isCorrect ? 'text-green-600' : 'text-red-600'"
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

    <!-- Subscription Required State -->
    <div v-else-if="subscriptionRequired" class="py-12 text-center">
      <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
        <Lock class="size-8 text-muted-foreground" />
      </div>
      <h2 class="text-xl font-semibold">Upgrade Required</h2>
      <p class="mx-auto mt-2 max-w-md text-muted-foreground">
        {{ error }}
      </p>
      <div class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button @click="router.push('/parent/subscription')">
          <Sparkles class="mr-2 size-4" />
          Upgrade Plan
        </Button>
        <Button variant="outline" @click="goBack"> Back </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goBack">Go Back</Button>
    </div>
  </div>
</template>
