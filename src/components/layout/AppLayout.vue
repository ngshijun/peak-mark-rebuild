<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import { Loader2, CirclePoundSterling, Beef } from 'lucide-vue-next'
import AppSidebar from './AppSidebar.vue'
import ThemeToggle from './ThemeToggle.vue'
import type { Database } from '@/types/database.types'

type GradeLevel = Database['public']['Tables']['grade_levels']['Row']

const authStore = useAuthStore()

// Grade selection dialog state
const showGradeDialog = ref(false)
const gradeLevels = ref<GradeLevel[]>([])
const selectedGradeId = ref<string>('')
const isLoadingGrades = ref(false)
const isSaving = ref(false)

// Check if student needs to set grade on mount
onMounted(async () => {
  if (authStore.isStudent && !authStore.studentProfile?.gradeLevelId) {
    await fetchGradeLevels()
    showGradeDialog.value = true
  }
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

async function handleSaveGrade() {
  if (!selectedGradeId.value) {
    toast.error('Please select your grade level')
    return
  }

  isSaving.value = true
  try {
    const result = await authStore.updateGradeLevel(selectedGradeId.value)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Grade level set successfully')
    showGradeDialog.value = false
  } finally {
    isSaving.value = false
  }
}

const isStudent = computed(() => authStore.userType === 'student')
const coins = computed(() => authStore.studentProfile?.coins ?? 0)
const food = computed(() => authStore.studentProfile?.food ?? 0)

const greeting = computed(() => {
  const hour = new Date().getHours()
  let timeGreeting: string

  if (hour < 12) {
    timeGreeting = 'Good morning'
  } else if (hour < 18) {
    timeGreeting = 'Good afternoon'
  } else {
    timeGreeting = 'Good evening'
  }

  const userName = authStore.user?.name
  return userName ? `${timeGreeting}, ${userName}` : timeGreeting
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div class="flex items-center gap-2">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 h-4" />
          <h1 class="text-lg font-medium">{{ greeting }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <!-- Coins and Food display for students -->
          <template v-if="isStudent">
            <div
              class="flex w-28 items-center rounded-md bg-amber-50 px-2.5 py-1 dark:bg-amber-950/30"
            >
              <CirclePoundSterling class="size-4 text-amber-700 dark:text-amber-400" />
              <span
                class="flex-1 text-right text-sm font-semibold text-amber-700 dark:text-amber-400"
                >{{ coins.toLocaleString() }}</span
              >
            </div>
            <div class="flex w-24 items-center rounded-md bg-red-50 px-2.5 py-1 dark:bg-red-950/30">
              <Beef class="size-4 text-red-700 dark:text-red-400" />
              <span
                class="flex-1 text-right text-sm font-semibold text-red-700 dark:text-red-400"
                >{{ food.toLocaleString() }}</span
              >
            </div>
          </template>
          <ThemeToggle />
        </div>
      </header>
      <main class="flex-1 overflow-auto">
        <router-view />
      </main>
    </SidebarInset>

    <!-- Grade Selection Dialog (for students without grade set) -->
    <AlertDialog :open="showGradeDialog">
      <AlertDialogContent
        class="sm:max-w-md"
        @escape-key-down.prevent
        @pointer-down-outside.prevent
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Set Your Grade Level</AlertDialogTitle>
          <AlertDialogDescription>
            Please select your current grade level to personalize your learning experience. This
            helps us show you the right content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="py-4">
          <Select v-model="selectedGradeId" :disabled="isLoadingGrades || isSaving">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select your grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="grade in gradeLevels" :key="grade.id" :value="grade.id">
                {{ grade.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <Button :disabled="!selectedGradeId || isSaving" @click="handleSaveGrade">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SidebarProvider>
</template>
