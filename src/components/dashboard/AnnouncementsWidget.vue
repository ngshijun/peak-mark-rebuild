<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Megaphone, ChevronRight, Pin } from 'lucide-vue-next'
import { useAnnouncementsStore, type Announcement } from '@/stores/announcements'
import { useAuthStore } from '@/stores/auth'
import AnnouncementDetailDialog from '@/components/announcements/AnnouncementDetailDialog.vue'

const router = useRouter()
const announcementsStore = useAnnouncementsStore()
const authStore = useAuthStore()

const showDetailDialog = ref(false)
const selectedAnnouncement = ref<Announcement | null>(null)

function openAnnouncement(announcement: Announcement) {
  selectedAnnouncement.value = announcement
  showDetailDialog.value = true
}

function goToAnnouncementsPage() {
  const basePath = authStore.userType === 'student' ? '/student' : '/parent'
  router.push(`${basePath}/announcements`)
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <div class="flex items-center gap-2">
        <CardTitle class="text-sm font-medium">Announcements</CardTitle>
        <Badge
          v-if="announcementsStore.unreadCount > 0"
          variant="default"
          class="size-5 justify-center rounded-full p-0 text-xs"
        >
          {{ announcementsStore.unreadCount > 9 ? '9+' : announcementsStore.unreadCount }}
        </Badge>
      </div>
      <Megaphone class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div v-if="announcementsStore.latestAnnouncements.length === 0" class="py-4 text-center">
        <p class="text-sm text-muted-foreground">No announcements yet</p>
      </div>

      <div v-else class="space-y-3">
        <!-- Latest 3 announcements -->
        <div
          v-for="announcement in announcementsStore.latestAnnouncements.slice(0, 3)"
          :key="announcement.id"
          class="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50"
          @click="openAnnouncement(announcement)"
        >
          <div class="flex items-start gap-2">
            <!-- Unread indicator -->
            <div
              v-if="!announcement.isRead"
              class="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
            />
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5 truncate text-sm font-medium">
                <Pin v-if="announcement.isPinned" class="size-3 shrink-0 text-primary" />
                {{ announcement.title }}
              </p>
              <p class="line-clamp-1 text-xs text-muted-foreground">
                {{ announcement.content }}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ formatTimeAgo(announcement.createdAt) }}
              </p>
            </div>
          </div>
        </div>

        <!-- View All button -->
        <Button variant="ghost" size="sm" class="w-full" @click="goToAnnouncementsPage">
          View All
          <ChevronRight class="ml-1 size-4" />
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- Detail Dialog -->
  <AnnouncementDetailDialog v-model:open="showDetailDialog" :announcement="selectedAnnouncement" />
</template>
