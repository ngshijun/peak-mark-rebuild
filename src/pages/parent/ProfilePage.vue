<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChildLinkStore } from '@/stores/child-link'
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
import { Mail, Calendar, Pencil, Camera, Baby, GraduationCap } from 'lucide-vue-next'

const authStore = useAuthStore()
const childLinkStore = useChildLinkStore()

const showAvatarDialog = ref(false)
const avatarUrl = ref('')
const showEditNameDialog = ref(false)
const newName = ref('')

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
  if (!authStore.user?.dateJoined) return 'N/A'
  return new Date(authStore.user.dateJoined).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

function openAvatarDialog() {
  avatarUrl.value = authStore.user?.avatar ?? ''
  showAvatarDialog.value = true
}

function saveAvatar() {
  if (avatarUrl.value.trim()) {
    authStore.updateAvatar(avatarUrl.value.trim())
    toast.success('Avatar Updated', {
      description: 'Your profile picture has been updated.',
    })
  }
  showAvatarDialog.value = false
}

function generateRandomAvatar() {
  const seed = Math.random().toString(36).substring(7)
  avatarUrl.value = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`
}

function openEditNameDialog() {
  newName.value = authStore.user?.name ?? ''
  showEditNameDialog.value = true
}

function saveName() {
  if (newName.value.trim()) {
    authStore.updateName(newName.value.trim())
    toast.success('Name Updated', {
      description: 'Your name has been updated.',
    })
  }
  showEditNameDialog.value = false
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
              <AvatarImage :src="authStore.user?.avatar ?? ''" :alt="authStore.user?.name ?? ''" />
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
          <!-- Children Count Badge -->
          <div class="flex items-center justify-center">
            <Badge variant="secondary" class="text-sm">
              <Baby class="mr-1 size-3" />
              {{ childLinkStore.linkedChildren.length }} Linked Children
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

          <!-- Linked Children -->
          <div class="flex items-start gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Baby class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Linked Children</p>
              <div v-if="childLinkStore.linkedChildren.length > 0" class="mt-2 space-y-2">
                <div
                  v-for="child in childLinkStore.linkedChildren"
                  :key="child.id"
                  class="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar class="size-10">
                    <AvatarFallback>
                      {{
                        child.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="flex-1">
                    <p class="font-medium">{{ child.name }}</p>
                    <p class="text-sm text-muted-foreground">{{ child.email }}</p>
                  </div>
                  <Badge variant="outline">
                    <GraduationCap class="mr-1 size-3" />
                    {{ child.gradeLevelName }}
                  </Badge>
                </div>
              </div>
              <p v-else class="mt-1 font-medium text-muted-foreground">No linked children</p>
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
              <AvatarImage :src="avatarUrl" alt="Preview" />
              <AvatarFallback class="text-2xl">{{ userInitials }}</AvatarFallback>
            </Avatar>
          </div>
          <div class="space-y-2">
            <Label for="avatar-url">Avatar URL</Label>
            <Input
              id="avatar-url"
              v-model="avatarUrl"
              placeholder="https://example.com/avatar.png"
            />
          </div>
          <Button variant="outline" class="w-full" @click="generateRandomAvatar">
            Generate Random Avatar
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAvatarDialog = false">Cancel</Button>
          <Button @click="saveAvatar">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Name Dialog -->
    <Dialog v-model:open="showEditNameDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Name</DialogTitle>
          <DialogDescription> Enter your new display name. </DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <Label for="new-name">Name</Label>
          <Input id="new-name" v-model="newName" placeholder="Enter your name" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditNameDialog = false">Cancel</Button>
          <Button @click="saveName">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
