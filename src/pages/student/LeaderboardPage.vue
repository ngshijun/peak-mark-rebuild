<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import confetti from 'canvas-confetti'
import {
  useLeaderboardStore,
  type LeaderboardStudent,
  type WeeklyLeaderboardStudent,
  type WeeklyReward,
} from '@/stores/leaderboard'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore } from '@/stores/curriculum'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trophy, Medal, Award, Loader2, CirclePoundSterling, CalendarClock } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import fireGif from '@/assets/icons/fire.gif'
import { toMYTDateString, getMYTDayOfWeek, mytDateToUTCDate } from '@/lib/date'

const leaderboardStore = useLeaderboardStore()
const authStore = useAuthStore()
const curriculumStore = useCurriculumStore()

const ALL_VALUE = '__all__'
const selectedGradeLevel = ref<string>(ALL_VALUE)
const activeTab = ref<'all-time' | 'weekly'>('all-time')

// Coin rewards for weekly leaderboard top 10
const WEEKLY_COIN_REWARDS = [500, 400, 300, 250, 200, 150, 125, 100, 75, 50] as const

function getWeeklyReward(rank: number): number | null {
  if (rank >= 1 && rank <= 10) return WEEKLY_COIN_REWARDS[rank - 1] ?? null
  return null
}

// Countdown to next Monday 00:00 MYT
const countdown = ref('')
let countdownInterval: ReturnType<typeof setInterval> | null = null

function getNextMondayMYT(): Date {
  const dayOfWeek = getMYTDayOfWeek() // 0=Sun, 1=Mon, ...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek

  // Get today in MYT as a UTC-midnight date, add days, then shift to MYT midnight
  const todayUTC = mytDateToUTCDate(toMYTDateString())
  const nextMondayUTC = new Date(todayUTC)
  nextMondayUTC.setUTCDate(todayUTC.getUTCDate() + daysUntilMonday)

  // Convert MYT midnight (00:00+08:00) to UTC: subtract 8 hours
  return new Date(nextMondayUTC.getTime() - 8 * 60 * 60 * 1000)
}

function updateCountdown() {
  const now = new Date()
  const target = getNextMondayMYT()
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) {
    countdown.value = 'Ending...'
    return
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) {
    countdown.value = `${days}d ${hours}h`
  } else if (hours > 0) {
    countdown.value = `${hours}h ${minutes}m`
  } else {
    countdown.value = `${minutes}m`
  }
}

// Weekly reward notification
const showRewardDialog = ref(false)
const lastWeekReward = ref<WeeklyReward | null>(null)

function getOrdinalSuffix(rank: number): string {
  if (rank === 1) return 'st'
  if (rank === 2) return 'nd'
  if (rank === 3) return 'rd'
  return 'th'
}

async function checkWeeklyReward() {
  if (!leaderboardStore.hasUnseenReward) return

  const reward = await leaderboardStore.fetchLastWeekReward()
  if (!reward) return

  lastWeekReward.value = reward
  showRewardDialog.value = true
}

