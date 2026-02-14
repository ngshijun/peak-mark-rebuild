<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useAuthStore } from '@/stores/auth'
import { usePracticeStore, type StudentSubscriptionStatus } from '@/stores/practice'
import { useSubscriptionStore } from '@/stores/subscription'
import { useCurriculumStore } from '@/stores/curriculum'
import { editNameFormSchema } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { toast } from 'vue-sonner'
import {
  Cake,
  Mail,
  Calendar,
  CalendarIcon,
  GraduationCap,
  Trophy,
  CirclePoundSterling,
  Pencil,
  Camera,
  Loader2,
  ImagePlus,
  Dices,
  Zap,
  Sparkles,
  Crown,
  CreditCard,
  Check,
} from 'lucide-vue-next'
import {
  type DateValue,
  getLocalTimeZone,
  today,
  parseDate,
  CalendarDate,
} from '@internationalized/date'
import { createYearRange } from 'reka-ui/date'
const authStore = useAuthStore()
const practiceStore = usePracticeStore()
const subscriptionStore = useSubscriptionStore()
const curriculumStore = useCurriculumStore()

// Subscription
const subscriptionStatus = ref<StudentSubscriptionStatus | null>(null)
const isLoadingPlans = ref(false)

function getTierIcon(tier: string) {
  switch (tier) {
    case 'plus':
      return Zap
    case 'pro':
      return Sparkles
    case 'max':
      return Crown
    default:
      return CreditCard
  }
}

// Grade levels (from curriculum store)

// Dialog states
const showAvatarDialog = ref(false)
const avatarPreviewUrl = ref('')
const avatarFile = ref<File | null>(null)
const showEditNameDialog = ref(false)
const showEditBirthdayDialog = ref(false)
const editBirthdayValue = ref<DateValue | undefined>(undefined)
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

