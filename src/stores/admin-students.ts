import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { handleError } from '@/lib/errors'
import type { Database } from '@/types/database.types'

type SubscriptionTier = Database['public']['Enums']['subscription_tier']

export interface AdminStudent {
  id: string
  name: string
  email: string
  dateOfBirth: string | null
  subscriptionTier: SubscriptionTier | null
  parentName: string | null
  parentEmail: string | null
  joinedAt: string | null
  lastActive: string | null
  gradeLevelName: string | null
  xp: number
  coins: number
}

export const useAdminStudentsStore = defineStore('adminStudents', () => {
  const authStore = useAuthStore()

  // Students list state
  const students = ref<AdminStudent[]>([])
  const isLoadingStudents = ref(false)
  const studentsError = ref<string | null>(null)

  // Students table filter state
  const studentsFilters = ref({
    search: '',
  })

  // Students table pagination state
  const studentsPagination = ref({
    pageIndex: 0,
    pageSize: 10,
  })

  /**
   * Fetch all students with joined data
   */
  async function fetchAllStudents(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isAdmin) {
      return { error: 'Not authenticated as admin' }
    }

    isLoadingStudents.value = true
    studentsError.value = null

    try {
      // Fetch all student profiles with their subscriptions and parent links
      const { data: studentsData, error: fetchError } = await supabase
        .from('profiles')
        .select(
          `
          id,
          email,
          name,
          date_of_birth,
          created_at,
          parent_student_links!parent_student_links_student_id_fkey (
            parent:profiles!parent_student_links_parent_id_fkey (
              name,
              email
            )
          ),
          daily_statuses!daily_statuses_student_id_fkey (
            date
          ),
          student_profiles!student_profiles_id_fkey (
            xp,
            coins,
            subscription_tier,
            grade_levels (
              name
            )
          )
        `,
        )
        .eq('user_type', 'student')
        .order('name')

      if (fetchError) throw fetchError

      // Transform the data
      students.value = (studentsData ?? []).map((student) => {
        // Get parent info - handle both array and single object cases
        const parentLinksRaw = student.parent_student_links
        const parentLinks = Array.isArray(parentLinksRaw)
          ? parentLinksRaw
          : parentLinksRaw
            ? [parentLinksRaw]
            : []
        const parentInfo = (parentLinks as { parent: { name: string; email: string } | null }[])[0]
          ?.parent

        // Get last active from most recent daily status (logged in date)
        const statusesRaw = student.daily_statuses
        const statuses = Array.isArray(statusesRaw) ? statusesRaw : statusesRaw ? [statusesRaw] : []
        const statusDates = (statuses as { date: string | null }[])
          .map((s) => s.date)
          .filter(Boolean) as string[]
        const lastActive =
          statusDates.length > 0
            ? (statusDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null)
            : null

        // Get student profile data (xp, coins, tier, and grade level)
        const studentProfile = student.student_profiles as {
          xp: number | null
          coins: number | null
          subscription_tier: SubscriptionTier
          grade_levels: { name: string } | null
        } | null
        const xp = studentProfile?.xp ?? 0
        const coins = studentProfile?.coins ?? 0
        const gradeLevelName = studentProfile?.grade_levels?.name ?? null

        return {
          id: student.id,
          name: student.name ?? 'Unknown',
          email: student.email ?? '',
          dateOfBirth: student.date_of_birth,
          subscriptionTier: studentProfile?.subscription_tier ?? null,
          parentName: parentInfo?.name ?? null,
          parentEmail: parentInfo?.email ?? null,
          joinedAt: student.created_at,
          lastActive,
          gradeLevelName,
          xp,
          coins,
        }
      })

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch students.')
      studentsError.value = message
      return { error: message }
    } finally {
      isLoadingStudents.value = false
    }
  }

  /**
   * Get a student by ID from the loaded students
   */
  function getStudentById(studentId: string): AdminStudent | undefined {
    return students.value.find((s) => s.id === studentId)
  }

  // Filtered students computed (applies search filter)
  const filteredStudents = computed(() => {
    const searchQuery = studentsFilters.value.search.toLowerCase().trim()
    if (!searchQuery) return students.value

    return students.value.filter(
      (student) =>
        student.name.toLowerCase().includes(searchQuery) ||
        student.email.toLowerCase().includes(searchQuery) ||
        (student.parentName && student.parentName.toLowerCase().includes(searchQuery)) ||
        (student.parentEmail && student.parentEmail.toLowerCase().includes(searchQuery)),
    )
  })

  // Students filter setters
  function setStudentsSearch(value: string) {
    studentsFilters.value.search = value
    // Reset pagination when search changes
    studentsPagination.value.pageIndex = 0
  }

  // Students pagination setters
  function setStudentsPageIndex(value: number) {
    studentsPagination.value.pageIndex = value
  }

  function setStudentsPageSize(value: number) {
    studentsPagination.value.pageSize = value
    studentsPagination.value.pageIndex = 0
  }

  // Reset store state
  function $reset() {
    students.value = []
    isLoadingStudents.value = false
    studentsError.value = null
    studentsFilters.value = { search: '' }
    studentsPagination.value = { pageIndex: 0, pageSize: 10 }
  }

  return {
    // State
    students,
    isLoadingStudents,
    studentsError,

    // Computed
    filteredStudents,

    // Students filters
    studentsFilters,
    setStudentsSearch,

    // Students pagination
    studentsPagination,
    setStudentsPageIndex,
    setStudentsPageSize,

    // Actions
    fetchAllStudents,
    getStudentById,
    $reset,
  }
})
