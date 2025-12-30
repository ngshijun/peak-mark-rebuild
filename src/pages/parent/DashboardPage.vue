<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useChildLinkStore } from '@/stores/child-link'
import { useChildStatisticsStore } from '@/stores/child-statistics'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ChildMoodCalendar from '@/components/parent/ChildMoodCalendar.vue'
import ChildSessionChart from '@/components/parent/ChildSessionChart.vue'
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget.vue'

const SELECTED_CHILD_KEY = 'parent_selected_child_id'

const childLinkStore = useChildLinkStore()
const childStatisticsStore = useChildStatisticsStore()

const isLoading = ref(true)
const selectedChildId = ref<string>(localStorage.getItem(SELECTED_CHILD_KEY) || '')

// Persist selectedChildId to localStorage
watch(selectedChildId, (newId) => {
  if (newId) {
    localStorage.setItem(SELECTED_CHILD_KEY, newId)
  }
})

// Get linked children
const linkedChildren = computed(() => childLinkStore.linkedChildren)

// Selected child
const selectedChild = computed(() => {
  return linkedChildren.value.find((c) => c.id === selectedChildId.value)
})

onMounted(async () => {
  try {
    await childLinkStore.fetchLinkedChildren()
    // Fetch statistics for all children
    await childStatisticsStore.fetchChildrenStatistics()

    // Restore saved selection or select first child
    const savedChildId = localStorage.getItem(SELECTED_CHILD_KEY)
    const isValidSelection = linkedChildren.value.some((c) => c.id === savedChildId)

    if (savedChildId && isValidSelection) {
      selectedChildId.value = savedChildId
    } else {
      const firstChild = linkedChildren.value[0]
      if (firstChild) {
        selectedChildId.value = firstChild.id
      }
    }
  } catch {
    toast.error('Failed to load children data')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <p class="text-muted-foreground">Monitor your child's learning progress</p>
      </div>
      <!-- Child Selector -->
      <Select v-if="linkedChildren.length > 1" v-model="selectedChildId">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="Select child" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="child in linkedChildren" :key="child.id" :value="child.id">
            {{ child.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- No Children Linked -->
    <div v-else-if="linkedChildren.length === 0" class="py-12 text-center">
      <p class="text-muted-foreground">No children linked to your account yet.</p>
      <p class="mt-2 text-sm text-muted-foreground">Go to Settings to link your child's account.</p>
    </div>

    <!-- Dashboard Content -->
    <div v-else-if="selectedChild" class="space-y-6">
      <div class="grid gap-6 lg:grid-cols-4">
        <!-- Calendar (1/4 width) -->
        <div class="lg:col-span-1">
          <ChildMoodCalendar :child-id="selectedChild.id" :child-name="selectedChild.name" />
        </div>

        <!-- Chart (3/4 width) -->
        <div class="lg:col-span-3">
          <ChildSessionChart :child-id="selectedChild.id" />
        </div>
      </div>

      <!-- Announcements (full width) -->
      <AnnouncementsWidget />
    </div>
  </div>
</template>
