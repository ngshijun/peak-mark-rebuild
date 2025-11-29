<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import DailyStatusCard from '@/components/dashboard/DailyStatusCard.vue'
import CurrentPetCard from '@/components/dashboard/CurrentPetCard.vue'
import SpinWheelCard from '@/components/dashboard/SpinWheelCard.vue'
import StreakCard from '@/components/dashboard/StreakCard.vue'
import InProgressSessionsCard from '@/components/dashboard/InProgressSessionsCard.vue'

const authStore = useAuthStore()

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">
        {{ getGreeting() }}, {{ authStore.studentUser?.name ?? 'Student' }}!
      </h1>
      <p class="text-muted-foreground">Here's your daily overview</p>
    </div>

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
</template>
