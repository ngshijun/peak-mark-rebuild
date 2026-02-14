<script setup lang="ts">
import type { SessionQuestion } from './SessionQuestionCard.vue'
import type { SessionAnswer } from '@/lib/sessionResult'
import { formatDateTime } from '@/lib/date'
import { useQuestionsStore } from '@/stores/questions'
import SessionSummaryCards from './SessionSummaryCards.vue'
import SessionQuestionCard from './SessionQuestionCard.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Lock } from 'lucide-vue-next'

const questionsStore = useQuestionsStore()

defineProps<{
  summary: {
    score: number
    correctAnswers: number
    incorrectAnswers: number
    durationSeconds: number
  }
  completedAt: string | null
  questions: SessionQuestion[]
  answers: SessionAnswer[]
  isLocked: boolean
  answerLabel: 'Your' | "Student's"
}>()

function getAnswerByIndex(answers: SessionAnswer[], index: number): SessionAnswer | undefined {
  return answers[index]
}
</script>

<template>
  <!-- Summary Cards -->
  <SessionSummaryCards
    :score="summary.score"
    :correct-answers="summary.correctAnswers"
    :incorrect-answers="summary.incorrectAnswers"
    :duration-seconds="summary.durationSeconds"
  />

  <div v-if="completedAt" class="mb-4 text-sm text-muted-foreground">
    Completed: {{ formatDateTime(completedAt) }}
  </div>

  <!-- AI Summary (role-specific) -->
  <slot name="ai-summary" />

  <Separator class="mb-6" />

  <!-- Question Details Locked -->
  <Card
    v-if="isLocked"
    class="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 text-center dark:border-purple-800 dark:bg-card dark:from-purple-950/30 dark:to-indigo-950/30"
  >
    <CardContent class="py-8">
      <div
        class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50"
      >
        <Lock class="size-7 text-purple-500" />
      </div>
      <h3 class="text-lg font-semibold">Question Details Locked</h3>
      <slot name="locked-message" />
    </CardContent>
  </Card>

  <!-- Questions List -->
  <div v-else class="space-y-4">
    <h2 class="text-lg font-semibold">Question Details</h2>

    <SessionQuestionCard
      v-for="(question, index) in questions"
      :key="question.id"
      :question="question"
      :answer="getAnswerByIndex(answers, index)"
      :index="index"
      :answer-label="answerLabel"
      :get-image-url="questionsStore.getOptimizedQuestionImageUrl"
      :get-thumbnail-url="questionsStore.getThumbnailQuestionImageUrl"
    />
  </div>
</template>
