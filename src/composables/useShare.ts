import { toast } from 'vue-sonner'
import { useLanguageStore } from '@/stores/language'

interface ShareOptions {
  title: string
  text: string
}

export function useShare() {
  async function share({ title, text }: ShareOptions) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }

    const languageStore = useLanguageStore()
    try {
      await navigator.clipboard.writeText(text)
      toast.success(languageStore.t.shared.toasts.copiedToClipboard)
    } catch {
      toast.error(languageStore.t.shared.toasts.failedToShare)
    }
  }

  async function copyLink(text: string) {
    const languageStore = useLanguageStore()
    try {
      await navigator.clipboard.writeText(text)
      toast.success(languageStore.t.shared.toasts.linkCopied)
    } catch {
      toast.error(languageStore.t.shared.toasts.failedToCopyLink)
    }
  }

  return { share, copyLink }
}
