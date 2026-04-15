import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAvatarUrl } from '@/lib/storage'
import { formatLongDate } from '@/lib/date'
import { toast } from 'vue-sonner'
import { useLanguageStore } from '@/stores/language'

export function useProfileEditor() {
  const authStore = useAuthStore()
  const languageStore = useLanguageStore()

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
    return formatLongDate(authStore.user.createdAt)
  })

  const userAvatarUrl = computed(() => {
    return getAvatarUrl(authStore.user?.avatarPath ?? null)
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
      toast.success(languageStore.t.shared.toasts.avatarUpdated)
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
      toast.success(languageStore.t.shared.toasts.nameUpdated)
      return true
    } finally {
      isSaving.value = false
    }
  }

  const age = computed(() => {
    if (!authStore.user?.dateOfBirth) return null
    const now = new Date()
    const birthDate = new Date(authStore.user.dateOfBirth)
    let years = now.getFullYear() - birthDate.getFullYear()
    const monthDiff = now.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      years--
    }
    return years
  })

  const formattedBirthday = computed(() => {
    if (!authStore.user?.dateOfBirth) return null
    return formatLongDate(authStore.user.dateOfBirth)
  })

  return {
    isSaving,
    userInitials,
    formattedDateJoined,
    userAvatarUrl,
    age,
    formattedBirthday,
    saveAvatar,
    saveName,
  }
}
