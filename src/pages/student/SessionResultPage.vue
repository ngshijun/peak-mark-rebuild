<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  usePracticeStore,
  type PracticeSession,
  type PracticeAnswer,
  type StudentSubscriptionStatus,
} from '@/stores/practice'
import { useQuestionsStore } from '@/stores/questions'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { supabase } from '@/lib/supabaseClient'
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
  Users,
  Star,
  CirclePoundSterling,
  BotMessageSquare,
  RefreshCw,
  AlertCircle,
  Crown,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const practiceStore = usePracticeStore()
const questionsStore = useQuestionsStore()
const dashboardStore = useStudentDashboardStore()

const sessionId = computed(() => route.params.sessionId as string)
const session = ref<PracticeSession | null>(null)
const isLoading = ref(true)
const subscriptionStatus = ref<StudentSubscriptionStatus | null>(null)
const subscriptionRequired = ref(false)

// AI Summary status: 'idle' | 'loading' | 'success' | 'failed'
const aiSummaryStatus = ref<'idle' | 'loading' | 'success' | 'failed'>('idle')
// Track if this is a just-completed session vs viewing from history
const isCurrentSession = ref(false)

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.questions.length || session.value.totalQuestions
  const correctAnswers = session.value.answers.filter((a) => a.isCorrect).length
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  // Use totalTimeSeconds from session (sum of time spent on each question)
  // This accurately tracks actual time spent, even if student left and came back
  const durationSeconds = session.value.totalTimeSeconds ?? 0

  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    score,
    durationSeconds,
  }
})

