<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileEditor } from '@/composables/useProfileEditor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import EditAvatarDialog from '@/components/shared/EditAvatarDialog.vue'
import EditNameDialog from '@/components/shared/EditNameDialog.vue'
import {
  Mail,
  Calendar,
  Pencil,
  Camera,
  Baby,
  Cake,
  ChevronsUpDown,
  RotateCcw,
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { type DateValue, getLocalTimeZone, today, parseDate } from '@internationalized/date'
import { createYearRange } from 'reka-ui/date'
import { useTour } from '@/composables/useTour'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()
const {
  isSaving,
  userInitials,
  formattedDateJoined,
  userAvatarUrl,
  age,
  formattedBirthday,
  saveAvatar,
  saveName,
} = useProfileEditor()
const { resetAndStartTour } = useTour()

const showAvatarDialog = ref(false)
const showEditNameDialog = ref(false)

// Birthday calendar popover
const birthdayPopoverOpen = ref(false)
const dateOfBirthValue = shallowRef<DateValue | undefined>(
  authStore.user?.dateOfBirth ? parseDate(authStore.user.dateOfBirth) : undefined,
)
const maxBirthdayDate = computed(() => today(getLocalTimeZone()))
const birthdayYearRange = computed(() => {
  const now = today(getLocalTimeZone())
  return createYearRange({
    start: now.cycle('year', -100),
    end: now,
  }).reverse()
})

async function handleAvatarSave(payload: { file: File | null; previewUrl: string }) {
  const success = await saveAvatar(payload.file, payload.previewUrl)
  if (success) showAvatarDialog.value = false
}

async function handleNameSave(name: string) {
  const success = await saveName(name)
  if (success) showEditNameDialog.value = false
}

async function handleBirthdayChange(v: DateValue | undefined) {
  dateOfBirthValue.value = v
  const dateString = v?.toString() ?? null
  isSaving.value = true
  try {
    const result = await authStore.updateDateOfBirth(dateString)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Birthday updated successfully')
    birthdayPopoverOpen.value = false
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">My Profile</h1>
        <p class="text-muted-foreground">Manage your account settings and preferences</p>
      </div>
      <Button variant="outline" size="sm" @click="resetAndStartTour">
        <RotateCcw class="mr-2 size-4" />
        Restart Tour
      </Button>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_3fr]">
      <!-- Profile Card -->
      <Card>
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
              @click="showAvatarDialog = true"
            >
              <Camera class="size-4" />
            </Button>
          </div>
          <CardTitle class="mt-4 flex min-w-0 items-center justify-center gap-2">
            <span class="min-w-0 truncate">{{ authStore.user?.name }}</span>
            <Button
              size="icon"
              variant="ghost"
              class="size-6 shrink-0"
              @click="showEditNameDialog = true"
            >
              <Pencil class="size-3" />
            </Button>
          </CardTitle>
          <CardDescription class="truncate">{{ authStore.user?.email }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-center">
            <Badge variant="secondary" class="text-sm">
              <Baby class="mr-1 size-3" />
              Parent Account
            </Badge>
          </div>
        </CardContent>
      </Card>

      <!-- Details Card -->
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <!-- Email -->
            <div class="flex items-center gap-3">
              <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                <Mail class="size-4 text-muted-foreground" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Email Address</p>
                <p class="flex h-9 items-center text-sm font-medium">
                  {{ authStore.user?.email }}
                </p>
              </div>
            </div>

            <!-- Birthday -->
            <div class="flex items-center gap-3">
              <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                <Cake class="size-4 text-muted-foreground" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Birthday</p>
                <Popover v-model:open="birthdayPopoverOpen">
                  <PopoverTrigger as-child>
                    <button
                      :class="
                        cn(
                          'border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-fit items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
                        )
                      "
                      :disabled="isSaving"
                    >
                      <template v-if="formattedBirthday">
                        {{ formattedBirthday }}
                        <span class="text-muted-foreground">({{ age }})</span>
                      </template>
                      <template v-else>Not set</template>
                      <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <CalendarPicker
                      :model-value="dateOfBirthValue"
                      :max-value="maxBirthdayDate"
                      :year-range="birthdayYearRange"
                      layout="month-and-year"
                      initial-focus
                      @update:model-value="(v) => handleBirthdayChange(v as DateValue | undefined)"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <!-- Date Joined -->
            <div class="flex items-center gap-3">
              <div class="flex size-9 items-center justify-center rounded-full bg-muted">
                <Calendar class="size-4 text-muted-foreground" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Member Since</p>
                <p class="flex h-9 items-center text-sm font-medium">
                  {{ formattedDateJoined }}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <EditAvatarDialog
      v-model:open="showAvatarDialog"
      :current-avatar-url="userAvatarUrl"
      :user-initials="userInitials"
      :is-saving="isSaving"
      @save="handleAvatarSave"
    />

    <EditNameDialog
      v-model:open="showEditNameDialog"
      :current-name="authStore.user?.name ?? ''"
      :is-saving="isSaving"
      @save="handleNameSave"
    />
  </div>
</template>
