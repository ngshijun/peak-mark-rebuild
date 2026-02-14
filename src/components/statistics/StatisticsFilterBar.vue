<script setup lang="ts">
import type { DateRangeFilter } from '@/lib/sessionFilters'
import { ALL_VALUE, dateRangeOptions } from '@/lib/statisticsColumns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from 'lucide-vue-next'

const props = defineProps<{
  dateRange: DateRangeFilter
  gradeLevel: string
  subject: string
  topic: string
  subTopic: string
  availableGradeLevels: string[]
  availableSubjects: string[]
  availableTopics: string[]
  availableSubTopics: string[]
  hideInProgress: boolean
}>()

const emit = defineEmits<{
  'update:dateRange': [value: DateRangeFilter]
  'update:gradeLevel': [value: string]
  'update:subject': [value: string]
  'update:topic': [value: string]
  'update:subTopic': [value: string]
  'update:hideInProgress': [value: boolean]
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <slot name="before" />

    <!-- Date Range Selector -->
    <Select
      :model-value="dateRange"
      @update:model-value="emit('update:dateRange', $event as DateRangeFilter)"
    >
      <SelectTrigger class="w-[140px]">
        <Calendar class="mr-2 size-4" />
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="option in dateRangeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Grade Level Selector -->
    <Select
      :model-value="gradeLevel"
      @update:model-value="emit('update:gradeLevel', $event as string)"
    >
      <SelectTrigger class="w-[130px]">
        <SelectValue placeholder="All Grades" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="ALL_VALUE">All Grades</SelectItem>
        <SelectItem v-for="grade in availableGradeLevels" :key="grade" :value="grade">
          {{ grade }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Subject Selector -->
    <Select
      :model-value="subject"
      :disabled="gradeLevel === ALL_VALUE"
      @update:model-value="emit('update:subject', $event as string)"
    >
      <SelectTrigger class="w-[140px]">
        <SelectValue placeholder="All Subjects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="ALL_VALUE">All Subjects</SelectItem>
        <SelectItem v-for="s in availableSubjects" :key="s" :value="s">
          {{ s }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Topic Selector -->
    <Select
      :model-value="topic"
      :disabled="subject === ALL_VALUE"
      @update:model-value="emit('update:topic', $event as string)"
    >
      <SelectTrigger class="w-[140px]">
        <SelectValue placeholder="All Topics" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="ALL_VALUE">All Topics</SelectItem>
        <SelectItem v-for="t in availableTopics" :key="t" :value="t">
          {{ t }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Sub-Topic Selector -->
    <Select
      :model-value="subTopic"
      :disabled="topic === ALL_VALUE"
      @update:model-value="emit('update:subTopic', $event as string)"
    >
      <SelectTrigger class="w-[150px]">
        <SelectValue placeholder="All Sub-Topics" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="ALL_VALUE">All Sub-Topics</SelectItem>
        <SelectItem v-for="st in availableSubTopics" :key="st" :value="st">
          {{ st }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Hide In Progress Checkbox -->
    <label class="flex items-center gap-2 text-sm">
      <Checkbox
        :model-value="hideInProgress"
        @update:model-value="emit('update:hideInProgress', !!$event)"
      />
      Hide in progress
    </label>
  </div>
</template>
