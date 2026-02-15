<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChildStatisticsStore, type ChildPracticeSession } from '@/stores/child-statistics'
import { useChildLinkStore } from '@/stores/child-link'
import { resolveFilterValue, createPracticeHistoryColumns } from '@/lib/statisticsColumns'
import { useStatisticsSummary } from '@/composables/useStatisticsSummary'
import StatisticsFilterBar from '@/components/statistics/StatisticsFilterBar.vue'
import StatisticsSummaryCards from '@/components/statistics/StatisticsSummaryCards.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'vue-sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { Users, BookOpen, History, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const childStatisticsStore = useChildStatisticsStore()
const childLinkStore = useChildLinkStore()

const SELECTED_CHILD_KEY = 'parent_selected_child_id'
const hideInProgress = ref(false)

// Get initial child ID from localStorage or default to first child
function getInitialChildId(): string {
  const savedChildId = localStorage.getItem(SELECTED_CHILD_KEY)
  if (savedChildId && childLinkStore.linkedChildren.some((c) => c.id === savedChildId)) {
    return savedChildId
  }
  return childLinkStore.linkedChildren[0]?.id ?? ''
}

const selectedChildId = ref<string>(getInitialChildId())

// Fetch data on mount
onMounted(async () => {
  try {
    if (childLinkStore.linkedChildren.length > 0 && !selectedChildId.value) {
      selectedChildId.value = getInitialChildId()
    }
    if (selectedChildId.value) {
      await childStatisticsStore.fetchChildStatistics(selectedChildId.value)
    }
  } catch (err) {
    console.error('Failed to load statistics:', err)
    toast.error('Failed to load statistics')
  }
})

// Fetch statistics and reset filters when child changes
watch(selectedChildId, async (newChildId) => {
  childStatisticsStore.resetStatisticsFilters()
  if (newChildId) {
    localStorage.setItem(SELECTED_CHILD_KEY, newChildId)
    await childStatisticsStore.fetchChildStatistics(newChildId)
  }
})

// Convert ALL_VALUE sentinel to undefined for store filter calls
const gradeLevelFilter = computed(() =>
  resolveFilterValue(childStatisticsStore.statisticsFilters.gradeLevel),
)
const subjectFilter = computed(() =>
  resolveFilterValue(childStatisticsStore.statisticsFilters.subject),
)
const topicFilter = computed(() => resolveFilterValue(childStatisticsStore.statisticsFilters.topic))
const subTopicFilter = computed(() =>
  resolveFilterValue(childStatisticsStore.statisticsFilters.subTopic),
)

// Get available filter options
const availableGradeLevels = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getGradeLevels(selectedChildId.value)
})
const availableSubjects = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getSubjects(selectedChildId.value, gradeLevelFilter.value)
})
const availableTopics = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getTopics(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
  )
})
const availableSubTopics = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getSubTopics(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
  )
})

// Get filtered sessions
const filteredSessions = computed(() => {
  if (!selectedChildId.value) return []
  return childStatisticsStore.getFilteredSessions(
    selectedChildId.value,
    gradeLevelFilter.value,
    subjectFilter.value,
    topicFilter.value,
    subTopicFilter.value,
    childStatisticsStore.statisticsFilters.dateRange,
  )
})

// Statistics computed values (only from completed sessions)
const { averageScore, totalSessions, totalStudyTime, subTopicsPracticed } =
  useStatisticsSummary(filteredSessions)

// Get recent sessions for table
const recentSessions = computed(() => {
  return [...filteredSessions.value].sort((a, b) => {
    const aCompleted = !!a.completedAt
    const bCompleted = !!b.completedAt
    if (!aCompleted && bCompleted) return -1
    if (aCompleted && !bCompleted) return 1
    if (!aCompleted && !bCompleted) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
  })
})

// Table data with optional in-progress filtering
const displayedSessions = computed(() => {
  if (hideInProgress.value) {
    return recentSessions.value.filter((s) => s.status === 'completed')
  }
  return recentSessions.value
})

const columns = createPracticeHistoryColumns<ChildPracticeSession>()

function handleRowClick(row: ChildPracticeSession) {
  if (row.status === 'completed') {
    router.push(`/parent/session/${selectedChildId.value}/${row.id}`)
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Statistics</h1>
      <p class="text-muted-foreground">View your children's learning progress</p>
    </div>

    <!-- Loading State -->
    <div v-if="childStatisticsStore.isLoading" class="flex items-center justify-center py-16">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- No Children State -->
    <div v-else-if="childLinkStore.linkedChildren.length === 0" class="py-16 text-center">
      <Users class="mx-auto size-16 text-muted-foreground/50" />
      <h2 class="mt-4 text-lg font-semibold">No Linked Children</h2>
      <p class="mt-2 text-muted-foreground">
        Link a child to view their statistics. Go to the Children page to send an invitation.
      </p>
    </div>

    <!-- Statistics Content -->
    <template v-else>
      <!-- Filters Row -->
      <StatisticsFilterBar
        :date-range="childStatisticsStore.statisticsFilters.dateRange"
        :grade-level="childStatisticsStore.statisticsFilters.gradeLevel"
        :subject="childStatisticsStore.statisticsFilters.subject"
        :topic="childStatisticsStore.statisticsFilters.topic"
        :sub-topic="childStatisticsStore.statisticsFilters.subTopic"
        :available-grade-levels="availableGradeLevels"
        :available-subjects="availableSubjects"
        :available-topics="availableTopics"
        :available-sub-topics="availableSubTopics"
        :hide-in-progress="hideInProgress"
        @update:date-range="childStatisticsStore.setStatisticsDateRange($event)"
        @update:grade-level="childStatisticsStore.setStatisticsGradeLevel($event)"
        @update:subject="childStatisticsStore.setStatisticsSubject($event)"
        @update:topic="childStatisticsStore.setStatisticsTopic($event)"
        @update:sub-topic="childStatisticsStore.setStatisticsSubTopic($event)"
        @update:hide-in-progress="hideInProgress = $event"
      >
        <template #before>
          <!-- Child Selector -->
          <Select v-model="selectedChildId">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="child in childLinkStore.linkedChildren"
                :key="child.id"
                :value="child.id"
              >
                {{ child.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </template>
      </StatisticsFilterBar>

      <!-- Statistics Cards -->
      <StatisticsSummaryCards
        v-if="selectedChildId"
        :average-score="averageScore"
        :total-sessions="totalSessions"
        :total-study-time="totalStudyTime"
        :sub-topics-practiced="subTopicsPracticed"
      />

      <!-- Practice History Table -->
      <Card v-if="selectedChildId">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <History class="size-5" />
            Practice History
          </CardTitle>
          <CardDescription>View your child's past practice sessions and scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            v-if="displayedSessions.length > 0"
            :columns="columns"
            :data="displayedSessions"
            :on-row-click="handleRowClick"
            :initial-sorting="[{ id: 'completedAt', desc: true }]"
            :page-index="childStatisticsStore.statisticsPagination.pageIndex"
            :page-size="childStatisticsStore.statisticsPagination.pageSize"
            :on-page-index-change="childStatisticsStore.setStatisticsPageIndex"
            :on-page-size-change="childStatisticsStore.setStatisticsPageSize"
          />
          <div v-else class="py-12 text-center">
            <BookOpen class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-muted-foreground">
              No practice sessions found for the selected filters.
            </p>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
