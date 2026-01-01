<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePracticeStore } from '@/stores/practice'
import { useQuestionsStore, type Question, type MCQOption } from '@/stores/questions'
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Flag } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
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
import QuestionFeedbackDialog from '@/components/practice/QuestionFeedbackDialog.vue'

const router = useRouter()
const route = useRoute()
const practiceStore = usePracticeStore()
const questionsStore = useQuestionsStore()

const selectedOptionIds = ref<Set<string>>(new Set())
const textAnswer = ref('')
const showExitDialog = ref(false)
const showFeedbackDialog = ref(false)
const isResuming = ref(false)

// Time tracking for current question
const questionStartTime = ref<number>(Date.now())

// Store shuffled options per question (keyed by question ID)
const shuffledOptionsMap = ref<Map<string, MCQOption[]>>(new Map())

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }
  return shuffled
}

// Get filtered and shuffled options for current question (MCQ and MRQ)
const displayOptions = computed(() => {
  if (
    !currentQuestion.value ||
    (currentQuestion.value.type !== 'mcq' && currentQuestion.value.type !== 'mrq')
  )
    return []

  const questionId = currentQuestion.value.id

  // Check if we already have shuffled options for this question
  if (shuffledOptionsMap.value.has(questionId)) {
    return shuffledOptionsMap.value.get(questionId)!
  }

  // Filter out empty options (no text and no image)
  const nonEmptyOptions = currentQuestion.value.options.filter(
    (opt) => (opt.text && opt.text.trim()) || opt.imagePath,
  )

  // Shuffle the options
  const shuffled = shuffleArray(nonEmptyOptions)

  // Store for consistent display when navigating back
  shuffledOptionsMap.value.set(questionId, shuffled)

  return shuffled
})

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
      toast.error('Failed to resume session')
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

// O(1) lookup Map for answers by question ID (avoids repeated .find() calls in template)
const answerByQuestionId = computed(() => {
  const map = new Map<string, { isCorrect: boolean }>()
  for (const answer of practiceStore.currentSession?.answers ?? []) {
    if (answer.questionId) {
      map.set(answer.questionId, { isCorrect: answer.isCorrect })
    }
  }
  return map
})

// Get correct answer for display
const correctAnswer = computed(() => {
  if (!currentQuestion.value) return ''
  if (currentQuestion.value.type === 'mcq') {
    const correct = currentQuestion.value.options.find((o) => o.isCorrect)
    return correct?.text ?? ''
  }
  if (currentQuestion.value.type === 'mrq') {
    const correctOptions = currentQuestion.value.options.filter((o) => o.isCorrect)
    return correctOptions.map((o) => o.text).join(', ')
  }
  return currentQuestion.value.answer ?? ''
})

// Get the selected option ids from the current answer (convert from numbers to letters)
const answeredOptionIds = computed(() => {
  if (!currentAnswer.value?.selectedOptions) return []
  return practiceStore.optionNumbersToIds(currentAnswer.value.selectedOptions)
})

// Check if all options are image-only (no text)
const isImageOnlyOptions = computed(() => {
  if (!displayOptions.value.length) return false
  return displayOptions.value.every((opt) => opt.imagePath && !opt.text?.trim())
})

async function submitAnswer() {
  if (!currentQuestion.value) return

  // Calculate time spent on this question in seconds
  const timeSpentSeconds = Math.round((Date.now() - questionStartTime.value) / 1000)

  if (currentQuestion.value.type === 'mcq' || currentQuestion.value.type === 'mrq') {
    if (selectedOptionIds.value.size === 0) return
    await practiceStore.submitAnswer(
      Array.from(selectedOptionIds.value),
      undefined,
      timeSpentSeconds,
    )
  } else {
    if (!textAnswer.value.trim()) return
    await practiceStore.submitAnswer(undefined, textAnswer.value.trim(), timeSpentSeconds)
  }
}

