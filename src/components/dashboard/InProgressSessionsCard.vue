<script setup lang="ts">
import { computed, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { usePracticeStore } from '@/stores/practice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { ArrowUpDown, Play } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const practiceStore = usePracticeStore()
const router = useRouter()

interface InProgressRow {
  id: string
  createdAt: string
  subjectName: string
  topicName: string
  answeredQuestions: number
  totalQuestions: number
  correctAnswers: number
}

// Filter for in-progress sessions only
const inProgressData = computed<InProgressRow[]>(() => {
  return practiceStore.studentHistory
    .filter((session) => !session.completedAt)
    .map((session) => {
      // Use currentQuestionIndex and correctCount from session data
      // since answers array is not populated in history fetch
      return {
        id: session.id,
        createdAt: session.createdAt ?? new Date().toISOString(),
        subjectName: session.subjectName,
        topicName: session.topicName,
        answeredQuestions: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctCount,
      }
    })
})

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleContinue(sessionId: string) {
  // Navigate to practice quiz page to continue the session
  router.push(`/student/practice/quiz?sessionId=${sessionId}`)
}

const columns: ColumnDef<InProgressRow>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Started', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'text-sm' }, formatDate(row.original.createdAt))
    },
  },
  {
    accessorKey: 'subjectName',
    header: 'Subject',
    cell: ({ row }) => {
      return h('div', { class: 'font-medium' }, row.original.subjectName)
    },
  },
  {
    accessorKey: 'topicName',
    header: 'Topic',
    cell: ({ row }) => {
      return h('div', {}, row.original.topicName)
    },
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => {
      const answered = row.original.answeredQuestions
      const total = row.original.totalQuestions
      const correct = row.original.correctAnswers
      const percentage = total > 0 ? Math.round((answered / total) * 100) : 0

      return h('div', { class: 'flex flex-col gap-1' }, [
        h('div', { class: 'text-sm' }, `${answered}/${total} questions (${correct} correct)`),
        h('div', { class: 'h-2 w-24 rounded-full bg-muted overflow-hidden' }, [
          h('div', {
            class: 'h-full bg-primary transition-all',
            style: { width: `${percentage}%` },
          }),
        ]),
      ])
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'flex justify-end' },
        h(
          Button,
          {
            size: 'sm',
            onClick: () => handleContinue(row.original.id),
          },
          () => [h(Play, { class: 'mr-1 size-4' }), 'Continue'],
        ),
      )
    },
  },
]
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>In-Progress Sessions</CardTitle>
          <CardDescription>Continue where you left off</CardDescription>
        </div>
        <Badge v-if="inProgressData.length > 0" variant="secondary">
          {{ inProgressData.length }} active
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      <template v-if="inProgressData.length > 0">
        <DataTable :columns="columns" :data="inProgressData" />
      </template>
      <template v-else>
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <div class="mb-3 text-4xl">📚</div>
          <p class="text-muted-foreground">No sessions in progress</p>
          <p class="text-sm text-muted-foreground">Start a new practice session to see it here</p>
          <Button class="mt-4" variant="outline" @click="router.push('/student/practice')">
            Start Practice
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
