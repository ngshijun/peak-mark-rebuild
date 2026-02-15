<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeHistoryStore } from '@/stores/practice-history'
import { computeScorePercent } from '@/lib/questionHelpers'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-vue-next'

const practiceStore = usePracticeHistoryStore()
const router = useRouter()

interface SubjectStats {
  gradeLevelName: string
  subjectName: string
  totalScore: number
  sessionCount: number
  averageScore: number
}

const topSubjects = computed<SubjectStats[]>(() => {
  const completedSessions = practiceStore
    .getFilteredHistory()
    .filter((s) => s.completedAt && s.totalQuestions > 0)

  if (completedSessions.length === 0) return []

  const subjectMap = new Map<
    string,
    { gradeLevelName: string; subjectName: string; totalScore: number; count: number }
  >()

  completedSessions.forEach((session) => {
    const score = computeScorePercent(session.correctAnswers, session.totalQuestions)
    const key = `${session.gradeLevelName}::${session.subjectName}`
    const existing = subjectMap.get(key)

    if (existing) {
      existing.totalScore += score
      existing.count += 1
    } else {
      subjectMap.set(key, {
        gradeLevelName: session.gradeLevelName,
        subjectName: session.subjectName,
        totalScore: score,
        count: 1,
      })
    }
  })

  const subjects: SubjectStats[] = []
  subjectMap.forEach((stats) => {
    subjects.push({
      gradeLevelName: stats.gradeLevelName,
      subjectName: stats.subjectName,
      totalScore: stats.totalScore,
      sessionCount: stats.count,
      averageScore: Math.round(stats.totalScore / stats.count),
    })
  })

  return subjects.sort((a, b) => b.averageScore - a.averageScore).slice(0, 3)
})

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

const medals = ['🥇', '🥈', '🥉']

function goToHistory() {
  router.push('/student/history')
}
</script>

<template>
  <!-- Soft blue tint - knowledge/learning association -->
  <Card
    class="cursor-pointer border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 transition-shadow hover:shadow-lg dark:border-sky-900/50 dark:bg-card dark:from-sky-950/30 dark:to-blue-950/30"
    @click="goToHistory"
  >
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">Top Subjects</CardTitle>
      <Trophy class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div class="space-y-3">
        <div v-for="index in 3" :key="index" class="flex items-center gap-2">
          <span class="text-lg leading-none">{{ medals[index - 1] }}</span>
          <template v-if="topSubjects[index - 1]">
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="truncate text-sm font-medium">
                  {{ topSubjects[index - 1]!.gradeLevelName }} ·
                  {{ topSubjects[index - 1]!.subjectName }}
                </p>
                <span
                  class="shrink-0 text-sm font-bold"
                  :class="getScoreTextColor(topSubjects[index - 1]!.averageScore)"
                >
                  Avg: {{ topSubjects[index - 1]!.averageScore }}%
                </span>
              </div>
              <div
                class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900/30"
              >
                <div
                  class="h-full rounded-full transition-all"
                  :class="getScoreBarColor(topSubjects[index - 1]!.averageScore)"
                  :style="{ width: `${topSubjects[index - 1]!.averageScore}%` }"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-muted-foreground/60">Practice more to unlock!</p>
              <div
                class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900/30"
              />
            </div>
          </template>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