onMounted(async () => {
  // Fetch subscription status and session data in parallel
  const [subStatus, result] = await Promise.all([
    practiceStore.getStudentSubscriptionStatus(),
    practiceStore.getSessionById(sessionId.value),
  ])

  subscriptionStatus.value = subStatus
  subscriptionRequired.value = !subStatus.canViewDetailedResults

  if (result.session) {
    session.value = result.session
    // has_practiced is now set automatically by a DB trigger on practice_sessions.completed_at
    // Refresh local dashboard state to pick up the trigger's changes
    if (result.session.completedAt) {
      await dashboardStore.fetchTodayStatus()
    }

    // Check if this is the current session (just completed) vs viewing from history
    isCurrentSession.value = practiceStore.currentSession?.id === result.session.id

    // Set AI summary status based on current state
    if (result.session.aiSummary) {
      aiSummaryStatus.value = 'success'
    } else if (subStatus.tier === 'max' && isCurrentSession.value) {
      // Just completed session without summary - trigger generation and track status
      generateAiSummary()
    }
    // For history sessions without summary, status stays 'idle' (will show "No summary")
  } else {
    router.push('/student/statistics')
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

// Convert selectedOptions (number[]) to option ids (letters)
function getSelectedOptionIds(answer: PracticeAnswer | undefined): string[] {
  if (!answer?.selectedOptions) return []
  return practiceStore.optionNumbersToIds(answer.selectedOptions)
}

// Check if an option was selected
function wasOptionSelected(answer: PracticeAnswer | undefined, optionId: string): boolean {
  return getSelectedOptionIds(answer).includes(optionId)
}

// Check if question is deleted
function isQuestionDeleted(question: unknown): boolean {
  return (question as { isDeleted?: boolean })?.isDeleted === true
}

// Get answer by index (for deleted questions where questionId is null)
function getAnswerByIndex(index: number): PracticeAnswer | undefined {
  return session.value?.answers[index]
}

// Helper to check if an option is filled (has text or image)
function isOptionFilled(opt: { text?: string | null; imagePath?: string | null }): boolean {
  return !!(opt.text && opt.text.trim()) || !!opt.imagePath
}

function goBack() {
  router.back()
}

function goToHistory() {
  router.push('/student/statistics')
}

// Manually trigger AI summary generation
async function generateAiSummary() {
  if (!session.value || aiSummaryStatus.value === 'loading') return

  aiSummaryStatus.value = 'loading'
  try {
    const { data, error } = await supabase.functions.invoke('generate-session-summary', {
      body: { sessionId: session.value.id },
    })

    if (error) {
      console.error('Failed to generate AI summary:', error)
      aiSummaryStatus.value = 'failed'
      return
    }

    if (data?.summary) {
      session.value.aiSummary = data.summary
      aiSummaryStatus.value = 'success'
    } else {
      aiSummaryStatus.value = 'failed'
    }
  } catch (err) {
    console.error('Error generating AI summary:', err)
    aiSummaryStatus.value = 'failed'
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

        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold">Session Results</h1>
            <p class="text-muted-foreground">
              {{ session.subjectName }} - {{ session.topicName }} | {{ session.gradeLevelName }}
            </p>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <div class="flex items-center gap-1.5 text-purple-600">
              <Star class="size-4" />
              <span class="font-medium">+{{ session.xpEarned ?? 0 }} XP</span>
            </div>
            <div class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <CirclePoundSterling class="size-4 text-amber-600 dark:text-amber-400" />
              <span class="font-medium">+{{ session.coinsEarned ?? 0 }} Coins</span>
            </div>
          </div>
        </div>
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

      <!-- AI Summary Card (always visible) -->
      <Card
        class="mb-6 border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20"
      >
        <CardHeader class="pb-2">
          <CardTitle
            class="flex items-center justify-between text-sm font-medium text-purple-700 dark:text-purple-300"
          >
            <div class="flex items-center gap-2">
              <BotMessageSquare class="size-4" />
              AI Summary
            </div>
            <!-- Generate button for Max tier when failed (current session) or no summary (history) -->
            <Button
              v-if="
                subscriptionStatus?.tier === 'max' &&
                !session.aiSummary &&
                aiSummaryStatus !== 'loading'
              "
              variant="outline"
              size="sm"
              class="h-7 text-xs"
              @click="generateAiSummary"
            >
              <RefreshCw class="mr-1 size-3" />
              {{ aiSummaryStatus === 'failed' ? 'Retry' : 'Generate Summary' }}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <!-- Non-Max tier: Upgrade message -->
          <div
            v-if="subscriptionStatus?.tier !== 'max'"
            class="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <Crown class="size-5 text-amber-500" />
            <span
              >Upgrade to <strong>Max</strong> to unlock AI-powered feedback for each session.</span
            >
          </div>

          <!-- Max tier: Loading state -->
          <div
            v-else-if="aiSummaryStatus === 'loading'"
            class="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 class="size-4 animate-spin" />
            Generating summary...
          </div>

          <!-- Max tier: Success - show summary -->
          <div
            v-else-if="session.aiSummary"
            class="text-sm leading-relaxed"
            v-html="parseSimpleMarkdown(session.aiSummary)"
          />

          <!-- Max tier: Failed state (only for current session) -->
          <div
            v-else-if="aiSummaryStatus === 'failed' && isCurrentSession"
            class="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <AlertCircle class="size-4 text-red-500" />
            Failed to generate summary. Click "Retry" to try again.
          </div>

          <!-- Max tier: No summary (history sessions) -->
          <div v-else class="text-sm text-muted-foreground">
            No summary available for this session.
          </div>
        </CardContent>
      </Card>

      <Separator class="mb-6" />

      <!-- Question Details Locked -->
      <Card
        v-if="subscriptionRequired"
        class="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 text-center dark:border-purple-800 dark:bg-card dark:from-purple-950/30 dark:to-indigo-950/30"
      >
        <CardContent class="py-8">
          <div
            class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50"
          >
            <Lock class="size-7 text-purple-500" />
          </div>
          <h3 class="text-lg font-semibold">Question Details Locked</h3>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            <template v-if="!subscriptionStatus?.isLinkedToParent">
              Link your account to a parent to unlock detailed session results. Ask your parent to
              send you an invitation.
            </template>
            <template v-else>
              Detailed session results require a Pro or Max subscription. Ask your parent to upgrade
              your plan.
            </template>
          </p>
          <Button
            v-if="!subscriptionStatus?.isLinkedToParent"
            class="mt-4"
            @click="router.push('/student/family')"
          >
            <Users class="mr-2 size-4" />
            Link to Parent
          </Button>
        </CardContent>
      </Card>

      <!-- Questions List -->
      <div v-else class="space-y-4">
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
            <div v-if="isQuestionDeleted(question)" class="text-sm text-muted-foreground italic">
              <p>This question has been deleted from the question bank.</p>
              <p class="mt-2">
                Your answer was:
                <span
                  :class="
                    getAnswerByIndex(index)?.isCorrect
                      ? 'text-green-600 font-medium'
                      : 'text-red-600 font-medium'
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
                    class="ml-auto shrink-0 border-green-500 text-green-600 dark:border-green-600 dark:text-green-400"
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
                    class="ml-auto shrink-0 border-green-500 text-green-600 dark:border-green-600 dark:text-green-400"
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
                    class="ml-auto shrink-0 border-red-500 text-red-600 dark:border-red-600 dark:text-red-400"
                  >
                    Correct answer
                  </Badge>
                  <Badge
                    v-else-if="wasOptionSelected(getAnswerByIndex(index), option.id)"
                    variant="outline"
                    class="ml-auto shrink-0 border-red-500 text-red-600 dark:border-red-600 dark:text-red-400"
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

    <!-- Empty State -->
    <div v-else class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goToHistory">Go to Statistics</Button>
    </div>
  </div>
</template>
