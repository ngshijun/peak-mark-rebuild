<script setup lang="ts">
import { Mountain } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="container mx-auto flex h-16 items-center justify-between px-4">
      <RouterLink to="/" class="flex items-center gap-2">
        <div class="flex size-8 items-center justify-center rounded-lg bg-primary">
          <Mountain class="size-4 text-primary-foreground" />
        </div>
        <span class="text-xl font-bold">Peak Mark</span>
      </RouterLink>

      <div class="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" as-child>
          <RouterLink to="/login">Login</RouterLink>
        </Button>
        <Button as-child>
          <RouterLink to="/signup">Sign Up</RouterLink>
        </Button>
      </div>
    </div>
  </header>
</template>
