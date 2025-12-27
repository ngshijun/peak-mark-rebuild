<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCheck } from 'lucide-vue-next'
import { useAnnouncementsStore, type Announcement } from '@/stores/announcements'
import AnnouncementCard from '@/components/announcements/AnnouncementCard.vue'
import AnnouncementDetailDialog from '@/components/announcements/AnnouncementDetailDialog.vue'
import {
  Pagination,
  PaginationContent,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { toast } from 'vue-sonner'

const announcementsStore = useAnnouncementsStore()

const showDetailDialog = ref(false)
const selectedAnnouncement = ref<Announcement | null>(null)
const isMarkingAllRead = ref(false)

// Pagination state
const currentPage = ref(1)
const itemsPerPage = 5

const totalPages = computed(() => Math.ceil(announcementsStore.announcements.length / itemsPerPage))

const paginatedAnnouncements = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return announcementsStore.announcements.slice(start, end)
})

onMounted(async () => {
  if (announcementsStore.announcements.length === 0) {
    await announcementsStore.fetchAnnouncements()
  }
})

function openAnnouncement(announcement: Announcement) {
  selectedAnnouncement.value = announcement
  showDetailDialog.value = true
}

async function handleMarkAllAsRead() {
  if (announcementsStore.unreadCount === 0) return

  isMarkingAllRead.value = true
  try {
    const { error } = await announcementsStore.markAllAsRead()
    if (error) {
      toast.error(error)
    } else {
      toast.success('All announcements marked as read')
    }
  } finally {
    isMarkingAllRead.value = false
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Announcements</h1>
        <p class="text-muted-foreground">Stay updated with the latest news and updates.</p>
      </div>
      <Button
        v-if="announcementsStore.unreadCount > 0"
        variant="outline"
        :disabled="isMarkingAllRead"
        @click="handleMarkAllAsRead"
      >
        <Loader2 v-if="isMarkingAllRead" class="mr-2 size-4 animate-spin" />
        <CheckCheck v-else class="mr-2 size-4" />
        Mark all as read
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="announcementsStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Empty State -->
      <div v-if="announcementsStore.announcements.length === 0" class="py-12 text-center">
        <p class="text-muted-foreground">No announcements yet. Check back later!</p>
      </div>

      <template v-else>
        <!-- Announcements List (Full Width) -->
        <div class="space-y-4">
          <AnnouncementCard
            v-for="announcement in paginatedAnnouncements"
            :key="announcement.id"
            :announcement="announcement"
            show-unread-indicator
            @click="openAnnouncement"
          />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6">
          <Pagination
            :total="announcementsStore.announcements.length"
            :items-per-page="itemsPerPage"
            :sibling-count="1"
            show-edges
            :default-page="1"
            :page="currentPage"
            @update:page="goToPage"
          >
            <PaginationContent class="flex items-center gap-1">
              <PaginationPrevious
                :disabled="currentPage === 1"
                @click="goToPage(currentPage - 1)"
              />

              <span class="px-4 text-sm text-muted-foreground">
                Page {{ currentPage }} of {{ totalPages }}
              </span>

              <PaginationNext
                :disabled="currentPage === totalPages"
                @click="goToPage(currentPage + 1)"
              />
            </PaginationContent>
          </Pagination>
        </div>
      </template>
    </template>

    <!-- Detail Dialog -->
    <AnnouncementDetailDialog
      v-model:open="showDetailDialog"
      :announcement="selectedAnnouncement"
    />
  </div>
</template>
