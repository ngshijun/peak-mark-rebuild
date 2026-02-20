<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import {
  useLeaderboardStore,
  type LeaderboardStudent,
  type WeeklyLeaderboardStudent,
  type WeeklyReward,
} from '@/stores/leaderboard'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore } from '@/stores/curriculum'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Trophy,
  Loader2,
  CirclePoundSterling,
  CalendarClock,
  Swords,
  CalendarSync,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import fireGif from '@/assets/icons/fire.gif'
import { useCountdownTimer } from '@/composables/useCountdownTimer'
import LeaderboardTable from '@/components/student/LeaderboardTable.vue'
import WeeklyRewardDialog from '@/components/student/WeeklyRewardDialog.vue'

const leaderboardStore = useLeaderboardStore()
const authStore = useAuthStore()
const curriculumStore = useCurriculumStore()

const ALL_VALUE = '__all__'
const selectedGradeLevel = ref<string>(ALL_VALUE)
const activeTab = ref<'all-time' | 'weekly'>('all-time')

// Weekly competition info banner (permanently dismissible)
const weeklyBannerDismissed = useLocalStorage('weekly_competition_banner_dismissed', false)

// Coin rewards for weekly leaderboard top 10
const WEEKLY_COIN_REWARDS = [500, 400, 300, 250, 200, 150, 125, 100, 75, 50] as const

function getWeeklyReward(rank: number): number | null {
  if (rank >= 1 && rank <= 10) return WEEKLY_COIN_REWARDS[rank - 1] ?? null
  return null
}

// Countdown to next Monday 00:00 MYT
const { countdown } = useCountdownTimer()

// Weekly reward notification
const showRewardDialog = ref(false)
const lastWeekReward = ref<WeeklyReward | null>(null)

async function checkWeeklyReward() {
  if (!leaderboardStore.hasUnseenReward) return

  const reward = await leaderboardStore.fetchLastWeekReward()
  if (!reward) return

  lastWeekReward.value = reward
  showRewardDialog.value = true
}

function dismissRewardDialog() {
  showRewardDialog.value = false
  if (lastWeekReward.value) {
    leaderboardStore.markRewardSeen(lastWeekReward.value.weekStart)
  }
}

// Computed for the filtered all-time leaderboard
const displayedStudents = computed<LeaderboardStudent[]>(() => {
  if (selectedGradeLevel.value === ALL_VALUE) {
    return leaderboardStore.getTop20()
  }

  const gradeLevel = curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel.value)
  if (!gradeLevel) {
    return leaderboardStore.getTop20()
  }

  return leaderboardStore.getTop20(gradeLevel.name)
})

// Computed for the weekly leaderboard (no grade filter — purely weekly XP)
const displayedWeeklyStudents = computed<WeeklyLeaderboardStudent[]>(() => {
  return leaderboardStore.getWeeklyTop20()
})

// Current student info for all-time when not in top 20
const currentStudentInfo = computed(() => {
  if (!authStore.user || !authStore.isStudent) return null

  const inTop20 = displayedStudents.value.some((s) => s.id === authStore.user!.id)
  if (inTop20) return null

  const currentStudent = leaderboardStore.currentStudent
  if (!currentStudent) return null

  if (selectedGradeLevel.value !== ALL_VALUE) {
    const gradeLevel = curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel.value)
    if (gradeLevel && currentStudent.gradeLevelName !== gradeLevel.name) {
      return null
    }
  }

  const allFiltered =
    selectedGradeLevel.value === ALL_VALUE
      ? leaderboardStore.students
      : leaderboardStore.getStudentsByGradeLevel(
          curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel.value)?.name ?? null,
        )

  // RANK()-style: count students with strictly higher XP + 1
  const rank = allFiltered.filter((s) => s.xp > currentStudent.xp).length + 1

  return {
    ...currentStudent,
    rank,
  }
})

