<script setup lang="ts">
import { computed } from 'vue'
import { usePracticeHistoryStore } from '@/stores/practice-history'
import { computeScorePercent } from '@/lib/questionHelpers'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-vue-next'
import { getScoreBarColor, getScoreTextColor, MEDAL_EMOJIS } from '@/lib/utils'
import { useT } from '@/composables/useT'

const t = useT()

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

// 3 fixed slots so the template can iterate a concrete (SubjectStats | null)[]
// and avoid non-null assertions on `topSubjects[index - 1]!.…`.
const topSubjectSlots = computed<(SubjectStats | null)[]>(() => [
  topSubjects.value[0] ?? null,
  topSubjects.value[1] ?? null,
  topSubjects.value[2] ?? null,
])

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
      <CardTitle class="text-sm font-medium">{{ t.shared.bestSubjectCard.title }}</CardTitle>
      <Trophy class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div class="space-y-3">
        <div v-for="(subject, i) in topSubjectSlots" :key="i" class="flex items-center gap-2">
          <span class="text-lg leading-none">{{ MEDAL_EMOJIS[i] }}</span>
          <template v-if="subject">
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="truncate text-sm font-medium">
                  {{ subject.gradeLevelName }} ·
                  {{ subject.subjectName }}
                </p>
                <span
                  class="shrink-0 text-sm font-bold"
                  :class="getScoreTextColor(subject.averageScore)"
                >
                  {{ t.shared.bestSubjectCard.averageLabel(subject.averageScore) }}
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
          </template>
          <template v-else>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-muted-foreground/60">
                {{ t.shared.bestSubjectCard.practiceMore }}
              </p>
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
