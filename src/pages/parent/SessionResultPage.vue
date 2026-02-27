<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  useChildStatisticsStore,
  type ChildPracticeSessionFull,
  type ChildSubscriptionStatus,
} from '@/stores/child-statistics'
import { useChildLinkStore } from '@/stores/child-link'
import { parseSimpleMarkdown } from '@/lib/utils'
import SessionResultContent from '@/components/session/SessionResultContent.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Sparkles, BotMessageSquare, Crown } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const childStatisticsStore = useChildStatisticsStore()
const childLinkStore = useChildLinkStore()

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
    router.replace('/parent/statistics')
  }
  isLoading.value = false
})

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
                class="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300"
              >
                <BotMessageSquare class="size-4" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                v-if="childSubscription?.tier !== 'max'"
                class="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <Crown class="size-5 text-amber-500" />
                <span
                  >Upgrade to <strong>Max</strong> to unlock AI-powered feedback for each
                  session.</span
                >
              </div>
              <div
                v-else-if="session.aiSummary"
                class="text-sm leading-relaxed"
                v-html="parseSimpleMarkdown(session.aiSummary)"
              />
              <div v-else class="text-sm text-muted-foreground">
                No summary available for this session.
              </div>
            </CardContent>
          </Card>
        </template>

        <template #locked-message>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Detailed session results require a Pro or Max subscription. Upgrade to view individual
            questions and answers.
          </p>
          <Button class="mt-4" @click="router.push('/parent/subscription')">
            <Sparkles class="mr-2 size-4" />
            Upgrade Plan
          </Button>
        </template>
      </SessionResultContent>
    </template>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="py-12 text-center">
      <p class="text-muted-foreground">Session not found</p>
      <Button class="mt-4" @click="goBack">Go Back</Button>
    </div>
  </div>
</template>
