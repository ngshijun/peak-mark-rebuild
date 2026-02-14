<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { useAnnouncementsStore, audienceConfig, type Announcement } from '@/stores/announcements'
import {
  Search,
  Plus,
  Trash2,
  Loader2,
  Pin,
  PinOff,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import AnnouncementDetailDialog from '@/components/announcements/AnnouncementDetailDialog.vue'
import AnnouncementFormDialog from '@/components/admin/AnnouncementFormDialog.vue'
import { toast } from 'vue-sonner'
import { formatDate, formatTimeAgo } from '@/lib/date'

const announcementsStore = useAnnouncementsStore()

// Fetch announcements on mount
onMounted(async () => {
  if (announcementsStore.announcements.length === 0) {
    await announcementsStore.fetchAnnouncements()
  }
})

// Filter announcements based on search (using store's search state)
const filteredAnnouncements = computed(() => {
  const searchQuery = announcementsStore.adminAnnouncementsFilters.search
  if (!searchQuery) return announcementsStore.announcements
  const query = searchQuery.toLowerCase()
  return announcementsStore.announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(query) ||
      a.content.toLowerCase().includes(query) ||
      audienceConfig[a.targetAudience].label.toLowerCase().includes(query),
  )
})

// Preview Dialog (for row click)
const showPreviewDialog = ref(false)
const previewAnnouncement = ref<Announcement | null>(null)

function handleRowClick(announcement: Announcement) {
  previewAnnouncement.value = announcement
  showPreviewDialog.value = true
}

// Add/Edit Dialog
const showFormDialog = ref(false)
const editingAnnouncement = ref<Announcement | null>(null)

function openAddDialog() {
  editingAnnouncement.value = null
  showFormDialog.value = true
}

function openEditDialog(announcement: Announcement) {
  editingAnnouncement.value = announcement
  showFormDialog.value = true
}

async function handleFormSaved() {
  await announcementsStore.fetchAnnouncements()
}

// Pin toggle
const togglingPinId = ref<string | null>(null)

async function handleTogglePin(announcement: Announcement) {
  togglingPinId.value = announcement.id
  try {
    const { error } = await announcementsStore.togglePin(announcement.id)
    if (error) {
      toast.error(error)
    } else {
      // After toggle, isPinned reflects the NEW state
      toast.success(announcement.isPinned ? 'Announcement pinned' : 'Announcement unpinned')
    }
  } finally {
    togglingPinId.value = null
  }
}

// Delete Dialog
const showDeleteDialog = ref(false)
const deletingAnnouncement = ref<Announcement | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(announcement: Announcement) {
  deletingAnnouncement.value = announcement
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingAnnouncement.value) return

  isDeleting.value = true
  try {
    const { error } = await announcementsStore.deleteAnnouncement(deletingAnnouncement.value.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Announcement deleted successfully')
      // Refresh announcements list after delete
      await announcementsStore.fetchAnnouncements()
    }
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
    deletingAnnouncement.value = null
  }
}

