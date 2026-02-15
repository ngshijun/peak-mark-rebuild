<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePracticeStore } from '@/stores/practice'
import { usePracticeHistoryStore } from '@/stores/practice-history'
import type { PracticeSession } from '@/lib/practiceHelpers'
import type { StudentSubscriptionStatus } from '@/stores/student-subscription'
import { useStudentDashboardStore } from '@/stores/student-dashboard'
import { parseSimpleMarkdown } from '@/lib/utils'
import { computeScorePercent } from '@/lib/questionHelpers'
import SessionResultContent from '@/components/session/SessionResultContent.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Loader2,
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
const historyStore = usePracticeHistoryStore()
const dashboardStore = useStudentDashboardStore()

const sessionId = computed(() => route.params.sessionId as string)
const session = ref<PracticeSession | null>(null)
const isLoading = ref(true)
const subscriptionStatus = ref<StudentSubscriptionStatus | null>(null)
const subscriptionRequired = ref(false)

const aiSummaryStatus = ref<'idle' | 'loading' | 'success' | 'failed'>('idle')
const isCurrentSession = ref(false)

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.questions.length || session.value.totalQuestions
  const correctAnswers = session.value.answers.filter((a) => a.isCorrect).length
  const score = computeScorePercent(correctAnswers, totalQuestions)
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
  const [subStatus, result] = await Promise.all([
    practiceStore.getStudentSubscriptionStatus(),
    historyStore.getSessionById(sessionId.value),
  ])

  subscriptionStatus.value = subStatus
  subscriptionRequired.value = !subStatus.canViewDetailedResults

  if (result.session) {
    session.value = result.session
    if (result.session.completedAt) {
      await dashboardStore.fetchTodayStatus()
    }

    isCurrentSession.value = practiceStore.currentSession?.id === result.session.id

    if (result.session.aiSummary) {
      aiSummaryStatus.value = 'success'
    } else if (subStatus.tier === 'max' && isCurrentSession.value) {
      generateAiSummary()
    }
  } else {
    router.push('/student/statistics')
  }
  isLoading.value = false
})

function goBack() {
  router.back()
}

function goToHistory() {
  router.push('/student/statistics')
}

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

      <SessionResultContent
        :summary="summary"
        :completed-at="session.completedAt"
        :questions="session.questions"
        :answers="session.answers"
        :is-locked="subscriptionRequired"
        answer-label="Your"
      >
        <template #ai-summary>
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
              <div
                v-if="subscriptionStatus?.tier !== 'max'"
                class="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <Crown class="size-5 text-amber-500" />
                <span
                  >Upgrade to <strong>Max</strong> to unlock AI-powered feedback for each
                  session.</span
                >
              </div>
              <div
                v-else-if="aiSummaryStatus === 'loading'"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 class="size-4 animate-spin" />
                Generating summary...
              </div>
              <div
                v-else-if="session.aiSummary"
                class="text-sm leading-relaxed"
                v-html="parseSimpleMarkdown(session.aiSummary)"
              />
              <div
                v-else-if="aiSummaryStatus === 'failed' && isCurrentSession"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <AlertCircle class="size-4 text-red-500" />
                Failed to generate summary. Click "Retry" to try again.
              </div>
              <div v-else class="text-sm text-muted-foreground">
                No summary available for this session.
              </div>
            </CardContent>
          </Card>
        </template>

        <template #locked-message>
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
        </template>
      </SessionResultContent>
    </template>

    <!-- Empty State -->
    <div v-else class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goToHistory">Go to Statistics</Button>
    </div>
  </div>
</template>
