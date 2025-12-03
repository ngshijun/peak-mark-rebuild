<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'vue-sonner'
import 'vue-sonner/style.css'

const router = useRouter()
const authStore = useAuthStore()

// Track previous auth state to detect actual sign-out events
let previousAuthState: boolean | undefined = undefined

// React to auth state changes for automatic navigation
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    // Skip initial load (when previousAuthState is undefined)
    if (previousAuthState === undefined) {
      previousAuthState = isAuthenticated
      return
    }

    // User was signed out (session expired, revoked, manually signed out, etc.)
    if (!isAuthenticated && previousAuthState) {
      toast.info('You have been signed out')
      router.replace('/login')
    }

    previousAuthState = isAuthenticated
  },
  { immediate: true },
)
</script>

<template>
  <router-view />
  <Toaster rich-colors />
</template>
