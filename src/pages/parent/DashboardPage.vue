<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChildLinkStore } from '@/stores/child-link'
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

const childLinkStore = useChildLinkStore()

const isLoading = ref(true)
const selectedChildId = ref<string>('')

// Get linked children
const linkedChildren = computed(() => childLinkStore.linkedChildren)

// Selected child
const selectedChild = computed(() => {
  return linkedChildren.value.find((c) => c.id === selectedChildId.value)
})

onMounted(async () => {
  try {
    await childLinkStore.fetchLinkedChildren()
    // Select first child by default
    const firstChild = linkedChildren.value[0]
    if (firstChild) {
      selectedChildId.value = firstChild.id
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
    <div v-else-if="selectedChild" class="grid gap-6 lg:grid-cols-4">
      <!-- Calendar (1/4 width) -->
      <div class="lg:col-span-1">
        <ChildMoodCalendar :child-id="selectedChild.id" :child-name="selectedChild.name" />
      </div>

      <!-- Main Content (3/4 width) -->
      <div class="space-y-6 lg:col-span-3">
        <div class="rounded-lg border bg-card p-6">
          <p class="text-muted-foreground">More dashboard content coming soon...</p>
        </div>
      </div>
    </div>
  </div>
</template>
