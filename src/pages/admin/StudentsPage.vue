<script setup lang="ts">
import { onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import { useAdminStudentsStore, type AdminStudent } from '@/stores/admin-students'
import { Search, Loader2, Users, ArrowUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'vue-sonner'

const router = useRouter()
const adminStudentsStore = useAdminStudentsStore()

// Fetch students on mount
onMounted(async () => {
  if (adminStudentsStore.students.length === 0) {
    const result = await adminStudentsStore.fetchAllStudents()
    if (result.error) {
      toast.error(result.error)
    }
  }
})

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()

  // Check if same day
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) return 'Today'

  // Check if yesterday
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
  return formatDate(dateString)
}

// Subscription tier config for badge styling
const tierConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  core: {
    label: 'Core',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  pro: {
    label: 'Pro',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
  },
  max: {
    label: 'Max',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/50',
  },
}

// Column definitions
const columns: ColumnDef<AdminStudent>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Name', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'font-medium' }, row.original.name)
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => {
      return h('div', { class: 'text-muted-foreground' }, row.original.email)
    },
  },
  {
    accessorKey: 'gradeLevelName',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Grade', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', {}, row.original.gradeLevelName ?? '-')
    },
  },
  {
    accessorKey: 'xp',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['XP', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const xp = row.original.xp
      return h(
        'div',
        { class: 'font-medium text-purple-600 dark:text-purple-400' },
        xp.toLocaleString(),
      )
    },
  },
  {
    accessorKey: 'coins',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Coins', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const coins = row.original.coins
      return h(
        'div',
        { class: 'font-medium text-amber-600 dark:text-amber-400' },
        coins.toLocaleString(),
      )
    },
  },
  {
    accessorKey: 'dateOfBirth',
    header: 'Date of Birth',
    cell: ({ row }) => {
      return h('div', {}, formatDate(row.original.dateOfBirth))
    },
  },
  {
    accessorKey: 'subscriptionTier',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Subscription', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const tier = row.original.subscriptionTier
      if (!tier) {
        return h('div', { class: 'text-muted-foreground' }, 'None')
      }
      const config = tierConfig[tier] ?? tierConfig.core!
      return h(
        Badge,
        { variant: 'secondary', class: `${config!.bgColor} ${config!.color}` },
        () => config!.label,
      )
    },
  },
  {
    accessorKey: 'parentName',
    header: 'Parent Name',
    cell: ({ row }) => {
      return h('div', {}, row.original.parentName ?? '-')
    },
  },
  {
    accessorKey: 'parentEmail',
    header: 'Parent Email',
    cell: ({ row }) => {
      return h('div', { class: 'text-muted-foreground' }, row.original.parentEmail ?? '-')
    },
  },
  {
    accessorKey: 'joinedAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Joined', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', {}, formatDate(row.original.joinedAt))
    },
  },
  {
    accessorKey: 'lastActive',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Last Active', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const lastActive = row.original.lastActive
      if (!lastActive) {
        return h('div', { class: 'text-muted-foreground' }, 'Never')
      }
      return h('div', {}, formatRelativeDate(lastActive))
    },
  },
]

function handleRowClick(student: AdminStudent) {
  router.push(`/admin/students/${student.id}/statistics`)
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Students</h1>
      <p class="text-muted-foreground">View and manage all student accounts.</p>
    </div>

    <!-- Loading State -->
    <div v-if="adminStudentsStore.isLoadingStudents" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Search Bar -->
      <div class="mb-4">
        <div class="relative w-[400px]">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="adminStudentsStore.studentsFilters.search"
            placeholder="Search by name, email, or parent..."
            class="pl-9"
            @update:model-value="adminStudentsStore.setStudentsSearch(String($event))"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="adminStudentsStore.filteredStudents.length === 0" class="py-16 text-center">
        <Users class="mx-auto size-16 text-muted-foreground/50" />
        <h2 class="mt-4 text-lg font-semibold">No Students Found</h2>
        <p class="mt-2 text-muted-foreground">
          {{
            adminStudentsStore.studentsFilters.search
              ? 'No students match your search criteria.'
              : 'No students have registered yet.'
          }}
        </p>
      </div>

      <!-- Data Table -->
      <DataTable
        v-else
        :columns="columns"
        :data="adminStudentsStore.filteredStudents"
        :on-row-click="handleRowClick"
        :page-index="adminStudentsStore.studentsPagination.pageIndex"
        :page-size="adminStudentsStore.studentsPagination.pageSize"
        :on-page-index-change="adminStudentsStore.setStudentsPageIndex"
        :on-page-size-change="adminStudentsStore.setStudentsPageSize"
      />
    </template>
  </div>
</template>
