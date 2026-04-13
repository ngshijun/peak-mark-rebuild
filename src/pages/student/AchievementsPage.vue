<script setup lang="ts">
import { onMounted } from 'vue'
import { useT } from '@/composables/useT'
import { useBadgesStore } from '@/stores/badges'
import { Loader2 } from 'lucide-vue-next'
import ClosestToUnlockSection from '@/components/student/ClosestToUnlockSection.vue'
import BadgeGridByTier from '@/components/student/BadgeGridByTier.vue'

const t = useT()
const badgesStore = useBadgesStore()

onMounted(async () => {
  if (!badgesStore.hasLoaded) {
    await badgesStore.loadAll()
  } else {
    // Already loaded by the route guard or a prior visit — just refresh progress
    await badgesStore.refreshProgress()
  }
  // Clear the sidebar unread indicator: all currently-unseen unlocks are now "seen"
  await badgesStore.markAllSeen()
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div v-if="badgesStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <div>
        <h1 class="text-2xl font-bold">{{ t.student.achievements.title }}</h1>
      </div>

      <ClosestToUnlockSection />

      <div>
        <h2 class="text-lg font-semibold mb-3">{{ t.student.achievements.allBadges }}</h2>
        <BadgeGridByTier />
      </div>
    </template>
  </div>
</template>
