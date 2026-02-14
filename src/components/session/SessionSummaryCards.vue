<script setup lang="ts">
import { formatDuration } from '@/lib/date'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, Clock } from 'lucide-vue-next'

defineProps<{
  score: number
  correctAnswers: number
  incorrectAnswers: number
  durationSeconds: number
}>()
</script>

<template>
  <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
    <Card>
      <CardContent class="flex flex-col items-center justify-center p-4">
        <div
          class="text-3xl font-bold"
          :class="{
            'text-green-600': score >= 80,
            'text-yellow-600': score >= 60 && score < 80,
            'text-red-600': score < 60,
          }"
        >
          {{ score }}%
        </div>
        <div class="text-sm text-muted-foreground">Score</div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="flex flex-col items-center justify-center p-4">
        <div class="flex items-center gap-1 text-3xl font-bold text-green-600">
          <CheckCircle2 class="size-6" />
          {{ correctAnswers }}
        </div>
        <div class="text-sm text-muted-foreground">Correct</div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="flex flex-col items-center justify-center p-4">
        <div class="flex items-center gap-1 text-3xl font-bold text-red-600">
          <XCircle class="size-6" />
          {{ incorrectAnswers }}
        </div>
        <div class="text-sm text-muted-foreground">Incorrect</div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="flex flex-col items-center justify-center p-4">
        <div class="flex items-center gap-1 text-3xl font-bold">
          <Clock class="size-6 text-muted-foreground" />
          {{ formatDuration(durationSeconds) }}
        </div>
        <div class="text-sm text-muted-foreground">Time Used</div>
      </CardContent>
    </Card>
  </div>
</template>
