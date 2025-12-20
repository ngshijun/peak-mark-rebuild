<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { useAnnouncementsStore } from '@/stores/announcements'
import { useAuthStore } from '@/stores/auth'
import type { NavItem } from '@/types'

defineProps<{
  items: NavItem[]
}>()

const route = useRoute()
const announcementsStore = useAnnouncementsStore()
const authStore = useAuthStore()

function shouldShowBadge(item: NavItem): boolean {
  return (
    item.path.includes('announcements') &&
    authStore.userType !== 'admin' &&
    announcementsStore.unreadCount > 0
  )
}
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.path">
          <SidebarMenuButton as-child :is-active="route.path === item.path">
            <RouterLink :to="item.path" class="flex items-center justify-between w-full">
              <div class="flex items-center gap-2">
                <component :is="item.icon" class="size-4" />
                <span>{{ item.title }}</span>
              </div>
              <Badge
                v-if="shouldShowBadge(item)"
                variant="default"
                class="size-5 justify-center rounded-full p-0 text-xs"
              >
                {{ announcementsStore.unreadCount > 9 ? '9+' : announcementsStore.unreadCount }}
              </Badge>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
