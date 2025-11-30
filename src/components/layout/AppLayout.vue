<script setup lang="ts">
import { computed } from 'vue'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth'
import AppSidebar from './AppSidebar.vue'
import ThemeToggle from './ThemeToggle.vue'

const authStore = useAuthStore()

const greeting = computed(() => {
  const hour = new Date().getHours()
  let timeGreeting: string

  if (hour < 12) {
    timeGreeting = 'Good morning'
  } else if (hour < 18) {
    timeGreeting = 'Good afternoon'
  } else {
    timeGreeting = 'Good evening'
  }

  const userName = authStore.user?.name
  return userName ? `${timeGreeting}, ${userName}` : timeGreeting
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div class="flex items-center gap-2">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 h-4" />
          <h1 class="text-lg font-medium">{{ greeting }}</h1>
        </div>
        <ThemeToggle />
      </header>
      <main class="flex-1 overflow-auto">
        <router-view />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