async function nextQuestion() {
  // Reset input state
  selectedOptionIds.value = new Set()
  textAnswer.value = ''
  await practiceStore.nextQuestion()
}

async function previousQuestion() {
  // Reset input state
  selectedOptionIds.value = new Set()
  textAnswer.value = ''
  await practiceStore.previousQuestion()
}

async function finishQuiz() {
  const result = await practiceStore.completeSession()
  if (result.session) {
    toast.success('Quiz completed!')
    router.push(`/student/session/${result.session.id}`)
  } else if (result.error) {
    toast.error('Failed to complete quiz')
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
    await practiceStore.startSession(session.subTopicId)
    selectedOptionIds.value = new Set()
    textAnswer.value = ''
  }
}

function goHome() {
  practiceStore.endSession()
  router.push('/student/practice')
}

async function goToQuestion(index: number) {
  await practiceStore.goToQuestion(index)
  selectedOptionIds.value = new Set()
  textAnswer.value = ''
}

// Handle option click - single select for MCQ, toggle for MRQ
function handleOptionClick(optionId: string) {
  if (!currentQuestion.value) return

  if (currentQuestion.value.type === 'mcq') {
    // MCQ: single selection (radio behavior)
    selectedOptionIds.value = new Set([optionId])
  } else if (currentQuestion.value.type === 'mrq') {
    // MRQ: toggle selection (checkbox behavior)
    const newSet = new Set(selectedOptionIds.value)
    if (newSet.has(optionId)) {
      newSet.delete(optionId)
    } else {
      newSet.add(optionId)
    }
    selectedOptionIds.value = newSet
  }
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
            <div class="flex items-start justify-between gap-4">
              <CardTitle class="text-lg whitespace-pre-line">{{
                currentQuestion.question
              }}</CardTitle>
              <div class="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">
                  {{
                    currentQuestion.type === 'mcq'
                      ? 'Multiple Choice'
                      : currentQuestion.type === 'mrq'
                        ? 'Multiple Response'
                        : 'Short Answer'
                  }}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  title="Report an issue with this question"
                  @click="showFeedbackDialog = true"
                >
                  <Flag class="size-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-4">
            <!-- Question Image (using optimized URL for faster loading) -->
            <!-- Key forces re-render on question change to prevent showing previous image -->
            <div v-if="currentQuestion.imagePath" class="flex justify-center">
              <img
                :key="currentQuestion.id"
                :src="questionsStore.getOptimizedQuestionImageUrl(currentQuestion.imagePath)"
                alt="Question image"
                class="max-h-64 rounded-lg border object-contain"
                loading="eager"
              />
            </div>

            <!-- MCQ/MRQ Options (shuffled and filtered) -->
            <div
              v-if="currentQuestion.type === 'mcq' || currentQuestion.type === 'mrq'"
              :class="isImageOnlyOptions ? 'grid grid-cols-2 gap-3' : 'space-y-2'"
            >
              <!-- Hint for MRQ -->
              <p
                v-if="currentQuestion.type === 'mrq'"
                class="text-sm text-muted-foreground"
                :class="{ 'col-span-2': isImageOnlyOptions }"
              >
                Select all correct answers
              </p>
              <button
                v-for="(option, index) in displayOptions"
                :key="option.id"
                class="w-full rounded-lg border p-4 transition-colors"
                :class="{
                  'text-left': !isImageOnlyOptions,
                  'border-primary bg-primary/5': selectedOptionIds.has(option.id) && !isAnswered,
                  'hover:border-primary/50 hover:bg-muted/50':
                    !isAnswered && !selectedOptionIds.has(option.id),
                  'cursor-not-allowed': isAnswered,
                  'border-green-500 bg-green-50 dark:bg-green-950/20':
                    isAnswered && option.isCorrect,
                  'border-red-500 bg-red-50 dark:bg-red-950/20':
                    isAnswered && answeredOptionIds.includes(option.id) && !option.isCorrect,
                }"
                :disabled="isAnswered"
                @click="handleOptionClick(option.id)"
              >
                <!-- Image-only layout: vertical with centered content -->
                <div v-if="isImageOnlyOptions" class="flex flex-col items-center gap-2">
                  <div class="flex w-full items-center justify-between">
                    <span
                      class="flex size-8 shrink-0 items-center justify-center rounded-full border font-medium"
                      :class="{
                        'border-primary bg-primary text-primary-foreground':
                          selectedOptionIds.has(option.id) && !isAnswered,
                        'border-green-500 bg-green-500 text-white': isAnswered && option.isCorrect,
                        'border-red-500 bg-red-500 text-white':
                          isAnswered && answeredOptionIds.includes(option.id) && !option.isCorrect,
                      }"
                    >
                      {{ String.fromCharCode(65 + index) }}
                    </span>
                    <CheckCircle2
                      v-if="isAnswered && option.isCorrect"
                      class="size-5 text-green-500"
                    />
                    <XCircle
                      v-if="
                        isAnswered && answeredOptionIds.includes(option.id) && !option.isCorrect
                      "
                      class="size-5 text-red-500"
                    />
                  </div>
                  <img
                    v-if="option.imagePath"
                    :key="`${currentQuestion.id}-${option.id}`"
                    :src="questionsStore.getThumbnailQuestionImageUrl(option.imagePath)"
                    :alt="`Option ${String.fromCharCode(65 + index)}`"
                    class="max-h-32 rounded border object-contain"
                    loading="lazy"
                  />
                </div>
                <!-- Text/mixed layout: horizontal -->
                <div v-else class="flex items-center gap-3">
                  <span
                    class="flex size-8 shrink-0 items-center justify-center rounded-full border font-medium"
                    :class="{
                      'border-primary bg-primary text-primary-foreground':
                        selectedOptionIds.has(option.id) && !isAnswered,
                      'border-green-500 bg-green-500 text-white': isAnswered && option.isCorrect,
                      'border-red-500 bg-red-500 text-white':
                        isAnswered && answeredOptionIds.includes(option.id) && !option.isCorrect,
                    }"
                  >
                    {{ String.fromCharCode(65 + index) }}
                  </span>
                  <div class="flex flex-1 items-center gap-2">
                    <span v-if="option.text">{{ option.text }}</span>
                    <img
                      v-if="option.imagePath"
                      :key="`${currentQuestion.id}-${option.id}`"
                      :src="questionsStore.getThumbnailQuestionImageUrl(option.imagePath)"
                      :alt="`Option ${String.fromCharCode(65 + index)}`"
                      class="max-h-16 rounded border object-contain"
                      loading="lazy"
                    />
                  </div>
                  <CheckCircle2
                    v-if="isAnswered && option.isCorrect"
                    class="ml-auto size-5 text-green-500"
                  />
                  <XCircle
                    v-if="isAnswered && answeredOptionIds.includes(option.id) && !option.isCorrect"
                    class="ml-auto size-5 text-red-500"
                  />
                </div>
              </button>
            </div>

            <!-- Short Answer Input -->
            <div v-if="currentQuestion.type === 'short_answer'" class="space-y-2">
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
                :disabled="
                  currentQuestion.type === 'mcq' || currentQuestion.type === 'mrq'
                    ? selectedOptionIds.size === 0
                    : !textAnswer.trim()
                "
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
              'border-green-500 bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300':
                answerByQuestionId.get(q.id)?.isCorrect,
              'border-red-500 bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300':
                answerByQuestionId.has(q.id) && !answerByQuestionId.get(q.id)?.isCorrect,
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
            Are you sure you want to exit? Your progress is saved and you can continue later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue Quiz</AlertDialogCancel>
          <AlertDialogAction @click="exitQuiz">Exit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Question Feedback Dialog -->
    <QuestionFeedbackDialog
      v-if="currentQuestion"
      v-model:open="showFeedbackDialog"
      :question-id="currentQuestion.id"
    />
  </div>
</template>
