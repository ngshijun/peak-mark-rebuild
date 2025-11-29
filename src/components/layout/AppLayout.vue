<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth'
import { sidebarNavConfig } from '@/config/navigation'
import AppSidebar from './AppSidebar.vue'
import ThemeToggle from './ThemeToggle.vue'

const route = useRoute()
const authStore = useAuthStore()

const pageTitle = computed(() => {
  if (!authStore.userType) return ''
  const navItems = sidebarNavConfig[authStore.userType]
  const currentItem = navItems.find((item) => item.path === route.path)
  return currentItem?.title ?? ''
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
          <h1 class="text-lg font-medium">{{ pageTitle }}</h1>
        </div>
        <ThemeToggle />
      </header>
      <main class="flex-1 overflow-auto">
        <router-view />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
