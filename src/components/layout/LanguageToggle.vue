<script setup lang="ts">
import { useLanguageStore } from '@/stores/language'
import { Button } from '@/components/ui/button'

const languageStore = useLanguageStore()
</script>

<template>
  <Button variant="ghost" size="icon" class="size-8" @click="languageStore.toggleLanguage()">
    <span class="text-sm font-medium">{{ languageStore.language === 'en' ? '中' : 'EN' }}</span>
    <span class="sr-only">Toggle language</span>
  </Button>
</template>
