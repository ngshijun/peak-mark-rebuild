import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { usePreferredDark } from '@vueuse/core'

export type Theme = 'light' | 'dark' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const prefersDark = usePreferredDark()
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'system')

  const isDark = computed(() => {
    if (theme.value === 'system') {
      return prefersDark.value
    }
    return theme.value === 'dark'
  })

  function applyTheme() {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
  }

  function toggleTheme() {
    const themes: Theme[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme.value)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex]!)
  }

  // Apply theme on init and watch for changes
  watch(isDark, applyTheme, { immediate: true })

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  }
})
