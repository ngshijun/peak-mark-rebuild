<script setup lang="ts">
import { ref } from 'vue'
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

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.error('Please enter your email and password')
    return
  }

  isSubmitting.value = true

  try {
    const result = await authStore.signIn(email.value, password.value)

    if (result.error) {
      toast.error(result.error)
      return
    }

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
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="handleLogin">
          <div class="space-y-2">
            <Label for="email">Email</Label>
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
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="Enter your password"
              required
              :disabled="isSubmitting"
            />
          </div>
          <Button type="submit" class="w-full" :disabled="isSubmitting">
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