// Column definitions
const columns: ColumnDef<Announcement>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      return h('div', { class: 'max-w-[200px] font-medium truncate flex items-center gap-1.5' }, [
        row.original.isPinned ? h(Pin, { class: 'size-3.5 text-primary shrink-0' }) : null,
        row.original.title,
      ])
    },
  },
  {
    accessorKey: 'content',
    header: 'Content',
    cell: ({ row }) => {
      const content = row.original.content
      return h(
        'div',
        { class: 'max-w-[250px] truncate text-muted-foreground', title: content },
        content.substring(0, 60) + (content.length > 60 ? '...' : ''),
      )
    },
  },
  {
    accessorKey: 'targetAudience',
    header: 'Audience',
    cell: ({ row }) => {
      const audience = row.original.targetAudience
      const config = audienceConfig[audience]
      return h(
        Badge,
        { variant: 'secondary', class: `${config.bgColor} ${config.color}` },
        () => config.label,
      )
    },
  },
  {
    accessorKey: 'imagePath',
    header: 'Image',
    cell: ({ row }) => {
      const imagePath = row.original.imagePath
      if (!imagePath) {
        return h('span', { class: 'text-muted-foreground text-sm' }, '-')
      }
      return h('img', {
        src: announcementsStore.getThumbnailImageUrl(imagePath),
        alt: 'Announcement image',
        class: 'size-10 object-cover rounded border',
      })
    },
  },
  {
    accessorKey: 'expiresAt',
    header: 'Expires',
    cell: ({ row }) => {
      const expiresAt = row.original.expiresAt
      if (!expiresAt) {
        return h('span', { class: 'text-muted-foreground text-sm' }, 'Never')
      }
      const isExpired = new Date(expiresAt) < new Date()
      return h(
        'span',
        { class: isExpired ? 'text-destructive' : 'text-muted-foreground text-sm' },
        formatDate(expiresAt),
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Created', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h(
        'span',
        { class: 'text-sm text-muted-foreground' },
        formatTimeAgo(row.original.createdAt),
      )
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const announcement = row.original
      const isPinning = togglingPinId.value === announcement.id
      return h(
        DropdownMenu,
        {},
        {
          default: () => [
            h(DropdownMenuTrigger, { asChild: true }, () =>
              h(
                Button,
                {
                  variant: 'ghost',
                  size: 'icon',
                  class: 'size-6',
                  onClick: (event: Event) => event.stopPropagation(),
                },
                () => h(MoreHorizontal, { class: 'size-4' }),
              ),
            ),
            h(DropdownMenuContent, { align: 'end' }, () => [
              h(
                DropdownMenuItem,
                {
                  disabled: isPinning,
                  onClick: (event: Event) => {
                    event.stopPropagation()
                    handleTogglePin(announcement)
                  },
                },
                () => [
                  isPinning
                    ? h(Loader2, { class: 'mr-2 size-4 animate-spin' })
                    : announcement.isPinned
                      ? h(PinOff, { class: 'mr-2 size-4' })
                      : h(Pin, { class: 'mr-2 size-4' }),
                  announcement.isPinned ? 'Unpin' : 'Pin',
                ],
              ),
              h(
                DropdownMenuItem,
                {
                  onClick: (event: Event) => {
                    event.stopPropagation()
                    openEditDialog(announcement)
                  },
                },
                () => [h(Pencil, { class: 'mr-2 size-4' }), 'Edit'],
              ),
              h(
                DropdownMenuItem,
                {
                  class: 'text-destructive focus:text-destructive',
                  onClick: (event: Event) => {
                    event.stopPropagation()
                    openDeleteDialog(announcement)
                  },
                },
                () => [h(Trash2, { class: 'mr-2 size-4' }), 'Delete'],
              ),
            ]),
          ],
        },
      )
    },
  },
]
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Announcements</h1>
        <p class="text-muted-foreground">
          Create and manage announcements for students and parents.
        </p>
      </div>
      <Button :disabled="announcementsStore.isLoading" @click="openAddDialog">
        <Plus class="mr-2 size-4" />
        Add Announcement
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="announcementsStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Search Bar -->
      <div class="mb-4 flex items-center gap-2">
        <div class="relative max-w-sm flex-1">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="announcementsStore.adminAnnouncementsFilters.search"
            placeholder="Search announcements..."
            class="pl-9"
            @update:model-value="announcementsStore.setAdminAnnouncementsSearch(String($event))"
          />
        </div>
      </div>

      <!-- Data Table -->
      <DataTable :columns="columns" :data="filteredAnnouncements" :on-row-click="handleRowClick" />

      <!-- Empty State -->
      <div
        v-if="
          filteredAnnouncements.length === 0 && !announcementsStore.adminAnnouncementsFilters.search
        "
        class="py-12 text-center"
      >
        <p class="text-muted-foreground">No announcements yet. Create your first announcement!</p>
      </div>
    </template>

    <!-- Add/Edit Announcement Dialog -->
    <AnnouncementFormDialog
      v-model:open="showFormDialog"
      :announcement="editingAnnouncement"
      @saved="handleFormSaved"
    />

    <!-- Preview Announcement Dialog -->
    <AnnouncementDetailDialog
      v-model:open="showPreviewDialog"
      :announcement="previewAnnouncement"
    />

    <!-- Delete Announcement Confirmation -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{{ deletingAnnouncement?.title }}"? This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="isDeleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
