import { toast } from 'vue-sonner'

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

    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch {
      toast.error('Failed to share')
    }
  }

  return { share }
}