// Current student info for weekly when not in top 20
const currentWeeklyStudentInfo = computed(() => {
  if (!authStore.user || !authStore.isStudent) return null

  const inTop20 = displayedWeeklyStudents.value.some((s) => s.id === authStore.user!.id)
  if (inTop20) return null

  const currentStudent = leaderboardStore.currentWeeklyStudent
  if (!currentStudent) return null

  // RANK()-style: count students with strictly higher weekly XP + 1
  const rank =
    leaderboardStore.weeklyStudents.filter((s) => s.weeklyXp > currentStudent.weeklyXp).length + 1

  return {
    ...currentStudent,
    rank,
  }
})

// Fetch data on mount
onMounted(async () => {
  try {
    if (curriculumStore.gradeLevels.length === 0) {
      await curriculumStore.fetchCurriculum()
    }

    // Fetch both leaderboards in parallel
    await Promise.all([
      leaderboardStore.fetchLeaderboard(),
      leaderboardStore.fetchWeeklyLeaderboard(),
    ])
  } catch (err) {
    console.error('Failed to load leaderboard:', err)
    toast.error('Failed to load leaderboard')
  }

  // Check for weekly reward notification
  checkWeeklyReward()
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">Leaderboard</h1>
        <p class="text-muted-foreground">Top students with the highest XP</p>
      </div>

      <!-- Grade Level Filter (all-time only) -->
      <Select
        v-if="activeTab === 'all-time'"
        v-model="selectedGradeLevel"
        :disabled="leaderboardStore.isLoading"
      >
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="All Grade Levels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL_VALUE">All Grade Levels</SelectItem>
          <SelectItem
            v-for="gradeLevel in curriculumStore.gradeLevels"
            :key="gradeLevel.id"
            :value="gradeLevel.id"
          >
            {{ gradeLevel.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="all-time">All-Time</TabsTrigger>
        <TabsTrigger value="weekly"> Weekly Competition </TabsTrigger>
      </TabsList>

      <!-- All-Time Tab -->
      <TabsContent value="all-time">
        <div v-if="leaderboardStore.isLoading" class="flex items-center justify-center py-12">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>

        <Card v-else>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Trophy class="size-5 text-yellow-500" />
              Top 20 Students
              <Badge v-if="selectedGradeLevel !== ALL_VALUE" variant="secondary" class="ml-2">
                {{
                  curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel)?.name ?? ''
                }}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent class="p-0">
            <LeaderboardTable
              :entries="displayedStudents"
              :current-student-entry="currentStudentInfo"
              empty-message="No students found for this grade level."
            >
              <template #stats="{ entry }">
                <div class="flex items-center gap-6">
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Streak</p>
                    <p class="flex items-center justify-center gap-1 font-semibold">
                      <img
                        v-if="(entry as LeaderboardStudent).currentStreak > 0"
                        :src="fireGif"
                        alt="fire"
                        loading="lazy"
                        class="size-4"
                      />
                      {{ (entry as LeaderboardStudent).currentStreak }}
                    </p>
                  </div>
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Level</p>
                    <p class="font-semibold">{{ (entry as LeaderboardStudent).level }}</p>
                  </div>
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">XP</p>
                    <p class="font-semibold">
                      {{ (entry as LeaderboardStudent).xp.toLocaleString() }}
                    </p>
                  </div>
                </div>
              </template>
              <template #current-student-stats="{ entry }">
                <div class="flex items-center gap-6">
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Streak</p>
                    <p class="flex items-center justify-center gap-1 font-semibold">
                      <img
                        v-if="(entry as LeaderboardStudent).currentStreak > 0"
                        :src="fireGif"
                        alt="fire"
                        loading="lazy"
                        class="size-4"
                      />
                      {{ (entry as LeaderboardStudent).currentStreak }}
                    </p>
                  </div>
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Level</p>
                    <p class="font-semibold">{{ (entry as LeaderboardStudent).level }}</p>
                  </div>
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">XP</p>
                    <p class="font-semibold">
                      {{ (entry as LeaderboardStudent).xp.toLocaleString() }}
                    </p>
                  </div>
                </div>
              </template>
            </LeaderboardTable>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Weekly Tab -->
      <TabsContent value="weekly" class="space-y-4">
        <div
          v-if="!weeklyBannerDismissed"
          class="relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-500/10 via-amber-500/10 to-purple-500/10 border border-purple-500/20 p-4"
        >
          <button
            class="absolute top-2 right-2 rounded-full p-1 opacity-50 transition-opacity hover:opacity-100"
            @click="weeklyBannerDismissed = true"
          >
            <X class="size-4" />
            <span class="sr-only">Dismiss</span>
          </button>
          <h3 class="mb-3 pr-6 font-bold">How It Works</h3>
          <div class="grid gap-2 text-sm sm:grid-cols-3">
            <div class="flex items-center gap-2">
              <Swords class="size-4 shrink-0 text-purple-500" />
              <span>Earn XP to climb the ranks</span>
            </div>
            <div class="flex items-center gap-2">
              <CirclePoundSterling class="size-4 shrink-0 text-amber-500" />
              <span>Top 10 win coin rewards</span>
            </div>
            <div class="flex items-center gap-2">
              <CalendarSync class="size-4 shrink-0 text-blue-500" />
              <span>Resets every Monday</span>
            </div>
          </div>
        </div>

        <div v-if="leaderboardStore.isWeeklyLoading" class="flex items-center justify-center py-12">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>

        <Card v-else>
          <CardHeader>
            <CardTitle class="flex flex-wrap items-center gap-2">
              <Trophy class="size-5 text-yellow-500" />
              Weekly Top 20
              <Badge v-if="selectedGradeLevel !== ALL_VALUE" variant="secondary">
                {{
                  curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel)?.name ?? ''
                }}
              </Badge>
              <Badge variant="outline" class="ml-auto gap-1">
                <CalendarClock class="size-3" />
                Ends in {{ countdown }}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent class="p-0">
            <LeaderboardTable
              :entries="displayedWeeklyStudents"
              :current-student-entry="currentWeeklyStudentInfo"
              empty-message="No students have earned XP this week yet."
            >
              <template #stats="{ entry }">
                <div class="flex items-center gap-6">
                  <div
                    v-if="getWeeklyReward((entry as WeeklyLeaderboardStudent).rank)"
                    class="w-12 text-center"
                  >
                    <p class="text-sm text-muted-foreground">Reward</p>
                    <p
                      class="flex items-center justify-center gap-1 font-semibold text-amber-600 dark:text-amber-400"
                    >
                      <CirclePoundSterling class="size-3.5" />
                      {{ getWeeklyReward((entry as WeeklyLeaderboardStudent).rank) }}
                    </p>
                  </div>
                  <div v-else class="w-12" />
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Level</p>
                    <p class="font-semibold">{{ (entry as WeeklyLeaderboardStudent).level }}</p>
                  </div>
                  <div class="w-16 text-center">
                    <p class="text-sm text-muted-foreground">XP</p>
                    <p class="font-semibold">
                      {{ (entry as WeeklyLeaderboardStudent).weeklyXp.toLocaleString() }}
                    </p>
                  </div>
                </div>
              </template>
              <template #current-student-stats="{ entry }">
                <div class="flex items-center gap-6">
                  <div
                    v-if="getWeeklyReward((entry as WeeklyLeaderboardStudent).rank)"
                    class="w-12 text-center"
                  >
                    <p class="text-sm text-muted-foreground">Reward</p>
                    <p
                      class="flex items-center justify-center gap-1 font-semibold text-amber-600 dark:text-amber-400"
                    >
                      <CirclePoundSterling class="size-3.5" />
                      {{ getWeeklyReward((entry as WeeklyLeaderboardStudent).rank) }}
                    </p>
                  </div>
                  <div v-else class="w-12" />
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Level</p>
                    <p class="font-semibold">{{ (entry as WeeklyLeaderboardStudent).level }}</p>
                  </div>
                  <div class="w-16 text-center">
                    <p class="text-sm text-muted-foreground">XP</p>
                    <p class="font-semibold">
                      {{ (entry as WeeklyLeaderboardStudent).weeklyXp.toLocaleString() }}
                    </p>
                  </div>
                </div>
              </template>
            </LeaderboardTable>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <!-- Weekly Reward Notification Dialog -->
    <WeeklyRewardDialog
      :open="showRewardDialog"
      :reward="lastWeekReward"
      @dismiss="dismissRewardDialog"
    />
  </div>
</template>
