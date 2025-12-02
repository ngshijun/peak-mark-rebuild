<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm, Field as VeeField } from 'vee-validate'
import { useAuthStore } from '@/stores/auth'
import { signupFormSchema } from '@/lib/validations'
import { Mountain, Loader2 } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()

const isSubmitting = ref(false)

const { handleSubmit, values, setFieldValue } = useForm({
  validationSchema: signupFormSchema,
  initialValues: {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'student' as 'student' | 'parent',
    dateOfBirth: '',
  },
})

const onSubmit = handleSubmit(async (formValues) => {
  isSubmitting.value = true

  try {
    const result = await authStore.signUp(
      formValues.email,
      formValues.password,
      formValues.name,
      formValues.userType,
      formValues.userType === 'student' ? formValues.dateOfBirth || undefined : undefined,
    )

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.user) {
      toast.success('Account created successfully! Please check your email to verify your account.')
      router.push('/login')
    }
  } catch (err) {
    toast.error('An unexpected error occurred')
  } finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary">
          <Mountain class="size-6 text-primary-foreground" />
        </div>
        <CardTitle class="text-2xl">Peak Mark</CardTitle>
        <CardDescription>Create a new account</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit="onSubmit">
          <VeeField v-slot="{ field, errors }" name="name">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="name">Name <span class="text-destructive">*</span></FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField v-slot="{ field, errors }" name="email">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="email">Email <span class="text-destructive">*</span></FieldLabel>
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

          <VeeField v-slot="{ field, errors }" name="password">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="password">
                Password <span class="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (min 6 characters)"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField v-slot="{ field, errors }" name="confirmPassword">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="confirmPassword">
                Confirm Password <span class="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField v-slot="{ errors }" name="userType">
            <Field :data-invalid="!!errors.length">
              <FieldLabel>Account Type <span class="text-destructive">*</span></FieldLabel>
              <div class="flex gap-2">
                <Button
                  type="button"
                  :variant="values.userType === 'student' ? 'default' : 'outline'"
                  size="sm"
                  class="flex-1"
                  :disabled="isSubmitting"
                  @click="setFieldValue('userType', 'student')"
                >
                  Student
                </Button>
                <Button
                  type="button"
                  :variant="values.userType === 'parent' ? 'default' : 'outline'"
                  size="sm"
                  class="flex-1"
                  :disabled="isSubmitting"
                  @click="setFieldValue('userType', 'parent')"
                >
                  Parent
                </Button>
              </div>
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField v-if="values.userType === 'student'" v-slot="{ field }" name="dateOfBirth">
            <Field>
              <FieldLabel for="dateOfBirth">Date of Birth</FieldLabel>
              <Input id="dateOfBirth" type="date" :disabled="isSubmitting" v-bind="field" />
            </Field>
          </VeeField>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            <Loader2 v-if="isSubmitting" class="mr-2 size-4 animate-spin" />
            {{ isSubmitting ? 'Creating Account...' : 'Sign Up' }}
          </Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?
          <RouterLink to="/login" class="text-primary hover:underline">Login</RouterLink>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
