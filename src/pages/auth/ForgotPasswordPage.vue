<script setup lang="ts">
import { ref } from 'vue'
import { useSeoMeta } from '@unhead/vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/composables/useT'
import { z } from 'zod'
import logoSvg from '@/assets/logo.svg'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()
const t = useT()

useSeoMeta({
  title: 'Forgot Password',
  description: 'Reset your Clavis password. Enter your email to receive a password reset link.',
  robots: 'noindex, follow',
})

const isSubmitting = ref(false)
const emailSent = ref(false)
const sentEmail = ref('')

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, t.value.auth.forgotPassword.validation.emailRequired)
    .email(t.value.auth.forgotPassword.validation.emailInvalid),
})

const { handleSubmit, submitCount } = useForm({
  validationSchema: forgotPasswordSchema,
  initialValues: {
    email: '',
  },
})

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true

  try {
    const result = await authStore.resetPassword(values.email)

    if (result.error) {
      toast.error(result.error)
      return
    }

    sentEmail.value = values.email
    emailSent.value = true
    toast.success(t.value.auth.forgotPassword.resetSuccess)
  } catch (err) {
    console.error('Failed to send password reset email:', err)
    toast.error(t.value.auth.forgotPassword.unexpectedError)
  } finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="mb-1 flex items-center justify-center gap-3">
          <img :src="logoSvg" :alt="t.auth.common.logoAlt" class="size-10" />
          <span class="font-logo translate-y-1 text-3xl text-primary">Clavis</span>
        </div>
        <CardTitle class="text-xl">{{ t.auth.forgotPassword.title }}</CardTitle>
        <CardDescription>
          {{
            emailSent
              ? t.auth.forgotPassword.descriptionSent
              : t.auth.forgotPassword.descriptionForm
          }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <!-- Success State -->
        <div v-if="emailSent" class="space-y-4">
          <div class="flex flex-col items-center gap-4 py-4">
            <div
              class="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50"
            >
              <CheckCircle class="size-8 text-green-600" />
            </div>
            <div class="text-center">
              <p class="text-sm text-muted-foreground">{{ t.auth.forgotPassword.sentTo }}</p>
              <p class="font-medium">{{ sentEmail }}</p>
            </div>
            <p class="text-center text-sm text-muted-foreground">
              {{ t.auth.forgotPassword.instructions }}
            </p>
          </div>

          <Button as-child variant="outline" class="w-full">
            <RouterLink to="/login">
              <ArrowLeft class="mr-2 size-4" />
              {{ t.auth.forgotPassword.backToLogin }}
            </RouterLink>
          </Button>
        </div>

        <!-- Form State -->
        <template v-else>
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
                <FieldLabel for="email">{{ t.auth.forgotPassword.emailLabel }}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  :placeholder="t.auth.forgotPassword.emailPlaceholder"
                  :disabled="isSubmitting"
                  :aria-invalid="!!errors.length"
                  v-bind="field"
                />
                <FieldError :errors="errors" />
              </Field>
            </VeeField>

            <Button type="submit" class="mt-2 w-full" :disabled="isSubmitting">
              <Loader2 v-if="isSubmitting" class="mr-2 size-4 animate-spin" />
              {{ isSubmitting ? t.auth.forgotPassword.submitting : t.auth.forgotPassword.submit }}
            </Button>
          </form>

          <div class="mt-4 text-center text-sm text-muted-foreground">
            {{ t.auth.forgotPassword.rememberPassword }}
            <RouterLink to="/login" class="text-primary hover:underline">{{
              t.auth.forgotPassword.backToLogin
            }}</RouterLink>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
