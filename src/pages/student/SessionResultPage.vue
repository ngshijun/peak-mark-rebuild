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
import { formatDateTime } from '@/lib/date'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { parseSimpleMarkdown } from '@/lib/utils'
import SessionSummaryCards from '@/components/session/SessionSummaryCards.vue'
import SessionQuestionCard from '@/components/session/SessionQuestionCard.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
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

function getAnswerByIndex(index: number): PracticeAnswer | undefined {
  return session.value?.answers[index]
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
  const { summary, error } = await practiceStore.generateSessionSummary(session.value.id)

  if (error || !summary) {
    aiSummaryStatus.value = 'failed'
    return
  }

  session.value.aiSummary = summary
  aiSummaryStatus.value = 'success'
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
      <SessionSummaryCards
        :score="summary.score"
        :correct-answers="summary.correctAnswers"
        :incorrect-answers="summary.incorrectAnswers"
        :duration-seconds="summary.durationSeconds"
      />

      <div v-if="session.completedAt" class="mb-4 text-sm text-muted-foreground">
        Completed: {{ formatDateTime(session.completedAt) }}
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

        <SessionQuestionCard
          v-for="(question, index) in session.questions"
          :key="question.id"
          :question="question"
          :answer="getAnswerByIndex(index)"
          :index="index"
          answer-label="Your"
          :get-image-url="questionsStore.getOptimizedQuestionImageUrl"
          :get-thumbnail-url="questionsStore.getThumbnailQuestionImageUrl"
        />
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goToHistory">Go to Statistics</Button>
    </div>
  </div>
</template>
