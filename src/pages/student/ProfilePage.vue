<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import {
  Cake,
  Mail,
  Calendar,
  GraduationCap,
  Trophy,
  Coins,
  Pencil,
  Camera,
  Loader2,
  ImagePlus,
  Dices,
} from 'lucide-vue-next'
import type { Database } from '@/types/database.types'

type GradeLevel = Database['public']['Tables']['grade_levels']['Row']

const authStore = useAuthStore()

// Grade levels
const gradeLevels = ref<GradeLevel[]>([])
const isLoadingGrades = ref(false)

// Dialog states
const showAvatarDialog = ref(false)
const avatarPreviewUrl = ref('')
const avatarFile = ref<File | null>(null)
const showEditNameDialog = ref(false)
const newName = ref('')
const isSaving = ref(false)

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

const age = computed(() => {
  if (!authStore.user?.dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(authStore.user.dateOfBirth)
  let years = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    years--
  }
  return years
})

const currentGradeName = computed(() => {
  if (!authStore.studentProfile?.gradeLevelId) return 'Not set'
  const grade = gradeLevels.value.find((g) => g.id === authStore.studentProfile?.gradeLevelId)
  return grade?.name ?? 'Not set'
})

// Get avatar URL from storage path
const userAvatarUrl = computed(() => {
  return authStore.getAvatarUrl(authStore.user?.avatarPath ?? null)
})

onMounted(async () => {
  await fetchGradeLevels()
})

async function fetchGradeLevels() {
  isLoadingGrades.value = true
  try {
    const { data, error } = await supabase
      .from('grade_levels')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw error
    gradeLevels.value = data ?? []
  } catch (err) {
    console.error('Error fetching grade levels:', err)
    toast.error('Failed to load grade levels')
  } finally {
    isLoadingGrades.value = false
  }
}

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

async function handleGradeChange(value: unknown) {
  if (!value || typeof value !== 'string') return

  isSaving.value = true
  try {
    const result = await authStore.updateGradeLevel(value)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Grade level updated successfully')
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
        <CardContent class="space-y-4">
          <!-- Level Badge -->
          <div class="flex items-center justify-center gap-2">
            <Badge variant="secondary" class="text-sm">
              <Trophy class="mr-1 size-3" />
              Level {{ authStore.currentLevel }}
            </Badge>
            <Badge variant="outline" class="text-sm">
              <Coins class="mr-1 size-3" />
              {{ authStore.studentProfile?.coins ?? 0 }} Coins
            </Badge>
          </div>

          <!-- XP Progress -->
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">XP Progress</span>
              <span>{{ authStore.currentLevelXp }} / {{ authStore.xpToNextLevel }}</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                class="h-full bg-primary transition-all"
                :style="{ width: `${authStore.xpProgress}%` }"
              />
            </div>
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

          <!-- Age -->
          <div class="flex items-center gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Cake class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Age</p>
              <p class="font-medium">
                {{ age !== null ? `${age} years old` : 'Not set' }}
              </p>
            </div>
          </div>

          <!-- Grade Level -->
          <div class="flex items-center gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <GraduationCap class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Grade Level</p>
              <p class="font-medium">{{ currentGradeName }}</p>
            </div>
            <Select
              :model-value="authStore.studentProfile?.gradeLevelId ?? undefined"
              :disabled="isSaving || isLoadingGrades"
              @update:model-value="handleGradeChange"
            >
              <SelectTrigger class="w-[140px]">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="grade in gradeLevels" :key="grade.id" :value="grade.id">
                  {{ grade.name }}
                </SelectItem>
              </SelectContent>
            </Select>
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