// Fire confetti when reward dialog opens
watch(showRewardDialog, (open) => {
  if (open) {
    const duration = 1500
    const end = Date.now() + duration
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }
})

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
  } catch {
    toast.error('Failed to load leaderboard')
  }

  // Check for weekly reward notification
  checkWeeklyReward()

  // Start countdown timer
  updateCountdown()
  countdownInterval = setInterval(updateCountdown, 60_000)
})

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function getRankIcon(rank: number) {
  if (rank === 1) return Trophy
  if (rank === 2) return Medal
  if (rank === 3) return Award
  return null
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-500'
  if (rank === 2) return 'text-gray-400'
  if (rank === 3) return 'text-amber-600'
  return 'text-muted-foreground'
}
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
        <TabsTrigger value="weekly"> Weekly </TabsTrigger>
      </TabsList>

      <!-- All-Time Tab -->
      <TabsContent value="all-time">
        <!-- Loading State -->
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
            <div v-if="displayedStudents.length === 0" class="py-12 text-center">
              <p class="text-muted-foreground">No students found for this grade level.</p>
            </div>

            <div v-else class="divide-y">
              <div
                v-for="student in displayedStudents"
                :key="student.id"
                class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
                :class="{
                  'bg-primary/5': authStore.user?.id === student.id,
                }"
              >
                <!-- Rank -->
                <div class="flex w-12 items-center justify-center">
                  <component
                    :is="getRankIcon(student.rank)"
                    v-if="getRankIcon(student.rank)"
                    class="size-6"
                    :class="getRankColor(student.rank)"
                  />
                  <span v-else class="text-lg font-semibold" :class="getRankColor(student.rank)">
                    {{ student.rank }}
                  </span>
                </div>

                <!-- Avatar -->
                <Avatar class="size-10">
                  <AvatarImage
                    :src="leaderboardStore.getAvatarUrl(student.avatarPath)"
                    :alt="student.name"
                  />
                  <AvatarFallback>{{ getInitials(student.name) }}</AvatarFallback>
                </Avatar>

                <!-- Student Info -->
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">
                    {{ student.name }}
                    <Badge
                      v-if="authStore.user?.id === student.id"
                      variant="secondary"
                      class="ml-2"
                    >
                      You
                    </Badge>
                  </p>
                  <p class="text-sm text-muted-foreground">{{ student.gradeLevelName ?? 'N/A' }}</p>
                </div>

                <!-- Stats -->
                <div class="flex items-center gap-6">
                  <!-- Streak -->
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Streak</p>
                    <p class="flex items-center justify-center gap-1 font-semibold">
                      <img
                        v-if="student.currentStreak > 0"
                        :src="fireGif"
                        alt="fire"
                        loading="lazy"
                        class="size-4"
                      />
                      {{ student.currentStreak }}
                    </p>
                  </div>

                  <!-- Level -->
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Level</p>
                    <p class="font-semibold">{{ student.level }}</p>
                  </div>

                  <!-- XP -->
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">XP</p>
                    <p class="font-semibold">{{ student.xp.toLocaleString() }}</p>
                  </div>
                </div>
              </div>

              <!-- Current student row if not in top 20 -->
              <template v-if="currentStudentInfo">
                <div class="border-t-2 border-dashed" />
                <div class="flex items-center gap-4 bg-primary/5 px-6 py-4">
                  <!-- Rank -->
                  <div class="flex w-12 items-center justify-center">
                    <span class="text-lg font-semibold text-muted-foreground">
                      {{ currentStudentInfo.rank }}
                    </span>
                  </div>

                  <!-- Avatar -->
                  <Avatar class="size-10">
                    <AvatarImage
                      :src="leaderboardStore.getAvatarUrl(currentStudentInfo.avatarPath)"
                      :alt="currentStudentInfo.name"
                    />
                    <AvatarFallback>{{ getInitials(currentStudentInfo.name) }}</AvatarFallback>
                  </Avatar>

                  <!-- Student Info -->
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">
                      {{ currentStudentInfo.name }}
                      <Badge variant="secondary" class="ml-2">You</Badge>
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{ currentStudentInfo.gradeLevelName ?? 'N/A' }}
                    </p>
                  </div>

                  <!-- Stats -->
                  <div class="flex items-center gap-6">
                    <!-- Streak -->
                    <div class="w-12 text-center">
                      <p class="text-sm text-muted-foreground">Streak</p>
                      <p class="flex items-center justify-center gap-1 font-semibold">
                        <img
                          v-if="currentStudentInfo.currentStreak > 0"
                          :src="fireGif"
                          alt="fire"
                          loading="lazy"
                          class="size-4"
                        />
                        {{ currentStudentInfo.currentStreak }}
                      </p>
                    </div>

                    <!-- Level -->
                    <div class="w-12 text-center">
                      <p class="text-sm text-muted-foreground">Level</p>
                      <p class="font-semibold">{{ currentStudentInfo.level }}</p>
                    </div>

                    <!-- XP -->
                    <div class="w-12 text-center">
                      <p class="text-sm text-muted-foreground">XP</p>
                      <p class="font-semibold">{{ currentStudentInfo.xp.toLocaleString() }}</p>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Weekly Tab -->
      <TabsContent value="weekly">
        <!-- Loading State -->
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
            <div v-if="displayedWeeklyStudents.length === 0" class="py-12 text-center">
              <p class="text-muted-foreground">No students have earned XP this week yet.</p>
            </div>

            <div v-else class="divide-y">
              <div
                v-for="student in displayedWeeklyStudents"
                :key="student.id"
                class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
                :class="{
                  'bg-primary/5': authStore.user?.id === student.id,
                }"
              >
                <!-- Rank -->
                <div class="flex w-12 items-center justify-center">
                  <component
                    :is="getRankIcon(student.rank)"
                    v-if="getRankIcon(student.rank)"
                    class="size-6"
                    :class="getRankColor(student.rank)"
                  />
                  <span v-else class="text-lg font-semibold" :class="getRankColor(student.rank)">
                    {{ student.rank }}
                  </span>
                </div>

                <!-- Avatar -->
                <Avatar class="size-10">
                  <AvatarImage
                    :src="leaderboardStore.getAvatarUrl(student.avatarPath)"
                    :alt="student.name"
                  />
                  <AvatarFallback>{{ getInitials(student.name) }}</AvatarFallback>
                </Avatar>

                <!-- Student Info -->
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">
                    {{ student.name }}
                    <Badge
                      v-if="authStore.user?.id === student.id"
                      variant="secondary"
                      class="ml-2"
                    >
                      You
                    </Badge>
                  </p>
                  <p class="text-sm text-muted-foreground">{{ student.gradeLevelName ?? 'N/A' }}</p>
                </div>

                <!-- Stats -->
                <div class="flex items-center gap-6">
                  <!-- Coin Reward -->
                  <div v-if="getWeeklyReward(student.rank)" class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Reward</p>
                    <p
                      class="flex items-center justify-center gap-1 font-semibold text-amber-600 dark:text-amber-400"
                    >
                      <CirclePoundSterling class="size-3.5" />
                      {{ getWeeklyReward(student.rank) }}
                    </p>
                  </div>
                  <div v-else class="w-12" />

                  <!-- Level -->
                  <div class="w-12 text-center">
                    <p class="text-sm text-muted-foreground">Level</p>
                    <p class="font-semibold">{{ student.level }}</p>
                  </div>

                  <!-- Weekly XP -->
                  <div class="w-16 text-center">
                    <p class="text-sm text-muted-foreground">XP</p>
                    <p class="font-semibold">{{ student.weeklyXp.toLocaleString() }}</p>
                  </div>
                </div>
              </div>

              <!-- Current student row if not in top 20 -->
              <template v-if="currentWeeklyStudentInfo">
                <div class="border-t-2 border-dashed" />
                <div class="flex items-center gap-4 bg-primary/5 px-6 py-4">
                  <!-- Rank -->
                  <div class="flex w-12 items-center justify-center">
                    <span class="text-lg font-semibold text-muted-foreground">
                      {{ currentWeeklyStudentInfo.rank }}
                    </span>
                  </div>

                  <!-- Avatar -->
                  <Avatar class="size-10">
                    <AvatarImage
                      :src="leaderboardStore.getAvatarUrl(currentWeeklyStudentInfo.avatarPath)"
                      :alt="currentWeeklyStudentInfo.name"
                    />
                    <AvatarFallback>{{
                      getInitials(currentWeeklyStudentInfo.name)
                    }}</AvatarFallback>
                  </Avatar>

                  <!-- Student Info -->
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">
                      {{ currentWeeklyStudentInfo.name }}
                      <Badge variant="secondary" class="ml-2">You</Badge>
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{ currentWeeklyStudentInfo.gradeLevelName ?? 'N/A' }}
                    </p>
                  </div>

                  <!-- Stats -->
                  <div class="flex items-center gap-6">
                    <!-- Coin Reward placeholder -->
                    <div
                      v-if="getWeeklyReward(currentWeeklyStudentInfo.rank)"
                      class="w-12 text-center"
                    >
                      <p class="text-sm text-muted-foreground">Reward</p>
                      <p
                        class="flex items-center justify-center gap-1 font-semibold text-amber-600 dark:text-amber-400"
                      >
                        <CirclePoundSterling class="size-3.5" />
                        {{ getWeeklyReward(currentWeeklyStudentInfo.rank) }}
                      </p>
                    </div>
                    <div v-else class="w-12" />

                    <!-- Level -->
                    <div class="w-12 text-center">
                      <p class="text-sm text-muted-foreground">Level</p>
                      <p class="font-semibold">{{ currentWeeklyStudentInfo.level }}</p>
                    </div>

                    <!-- Weekly XP -->
                    <div class="w-16 text-center">
                      <p class="text-sm text-muted-foreground">XP</p>
                      <p class="font-semibold">
                        {{ currentWeeklyStudentInfo.weeklyXp.toLocaleString() }}
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <!-- Weekly Reward Notification Dialog -->
    <Dialog
      :open="showRewardDialog"
      @update:open="
        (v: boolean) => {
          if (!v) dismissRewardDialog()
        }
      "
    >
      <DialogContent class="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle class="text-center text-xl">Weekly Leaderboard Results</DialogTitle>
          <DialogDescription class="text-center">
            Last week's competition has ended!
          </DialogDescription>
        </DialogHeader>

        <div v-if="lastWeekReward" class="space-y-4 py-2">
          <div class="flex flex-col items-center gap-2">
            <Trophy class="size-12 text-yellow-500" />
            <p class="text-2xl font-bold">
              {{ lastWeekReward.rank }}{{ getOrdinalSuffix(lastWeekReward.rank) }} Place
            </p>
            <p class="text-sm text-muted-foreground">
              You earned {{ lastWeekReward.weeklyXp.toLocaleString() }} XP last week
            </p>
          </div>

          <div
            class="flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-4 py-3 dark:bg-amber-950/30"
          >
            <CirclePoundSterling class="size-5 text-amber-600 dark:text-amber-400" />
            <span class="text-lg font-bold text-amber-600 dark:text-amber-400">
              +{{ lastWeekReward.coinsAwarded }} Coins
            </span>
          </div>

          <Button class="w-full" @click="dismissRewardDialog"> Awesome! </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
