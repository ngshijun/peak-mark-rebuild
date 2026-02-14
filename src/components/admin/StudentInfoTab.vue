<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  User,
  Mail,
  Cake,
  Users,
  GraduationCap,
  CreditCard,
  CalendarDays,
  Clock,
  Star,
  CirclePoundSterling,
  Flame,
  Apple,
} from 'lucide-vue-next'

import { tierConfig } from '@/lib/tierConfig'

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return 'Yesterday'

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return formatShortDate(dateString)
}

defineProps<{
  student: {
    name: string
    email: string
    dateOfBirth: string | null
    parentName: string | null
    parentEmail: string | null
    gradeLevelName: string | null
    subscriptionTier: string | null
    joinedAt: string | null
    lastActive: string | null
    xp: number
    coins: number
  }
  engagement?: {
    level: number
    food: number
    currentStreak: number
  }
}>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <User class="size-5" />
        Student Information
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Personal -->
        <div class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Personal
          </p>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <User class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Name</p>
              <p class="font-medium">{{ student.name }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Mail class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Email</p>
              <p class="font-medium">{{ student.email }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Cake class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Date of Birth</p>
              <p class="font-medium">{{ formatShortDate(student.dateOfBirth) }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Users class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Parent</p>
              <p v-if="student.parentName" class="font-medium">
                {{ student.parentName }}
                <span v-if="student.parentEmail" class="text-muted-foreground">
                  ({{ student.parentEmail }})
                </span>
              </p>
              <p v-else class="font-medium text-muted-foreground">-</p>
            </div>
          </div>
        </div>

        <!-- Account -->
        <div class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </p>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <GraduationCap class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Grade Level</p>
              <p class="font-medium">{{ student.gradeLevelName ?? '-' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <CreditCard class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Subscription</p>
              <Badge
                v-if="student.subscriptionTier"
                variant="secondary"
                :class="`${tierConfig[student.subscriptionTier]?.bgColor ?? ''} ${tierConfig[student.subscriptionTier]?.color ?? ''}`"
              >
                {{ tierConfig[student.subscriptionTier]?.label ?? student.subscriptionTier }}
              </Badge>
              <p v-else class="font-medium text-muted-foreground">None</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <CalendarDays class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Joined</p>
              <p class="font-medium">{{ formatShortDate(student.joinedAt) }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-full bg-muted">
              <Clock class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Last Active</p>
              <p class="font-medium">{{ formatRelativeDate(student.lastActive) }}</p>
            </div>
          </div>
        </div>

        <!-- Engagement -->
        <div class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Engagement
          </p>

          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/30"
            >
              <Star class="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                Level {{ engagement?.level ?? Math.floor(student.xp / 500) + 1 }}
              </p>
              <p class="font-medium text-purple-600 dark:text-purple-400">
                {{ student.xp.toLocaleString() }} XP
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30"
            >
              <CirclePoundSterling class="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Coins</p>
              <p class="font-medium text-amber-600 dark:text-amber-400">
                {{ student.coins.toLocaleString() }}
              </p>
            </div>
          </div>

          <div v-if="engagement" class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30"
            >
              <Apple class="size-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Food</p>
              <p class="font-medium text-green-600 dark:text-green-400">
                {{ engagement.food }}
              </p>
            </div>
          </div>

          <div v-if="engagement" class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/30"
            >
              <Flame class="size-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Current Streak</p>
              <p class="font-medium text-orange-600 dark:text-orange-400">
                {{ engagement.currentStreak }}
                {{ engagement.currentStreak === 1 ? 'day' : 'days' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
