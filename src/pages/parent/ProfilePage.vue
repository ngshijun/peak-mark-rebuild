<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import { Mail, Calendar, Pencil, Camera, Baby, Loader2 } from 'lucide-vue-next'

const authStore = useAuthStore()

const showAvatarDialog = ref(false)
const avatarUrl = ref('')
const showEditNameDialog = ref(false)
const newName = ref('')
const isSaving = ref(false)

const userInitials = computed(() => {
  if (!authStore.user?.name) return '?'
  return authStore.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const formattedDateJoined = computed(() => {
  if (!authStore.user?.createdAt) return 'N/A'
  return new Date(authStore.user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Get avatar URL from storage path
const userAvatarUrl = computed(() => {
  if (!authStore.user?.avatarPath) return ''
  const { data } = supabase.storage.from('avatars').getPublicUrl(authStore.user.avatarPath)
  return data.publicUrl
})

function openAvatarDialog() {
  avatarUrl.value = ''
  showAvatarDialog.value = true
}

async function saveAvatar() {
  if (!avatarUrl.value.trim()) {
    showAvatarDialog.value = false
    return
  }

  isSaving.value = true
  try {
    const result = await authStore.updateAvatar(avatarUrl.value.trim())
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Avatar updated successfully')
    showAvatarDialog.value = false
  } finally {
    isSaving.value = false
  }
}

function generateRandomAvatar() {
  const seed = Math.random().toString(36).substring(7)
  avatarUrl.value = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`
}

function openEditNameDialog() {
  newName.value = authStore.user?.name ?? ''
  showEditNameDialog.value = true
}

async function saveName() {
  if (!newName.value.trim()) {
    showEditNameDialog.value = false
    return
  }

  isSaving.value = true
  try {
    const result = await authStore.updateName(newName.value.trim())
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Name updated successfully')
    showEditNameDialog.value = false
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">My Profile</h1>
      <p class="text-muted-foreground">Manage your account settings and preferences</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Profile Card -->
      <Card class="lg:col-span-1">
        <CardHeader class="text-center">
          <div class="relative mx-auto">
            <Avatar class="size-24">
              <AvatarImage :src="userAvatarUrl" :alt="authStore.user?.name ?? ''" />
              <AvatarFallback class="text-2xl">{{ userInitials }}</AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              variant="secondary"
              class="absolute -bottom-1 -right-1 size-8 rounded-full"
              @click="openAvatarDialog"
            >
              <Camera class="size-4" />
            </Button>
          </div>
          <CardTitle class="mt-4 flex items-center justify-center gap-2">
            {{ authStore.user?.name }}
            <Button size="icon" variant="ghost" class="size-6" @click="openEditNameDialog">
              <Pencil class="size-3" />
            </Button>
          </CardTitle>
          <CardDescription>{{ authStore.user?.email }}</CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Account Type Badge -->
          <div class="flex items-center justify-center">
            <Badge variant="secondary" class="text-sm">
              <Baby class="mr-1 size-3" />
              Parent Account
            </Badge>
          </div>
        </CardContent>
      </Card>

      <!-- Details Card -->
      <Card class="lg:col-span-2">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Email -->
          <div class="flex items-center gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Mail class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Email Address</p>
              <p class="font-medium">{{ authStore.user?.email }}</p>
            </div>
          </div>

          <!-- Date Joined -->
          <div class="flex items-center gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Calendar class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Member Since</p>
              <p class="font-medium">{{ formattedDateJoined }}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Avatar Dialog -->
    <Dialog v-model:open="showAvatarDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Profile Picture</DialogTitle>
          <DialogDescription>
            Enter a URL for your new avatar or generate a random one.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="flex justify-center">
            <Avatar class="size-24">
              <AvatarImage :src="avatarUrl || userAvatarUrl" alt="Preview" />
              <AvatarFallback class="text-2xl">{{ userInitials }}</AvatarFallback>
            </Avatar>
          </div>
          <div class="space-y-2">
            <Label for="avatar-url">Avatar URL</Label>
            <Input
              id="avatar-url"
              v-model="avatarUrl"
              placeholder="https://example.com/avatar.png"
              :disabled="isSaving"
            />
          </div>
          <Button
            variant="outline"
            class="w-full"
            :disabled="isSaving"
            @click="generateRandomAvatar"
          >
            Generate Random Avatar
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showAvatarDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSaving" @click="saveAvatar">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Name Dialog -->
    <Dialog v-model:open="showEditNameDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Name</DialogTitle>
          <DialogDescription>Enter your new display name.</DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <Label for="new-name">Name</Label>
          <Input
            id="new-name"
            v-model="newName"
            placeholder="Enter your name"
            :disabled="isSaving"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showEditNameDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSaving" @click="saveName">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
