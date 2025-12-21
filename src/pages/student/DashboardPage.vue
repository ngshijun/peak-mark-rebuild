<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useStudentDashboardStore } from '@/stores/studentDashboard'
import { usePracticeStore } from '@/stores/practice'
import { usePetsStore } from '@/stores/pets'
import { useAuthStore } from '@/stores/auth'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import DailyStatusButton from '@/components/dashboard/DailyStatusButton.vue'
import BestSubjectCard from '@/components/dashboard/BestSubjectCard.vue'
import CurrentPetCard from '@/components/dashboard/CurrentPetCard.vue'
import SpinWheelCard from '@/components/dashboard/SpinWheelCard.vue'
import StreakCard from '@/components/dashboard/StreakCard.vue'
import InProgressSessionsCard from '@/components/dashboard/InProgressSessionsCard.vue'
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget.vue'

const dashboardStore = useStudentDashboardStore()
const practiceStore = usePracticeStore()
const petsStore = usePetsStore()
const authStore = useAuthStore()

const isLoading = ref(true)
const dailyStatusButtonRef = ref<InstanceType<typeof DailyStatusButton> | null>(null)

// LocalStorage key for "don't show again today"
const MOOD_REMINDER_DISMISSED_KEY = 'mood_reminder_dismissed_date'

function shouldShowMoodReminder(): boolean {
  // Don't show mood reminder if grade level is not set (grade dialog takes priority)
  if (!authStore.studentProfile?.gradeLevelId) return false

  // Check if user has already set mood today
  if (dashboardStore.hasMoodToday) return false

  // Check if user dismissed the reminder today
  const dismissedDate = localStorage.getItem(MOOD_REMINDER_DISMISSED_KEY)
  if (dismissedDate === dashboardStore.getTodayString()) return false

  return true
}

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

// Show mood reminder dialog after loading completes
watch(isLoading, async (loading) => {
  if (!loading && shouldShowMoodReminder()) {
    // Wait for Vue to finish rendering the v-else content
    await nextTick()
    // Open the DailyStatusButton dialog with "don't show again" option
    dailyStatusButtonRef.value?.openDialog(true)
  }
})
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <p class="text-muted-foreground">Here's your daily overview</p>
      </div>
      <DailyStatusButton v-if="!isLoading" ref="dailyStatusButtonRef" />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else class="space-y-6">
      <!-- Dashboard Cards Grid -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BestSubjectCard />
        <CurrentPetCard />
        <SpinWheelCard />
        <StreakCard />
      </div>

      <!-- In-Progress Sessions -->
      <InProgressSessionsCard />

      <!-- Announcements (full width) -->
      <AnnouncementsWidget />
    </div>
  </div>
</template>
