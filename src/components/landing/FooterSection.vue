<script setup lang="ts">
import { Mountain } from 'lucide-vue-next'
</script>

<template>
  <footer class="border-t bg-background py-12">
    <div class="container mx-auto px-4">
      <div class="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Mountain class="size-4 text-primary-foreground" />
          </div>
          <span class="text-xl font-bold">Peak Mark</span>
        </div>

        <nav class="flex flex-wrap justify-center gap-6">
          <RouterLink
            to="/login"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Login
          </RouterLink>
          <RouterLink
            to="/signup"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign Up
          </RouterLink>
          <RouterLink
            to="/forgot-password"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot Password
          </RouterLink>
        </nav>

        <p class="text-sm text-muted-foreground">
          &copy; {{ new Date().getFullYear() }} Peak Mark. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
