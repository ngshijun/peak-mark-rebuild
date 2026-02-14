import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'

export function useProfileEditor() {
  const authStore = useAuthStore()

  const isSaving = ref(false)

  const userInitials = computed(() => {
    if (!authStore.user?.name) return '?'
    return authStore.user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  })

  const formattedDateJoined = computed(() => {
    if (!authStore.user?.createdAt) return 'N/A'
    return new Date(authStore.user.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  })

  const userAvatarUrl = computed(() => {
    return authStore.getAvatarUrl(authStore.user?.avatarPath ?? null)
  })

  async function saveAvatar(file: File | null, previewUrl: string): Promise<boolean> {
    if (!previewUrl) return false

    isSaving.value = true
    try {
      let result: { path: string | null; error: string | null }

      if (file) {
        result = await authStore.uploadAvatar(file)
      } else {
        result = await authStore.uploadAvatarFromUrl(previewUrl)
      }

      if (result.error) {
        toast.error(result.error)
        return false
      }
      toast.success('Avatar updated successfully')
      return true
    } finally {
      isSaving.value = false
    }
  }

  async function saveName(name: string): Promise<boolean> {
    isSaving.value = true
    try {
      const result = await authStore.updateName(name.trim())
      if (result.error) {
        toast.error(result.error)
        return false
      }
      toast.success('Name updated successfully')
      return true
    } finally {
      isSaving.value = false
    }
  }

  return {
    isSaving,
    userInitials,
    formattedDateJoined,
    userAvatarUrl,
    saveAvatar,
    saveName,
  }
}
