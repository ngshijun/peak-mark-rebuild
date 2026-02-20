<script setup lang="ts">
import { onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import { useAdminPaymentHistoryStore, type AdminPaymentEntry } from '@/stores/admin-payment-history'
import { Search, Loader2, CreditCard, ArrowUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'vue-sonner'
import { formatDateTime } from '@/lib/date'
import { tierConfig } from '@/lib/tierConfig'

const router = useRouter()
const store = useAdminPaymentHistoryStore()

onMounted(async () => {
  if (store.payments.length === 0) {
    const result = await store.fetchPayments()
    if (result.error) {
      toast.error(result.error)
    }
  }
})

const columns: ColumnDef<AdminPaymentEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Date', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', {}, formatDateTime(row.original.createdAt ?? ''))
    },
  },
  {
    accessorKey: 'studentName',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Student', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const name = row.original.studentName
      const studentId = row.original.studentId
      if (!name || !studentId) {
        return h('div', { class: 'text-muted-foreground' }, '-')
      }
      return h(
        'button',
        {
          class: 'font-medium text-primary hover:underline',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            router.push(`/admin/students/${studentId}/statistics`)
          },
        },
        name,
      )
    },
  },
  {
    accessorKey: 'parentName',
    header: 'Parent',
    cell: ({ row }) => {
      return h('div', {}, row.original.parentName ?? '-')
    },
  },
  {
    accessorKey: 'amountCents',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Amount', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      const amount = (row.original.amountCents / 100).toFixed(2)
      const currency = row.original.currency.toUpperCase()
      return h('div', { class: 'font-medium' }, `${amount} ${currency}`)
    },
  },
  {
    accessorKey: 'tier',
    header: 'Tier',
    cell: ({ row }) => {
      const tier = row.original.tier
      if (!tier) {
        return h('div', { class: 'text-muted-foreground' }, '-')
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
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      const isSuccess = status === 'succeeded'
      return h(
        Badge,
        {
          variant: 'secondary',
          class: isSuccess
            ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
        },
        () => status,
      )
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => {
      return h('div', { class: 'text-muted-foreground' }, row.original.description ?? '-')
    },
  },
]
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Payment History</h1>
      <p class="text-muted-foreground">View all payment transactions across students.</p>
    </div>

    <!-- Loading State -->
    <div v-if="store.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Search Bar -->
      <div class="mb-4">
        <div class="relative w-[400px]">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="store.filters.search"
            placeholder="Search by student, parent, description, or status..."
            class="pl-9"
            @update:model-value="store.setSearch(String($event))"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="store.filteredPayments.length === 0" class="py-16 text-center">
        <CreditCard class="mx-auto size-16 text-muted-foreground/50" />
        <h2 class="mt-4 text-lg font-semibold">No Payments Found</h2>
        <p class="mt-2 text-muted-foreground">
          {{
            store.filters.search
              ? 'No payments match your search criteria.'
              : 'No payment transactions have been recorded yet.'
          }}
        </p>
      </div>

      <!-- Data Table -->
      <DataTable
        v-else
        :columns="columns"
        :data="store.filteredPayments"
        :initial-sorting="[{ id: 'createdAt', desc: true }]"
        :page-index="store.pagination.pageIndex"
        :page-size="store.pagination.pageSize"
        :on-page-index-change="store.setPageIndex"
        :on-page-size-change="store.setPageSize"
      />
    </template>
  </div>
</template>
