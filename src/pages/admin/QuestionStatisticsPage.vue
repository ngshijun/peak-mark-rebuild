<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useQuestionsStore } from '@/stores/questions'
import type { QuestionWithStats } from '@/types'
import { Search, Clock, ArrowUpDown } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const questionsStore = useQuestionsStore()

const ALL_VALUE = '__all__'

const searchQuery = ref('')

// Filter state
const selectedGradeLevel = ref<string>(ALL_VALUE)
const selectedSubject = ref<string>(ALL_VALUE)
const selectedTopic = ref<string>(ALL_VALUE)

// Reset subject and topic when grade level changes
watch(selectedGradeLevel, () => {
  selectedSubject.value = ALL_VALUE
  selectedTopic.value = ALL_VALUE
})

// Reset topic when subject changes
watch(selectedSubject, () => {
  selectedTopic.value = ALL_VALUE
})

// Helper to convert ALL_VALUE to undefined for store calls
const gradeLevelFilter = computed(() =>
  selectedGradeLevel.value === ALL_VALUE ? undefined : selectedGradeLevel.value,
)
const subjectFilter = computed(() =>
  selectedSubject.value === ALL_VALUE ? undefined : selectedSubject.value,
)
const topicFilter = computed(() =>
  selectedTopic.value === ALL_VALUE ? undefined : selectedTopic.value,
)

// Get available filter options
const availableGradeLevels = computed(() => questionsStore.getGradeLevels())
const availableSubjects = computed(() => questionsStore.getSubjects(gradeLevelFilter.value))
const availableTopics = computed(() =>
  questionsStore.getTopics(gradeLevelFilter.value, subjectFilter.value),
)

// Filter questions based on dropdown filters and search
const filteredQuestions = computed(() => {
  // First apply dropdown filters
  let filtered = questionsStore.getFilteredQuestionsWithStats(
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
  )

  // Then apply search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (q) =>
        q.question.toLowerCase().includes(query) ||
        q.gradeLevelName.toLowerCase().includes(query) ||
        q.subjectName.toLowerCase().includes(query) ||
        q.topicName.toLowerCase().includes(query),
    )
  }

  return filtered
})

// Format time display
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

// Get color for correctness rate
function getCorrectnessColor(rate: number): string {
  if (rate >= 80) return 'text-green-600 dark:text-green-400'
  if (rate >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getProgressColor(rate: number): string {
  if (rate >= 80) return 'bg-green-500'
  if (rate >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

// Column definitions
const columns: ColumnDef<QuestionWithStats>[] = [
  {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      const question = row.original.question
      return h('div', { class: 'max-w-[250px] truncate font-medium' }, question)
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.type
      return h(Badge, { variant: type === 'mcq' ? 'default' : 'secondary' }, () =>
        type === 'mcq' ? 'MCQ' : 'Short Answer',
      )
    },
  },
  {
    accessorKey: 'gradeLevelName',
    header: 'Grade Level',
  },
  {
    accessorKey: 'subjectName',
    header: 'Subject',
  },
  {
    accessorKey: 'topicName',
    header: 'Topic',
  },
  {
    id: 'attempts',
    accessorFn: (row) => row.stats.attempts,
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Attempts', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const attempts = row.original.stats.attempts
      return h('div', { class: 'text-center font-medium' }, attempts.toLocaleString())
    },
  },
  {
    id: 'correctnessRate',
    accessorFn: (row) => row.stats.correctnessRate,
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Correctness Rate', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const rate = row.original.stats.correctnessRate
      return h('div', { class: 'flex items-center gap-2' }, [
        h('div', { class: 'w-16 h-2 bg-muted rounded-full overflow-hidden' }, [
          h('div', {
            class: `h-full ${getProgressColor(rate)}`,
            style: { width: `${rate}%` },
          }),
        ]),
        h('span', { class: `text-sm font-medium ${getCorrectnessColor(rate)}` }, `${rate}%`),
      ])
    },
  },
  {
    id: 'averageTime',
    accessorFn: (row) => row.stats.averageTimeSeconds,
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Avg. Time', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const seconds = row.original.stats.averageTimeSeconds
      return h('div', { class: 'flex items-center gap-1 text-muted-foreground' }, [
        h(Clock, { class: 'size-3' }),
        h('span', { class: 'text-sm' }, formatTime(seconds)),
      ])
    },
  },
]
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Question Statistics</h1>
      <p class="text-muted-foreground">View performance metrics for all questions.</p>
    </div>

    <!-- Filters Row -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <!-- Search Bar -->
      <div class="relative w-[250px]">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search questions..." class="pl-9" />
      </div>

      <!-- Grade Level Selector -->
      <Select v-model="selectedGradeLevel">
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
      <Select v-model="selectedSubject" :disabled="selectedGradeLevel === ALL_VALUE">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="All Subjects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL_VALUE">All Subjects</SelectItem>
          <SelectItem v-for="subject in availableSubjects" :key="subject" :value="subject">
            {{ subject }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Topic Selector -->
      <Select v-model="selectedTopic" :disabled="selectedSubject === ALL_VALUE">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="All Topics" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL_VALUE">All Topics</SelectItem>
          <SelectItem v-for="topic in availableTopics" :key="topic" :value="topic">
            {{ topic }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Data Table -->
    <DataTable :columns="columns" :data="filteredQuestions" />
  </div>
</template>
