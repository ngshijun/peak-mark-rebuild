<script setup lang="ts">
import { formatDuration } from '@/lib/date'
import {
  type SessionAnswer,
  wasOptionSelected,
  isQuestionDeleted,
  isOptionFilled,
} from '@/lib/sessionResult'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock } from 'lucide-vue-next'

export interface SessionQuestion {
  id: string
  type: 'mcq' | 'mrq' | 'short_answer'
  question: string
  imagePath?: string | null
  answer?: string | null
  explanation?: string | null
  isDeleted?: boolean
  options?: Array<{
    id: string
    text?: string | null
    imagePath?: string | null
    isCorrect: boolean
  }>
}

const props = defineProps<{
  question: SessionQuestion
  answer: SessionAnswer | undefined
  index: number
  /** Controls label text: "Your" produces "Your answer", "Student's" produces "Student's answer" */
  answerLabel: 'Your' | "Student's"
  getImageUrl: (path: string | null) => string
  getThumbnailUrl: (path: string | null) => string
}>()
</script>

<template>
  <Card
    :class="{
      'border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/20':
        isQuestionDeleted(question),
      'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20':
        !isQuestionDeleted(question) && answer?.isCorrect,
      'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20':
        !isQuestionDeleted(question) && answer && !answer.isCorrect,
    }"
  >
    <CardHeader class="pb-2">
      <div class="flex items-start justify-between gap-2">
        <CardTitle class="text-sm font-medium"> Question {{ index + 1 }} </CardTitle>
        <div class="flex items-center gap-2">
          <span
            v-if="answer?.timeSpentSeconds != null"
            class="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Clock class="size-3" />
            {{ formatDuration(answer.timeSpentSeconds ?? 0) }}
          </span>
          <Badge v-if="isQuestionDeleted(question)" variant="secondary" class="shrink-0">
            Deleted
          </Badge>
          <template v-else>
            <Badge variant="secondary" class="shrink-0">
              {{
                question.type === 'mcq'
                  ? 'Multiple Choice'
                  : question.type === 'mrq'
                    ? 'Multiple Response'
                    : 'Short Answer'
              }}
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
          {{ answerLabel }} answer was:
          <span
            :class="answer?.isCorrect ? 'font-medium text-green-600' : 'font-medium text-red-600'"
          >
            {{ answer?.isCorrect ? 'Correct' : 'Incorrect' }}
          </span>
        </p>
      </div>

      <!-- Question Text -->
      <template v-else>
        <p class="text-sm whitespace-pre-line">{{ question.question }}</p>

        <!-- Question Image -->
        <img
          v-if="question.imagePath"
          :src="getImageUrl(question.imagePath)"
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
                (question.type === 'mcq' || wasOptionSelected(answer, option.id)),
              'border-red-500 bg-red-100 dark:bg-red-900/30':
                (!option.isCorrect && wasOptionSelected(answer, option.id)) ||
                (question.type === 'mrq' &&
                  option.isCorrect &&
                  !wasOptionSelected(answer, option.id)),
            }"
          >
            <!-- Correct and selected -->
            <span
              v-if="option.isCorrect && wasOptionSelected(answer, option.id)"
              class="text-green-600"
            >
              <CheckCircle2 class="size-4" />
            </span>
            <!-- MCQ: Correct but NOT selected -->
            <span
              v-else-if="
                question.type === 'mcq' && option.isCorrect && !wasOptionSelected(answer, option.id)
              "
              class="text-green-600"
            >
              <CheckCircle2 class="size-4" />
            </span>
            <!-- MRQ: Correct but NOT selected (missed) -->
            <span
              v-else-if="
                question.type === 'mrq' && option.isCorrect && !wasOptionSelected(answer, option.id)
              "
              class="text-red-600"
            >
              <XCircle class="size-4" />
            </span>
            <!-- Incorrect and selected -->
            <span v-else-if="wasOptionSelected(answer, option.id)" class="text-red-600">
              <XCircle class="size-4" />
            </span>
            <!-- Incorrect and not selected -->
            <span v-else class="size-4" />
            <div class="flex flex-1 items-center gap-2">
              <span v-if="option.text">{{ option.text }}</span>
              <img
                v-if="option.imagePath"
                :src="getThumbnailUrl(option.imagePath)"
                :alt="`Option ${option.id.toUpperCase()}`"
                class="max-h-12 rounded border object-contain"
                loading="lazy"
              />
            </div>
            <!-- Labels for clarity -->
            <Badge
              v-if="option.isCorrect && wasOptionSelected(answer, option.id)"
              variant="outline"
              class="ml-auto shrink-0 border-green-500 text-green-600 dark:border-green-600 dark:text-green-400"
            >
              {{ answerLabel }} answer
            </Badge>
            <Badge
              v-else-if="
                question.type === 'mcq' && option.isCorrect && !wasOptionSelected(answer, option.id)
              "
              variant="outline"
              class="ml-auto shrink-0 border-green-500 text-green-600 dark:border-green-600 dark:text-green-400"
            >
              Correct answer
            </Badge>
            <Badge
              v-else-if="
                question.type === 'mrq' && option.isCorrect && !wasOptionSelected(answer, option.id)
              "
              variant="outline"
              class="ml-auto shrink-0 border-red-500 text-red-600 dark:border-red-600 dark:text-red-400"
            >
              Correct answer
            </Badge>
            <Badge
              v-else-if="wasOptionSelected(answer, option.id)"
              variant="outline"
              class="ml-auto shrink-0 border-red-500 text-red-600 dark:border-red-600 dark:text-red-400"
            >
              {{ answerLabel }} answer
            </Badge>
          </div>
        </div>

        <!-- Short Answer -->
        <div v-else-if="question.type === 'short_answer'" class="space-y-2 text-sm">
          <div class="flex gap-2">
            <span class="font-medium">{{ answerLabel }} Answer:</span>
            <span :class="answer?.isCorrect ? 'text-green-600' : 'text-red-600'">
              {{ answer?.textAnswer || '-' }}
            </span>
          </div>
          <div v-if="!answer?.isCorrect" class="flex gap-2">
            <span class="font-medium">Correct Answer:</span>
            <span class="text-green-600">{{ question.answer }}</span>
          </div>
        </div>

        <!-- Explanation -->
        <div
          v-if="answer"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
        >
          <p class="text-sm font-medium text-amber-800 dark:text-amber-200">Explanation</p>
          <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {{ question.explanation || 'No explanation available for this question.' }}
          </p>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
