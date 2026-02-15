import { h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { formatDuration, formatDateTime } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown } from 'lucide-vue-next'
import type { DateRangeFilter } from '@/lib/sessionFilters'

export const ALL_VALUE = '__all__'

/** Convert ALL_VALUE sentinel to undefined for store filter calls. */
export function resolveFilterValue(value: string): string | undefined {
  return value === ALL_VALUE ? undefined : value
}

export const statusConfig = {
  completed: {
    label: 'Completed',
    bgColor: 'bg-green-100 dark:bg-green-950/30',
    color: 'text-green-700 dark:text-green-400',
  },
  in_progress: {
    label: 'In Progress',
    bgColor: 'bg-amber-100 dark:bg-amber-950/30',
    color: 'text-amber-700 dark:text-amber-400',
  },
} as const

export const dateRangeOptions: { value: DateRangeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'alltime', label: 'All Time' },
]

export interface PracticeSessionRow {
  completedAt: string | null
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
  status: 'completed' | 'in_progress'
  score: number | null
  totalQuestions: number
  correctAnswers: number
  durationSeconds: number | null
}

export function createPracticeHistoryColumns<T extends PracticeSessionRow>(): ColumnDef<T>[] {
  return [
    {
      accessorKey: 'completedAt',
      header: ({ column }) => {
        return h(
          Button,
          {
            variant: 'ghost',
            onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
          },
          () => ['Completed At', h(ArrowUpDown, { class: 'ml-2 size-4' })],
        )
      },
      cell: ({ row }) => {
        const completedAt = row.original.completedAt
        if (!completedAt) {
          return h('div', { class: 'text-muted-foreground' }, '-')
        }
        return h('div', { class: 'text-sm' }, formatDateTime(completedAt))
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.completedAt
        const b = rowB.original.completedAt
        if (!a && !b) return 0
        if (!a) return 1
        if (!b) return -1
        return new Date(a).getTime() - new Date(b).getTime()
      },
    },
    {
      accessorKey: 'gradeLevelName',
      header: 'Grade',
      cell: ({ row }) => h('div', {}, row.original.gradeLevelName),
    },
    {
      accessorKey: 'subjectName',
      header: 'Subject',
      cell: ({ row }) => h('div', { class: 'font-medium' }, row.original.subjectName),
    },
    {
      accessorKey: 'topicName',
      header: 'Topic',
      cell: ({ row }) => h('div', {}, row.original.topicName),
    },
    {
      accessorKey: 'subTopicName',
      header: 'Sub-Topic',
      cell: ({ row }) => h('div', {}, row.original.subTopicName),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => {
        return h(
          Button,
          {
            variant: 'ghost',
            onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
          },
          () => ['Status', h(ArrowUpDown, { class: 'ml-2 size-4' })],
        )
      },
      cell: ({ row }) => {
        const status = row.original.status
        const config = statusConfig[status]
        return h(
          Badge,
          {
            variant: 'secondary',
            class: `${config.bgColor} ${config.color}`,
          },
          () => config.label,
        )
      },
    },
    {
      accessorKey: 'score',
      header: ({ column }) => {
        return h(
          Button,
          {
            variant: 'ghost',
            onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
          },
          () => ['Score', h(ArrowUpDown, { class: 'ml-2 size-4' })],
        )
      },
      cell: ({ row }) => {
        const score = row.original.score
        const correct = row.original.correctAnswers
        const total = row.original.totalQuestions

        if (score === null) {
          return h('div', { class: 'text-muted-foreground' }, '-')
        }

        const colorClass =
          score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'

        return h('div', { class: colorClass }, `${score}% (${correct}/${total})`)
      },
    },
    {
      accessorKey: 'durationSeconds',
      header: ({ column }) => {
        return h(
          Button,
          {
            variant: 'ghost',
            onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
          },
          () => ['Duration', h(ArrowUpDown, { class: 'ml-2 size-4' })],
        )
      },
      cell: ({ row }) => {
        const seconds = row.original.durationSeconds
        if (seconds == null) {
          return h('div', { class: 'text-muted-foreground' }, '-')
        }
        return h('div', {}, formatDuration(seconds))
      },
    },
  ]
}
