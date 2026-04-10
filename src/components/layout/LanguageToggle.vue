<script setup lang="ts">
import { useLanguageStore } from '@/stores/language'
import { Button } from '@/components/ui/button'
import { useT } from '@/composables/useT'

const languageStore = useLanguageStore()
const t = useT()
</script>

<template>
  <Button variant="ghost" size="icon" class="size-8" @click="languageStore.toggleLanguage()">
    <span class="text-sm font-medium">{{ languageStore.language === 'en' ? '中' : 'EN' }}</span>
    <span class="sr-only">{{ t.shared.layout.toggleLanguage }}</span>
  </Button>
</template>
