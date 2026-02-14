<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAdminStudentsStore, type MoodEntry } from '@/stores/admin-students'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-vue-next'
import StatusCalendar, { type StatusEntry } from '@/components/shared/StatusCalendar.vue'

const props = defineProps<{
  studentId: string
}>()

const adminStudentsStore = useAdminStudentsStore()
const calendarRef = ref<InstanceType<typeof StatusCalendar> | null>(null)

const calendarStatuses = ref<MoodEntry[]>([])
const isLoading = ref(false)

const statusMap = computed(() => {
  const map = new Map<string, StatusEntry>()
  for (const s of calendarStatuses.value) {
    map.set(s.date, { mood: s.mood, hasPracticed: s.hasPracticed })
  }
  return map
})

async function fetchCalendar(year?: number, month?: number) {
  if (!props.studentId) return
  const y = year ?? calendarRef.value?.currentYear ?? new Date().getFullYear()
  const m = month ?? calendarRef.value?.currentMonth ?? new Date().getMonth() + 1
  isLoading.value = true
  const { statuses } = await adminStudentsStore.fetchStudentDailyStatuses(props.studentId, y, m)
  calendarStatuses.value = statuses
  isLoading.value = false
}

onMounted(() => fetchCalendar())
watch(
  () => props.studentId,
  () => fetchCalendar(),
)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Calendar class="size-5" />
        Daily Status
      </CardTitle>
    </CardHeader>
    <CardContent>
      <StatusCalendar
        ref="calendarRef"
        :statuses="statusMap"
        :is-loading="isLoading"
        aspect-class="aspect-[2/1]"
        emoji-class="text-2xl"
        @month-change="fetchCalendar"
      />
    </CardContent>
  </Card>
</template>