const formattedBirthday = computed(() => {
  if (!authStore.user?.dateOfBirth) return null
  return new Date(authStore.user.dateOfBirth).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const currentGradeName = computed(() => {
  if (!authStore.studentProfile?.gradeLevelId) return 'Not set'
  const grade = curriculumStore.gradeLevels.find(
    (g) => g.id === authStore.studentProfile?.gradeLevelId,
  )
  return grade?.name ?? 'Not set'
})

// Get avatar URL from storage path
const userAvatarUrl = computed(() => {
  return authStore.getAvatarUrl(authStore.user?.avatarPath ?? null)
})

onMounted(async () => {
  isLoadingPlans.value = true
  await Promise.all([
    curriculumStore.fetchCurriculum(),
    practiceStore.getStudentSubscriptionStatus().then((status) => {
      subscriptionStatus.value = status
    }),
    subscriptionStore.fetchPlans(),
  ]).finally(() => {
    isLoadingPlans.value = false
  })
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

function openEditBirthdayDialog() {
  // Convert string date to DateValue for calendar
  if (authStore.user?.dateOfBirth) {
    const dateStr = authStore.user.dateOfBirth.split('T')[0]
    if (dateStr) {
      editBirthdayValue.value = parseDate(dateStr)
    } else {
      editBirthdayValue.value = undefined
    }
  } else {
    editBirthdayValue.value = undefined
  }
  showEditBirthdayDialog.value = true
}

async function saveBirthday() {
  isSaving.value = true
  try {
    // Convert DateValue back to string (YYYY-MM-DD format)
    const dateString = editBirthdayValue.value?.toString() ?? null
    const result = await authStore.updateDateOfBirth(dateString)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Birthday updated successfully')
    showEditBirthdayDialog.value = false
  } finally {
    isSaving.value = false
  }
}

// Computed for max date (today) for birthday calendar
const maxBirthdayDate = computed(() => today(getLocalTimeZone()))

// Year range for birthday picker (last 25 years, newest first)
const birthdayYearRange = computed(() => {
  const now = today(getLocalTimeZone())
  return createYearRange({
    start: now.cycle('year', -25),
    end: now,
  }).reverse()
})
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
          <CardTitle class="mt-4 flex min-w-0 items-center justify-center gap-2">
            <span class="min-w-0 truncate">{{ authStore.user?.name }}</span>
            <Button size="icon" variant="ghost" class="size-6 shrink-0" @click="openEditNameDialog">
              <Pencil class="size-3" />
            </Button>
          </CardTitle>
          <CardDescription class="truncate">{{ authStore.user?.email }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Level Badge -->
          <div class="flex items-center justify-center gap-2">
            <Badge variant="secondary" class="text-sm">
              <Trophy class="mr-1 size-3" />
              Level {{ authStore.currentLevel }}
            </Badge>
            <Badge variant="outline" class="text-sm">
              <CirclePoundSterling class="mr-1 size-3 text-amber-600 dark:text-amber-400" />
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

          <!-- Birthday -->
          <div class="flex items-center gap-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Cake class="size-5 text-muted-foreground" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Birthday</p>
              <p class="font-medium">
                <template v-if="formattedBirthday">
                  {{ formattedBirthday }}
                  <span class="text-muted-foreground">({{ age }} years old)</span>
                </template>
                <template v-else>Not set</template>
              </p>
            </div>
            <Button size="icon" variant="ghost" class="size-8" @click="openEditBirthdayDialog">
              <Pencil class="size-4" />
            </Button>
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
              :disabled="isSaving || curriculumStore.isLoading"
              @update:model-value="handleGradeChange"
            >
              <SelectTrigger class="w-[140px]">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="grade in curriculumStore.gradeLevels"
                  :key="grade.id"
                  :value="grade.id"
                >
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

    <!-- My Plan -->
    <Card>
      <CardHeader>
        <CardTitle>My Plan</CardTitle>
        <CardDescription>See what's included in your plan</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          v-if="isLoadingPlans || !subscriptionStatus"
          class="flex items-center justify-center py-8"
        >
          <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>
        <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="plan in subscriptionStore.plans"
            :key="plan.id"
            class="relative flex flex-col rounded-lg border p-4"
            :class="[
              subscriptionStatus.tier === plan.id ? 'border-primary bg-muted/50' : 'border-border',
            ]"
          >
            <!-- Current Plan badge -->
            <Badge
              v-if="subscriptionStatus.tier === plan.id"
              class="absolute -top-2 left-1/2 -translate-x-1/2"
            >
              Current Plan
            </Badge>

            <!-- Plan header -->
            <div class="flex items-center gap-2">
              <component :is="getTierIcon(plan.id)" class="size-5 text-primary" />
              <span class="font-semibold">{{ plan.name }}</span>
            </div>

            <!-- Sessions badge -->
            <div class="mt-3">
              <Badge variant="outline">{{ plan.sessionsPerDay }} sessions/day</Badge>
            </div>

            <!-- Features list -->
            <ul class="mt-3 flex-1 space-y-1.5">
              <li
                v-for="(feature, i) in plan.features"
                :key="i"
                class="flex items-start gap-2 text-sm"
              >
                <Check class="mt-0.5 size-4 shrink-0 text-green-500" />
                <span>{{ feature }}</span>
              </li>
            </ul>

            <!-- Footer -->
            <p
              v-if="
                subscriptionStatus.tier !== plan.id &&
                ['core', 'plus', 'pro', 'max'].indexOf(plan.id) >
                  ['core', 'plus', 'pro', 'max'].indexOf(subscriptionStatus.tier)
              "
              class="mt-3 text-center text-xs text-muted-foreground"
            >
              Ask your parent to upgrade
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

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

    <!-- Edit Birthday Dialog -->
    <Dialog v-model:open="showEditBirthdayDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Birthday</DialogTitle>
          <DialogDescription>Select your date of birth.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <Field>
            <FieldLabel>Birthday</FieldLabel>
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="w-full justify-start text-left font-normal"
                  :class="{ 'text-muted-foreground': !editBirthdayValue }"
                  :disabled="isSaving"
                >
                  <CalendarIcon class="mr-2 size-4" />
                  <span v-if="editBirthdayValue">
                    {{
                      new Date(editBirthdayValue.toString()).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    }}
                  </span>
                  <span v-else>Pick a date</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <CalendarPicker
                  :model-value="editBirthdayValue as any"
                  :max-value="maxBirthdayDate"
                  :year-range="birthdayYearRange"
                  layout="month-and-year"
                  initial-focus
                  @update:model-value="(v: any) => (editBirthdayValue = v)"
                />
              </PopoverContent>
            </Popover>
          </Field>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving"
            @click="showEditBirthdayDialog = false"
          >
            Cancel
          </Button>
          <Button :disabled="isSaving" @click="saveBirthday">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
