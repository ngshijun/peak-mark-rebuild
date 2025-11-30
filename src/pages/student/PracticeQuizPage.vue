<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePracticeStore } from '@/stores/practice'
import { useQuestionsStore, type Question } from '@/stores/questions'
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const router = useRouter()
const route = useRoute()
const practiceStore = usePracticeStore()
const questionsStore = useQuestionsStore()

const selectedOptionId = ref('')
const textAnswer = ref('')
const showExitDialog = ref(false)
const isResuming = ref(false)

// Time tracking for current question
const questionStartTime = ref<number>(Date.now())

// Reset timer when question changes (track by question index)
watch(
  () => practiceStore.currentQuestionNumber,
  () => {
    questionStartTime.value = Date.now()
  },
)

// Resume session from query param or redirect if no active session
onMounted(async () => {
  const sessionId = route.query.sessionId as string | undefined

  // If there's a sessionId in the URL and no active session, try to resume
  if (sessionId && !practiceStore.isSessionActive) {
    isResuming.value = true
    const result = await practiceStore.resumeSession(sessionId)
    isResuming.value = false

    if (result.error || !result.session) {
      // Failed to resume - redirect to practice page
      router.push('/student/practice')
      return
    }
  } else if (!practiceStore.isSessionActive) {
    // No session ID and no active session - redirect
    router.push('/student/practice')
  }

  // Initialize question start time
  questionStartTime.value = Date.now()
})

const currentQuestion = computed(() => practiceStore.currentQuestion)
const currentAnswer = computed(() => practiceStore.currentAnswer)
const isAnswered = computed(() => practiceStore.isCurrentQuestionAnswered)
const progress = computed(() => {
  if (!practiceStore.totalQuestions) return 0
  return (practiceStore.currentQuestionNumber / practiceStore.totalQuestions) * 100
})

const isLastQuestion = computed(() => {
  return practiceStore.currentQuestionNumber === practiceStore.totalQuestions
})

const allQuestionsAnswered = computed(() => {
  return practiceStore.currentSession?.answers.length === practiceStore.totalQuestions
})

// Get correct answer for display
const correctAnswer = computed(() => {
  if (!currentQuestion.value) return ''
  if (currentQuestion.value.type === 'mcq') {
    const correct = currentQuestion.value.options.find((o) => o.isCorrect)
    return correct?.text ?? ''
  }
  return currentQuestion.value.answer ?? ''
})

// Get the selected option id from the current answer (convert from number to letter)
const answeredOptionId = computed(() => {
  if (!currentAnswer.value?.selectedOption) return null
  return practiceStore.optionNumberToId(currentAnswer.value.selectedOption)
})

async function submitAnswer() {
  if (!currentQuestion.value) return

  // Calculate time spent on this question in seconds
  const timeSpentSeconds = Math.round((Date.now() - questionStartTime.value) / 1000)

  if (currentQuestion.value.type === 'mcq') {
    if (!selectedOptionId.value) return
    await practiceStore.submitAnswer(selectedOptionId.value, undefined, timeSpentSeconds)
  } else {
    if (!textAnswer.value.trim()) return
    await practiceStore.submitAnswer(undefined, textAnswer.value.trim(), timeSpentSeconds)
  }
}

async function nextQuestion() {
  // Reset input state
  selectedOptionId.value = ''
  textAnswer.value = ''
  await practiceStore.nextQuestion()
}

async function previousQuestion() {
  // Reset input state
  selectedOptionId.value = ''
  textAnswer.value = ''
  await practiceStore.previousQuestion()
}

async function finishQuiz() {
  const result = await practiceStore.completeSession()
  if (result.session) {
    router.push(`/student/session/${result.session.id}`)
  }
}

function exitQuiz() {
  practiceStore.endSession()
  router.push('/student/practice')
}

async function restartQuiz() {
  const session = practiceStore.currentSession
  if (session) {
    practiceStore.endSession()
    await practiceStore.startSession(session.topicId)
    selectedOptionId.value = ''
    textAnswer.value = ''
  }
}

function goHome() {
  practiceStore.endSession()
  router.push('/student/practice')
}

async function goToQuestion(index: number) {
  await practiceStore.goToQuestion(index)
  selectedOptionId.value = ''
  textAnswer.value = ''
}
</script>

