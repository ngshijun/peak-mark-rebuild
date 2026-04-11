import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const stored = localStorage.getItem('theme')
  const theme = ref<Theme>(stored === 'dark' ? 'dark' : 'light')

  const isDark = computed(() => theme.value === 'dark')

  function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark)
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme === 'dark')
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  // Apply on init
  applyTheme(isDark.value)

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  }
})
