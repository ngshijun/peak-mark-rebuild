import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type AnnouncementAudience = Database['public']['Enums']['announcement_audience']

export interface Announcement {
  id: string
  title: string
  content: string
  targetAudience: AnnouncementAudience
  imagePath: string | null
  expiresAt: string | null
  createdBy: string
  createdAt: string | null
  updatedAt: string | null
  isPinned: boolean
  isRead?: boolean
}

export const audienceConfig: Record<
  AnnouncementAudience,
  { label: string; color: string; bgColor: string }
> = {
  all: {
    label: 'All Users',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  students_only: {
    label: 'Students Only',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  parents_only: {
    label: 'Parents Only',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
}

export const useAnnouncementsStore = defineStore('announcements', () => {
  const authStore = useAuthStore()

  // State
  const announcements = ref<Announcement[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unreadCount = ref(0)

  // Computed
  const unreadAnnouncements = computed(() => announcements.value.filter((a) => !a.isRead))

  const latestAnnouncements = computed(() => announcements.value.slice(0, 5))

  // Fetch announcements with read status
  async function fetchAnnouncements(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      const { data: announcementData, error: fetchError } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Fetch read status for current user (if not admin)
      let readAnnouncementIds: Set<string> = new Set()
      if (authStore.userType !== 'admin' && authStore.user?.id) {
        const { data: readData } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', authStore.user.id)

        readAnnouncementIds = new Set((readData || []).map((r) => r.announcement_id))
      }

      announcements.value = (announcementData || []).map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        targetAudience: a.target_audience,
        imagePath: a.image_path,
        expiresAt: a.expires_at,
        createdBy: a.created_by,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        isPinned: a.is_pinned,
        isRead: authStore.userType === 'admin' ? true : readAnnouncementIds.has(a.id),
      }))

      // Calculate unread count from fetched data (more reliable than RPC on first login)
      if (authStore.userType === 'admin') {
        unreadCount.value = 0
      } else {
        unreadCount.value = announcements.value.filter((a) => !a.isRead).length
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch announcements'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Fetch unread count
  async function fetchUnreadCount(): Promise<void> {
    if (authStore.userType === 'admin') {
      unreadCount.value = 0
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('get_unread_announcement_count')
      if (!rpcError && data !== null) {
        unreadCount.value = data
      }
    } catch {
      // Silently fail for unread count
    }
  }

  // Mark announcement as read
  async function markAsRead(announcementId: string): Promise<{ error: string | null }> {
    if (authStore.userType === 'admin' || !authStore.user?.id) {
      return { error: null }
    }

    // Check if already read locally
    const announcement = announcements.value.find((a) => a.id === announcementId)
    if (announcement?.isRead) {
      return { error: null }
    }

    try {
      const { error: insertError } = await supabase.from('announcement_reads').insert({
        announcement_id: announcementId,
        user_id: authStore.user.id,
      })

      // Ignore duplicate key error
      if (insertError && !insertError.message.includes('duplicate')) {
        throw insertError
      }

      // Update local state
      if (announcement) {
        announcement.isRead = true
      }

      // Decrement unread count
      if (unreadCount.value > 0) {
        unreadCount.value--
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to mark as read' }
    }
  }

  // Mark all as read
  async function markAllAsRead(): Promise<{ error: string | null }> {
    if (authStore.userType === 'admin' || !authStore.user?.id) {
      return { error: null }
    }

    const unreadIds = announcements.value.filter((a) => !a.isRead).map((a) => a.id)

    if (unreadIds.length === 0) {
      return { error: null }
    }

    try {
      const inserts = unreadIds.map((id) => ({
        announcement_id: id,
        user_id: authStore.user!.id,
      }))

      const { error: insertError } = await supabase
        .from('announcement_reads')
        .upsert(inserts, { onConflict: 'announcement_id,user_id' })

      if (insertError) throw insertError

      // Update local state
      announcements.value.forEach((a) => {
        a.isRead = true
      })
      unreadCount.value = 0

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to mark all as read' }
    }
  }

  /**
   * Image transformation options for Supabase Storage
   */
  interface ImageTransformOptions {
    width?: number
    height?: number
    quality?: number
    resize?: 'cover' | 'contain' | 'fill'
  }

  /**
   * Get public URL for an announcement image with optional transformation
   */
  function getImageUrl(imagePath: string | null, transform?: ImageTransformOptions): string {
    if (!imagePath) return ''
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath
    }

    // Apply transformation if provided (enables automatic WebP conversion)
    if (transform) {
      const { data } = supabase.storage.from('announcement-images').getPublicUrl(imagePath, {
        transform: {
          width: transform.width,
          height: transform.height,
          quality: transform.quality ?? 80,
          resize: transform.resize ?? 'contain',
        },
      })
      return data.publicUrl
    }

    const { data } = supabase.storage.from('announcement-images').getPublicUrl(imagePath)
    return data.publicUrl
  }

  /**
   * Get optimized image URL for announcement display (medium size for dialogs)
   */
  function getOptimizedImageUrl(imagePath: string | null): string {
    return getImageUrl(imagePath, { width: 800, quality: 80 })
  }

  /**
   * Get thumbnail URL for announcement image (small size for tables/lists)
   */
  function getThumbnailImageUrl(imagePath: string | null): string {
    return getImageUrl(imagePath, { width: 100, height: 100, quality: 70, resize: 'cover' })
  }

  // ========== ADMIN FUNCTIONS ==========

  // Create announcement
  async function createAnnouncement(data: {
    title: string
    content: string
    targetAudience: AnnouncementAudience
    imagePath?: string | null
    expiresAt?: string | null
  }): Promise<{ announcement: Announcement | null; error: string | null }> {
    try {
      const { data: newAnnouncement, error: insertError } = await supabase
        .from('announcements')
        .insert({
          title: data.title,
          content: data.content,
          target_audience: data.targetAudience,
          image_path: data.imagePath ?? null,
          expires_at: data.expiresAt ?? null,
          created_by: authStore.user!.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      const announcement: Announcement = {
        id: newAnnouncement.id,
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        targetAudience: newAnnouncement.target_audience,
        imagePath: newAnnouncement.image_path,
        expiresAt: newAnnouncement.expires_at,
        createdBy: newAnnouncement.created_by,
        createdAt: newAnnouncement.created_at,
        updatedAt: newAnnouncement.updated_at,
        isPinned: newAnnouncement.is_pinned,
        isRead: true,
      }

      announcements.value.unshift(announcement)

      return { announcement, error: null }
    } catch (err) {
      return {
        announcement: null,
        error: err instanceof Error ? err.message : 'Failed to create announcement',
      }
    }
  }

  // Update announcement
  async function updateAnnouncement(
    id: string,
    updates: Partial<{
      title: string
      content: string
      targetAudience: AnnouncementAudience
      imagePath: string | null
      expiresAt: string | null
    }>,
  ): Promise<{ error: string | null }> {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.content !== undefined) updateData.content = updates.content
      if (updates.targetAudience !== undefined) updateData.target_audience = updates.targetAudience
      if (updates.imagePath !== undefined) updateData.image_path = updates.imagePath
      if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt

      const { data: updatedData, error: updateError } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', id)
        .select('updated_at')
        .single()

      if (updateError) throw updateError

      // Update local state
      const index = announcements.value.findIndex((a) => a.id === id)
      if (index !== -1) {
        const announcement = announcements.value[index]
        if (announcement) {
          if (updates.title !== undefined) announcement.title = updates.title
          if (updates.content !== undefined) announcement.content = updates.content
          if (updates.targetAudience !== undefined)
            announcement.targetAudience = updates.targetAudience
          if (updates.imagePath !== undefined) announcement.imagePath = updates.imagePath
          if (updates.expiresAt !== undefined) announcement.expiresAt = updates.expiresAt
          announcement.updatedAt = updatedData?.updated_at ?? new Date().toISOString()
        }
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update announcement' }
    }
  }

  // Toggle pin status
  async function togglePin(id: string): Promise<{ error: string | null }> {
    const announcement = announcements.value.find((a) => a.id === id)
    if (!announcement) {
      return { error: 'Announcement not found' }
    }

    const newPinnedStatus = !announcement.isPinned

    try {
      const { error: updateError } = await supabase
        .from('announcements')
        .update({ is_pinned: newPinnedStatus })
        .eq('id', id)

      if (updateError) throw updateError

      // Update local state
      announcement.isPinned = newPinnedStatus

      // Re-sort announcements (pinned first, then by created_at desc)
      announcements.value.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      })

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to toggle pin status' }
    }
  }

  // Delete announcement
  async function deleteAnnouncement(id: string): Promise<{ error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('announcements').delete().eq('id', id)

      if (deleteError) throw deleteError

      // Remove from local state
      const index = announcements.value.findIndex((a) => a.id === id)
      if (index !== -1) {
        announcements.value.splice(index, 1)
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete announcement' }
    }
  }

  // Upload image to storage
  async function uploadImage(file: File): Promise<{ path: string | null; error: string | null }> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('announcement-images')
        .upload(fileName, file, {
          upsert: true,
          cacheControl: '31536000',
        })

      if (uploadError) throw uploadError

      return { path: fileName, error: null }
    } catch (err) {
      return { path: null, error: err instanceof Error ? err.message : 'Failed to upload image' }
    }
  }

  // Delete image from storage
  async function deleteImage(path: string): Promise<{ error: string | null }> {
    try {
      const { error: deleteError } = await supabase.storage
        .from('announcement-images')
        .remove([path])

      if (deleteError) throw deleteError

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete image' }
    }
  }

  // Reset store state (call on logout)
  function $reset() {
    announcements.value = []
    isLoading.value = false
    error.value = null
    unreadCount.value = 0
  }

  return {
    // State
    announcements,
    isLoading,
    error,
    unreadCount,

    // Computed
    unreadAnnouncements,
    latestAnnouncements,

    // Actions
    fetchAnnouncements,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    getImageUrl,
    getOptimizedImageUrl,
    getThumbnailImageUrl,
    $reset,

    // Admin actions
    createAnnouncement,
    updateAnnouncement,
    togglePin,
    deleteAnnouncement,
    uploadImage,
    deleteImage,
  }
})
