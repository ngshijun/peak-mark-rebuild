<script setup lang="ts">
import { formatStudyTime } from '@/lib/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, BookOpen, Clock, Layers } from 'lucide-vue-next'

defineProps<{
  averageScore: number
  totalSessions: number
  totalStudyTime: number
  subTopicsPracticed: number
}>()
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">Average Score</CardTitle>
        <Target class="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{{ averageScore }}%</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">Sessions Completed</CardTitle>
        <BookOpen class="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{{ totalSessions }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">Study Time</CardTitle>
        <Clock class="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{{ formatStudyTime(totalStudyTime) }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">Sub-Topics Practiced</CardTitle>
        <Layers class="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{{ subTopicsPracticed }}</div>
      </CardContent>
    </Card>
  </div>
</template>
