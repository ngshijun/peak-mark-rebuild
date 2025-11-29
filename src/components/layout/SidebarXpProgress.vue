<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { Progress } from '@/components/ui/progress'
import { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar'
import PixelCoin from '@/components/icons/PixelCoin.vue'
import PixelMeat from '@/components/icons/PixelMeat.vue'

const authStore = useAuthStore()

const coins = computed(() => authStore.studentUser?.coins ?? 0)
const food = computed(() => authStore.studentUser?.food ?? 0)
const level = computed(() => authStore.studentUser?.level ?? 1)
const currentXp = computed(() => authStore.currentLevelXp)
const xpNeeded = computed(() => authStore.xpToNextLevel)
const progress = computed(() => authStore.xpProgress)
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent>
      <div class="px-2 py-3 space-y-3">
        <!-- Coin and Food Balance -->
        <div class="flex gap-2">
          <div
            class="flex flex-1 items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
          >
            <PixelCoin :size="18" />
            <span class="font-semibold text-amber-700 dark:text-amber-400">{{
              coins.toLocaleString()
            }}</span>
          </div>
          <div
            class="flex flex-1 items-center gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/30"
          >
            <PixelMeat :size="18" />
            <span class="font-semibold text-red-700 dark:text-red-400">{{
              food.toLocaleString()
            }}</span>
          </div>
        </div>

        <!-- Level Progress -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium">Level {{ level }}</span>
            <span class="text-xs text-muted-foreground">{{ currentXp }} / {{ xpNeeded }} XP</span>
          </div>
          <Progress :model-value="progress" class="h-2" />
        </div>
      </div>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
