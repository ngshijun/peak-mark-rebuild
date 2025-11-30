<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Mountain, Loader2 } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const dateOfBirth = ref('')
const userType = ref<'student' | 'parent'>('student')
const isSubmitting = ref(false)

const passwordsMatch = computed(() => password.value === confirmPassword.value)
const isFormValid = computed(() => {
  return (
    name.value.trim() !== '' &&
    email.value.trim() !== '' &&
    password.value.length >= 6 &&
    passwordsMatch.value
  )
})

async function handleSignup() {
  if (!isFormValid.value) {
    if (!passwordsMatch.value) {
      toast.error('Passwords do not match')
    } else if (password.value.length < 6) {
      toast.error('Password must be at least 6 characters')
    } else {
      toast.error('Please fill in all required fields')
    }
    return
  }

  isSubmitting.value = true

  try {
    const result = await authStore.signUp(
      email.value,
      password.value,
      name.value,
      userType.value,
      userType.value === 'student' ? dateOfBirth.value || undefined : undefined,
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
}
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
        <form class="space-y-4" @submit.prevent="handleSignup">
          <div class="space-y-2">
            <Label for="name">Name <span class="text-destructive">*</span></Label>
            <Input
              id="name"
              v-model="name"
              type="text"
              placeholder="Enter your name"
              required
              :disabled="isSubmitting"
            />
          </div>
          <div class="space-y-2">
            <Label for="email">Email <span class="text-destructive">*</span></Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="Enter your email"
              required
              :disabled="isSubmitting"
            />
          </div>
          <div class="space-y-2">
            <Label for="password">Password <span class="text-destructive">*</span></Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="Create a password (min 6 characters)"
              required
              minlength="6"
              :disabled="isSubmitting"
            />
          </div>
          <div class="space-y-2">
            <Label for="confirmPassword"
              >Confirm Password <span class="text-destructive">*</span></Label
            >
            <Input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              required
              :disabled="isSubmitting"
              :class="{ 'border-destructive': confirmPassword && !passwordsMatch }"
            />
            <p v-if="confirmPassword && !passwordsMatch" class="text-sm text-destructive">
              Passwords do not match
            </p>
          </div>
          <div class="space-y-2">
            <Label>Account Type <span class="text-destructive">*</span></Label>
            <div class="flex gap-2">
              <Button
                type="button"
                :variant="userType === 'student' ? 'default' : 'outline'"
                size="sm"
                class="flex-1"
                :disabled="isSubmitting"
                @click="userType = 'student'"
              >
                Student
              </Button>
              <Button
                type="button"
                :variant="userType === 'parent' ? 'default' : 'outline'"
                size="sm"
                class="flex-1"
                :disabled="isSubmitting"
                @click="userType = 'parent'"
              >
                Parent
              </Button>
            </div>
          </div>
          <div v-if="userType === 'student'" class="space-y-2">
            <Label for="dateOfBirth">Date of Birth</Label>
            <Input id="dateOfBirth" v-model="dateOfBirth" type="date" :disabled="isSubmitting" />
          </div>
          <Button type="submit" class="w-full" :disabled="isSubmitting || !isFormValid">
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
