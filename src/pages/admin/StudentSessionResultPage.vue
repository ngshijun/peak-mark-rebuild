<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStudentsStore } from '@/stores/admin-students'
import {
  useAdminStudentStatsStore,
  type StudentPracticeSessionFull,
  type PracticeAnswer,
} from '@/stores/admin-student-stats'
import { useQuestionsStore } from '@/stores/questions'
import { formatDateTime } from '@/lib/date'
import { parseSimpleMarkdown } from '@/lib/utils'
import SessionSummaryCards from '@/components/session/SessionSummaryCards.vue'
import SessionQuestionCard from '@/components/session/SessionQuestionCard.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, BotMessageSquare } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const adminStudentsStore = useAdminStudentsStore()
const adminStatsStore = useAdminStudentStatsStore()
const questionsStore = useQuestionsStore()

const studentId = computed(() => route.params.studentId as string)
const sessionId = computed(() => route.params.sessionId as string)

// Get student info
const student = computed(() => adminStudentsStore.getStudentById(studentId.value))

const session = ref<StudentPracticeSessionFull | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const summary = computed(() => {
  if (!session.value) return null
  const totalQuestions = session.value.questions.length || session.value.totalQuestions
  const correctAnswers = session.value.answers.filter((a) => a.isCorrect).length
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

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
  // Ensure students are loaded first
  if (adminStudentsStore.students.length === 0) {
    await adminStudentsStore.fetchAllStudents()
  }

  const result = await adminStatsStore.getSessionById(studentId.value, sessionId.value)
  if (result.session) {
    session.value = result.session
  } else {
    error.value = result.error
    // Redirect if session not found
    router.push(`/admin/students/${studentId.value}/statistics`)
  }
  isLoading.value = false
})

function getAnswerByIndex(index: number): PracticeAnswer | undefined {
  return session.value?.answers[index]
}

function goBack() {
  router.push(`/admin/students/${studentId.value}/statistics`)
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
          Back to Statistics
        </Button>

        <h1 class="text-2xl font-bold">Session Results</h1>
        <p v-if="student" class="text-muted-foreground">
          {{ student.name }} - {{ session.subjectName }} - {{ session.topicName }} |
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

        <SessionQuestionCard
          v-for="(question, index) in session.questions"
          :key="question.id"
          :question="question"
          :answer="getAnswerByIndex(index)"
          :index="index"
          answer-label="Student's"
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
