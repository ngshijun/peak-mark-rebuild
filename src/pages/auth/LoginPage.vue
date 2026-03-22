<script setup lang="ts">
import { nextTick, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSeoMeta } from '@unhead/vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useAuthStore } from '@/stores/auth'
import { loginFormSchema } from '@/lib/validations'
import logoSvg from '@/assets/logo.svg'
import { ArrowLeft, Loader2, Mail } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()

useSeoMeta({
  title: 'Log In',
  description: 'Log in to Clavis to start your gamified learning journey.',
  robots: 'noindex, follow',
})

const isSubmitting = ref(false)
const passwordRef = ref<InstanceType<typeof PasswordInput> | null>(null)
const unconfirmedEmail = ref('')
const isResending = ref(false)
const cooldownSeconds = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

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

async function handleResendVerification() {
  isResending.value = true
  try {
    const result = await authStore.resendConfirmationEmail(unconfirmedEmail.value)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Verification email sent!')
    startCooldown()
  } catch {
    toast.error('An unexpected error occurred')
  } finally {
    isResending.value = false
  }
}

const { handleSubmit, submitCount } = useForm({
  validationSchema: loginFormSchema,
  initialValues: {
    email: '',
    password: '',
  },
})

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true

  try {
    const result = await authStore.signIn(values.email, values.password)

    if (result.error) {
      if (result.errorCode === 'email_not_confirmed') {
        unconfirmedEmail.value = values.email
      } else {
        toast.error(result.error)
      }
      await nextTick()
      passwordRef.value?.inputRef?.select()
      return
    }

    // Clear any previous unconfirmed state on successful login
    unconfirmedEmail.value = ''

    if (result.user) {
      toast.success('Welcome back!')
      // Redirect based on user type
      const userType = authStore.userType
      if (userType === 'admin') {
        router.push('/admin/dashboard')
      } else if (userType === 'student') {
        router.push('/student/dashboard')
      } else if (userType === 'parent') {
        router.push('/parent/dashboard')
      } else {
        router.push('/login')
      }
    }
  } catch {
    toast.error('An unexpected error occurred')
  } finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <Button as-child variant="ghost" size="sm" class="absolute left-4 top-4">
      <RouterLink to="/">
        <ArrowLeft class="mr-2 size-4" />
        Back to Home
      </RouterLink>
    </Button>
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="mb-1 flex items-center justify-center gap-3">
          <img :src="logoSvg" alt="Clavis logo" class="size-10" />
          <span class="font-logo translate-y-1 text-3xl text-primary">Clavis</span>
        </div>
        <CardTitle class="text-xl">Sign In</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert v-if="unconfirmedEmail" variant="default" class="mb-4">
          <Mail class="size-4" />
          <AlertDescription class="flex flex-col gap-2">
            <span
              >Your email hasn't been verified yet. Check your inbox or resend the verification
              email.</span
            >
            <Button
              variant="outline"
              size="sm"
              class="w-fit"
              :disabled="isResending || cooldownSeconds > 0"
              @click="handleResendVerification"
            >
              <Loader2 v-if="isResending" class="mr-2 size-4 animate-spin" />
              <template v-if="isResending">Sending...</template>
              <template v-else-if="cooldownSeconds > 0">Resend in {{ cooldownSeconds }}s</template>
              <template v-else>Resend Verification Email</template>
            </Button>
          </AlertDescription>
        </Alert>

        <form class="space-y-4" @submit="onSubmit">
          <VeeField
            v-slot="{ field, errors }"
            :validate-on-blur="false"
            :validate-on-change="false"
            :validate-on-input="false"
            :validate-on-model-update="submitCount > 0"
            name="email"
          >
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField
            v-slot="{ field, errors }"
            :validate-on-blur="false"
            :validate-on-change="false"
            :validate-on-input="false"
            :validate-on-model-update="submitCount > 0"
            name="password"
          >
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                ref="passwordRef"
                placeholder="Enter your password"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <div class="text-right">
            <RouterLink to="/forgot-password" class="text-sm text-primary hover:underline">
              Forgot password?
            </RouterLink>
          </div>

          <Button type="submit" class="mt-2 w-full" :disabled="isSubmitting">
            <Loader2 v-if="isSubmitting" class="mr-2 size-4 animate-spin" />
            {{ isSubmitting ? 'Signing in...' : 'Login' }}
          </Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?
          <RouterLink to="/signup" class="text-primary hover:underline">Sign up</RouterLink>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
