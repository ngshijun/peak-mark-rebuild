<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useLeaderboardStore, type LeaderboardStudent } from '@/stores/leaderboard'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore } from '@/stores/curriculum'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trophy, Medal, Award, Loader2, Flame } from 'lucide-vue-next'

const leaderboardStore = useLeaderboardStore()
const authStore = useAuthStore()
const curriculumStore = useCurriculumStore()

const ALL_VALUE = '__all__'
const selectedGradeLevel = ref<string>(ALL_VALUE)

// Computed for the filtered leaderboard
const displayedStudents = computed<LeaderboardStudent[]>(() => {
  if (selectedGradeLevel.value === ALL_VALUE) {
    return leaderboardStore.getTop20()
  }

  // Find the grade level name from the ID
  const gradeLevel = curriculumStore.gradeLevels.find(
    (g) => g.id === selectedGradeLevel.value,
  )
  if (!gradeLevel) {
    return leaderboardStore.getTop20()
  }

  return leaderboardStore.getTop20(gradeLevel.name)
})

// Current student info for display when not in top 20
const currentStudentInfo = computed(() => {
  if (!authStore.user || !authStore.isStudent) return null

  // Check if student is in displayed list
  const inTop20 = displayedStudents.value.some((s) => s.id === authStore.user!.id)
  if (inTop20) return null

  // Get current student's data
  const currentStudent = leaderboardStore.currentStudent
  if (!currentStudent) return null

  // If filtering by grade level, check if current student matches
  if (selectedGradeLevel.value !== ALL_VALUE) {
    const gradeLevel = curriculumStore.gradeLevels.find(
      (g) => g.id === selectedGradeLevel.value,
    )
    if (gradeLevel && currentStudent.gradeLevelName !== gradeLevel.name) {
      return null
    }
  }

  // Calculate rank within the filtered set
  const allFiltered =
    selectedGradeLevel.value === ALL_VALUE
      ? leaderboardStore.students
      : leaderboardStore.getStudentsByGradeLevel(
          curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel.value)?.name ??
            null,
        )

  const rank = allFiltered.findIndex((s) => s.id === currentStudent.id) + 1

  return {
    ...currentStudent,
    rank: rank > 0 ? rank : currentStudent.rank,
  }
})

// Fetch data on mount
onMounted(async () => {
  // Fetch curriculum for grade level filter
  if (curriculumStore.gradeLevels.length === 0) {
    await curriculumStore.fetchCurriculum()
  }

  // Fetch leaderboard
  await leaderboardStore.fetchLeaderboard()
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

function getRankBg(rank: number): string {
  if (rank === 1) return 'bg-yellow-500'
  if (rank === 2) return 'bg-gray-400'
  if (rank === 3) return 'bg-amber-600'
  return ''
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">Leaderboard</h1>
        <p class="text-muted-foreground">Top students with the highest XP</p>
      </div>

      <!-- Grade Level Filter -->
      <Select v-model="selectedGradeLevel">
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

    <!-- Loading State -->
    <div v-if="leaderboardStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Leaderboard List -->
    <Card v-else>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Trophy class="size-5 text-yellow-500" />
          Top 20 Students
          <Badge v-if="selectedGradeLevel !== ALL_VALUE" variant="secondary" class="ml-2">
            {{
              curriculumStore.gradeLevels.find((g) => g.id === selectedGradeLevel)?.name ??
              ''
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
                :src="leaderboardStore.getAvatarUrl(student.avatarPath, student.name)"
                :alt="student.name"
              />
              <AvatarFallback>{{ getInitials(student.name) }}</AvatarFallback>
            </Avatar>

            <!-- Student Info -->
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">
                {{ student.name }}
                <Badge v-if="authStore.user?.id === student.id" variant="secondary" class="ml-2">
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
                  <Flame v-if="student.currentStreak > 0" class="size-4 text-orange-500" />
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
                  :src="
                    leaderboardStore.getAvatarUrl(
                      currentStudentInfo.avatarPath,
                      currentStudentInfo.name,
                    )
                  "
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
                    <Flame v-if="currentStudentInfo.currentStreak > 0" class="size-4 text-orange-500" />
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
  </div>
</template>
