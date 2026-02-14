<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  useChildStatisticsStore,
  type ChildPracticeSessionFull,
  type ChildSubscriptionStatus,
  type PracticeAnswer,
} from '@/stores/child-statistics'
import { useChildLinkStore } from '@/stores/child-link'
import { useQuestionsStore } from '@/stores/questions'
import { formatDateTime } from '@/lib/date'
import { parseSimpleMarkdown } from '@/lib/utils'
import SessionSummaryCards from '@/components/session/SessionSummaryCards.vue'
import SessionQuestionCard from '@/components/session/SessionQuestionCard.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, Lock, Sparkles, BotMessageSquare, Crown } from 'lucide-vue-next'

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
const childSubscription = ref<ChildSubscriptionStatus | null>(null)

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.totalQuestions
  const correctAnswers = session.value.correctAnswers
  const score = session.value.score
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
  const [result, subStatus] = await Promise.all([
    childStatisticsStore.getSessionById(childId.value, sessionId.value),
    childStatisticsStore.getChildSubscriptionStatus(childId.value),
  ])
  childSubscription.value = subStatus
  if (result.session) {
    session.value = result.session
  }
  subscriptionRequired.value = result.subscriptionRequired ?? false
  if (!result.session && !result.subscriptionRequired) {
    error.value = result.error
    router.push('/parent/statistics')
  }
  isLoading.value = false
})

function getAnswerByIndex(index: number): PracticeAnswer | undefined {
  return session.value?.answers[index]
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
      <SessionSummaryCards
        :score="summary.score"
        :correct-answers="summary.correctAnswers"
        :incorrect-answers="summary.incorrectAnswers"
        :duration-seconds="summary.durationSeconds"
      />

      <div v-if="session.completedAt" class="mb-4 text-sm text-muted-foreground">
        Completed: {{ formatDateTime(session.completedAt) }}
      </div>

      <!-- AI Summary -->
      <Card
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
          <!-- Non-Max tier: Upgrade message -->
          <div
            v-if="childSubscription?.tier !== 'max'"
            class="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <Crown class="size-5 text-amber-500" />
            <span
              >Upgrade to <strong>Max</strong> to unlock AI-powered feedback for each session.</span
            >
          </div>

          <!-- Max tier: Show summary -->
          <div
            v-else-if="session.aiSummary"
            class="text-sm leading-relaxed"
            v-html="parseSimpleMarkdown(session.aiSummary)"
          />

          <!-- Max tier: No summary available -->
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
            Detailed session results require a Pro or Max subscription. Upgrade to view individual
            questions and answers.
          </p>
          <Button class="mt-4" @click="router.push('/parent/subscription')">
            <Sparkles class="mr-2 size-4" />
            Upgrade Plan
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
    <div v-else-if="!isLoading" class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goBack">Go Back</Button>
    </div>
  </div>
</template>
