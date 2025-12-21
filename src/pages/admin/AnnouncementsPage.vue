<script setup lang="ts">
import { ref, computed, h, onMounted, nextTick } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import type { ColumnDef } from '@tanstack/vue-table'
import {
  useAnnouncementsStore,
  audienceConfig,
  type Announcement,
  type AnnouncementAudience,
} from '@/stores/announcements'
import { announcementFormSchema } from '@/lib/validations'
import {
  Search,
  Plus,
  Trash2,
  Loader2,
  ImagePlus,
  X,
  Pin,
  PinOff,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from 'vue-sonner'

const announcementsStore = useAnnouncementsStore()

// Form setup
const {
  handleSubmit,
  resetForm,
  setValues,
  errors: formErrors,
} = useForm({
  validationSchema: announcementFormSchema,
  initialValues: {
    title: '',
    content: '',
    targetAudience: 'all' as AnnouncementAudience,
    expiresAt: null as string | null,
  },
})

const searchQuery = ref('')

// Fetch announcements on mount
onMounted(async () => {
  if (announcementsStore.announcements.length === 0) {
    await announcementsStore.fetchAnnouncements()
  }
})

// Filter announcements based on search
const filteredAnnouncements = computed(() => {
  if (!searchQuery.value) return announcementsStore.announcements
  const query = searchQuery.value.toLowerCase()
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
const showDialog = ref(false)
const editingAnnouncement = ref<Announcement | null>(null)
const formImagePath = ref<string | null>(null)
const formImageFile = ref<File | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const isSaving = ref(false)
const showExpiryInput = ref(false)

function openAddDialog() {
  editingAnnouncement.value = null
  resetForm()
  formImagePath.value = null
  formImageFile.value = null
  showExpiryInput.value = false
  showDialog.value = true
}

async function openEditDialog(announcement: Announcement) {
  editingAnnouncement.value = announcement
  formImagePath.value = announcement.imagePath
  formImageFile.value = null
  showExpiryInput.value = !!announcement.expiresAt
  showDialog.value = true
  await nextTick()
  setValues({
    title: announcement.title,
    content: announcement.content,
    targetAudience: announcement.targetAudience,
    expiresAt: announcement.expiresAt,
  })
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      formImageFile.value = file
      formImagePath.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeImage() {
  formImagePath.value = null
  formImageFile.value = null
  if (imageInputRef.value) imageInputRef.value.value = ''
}

const handleSave = handleSubmit(async (values) => {
  isSaving.value = true

  try {
    let imagePath = formImagePath.value

    // Upload image if new file selected
    if (formImageFile.value) {
      const { path, error: uploadError } = await announcementsStore.uploadImage(formImageFile.value)
      if (uploadError) {
        toast.error(uploadError)
        return
      }
      imagePath = path
    }

    if (editingAnnouncement.value) {
      // Update existing announcement
      const { error } = await announcementsStore.updateAnnouncement(editingAnnouncement.value.id, {
        title: values.title,
        content: values.content,
        targetAudience: values.targetAudience,
        imagePath,
        expiresAt: values.expiresAt || null,
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Announcement updated successfully')
    } else {
      // Create new announcement
      const { error } = await announcementsStore.createAnnouncement({
        title: values.title,
        content: values.content,
        targetAudience: values.targetAudience,
        imagePath,
        expiresAt: values.expiresAt || null,
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Announcement created successfully')
    }

    showDialog.value = false
    // Refresh announcements list after save
    await announcementsStore.fetchAnnouncements()
  } finally {
    isSaving.value = false
  }
})

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

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
      return h(Badge, { variant: 'outline', class: config.color }, () => config.label)
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
                  class: 'size-4',
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
          <Input v-model="searchQuery" placeholder="Search announcements..." class="pl-9" />
        </div>
      </div>

      <!-- Data Table -->
      <DataTable :columns="columns" :data="filteredAnnouncements" :on-row-click="handleRowClick" />

      <!-- Empty State -->
      <div v-if="filteredAnnouncements.length === 0 && !searchQuery" class="py-12 text-center">
        <p class="text-muted-foreground">No announcements yet. Create your first announcement!</p>
      </div>
    </template>

    <!-- Add/Edit Announcement Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>{{
            editingAnnouncement ? 'Edit Announcement' : 'New Announcement'
          }}</DialogTitle>
          <DialogDescription>
            {{
              editingAnnouncement
                ? 'Update announcement details.'
                : 'Create a new announcement for users.'
            }}
          </DialogDescription>
        </DialogHeader>

        <form class="space-y-4 py-4" @submit="handleSave">
          <!-- Title -->
          <VeeField v-slot="{ field, errors }" name="title">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="announcement-title">Title</FieldLabel>
              <Input
                id="announcement-title"
                placeholder="Enter announcement title"
                :disabled="isSaving"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <!-- Content -->
          <VeeField v-slot="{ field, errors }" name="content">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="announcement-content">Content</FieldLabel>
              <Textarea
                id="announcement-content"
                placeholder="Enter announcement content..."
                rows="4"
                :disabled="isSaving"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <!-- Target Audience and Expiry Row -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Target Audience -->
            <VeeField v-slot="{ handleChange, value, errors }" name="targetAudience">
              <Field :data-invalid="!!errors.length">
                <FieldLabel>Target Audience</FieldLabel>
                <Select
                  :model-value="value"
                  :disabled="isSaving"
                  @update:model-value="handleChange"
                >
                  <SelectTrigger class="w-full" :class="{ 'border-destructive': !!errors.length }">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="(config, audience) in audienceConfig"
                      :key="audience"
                      :value="audience"
                    >
                      <span :class="config.color">{{ config.label }}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldError :errors="errors" />
              </Field>
            </VeeField>

            <!-- Expiry Date -->
            <VeeField v-slot="{ field, errors, setValue }" name="expiresAt">
              <Field :data-invalid="!!errors.length">
                <FieldLabel>Expires At (Optional)</FieldLabel>
                <div v-if="field.value || showExpiryInput" class="flex items-center gap-2">
                  <Input
                    id="expires-at"
                    type="datetime-local"
                    :disabled="isSaving"
                    :aria-invalid="!!errors.length"
                    class="flex-1"
                    v-bind="field"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-8 shrink-0"
                    :disabled="isSaving"
                    @click="
                      () => {
                        setValue(null)
                        showExpiryInput = false
                      }
                    "
                  >
                    <X class="size-4" />
                  </Button>
                </div>
                <Button
                  v-else
                  type="button"
                  variant="outline"
                  class="w-full justify-start text-muted-foreground"
                  :disabled="isSaving"
                  @click="showExpiryInput = true"
                >
                  No expiry date - click to set
                </Button>
                <FieldError :errors="errors" />
              </Field>
            </VeeField>
          </div>

          <!-- Image Upload -->
          <div class="space-y-2">
            <FieldLabel>Image (Optional)</FieldLabel>
            <div v-if="formImagePath" class="relative inline-block">
              <img
                :src="formImageFile ? formImagePath : announcementsStore.getImageUrl(formImagePath)"
                alt="Announcement image preview"
                class="h-32 max-w-full rounded-lg border object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                class="absolute -right-2 -top-2 size-6"
                :disabled="isSaving"
                @click="removeImage"
              >
                <X class="size-4" />
              </Button>
            </div>
            <div v-else>
              <input
                ref="imageInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleImageUpload"
              />
              <Button
                type="button"
                variant="outline"
                :disabled="isSaving"
                @click="imageInputRef?.click()"
              >
                <ImagePlus class="mr-2 size-4" />
                Upload Image
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              Add an optional image to make your announcement more engaging.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="showDialog = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isSaving">
              <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
              {{ editingAnnouncement ? 'Update' : 'Create' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

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
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
