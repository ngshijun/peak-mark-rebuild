<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { Sun, Moon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useT } from '@/composables/useT'

const themeStore = useThemeStore()
const t = useT()
</script>

<template>
  <Button variant="ghost" size="icon" class="size-8" @click="themeStore.toggleTheme()">
    <Sun v-if="themeStore.theme === 'light'" class="size-4" />
    <Moon v-else class="size-4" />
    <span class="sr-only">{{ t.shared.layout.toggleTheme }}</span>
  </Button>
</template>
