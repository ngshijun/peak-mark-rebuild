<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useChildStatisticsStore, type ChildDailyStatus } from '@/stores/child-statistics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-vue-next'
import StatusCalendar, { type StatusEntry } from '@/components/shared/StatusCalendar.vue'

const props = defineProps<{
  childId: string
  childName: string
}>()

const childStatisticsStore = useChildStatisticsStore()
const calendarRef = ref<InstanceType<typeof StatusCalendar> | null>(null)

const dailyStatuses = ref<ChildDailyStatus[]>([])
const isLoading = ref(false)

const statusMap = computed(() => {
  const map = new Map<string, StatusEntry>()
  for (const status of dailyStatuses.value) {
    map.set(status.date, { mood: status.mood, hasPracticed: status.hasPracticed })
  }
  return map
})

async function fetchStatuses(year?: number, month?: number) {
  const y = year ?? calendarRef.value?.currentYear ?? new Date().getFullYear()
  const m = month ?? calendarRef.value?.currentMonth ?? new Date().getMonth() + 1
  isLoading.value = true
  const { statuses } = await childStatisticsStore.fetchChildDailyStatuses(props.childId, y, m)
  dailyStatuses.value = statuses
  isLoading.value = false
}

watch(
  () => props.childId,
  () => fetchStatuses(),
)
onMounted(() => fetchStatuses())
</script>

<template>
  <Card class="h-full">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">{{ childName }}'s Daily Status</CardTitle>
      <Calendar class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <StatusCalendar
        ref="calendarRef"
        :statuses="statusMap"
        :is-loading="isLoading"
        @month-change="fetchStatuses"
      />
    </CardContent>
  </Card>
</template>