<template>
  <div class="p-6">
    <!-- Loading state while resuming session -->
    <div v-if="isResuming" class="flex flex-col items-center justify-center py-20">
      <div
        class="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
      ></div>
      <p class="text-muted-foreground">Resuming your session...</p>
    </div>

    <template v-else>
      <!-- Session Info & Progress -->
      <div class="mb-6">
        <div class="mb-2 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold">
              {{ practiceStore.currentSession?.subjectName }} -
              {{ practiceStore.currentSession?.topicName }}
            </h1>
            <p class="text-sm text-muted-foreground">
              Question {{ practiceStore.currentQuestionNumber }} of
              {{ practiceStore.totalQuestions }}
            </p>
          </div>
          <Button variant="outline" size="sm" @click="showExitDialog = true"> Exit Quiz </Button>
        </div>
        <Progress :model-value="progress" class="h-2" />
      </div>

      <!-- Question Card -->
      <div v-if="currentQuestion">
        <Card>
          <CardHeader>
            <div class="flex items-start justify-between">
              <CardTitle class="text-lg">{{ currentQuestion.question }}</CardTitle>
              <Badge variant="secondary">
                {{ currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Short Answer' }}
              </Badge>
            </div>
          </CardHeader>

          <CardContent class="space-y-4">
            <!-- Question Image -->
            <div v-if="currentQuestion.imagePath" class="flex justify-center">
              <img
                :src="questionsStore.getQuestionImageUrl(currentQuestion.imagePath)"
                alt="Question image"
                class="max-h-64 rounded-lg border object-contain"
              />
            </div>

            <!-- MCQ Options -->
            <div v-if="currentQuestion.type === 'mcq'" class="space-y-2">
              <button
                v-for="option in currentQuestion.options"
                :key="option.id"
                class="w-full rounded-lg border p-4 text-left transition-colors"
                :class="{
                  'border-primary bg-primary/5': selectedOptionId === option.id && !isAnswered,
                  'hover:border-primary/50 hover:bg-muted/50':
                    !isAnswered && selectedOptionId !== option.id,
                  'cursor-not-allowed': isAnswered,
                  'border-green-500 bg-green-50 dark:bg-green-950/20':
                    isAnswered && option.isCorrect,
                  'border-red-500 bg-red-50 dark:bg-red-950/20':
                    isAnswered && answeredOptionId === option.id && !option.isCorrect,
                }"
                :disabled="isAnswered"
                @click="selectedOptionId = option.id"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="flex size-8 shrink-0 items-center justify-center rounded-full border font-medium"
                    :class="{
                      'border-primary bg-primary text-primary-foreground':
                        selectedOptionId === option.id && !isAnswered,
                      'border-green-500 bg-green-500 text-white': isAnswered && option.isCorrect,
                      'border-red-500 bg-red-500 text-white':
                        isAnswered && answeredOptionId === option.id && !option.isCorrect,
                    }"
                  >
                    {{ option.id.toUpperCase() }}
                  </span>
                  <div class="flex flex-1 items-center gap-2">
                    <span v-if="option.text">{{ option.text }}</span>
                    <img
                      v-if="option.imagePath"
                      :src="questionsStore.getQuestionImageUrl(option.imagePath)"
                      :alt="`Option ${option.id.toUpperCase()}`"
                      class="max-h-16 rounded border object-contain"
                    />
                  </div>
                  <CheckCircle2
                    v-if="isAnswered && option.isCorrect"
                    class="ml-auto size-5 text-green-500"
                  />
                  <XCircle
                    v-if="isAnswered && answeredOptionId === option.id && !option.isCorrect"
                    class="ml-auto size-5 text-red-500"
                  />
                </div>
              </button>
            </div>

            <!-- Short Answer Input -->
            <div v-else class="space-y-2">
              <Input
                v-model="textAnswer"
                placeholder="Type your answer..."
                :disabled="isAnswered"
                class="text-lg"
                @keyup.enter="!isAnswered && submitAnswer()"
              />
              <div v-if="isAnswered" class="mt-4 rounded-lg border p-4">
                <div class="flex items-center gap-2">
                  <CheckCircle2 v-if="currentAnswer?.isCorrect" class="size-5 text-green-500" />
                  <XCircle v-else class="size-5 text-red-500" />
                  <span class="font-medium">
                    {{ currentAnswer?.isCorrect ? 'Correct!' : 'Incorrect' }}
                  </span>
                </div>
                <p v-if="!currentAnswer?.isCorrect" class="mt-2 text-sm text-muted-foreground">
                  The correct answer is:
                  <span class="font-medium text-foreground">{{ correctAnswer }}</span>
                </p>
              </div>
            </div>

            <!-- Explanation (shown after answering, if wrong) -->
            <div
              v-if="isAnswered && !currentAnswer?.isCorrect && currentQuestion.explanation"
              class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
            >
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200">Explanation</p>
              <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {{ currentQuestion.explanation }}
              </p>
            </div>
          </CardContent>

          <CardFooter class="flex justify-between">
            <Button
              variant="outline"
              :disabled="practiceStore.currentQuestionNumber === 1"
              @click="previousQuestion"
            >
              <ChevronLeft class="mr-2 size-4" />
              Previous
            </Button>

            <div class="flex gap-2">
              <Button
                v-if="!isAnswered"
                :disabled="currentQuestion.type === 'mcq' ? !selectedOptionId : !textAnswer.trim()"
                @click="submitAnswer"
              >
                Submit Answer
              </Button>

              <Button v-else-if="!isLastQuestion" @click="nextQuestion">
                Next
                <ChevronRight class="ml-2 size-4" />
              </Button>

              <Button v-else-if="allQuestionsAnswered" @click="finishQuiz"> Finish Quiz </Button>

              <Button v-else @click="nextQuestion">
                Next
                <ChevronRight class="ml-2 size-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>

        <!-- Question Navigation -->
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button
            v-for="(q, index) in practiceStore.currentSession?.questions"
            :key="q.id"
            class="flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors"
            :class="{
              'border-primary bg-primary text-primary-foreground':
                index === practiceStore.currentQuestionNumber - 1,
              'border-green-500 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300':
                practiceStore.currentSession?.answers.find((a) => a.questionId === q.id)?.isCorrect,
              'border-red-500 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300':
                practiceStore.currentSession?.answers.find((a) => a.questionId === q.id) &&
                !practiceStore.currentSession?.answers.find((a) => a.questionId === q.id)
                  ?.isCorrect,
              'hover:border-primary/50': index !== practiceStore.currentQuestionNumber - 1,
            }"
            @click="goToQuestion(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
      </div>
    </template>

    <!-- Exit Confirmation Dialog -->
    <AlertDialog v-model:open="showExitDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit Quiz?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to exit? Your progress will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue Quiz</AlertDialogCancel>
          <AlertDialogAction @click="exitQuiz">Exit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
