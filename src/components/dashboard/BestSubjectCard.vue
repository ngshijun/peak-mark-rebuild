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

const bestSubject = computed<SubjectStats | null>(() => {
  // Get completed sessions only
  const completedSessions = practiceStore
    .getFilteredHistory()
    .filter((s) => s.completedAt && s.totalQuestions > 0)

  if (completedSessions.length === 0) return null

  // Calculate average score per grade level + subject combination
  const subjectMap = new Map<
    string,
    { gradeLevelName: string; subjectName: string; totalScore: number; count: number }
  >()

  completedSessions.forEach((session) => {
    const score = Math.round((session.correctCount / session.totalQuestions) * 100)
    // Use combination of grade level and subject as key
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

  // Find the subject with the highest average score
  let best: SubjectStats | null = null

  subjectMap.forEach((stats) => {
    const averageScore = Math.round(stats.totalScore / stats.count)
    if (!best || averageScore > best.averageScore) {
      best = {
        gradeLevelName: stats.gradeLevelName,
        subjectName: stats.subjectName,
        totalScore: stats.totalScore,
        sessionCount: stats.count,
        averageScore,
      }
    }
  })

  return best
})

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function goToHistory() {
  router.push('/student/history')
}
</script>

<template>
  <!-- Soft blue tint - knowledge/learning association -->
  <Card
    class="cursor-pointer border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 dark:border-sky-900/50 dark:from-sky-950/30 dark:to-blue-950/30"
    @click="goToHistory"
  >
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">Best Subject</CardTitle>
      <Trophy class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <template v-if="bestSubject">
        <div class="flex items-center gap-3">
          <span class="text-4xl">🏆</span>
          <div>
            <p class="font-medium">
              {{ bestSubject.gradeLevelName }} - {{ bestSubject.subjectName }}
            </p>
            <p class="text-2xl font-bold" :class="getScoreColor(bestSubject.averageScore)">
              {{ bestSubject.averageScore }}%
              <span class="text-sm font-normal text-muted-foreground">avg</span>
            </p>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Based on {{ bestSubject.sessionCount }} session{{
            bestSubject.sessionCount > 1 ? 's' : ''
          }}
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
