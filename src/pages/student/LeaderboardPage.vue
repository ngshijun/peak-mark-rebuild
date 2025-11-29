<script setup lang="ts">
import { useLeaderboardStore } from '@/stores/leaderboard'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, Star } from 'lucide-vue-next'

const leaderboardStore = useLeaderboardStore()
const authStore = useAuthStore()

function getInitials(name: string) {
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

function getRankColor(rank: number) {
  if (rank === 1) return 'text-yellow-500'
  if (rank === 2) return 'text-gray-400'
  if (rank === 3) return 'text-amber-600'
  return 'text-muted-foreground'
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Leaderboard</h1>
        <p class="text-muted-foreground">Top 20 students with the highest XP</p>
      </div>
    </div>

    <!-- Leaderboard List -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Trophy class="size-5 text-yellow-500" />
          Top 20 Students
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div class="divide-y">
          <div
            v-for="(student, index) in leaderboardStore.top20Students"
            :key="student.id"
            class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
            :class="{
              'bg-primary/5': authStore.studentUser?.id === student.id,
            }"
          >
            <!-- Rank -->
            <div class="flex w-12 items-center justify-center">
              <component
                :is="getRankIcon(index + 1)"
                v-if="getRankIcon(index + 1)"
                class="size-6"
                :class="getRankColor(index + 1)"
              />
              <span v-else class="text-lg font-semibold" :class="getRankColor(index + 1)">
                {{ index + 1 }}
              </span>
            </div>

            <!-- Avatar -->
            <Avatar class="size-10">
              <AvatarImage v-if="student.avatarUrl" :src="student.avatarUrl" :alt="student.name" />
              <AvatarFallback>{{ getInitials(student.name) }}</AvatarFallback>
            </Avatar>

            <!-- Student Info -->
            <div class="flex-1">
              <p class="font-medium">
                {{ student.name }}
                <Badge
                  v-if="authStore.studentUser?.id === student.id"
                  variant="secondary"
                  class="ml-2"
                >
                  You
                </Badge>
              </p>
              <p class="text-sm text-muted-foreground">{{ student.gradeLevelName }}</p>
            </div>

            <!-- Level -->
            <div class="text-center">
              <p class="text-sm text-muted-foreground">Level</p>
              <p class="font-semibold">{{ student.level }}</p>
            </div>

            <!-- XP -->
            <div class="w-24 text-right">
              <p class="text-sm text-muted-foreground">XP</p>
              <p class="font-semibold">{{ student.xp.toLocaleString() }}</p>
            </div>
          </div>

          <!-- Current student row if not in top 20 -->
          <template v-if="authStore.studentUser && !leaderboardStore.isCurrentStudentInTop20">
            <div class="flex items-center gap-4 bg-primary/5 px-6 py-4">
              <!-- Rank -->
              <div class="flex w-12 items-center justify-center">
                <span class="text-lg font-semibold text-muted-foreground">
                  {{ leaderboardStore.currentStudentRank }}
                </span>
              </div>

              <!-- Avatar -->
              <Avatar class="size-10">
                <AvatarImage
                  :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${authStore.studentUser.name}`"
                  :alt="authStore.studentUser.name"
                />
                <AvatarFallback>{{ getInitials(authStore.studentUser.name) }}</AvatarFallback>
              </Avatar>

              <!-- Student Info -->
              <div class="flex-1">
                <p class="font-medium">
                  {{ authStore.studentUser.name }}
                  <Badge variant="secondary" class="ml-2">You</Badge>
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ authStore.studentUser.gradeLevelName }}
                </p>
              </div>

              <!-- Level -->
              <div class="text-center">
                <p class="text-sm text-muted-foreground">Level</p>
                <p class="font-semibold">{{ authStore.studentUser.level }}</p>
              </div>

              <!-- XP -->
              <div class="w-24 text-right">
                <p class="text-sm text-muted-foreground">XP</p>
                <p class="font-semibold">{{ authStore.studentUser.xp.toLocaleString() }}</p>
              </div>
            </div>
          </template>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
