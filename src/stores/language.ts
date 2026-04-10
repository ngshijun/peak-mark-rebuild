import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import en from '@/locales/en'
import zh from '@/locales/zh'

export type Language = 'en' | 'zh'

const locales = { en, zh } as const

export const useLanguageStore = defineStore('language', () => {
  const language = ref<Language>((localStorage.getItem('language') as Language) || 'en')

  const t = computed(() => locales[language.value])

  function setLanguage(lang: Language) {
    language.value = lang
    localStorage.setItem('language', lang)
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
