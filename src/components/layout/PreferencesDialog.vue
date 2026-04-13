<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-vue-next'
import { useLanguageStore, type Language } from '@/stores/language'
import { useThemeStore, type Theme } from '@/stores/theme'
import { useT } from '@/composables/useT'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const languageStore = useLanguageStore()
const themeStore = useThemeStore()
const t = useT()

function previewLanguage(lang: Language) {
  languageStore.setLanguage(lang)
}

function previewTheme(theme: Theme) {
  themeStore.setTheme(theme)
}
</script>

<template>
  <AlertDialog :open="open">
    <AlertDialogContent class="sm:max-w-md" @escape-key-down.prevent @pointer-down-outside.prevent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t.shared.layout.preferencesDialog.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t.shared.layout.preferencesDialog.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-2">
        <p class="text-sm font-medium text-muted-foreground">
          {{ t.shared.layout.preferencesDialog.languageLabel }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <Button
            :variant="languageStore.language === 'en' ? 'default' : 'outline'"
            class="h-14 text-base"
            @click="previewLanguage('en')"
          >
            English
          </Button>
          <Button
            :variant="languageStore.language === 'zh' ? 'default' : 'outline'"
            class="h-14 text-base"
            @click="previewLanguage('zh')"
          >
            中文
          </Button>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium text-muted-foreground">
          {{ t.shared.layout.preferencesDialog.themeLabel }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <Button
            :variant="themeStore.theme === 'light' ? 'default' : 'outline'"
            class="h-14 text-base"
            @click="previewTheme('light')"
          >
            <Sun class="size-4" />
            {{ t.shared.layout.preferencesDialog.lightOption }}
          </Button>
          <Button
            :variant="themeStore.theme === 'dark' ? 'default' : 'outline'"
            class="h-14 text-base"
            @click="previewTheme('dark')"
          >
            <Moon class="size-4" />
            {{ t.shared.layout.preferencesDialog.darkOption }}
          </Button>
        </div>
      </div>

      <AlertDialogFooter class="mt-4">
        <Button @click="emit('confirm')">
          {{ t.shared.layout.preferencesDialog.continueButton }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
