<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeoMeta } from '@unhead/vue'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/composables/useT'
import logoSvg from '@/assets/logo.svg'
import { ArrowLeft, Loader2, CheckCircle, Mail } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const t = useT()

useSeoMeta({
  title: 'Check Your Email',
  description: 'Verify your email address to complete your Clavis account setup.',
  robots: 'noindex, follow',
})

const email = ref('')
const isResending = ref(false)
const cooldownSeconds = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const queryEmail = route.query.email as string | undefined
  if (!queryEmail) {
    router.replace('/signup')
    return
  }
  email.value = queryEmail
  // Start cooldown immediately — Supabase just sent the email
  startCooldown()
})

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }
})

function startCooldown() {
  cooldownSeconds.value = 60
  cooldownTimer = setInterval(() => {
    cooldownSeconds.value--
    if (cooldownSeconds.value <= 0) {
      clearInterval(cooldownTimer!)
      cooldownTimer = null
    }
  }, 1000)
}

async function handleResend() {
  isResending.value = true

  try {
    const result = await authStore.resendConfirmationEmail(email.value)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(t.value.auth.signupConfirm.resendSuccess)
    startCooldown()
  } catch {
    toast.error(t.value.auth.signupConfirm.unexpectedError)
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <Button as-child variant="ghost" size="sm" class="absolute left-4 top-4">
      <RouterLink to="/">
        <ArrowLeft class="mr-2 size-4" />
        {{ t.auth.common.backToHome }}
      </RouterLink>
    </Button>
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="mb-1 flex items-center justify-center gap-3">
          <img :src="logoSvg" :alt="t.auth.common.logoAlt" class="size-10" />
          <span class="font-logo translate-y-1 text-3xl text-primary">Clavis</span>
        </div>
        <CardTitle class="text-xl">{{ t.auth.signupConfirm.title }}</CardTitle>
        <CardDescription>{{ t.auth.signupConfirm.description }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div class="flex flex-col items-center gap-4 py-4">
            <div
              class="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50"
            >
              <CheckCircle class="size-8 text-green-600" />
            </div>
            <div class="text-center">
              <p class="text-sm text-muted-foreground">{{ t.auth.signupConfirm.sentTo }}</p>
              <p class="font-medium">{{ email }}</p>
            </div>
            <p class="text-center text-sm text-muted-foreground">
              {{ t.auth.signupConfirm.instructions }}
            </p>
          </div>

          <Button
            variant="outline"
            class="w-full"
            :disabled="isResending || cooldownSeconds > 0"
            @click="handleResend"
          >
            <Loader2 v-if="isResending" class="mr-2 size-4 animate-spin" />
            <Mail v-else class="mr-2 size-4" />
            <template v-if="isResending">{{ t.auth.signupConfirm.resendingSending }}</template>
            <template v-else-if="cooldownSeconds > 0">
              {{ t.auth.signupConfirm.resendCooldown(cooldownSeconds) }}
            </template>
            <template v-else>{{ t.auth.signupConfirm.resend }}</template>
          </Button>

          <div class="space-y-1 text-center text-sm text-muted-foreground">
            <div>
              {{ t.auth.signupConfirm.alreadyVerified }}
              <RouterLink to="/login" class="text-primary hover:underline">{{
                t.auth.signupConfirm.backToLogin
              }}</RouterLink>
            </div>
            <div>
              {{ t.auth.signupConfirm.wrongEmail }}
              <RouterLink to="/signup" class="text-primary hover:underline">{{
                t.auth.signupConfirm.signUpAgain
              }}</RouterLink>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
