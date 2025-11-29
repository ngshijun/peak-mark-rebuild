<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserType, User } from '@/types'
import { Mountain } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const router = useRouter()
const authStore = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const dateOfBirth = ref('')
const userType = ref<UserType>('student')

function handleSignup() {
  let user: User
  const userName = name.value || 'New User'
  const userEmail = email.value || `${userType.value}@example.com`
  const today = new Date().toISOString().split('T')[0] as string

  if (userType.value === 'admin') {
    user = {
      id: crypto.randomUUID(),
      name: userName,
      email: userEmail,
      type: 'admin',
      dateJoined: today,
    }
  } else if (userType.value === 'student') {
    user = {
      id: crypto.randomUUID(),
      name: userName,
      email: userEmail,
      type: 'student',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      xp: 0,
      level: 1,
      coins: 0,
      food: 0,
      dateJoined: today,
      dateOfBirth: dateOfBirth.value || undefined,
    }
  } else {
    user = {
      id: crypto.randomUUID(),
      name: userName,
      email: userEmail,
      type: 'parent',
      childrenIds: [],
      dateJoined: today,
    }
  }

  authStore.setUser(user)
  router.push(`/${userType.value}/dashboard`)
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
            <Label for="name">Name</Label>
            <Input id="name" v-model="name" type="text" placeholder="Enter your name" />
          </div>
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" placeholder="Enter your email" />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="Create a password"
            />
          </div>
          <div class="space-y-2">
            <Label for="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your password"
            />
          </div>
          <div class="space-y-2">
            <Label>Account Type</Label>
            <div class="flex gap-2">
              <Button
                type="button"
                :variant="userType === 'admin' ? 'default' : 'outline'"
                size="sm"
                class="flex-1"
                @click="userType = 'admin'"
              >
                Admin
              </Button>
              <Button
                type="button"
                :variant="userType === 'student' ? 'default' : 'outline'"
                size="sm"
                class="flex-1"
                @click="userType = 'student'"
              >
                Student
              </Button>
              <Button
                type="button"
                :variant="userType === 'parent' ? 'default' : 'outline'"
                size="sm"
                class="flex-1"
                @click="userType = 'parent'"
              >
                Parent
              </Button>
            </div>
          </div>
          <div v-if="userType === 'student'" class="space-y-2">
            <Label for="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              v-model="dateOfBirth"
              type="date"
              placeholder="Select your date of birth"
            />
          </div>
          <Button type="submit" class="w-full">Sign Up</Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?
          <RouterLink to="/login" class="text-primary hover:underline">Login</RouterLink>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
