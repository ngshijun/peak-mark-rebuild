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

const email = ref('')
const password = ref('')

function loginAs(type: UserType) {
  let user: User

  if (type === 'admin') {
    user = {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      type: 'admin',
      dateJoined: '2024-01-01',
    }
  } else if (type === 'student') {
    user = {
      id: '2',
      name: 'Student User',
      email: 'student@example.com',
      type: 'student',
      gradeLevelId: '1',
      gradeLevelName: 'Grade 1',
      xp: 750,
      level: 3,
      coins: 1000,
      food: 10,
      selectedPetId: 'c1',
      dateJoined: '2024-06-15',
      dateOfBirth: '2017-03-15',
    }
  } else {
    user = {
      id: '3',
      name: 'Parent User',
      email: 'parent@example.com',
      type: 'parent',
      childrenIds: ['2'],
      dateJoined: '2024-06-15',
    }
  }

  authStore.setUser(user)
  router.push(`/${type}/dashboard`)
}

function handleLogin() {
  // Mock login - default to student
  loginAs('student')
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
            <Input id="email" v-model="email" type="email" placeholder="Enter your email" />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="Enter your password"
            />
          </div>
          <Button type="submit" class="w-full">Login</Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?
          <RouterLink to="/signup" class="text-primary hover:underline">Sign up</RouterLink>
        </div>

        <!-- Dev only: Quick login buttons -->
        <div class="mt-6 border-t pt-4">
          <p class="mb-2 text-center text-xs text-muted-foreground">Quick login (dev only)</p>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" class="flex-1" @click="loginAs('admin')"
              >Admin</Button
            >
            <Button variant="outline" size="sm" class="flex-1" @click="loginAs('student')"
              >Student</Button
            >
            <Button variant="outline" size="sm" class="flex-1" @click="loginAs('parent')"
              >Parent</Button
            >
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
