<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { usePracticeStore } from '@/stores/practice'
import { usePetsStore } from '@/stores/pets'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import DailyStatusCard from '@/components/dashboard/DailyStatusCard.vue'
import CurrentPetCard from '@/components/dashboard/CurrentPetCard.vue'
import SpinWheelCard from '@/components/dashboard/SpinWheelCard.vue'
import StreakCard from '@/components/dashboard/StreakCard.vue'
import InProgressSessionsCard from '@/components/dashboard/InProgressSessionsCard.vue'

const dashboardStore = useStudentDashboardStore()
const practiceStore = usePracticeStore()
const petsStore = usePetsStore()

const isLoading = ref(true)

// Fetch dashboard data on mount
onMounted(async () => {
  try {
    // Fetch all data in parallel
    await Promise.all([
      dashboardStore.fetchTodayStatus(),
      practiceStore.fetchSessionHistory(),
      petsStore.allPets.length === 0 ? petsStore.fetchAllPets() : Promise.resolve(),
      petsStore.fetchOwnedPets(),
    ])
  } catch {
    toast.error('Failed to load dashboard data')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-muted-foreground">Here's your daily overview</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else class="space-y-6">
      <!-- Dashboard Cards Grid -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DailyStatusCard />
        <CurrentPetCard />
        <SpinWheelCard />
        <StreakCard />
      </div>

      <!-- In-Progress Sessions -->
      <InProgressSessionsCard />
    </div>
  </div>
</template>
