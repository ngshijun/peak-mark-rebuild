<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeStore } from '@/stores/practice'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-vue-next'

const practiceStore = usePracticeStore()
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
    const score = Math.round((session.correctCount / session.totalQuestions) * 100)
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
    class="cursor-pointer border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 transition-shadow hover:shadow-lg dark:border-sky-900/50 dark:from-sky-950/30 dark:to-blue-950/30"
    @click="goToHistory"
  >
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">Top Subjects</CardTitle>
      <Trophy class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <template v-if="topSubjects.length > 0">
        <div class="space-y-3">
          <div v-for="(subject, index) in topSubjects" :key="index" class="flex items-center gap-2">
            <span class="text-lg leading-none">{{ medals[index] }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="truncate text-sm font-medium">
                  {{ subject.gradeLevelName }} · {{ subject.subjectName }}
                </p>
                <span
                  class="shrink-0 text-sm font-bold"
                  :class="getScoreTextColor(subject.averageScore)"
                >
                  {{ subject.averageScore }}%
                </span>
              </div>
              <div
                class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900/30"
              >
                <div
                  class="h-full rounded-full transition-all"
                  :class="getScoreBarColor(subject.averageScore)"
                  :style="{ width: `${subject.averageScore}%` }"
                />
              </div>
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          {{ topSubjects.length === 1 ? '1 subject' : `${topSubjects.length} subjects` }} practiced
        </p>
      </template>
      <template v-else>
        <div class="flex items-center gap-3">
          <span class="text-4xl">📚</span>
          <div>
            <p class="font-medium text-muted-foreground">No data yet</p>
            <p class="text-xs text-muted-foreground">
              Complete practice sessions to see your stats
            </p>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
