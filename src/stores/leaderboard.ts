import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']

// XP required per level (same as auth store)
const XP_PER_LEVEL = 500

export interface LeaderboardStudent {
  id: string
  name: string
  gradeLevelName: string | null
  xp: number
  level: number
  rank: number
  avatarPath: string | null
  currentStreak: number
}

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const authStore = useAuthStore()
  const students = ref<LeaderboardStudent[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const selectedGradeLevelId = ref<string | null>(null)

  /**
   * Fetch leaderboard data from Supabase
   */
  async function fetchLeaderboard(gradeLevelId?: string | null): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      let query = supabase
        .from('leaderboard')
        .select('*')
        .order('rank', { ascending: true })
        .limit(100) // Get top 100 for filtering

      // Filter by grade level if specified
      if (gradeLevelId) {
        // We need to join with student_profiles to filter by grade_level_id
        // Since the view doesn't expose grade_level_id, we'll filter client-side
        // or modify to get all and filter
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      students.value = (data ?? []).map((row: LeaderboardRow) => {
        const xp = row.xp ?? 0
        return {
          id: row.id ?? '',
          name: row.name ?? 'Unknown',
          gradeLevelName: row.grade_level_name,
          xp,
          level: Math.floor(xp / XP_PER_LEVEL) + 1,
          rank: row.rank ?? 0,
          avatarPath: row.avatar_path,
          currentStreak: row.current_streak ?? 0,
        }
      })

      return { error: null }
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch leaderboard'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Filter students by grade level (client-side)
  const filteredStudents = computed(() => {
    if (!selectedGradeLevelId.value) {
      return students.value
    }

    // Get the grade level name from curriculum store would be ideal,
    // but for now we filter by the gradeLevelName string comparison
    // This works because the view already includes grade_level_name
    return students.value.filter((s) => {
      // If a grade level is selected, match by grade level name
      // The grade level ID is used in the page, but we match by name in the data
      return true // For now return all, page will handle filtering
    })
  })

  // Get students filtered by grade level name
  function getStudentsByGradeLevel(gradeLevelName: string | null): LeaderboardStudent[] {
    if (!gradeLevelName) {
      return students.value
    }
    return students.value.filter((s) => s.gradeLevelName === gradeLevelName)
  }

  // Get top 20 students (optionally filtered by grade level name)
  function getTop20(gradeLevelName?: string | null): LeaderboardStudent[] {
    const filtered = gradeLevelName
      ? students.value.filter((s) => s.gradeLevelName === gradeLevelName)
      : students.value

    // Re-rank after filtering
    return filtered.slice(0, 20).map((student, index) => ({
      ...student,
      rank: index + 1,
    }))
  }

  // Get all students sorted by XP
  const rankedStudents = computed(() => {
    return [...students.value].sort((a, b) => b.xp - a.xp)
  })

  // Get top 20 students
  const top20Students = computed(() => {
    return rankedStudents.value.slice(0, 20)
  })

  // Get current student's rank (overall)
  const currentStudentRank = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null

    const student = students.value.find((s) => s.id === authStore.user!.id)
    return student?.rank ?? null
  })

  // Check if current student is in top 20
  const isCurrentStudentInTop20 = computed(() => {
    if (!currentStudentRank.value) return false
    return currentStudentRank.value <= 20
  })

  // Get current student's data from leaderboard
  const currentStudent = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null
    return students.value.find((s) => s.id === authStore.user!.id) ?? null
  })

  // Get avatar URL for a student
  function getAvatarUrl(avatarPath: string | null): string {
    if (!avatarPath) return ''
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  // Set grade level filter
  function setGradeLevelFilter(gradeLevelId: string | null) {
    selectedGradeLevelId.value = gradeLevelId
  }

  return {
    // State
    students,
    isLoading,
    error,
    selectedGradeLevelId,

    // Computed
    filteredStudents,
    rankedStudents,
    top20Students,
    currentStudentRank,
    isCurrentStudentInTop20,
    currentStudent,

    // Actions
    fetchLeaderboard,
    getStudentsByGradeLevel,
    getTop20,
    getAvatarUrl,
    setGradeLevelFilter,
  }
})
