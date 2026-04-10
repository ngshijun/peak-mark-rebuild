import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import en from '@/locales/en'
import zh from '@/locales/zh'
import { supabase } from '@/lib/supabaseClient'

export type Language = 'en' | 'zh'

const locales = { en, zh } as const

export const useLanguageStore = defineStore('language', () => {
  const language = ref<Language>((localStorage.getItem('language') as Language) || 'en')

  const t = computed(() => locales[language.value])

  async function setLanguage(lang: Language) {
    language.value = lang
    localStorage.setItem('language', lang)

    // Profile sync for authenticated users.
    // Dynamic import of auth store avoids a circular dependency
    // (auth store also needs to call language store — see Task 6).
    try {
      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      if (auth.user) {
        const { error } = await supabase
          .from('profiles')
          .update({ ui_language: lang })
          .eq('id', auth.user.id)
        if (error) {
          toast.error(locales[language.value].shared.toasts.languageSaveFailed)
          // Do NOT revert language.value — optimistic UI.
        }
      }
    } catch {
      // Guarantee the function never throws (unhandled rejection safety).
      // Covers dynamic import failure, network exceptions, and any synchronous
      // throw from the Supabase client.
      toast.error(locales[language.value].shared.toasts.languageSaveFailed)
    }
  }

  function toggleLanguage() {
    setLanguage(language.value === 'en' ? 'zh' : 'en')
  }

  return {
    language,
    t,
    setLanguage,
    toggleLanguage,
  }
})
