<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useAuthStore } from '@/stores/auth'
import { editNameFormSchema } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import { Mail, Calendar, Pencil, Camera, Shield, Loader2, ImagePlus, Dices } from 'lucide-vue-next'

const authStore = useAuthStore()

const showAvatarDialog = ref(false)
const avatarPreviewUrl = ref('')
const avatarFile = ref<File | null>(null)
const showEditNameDialog = ref(false)
const isSaving = ref(false)

// Edit name form
const {
  handleSubmit: handleNameSubmit,
  resetForm: resetNameForm,
  setValues: setNameValues,
} = useForm({
  validationSchema: editNameFormSchema,
  initialValues: {
    name: '',
  },
})

// Reset form when dialog opens
watch(showEditNameDialog, (open) => {
  if (open) {
    setNameValues({ name: authStore.user?.name ?? '' })
  }
})

// Avatar file input ref
const avatarInputRef = ref<HTMLInputElement | null>(null)

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
  return authStore.getAvatarUrl(authStore.user?.avatarPath ?? null)
})

function openAvatarDialog() {
  avatarPreviewUrl.value = ''
  avatarFile.value = null
  showAvatarDialog.value = true
}

function handleAvatarFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    avatarFile.value = file
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreviewUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function generateRandomAvatar() {
  const seed = Math.random().toString(36).substring(7)
  avatarPreviewUrl.value = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`
  avatarFile.value = null // Clear file since we're using generated avatar
}

async function saveAvatar() {
  if (!avatarPreviewUrl.value) {
    showAvatarDialog.value = false
    return
  }

  isSaving.value = true
  try {
    let result: { path: string | null; error: string | null }

    if (avatarFile.value) {
      // Upload file to storage
      result = await authStore.uploadAvatar(avatarFile.value)
    } else {
      // Upload from URL (dicebear)
      result = await authStore.uploadAvatarFromUrl(avatarPreviewUrl.value)
    }

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

function openEditNameDialog() {
  showEditNameDialog.value = true
}

const saveName = handleNameSubmit(async (values) => {
  isSaving.value = true
  try {
    const result = await authStore.updateName(values.name.trim())
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Name updated successfully')
    showEditNameDialog.value = false
    resetNameForm()
  } finally {
    isSaving.value = false
  }
})
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">My Profile</h1>
      <p class="text-muted-foreground">Manage your account settings</p>
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
          <!-- Admin Badge -->
          <div class="flex items-center justify-center">
            <Badge variant="default" class="text-sm">
              <Shield class="mr-1 size-3" />
              Administrator
            </Badge>
          </div>
        </CardContent>
      </Card>

      <!-- Details Card -->
      <Card class="lg:col-span-2">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your account information</CardDescription>
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

          <!-- Role -->
          <div class="flex items-center gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Shield class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Role</p>
              <p class="font-medium">Administrator</p>
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
          <DialogDescription> Upload an image or generate a random avatar. </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="flex justify-center">
            <Avatar class="size-24">
              <AvatarImage :src="avatarPreviewUrl || userAvatarUrl" alt="Preview" />
              <AvatarFallback class="text-2xl">{{ userInitials }}</AvatarFallback>
            </Avatar>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <input
              ref="avatarInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarFileSelect"
            />
            <Button
              variant="outline"
              class="w-full"
              :disabled="isSaving"
              @click="avatarInputRef?.click()"
            >
              <ImagePlus class="mr-2 size-4" />
              Upload Image
            </Button>
            <Button
              variant="outline"
              class="w-full"
              :disabled="isSaving"
              @click="generateRandomAvatar"
            >
              <Dices class="mr-2 size-4" />
              Random Avatar
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showAvatarDialog = false">
            Cancel
          </Button>
          <Button :disabled="isSaving || !avatarPreviewUrl" @click="saveAvatar">
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
        <form @submit="saveName">
          <VeeField v-slot="{ field, errors }" name="name">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="new-name">Name</FieldLabel>
              <Input
                id="new-name"
                placeholder="Enter your name"
                :disabled="isSaving"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>
          <DialogFooter class="mt-4">
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="showEditNameDialog = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isSaving">
              <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
