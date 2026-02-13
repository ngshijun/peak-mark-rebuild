<script setup lang="ts">
import { KeyRound } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useLanguageStore } from '@/stores/language'

const { t } = storeToRefs(useLanguageStore())
</script>

<template>
  <footer class="border-t bg-background py-12">
    <div class="container mx-auto px-4">
      <div class="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div>
          <div class="flex items-center gap-2">
            <div class="flex size-8 items-center justify-center rounded-lg bg-primary">
              <KeyRound class="size-4 text-primary-foreground" />
            </div>
            <span class="text-xl font-bold">Clavis</span>
          </div>
          <p class="mt-1 text-xs italic text-muted-foreground">
            {{ t.footer.tagline }}
          </p>
        </div>

        <nav class="flex flex-wrap justify-center gap-6">
          <RouterLink
            to="/login"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ t.footer.login }}
          </RouterLink>
          <RouterLink
            to="/signup"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ t.footer.signup }}
          </RouterLink>
          <RouterLink
            to="/forgot-password"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ t.footer.forgotPassword }}
          </RouterLink>
        </nav>

        <p class="text-sm text-muted-foreground">
          &copy; {{ new Date().getFullYear() }} {{ t.footer.copyright }}
        </p>
      </div>
    </div>
  </footer>
</template>
