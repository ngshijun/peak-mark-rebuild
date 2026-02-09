import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'
import { handleError } from '@/lib/errors'

type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
type WeeklyLeaderboardRow = Database['public']['Views']['weekly_leaderboard']['Row']

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

export interface WeeklyLeaderboardStudent {
  id: string
  name: string
  gradeLevelName: string | null
  weeklyXp: number
  totalXp: number
  level: number
  rank: number
  avatarPath: string | null
}

export interface WeeklyReward {
  weekStart: string
  rank: number
  weeklyXp: number
  coinsAwarded: number
}

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const authStore = useAuthStore()
  const students = ref<LeaderboardStudent[]>([])
  const weeklyStudents = ref<WeeklyLeaderboardStudent[]>([])
  const isLoading = ref(false)
  const isWeeklyLoading = ref(false)
  const error = ref<string | null>(null)
  const selectedGradeLevelId = ref<string | null>(null)
  const hasUnseenReward = ref(false)

  // O(1) lookup Map for students by ID
  const studentById = computed(() => {
    const map = new Map<string, LeaderboardStudent>()
    for (const student of students.value) {
      map.set(student.id, student)
    }
    return map
  })

  // O(1) lookup Map for weekly students by ID
  const weeklyStudentById = computed(() => {
    const map = new Map<string, WeeklyLeaderboardStudent>()
    for (const student of weeklyStudents.value) {
      map.set(student.id, student)
    }
    return map
  })

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
      const message = handleError(err, 'Failed to fetch leaderboard.')
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch weekly leaderboard data from Supabase
   */
  async function fetchWeeklyLeaderboard(): Promise<{ error: string | null }> {
    isWeeklyLoading.value = true

    try {
      const { data, error: fetchError } = await supabase
        .from('weekly_leaderboard')
        .select('*')
        .order('rank', { ascending: true })
        .limit(100)

      if (fetchError) throw fetchError

      weeklyStudents.value = (data ?? []).map((row: WeeklyLeaderboardRow) => {
        const totalXp = row.total_xp ?? 0
        return {
          id: row.id ?? '',
          name: row.name ?? 'Unknown',
          gradeLevelName: row.grade_level_name,
          weeklyXp: row.weekly_xp ?? 0,
          totalXp,
          level: Math.floor(totalXp / XP_PER_LEVEL) + 1,
          rank: row.rank ?? 0,
          avatarPath: row.avatar_path,
        }
      })

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch weekly leaderboard.')
      error.value = message
      return { error: message }
    } finally {
      isWeeklyLoading.value = false
    }
  }

  const REWARD_SEEN_KEY = 'weekly-leaderboard-reward-seen'

  /**
   * Check if the student has an unseen weekly reward.
   * Call this on app init / login.
   */
  async function checkUnseenReward() {
    if (!authStore.user || !authStore.isStudent) {
      hasUnseenReward.value = false
      return
    }

    const reward = await fetchLastWeekReward()
    if (!reward) {
      hasUnseenReward.value = false
      return
    }

    const seenWeek = localStorage.getItem(REWARD_SEEN_KEY)
    hasUnseenReward.value = seenWeek !== reward.weekStart
  }

  /**
   * Mark the current reward as seen (dismiss badge).
   */
  function markRewardSeen(weekStart: string) {
    localStorage.setItem(REWARD_SEEN_KEY, weekStart)
    hasUnseenReward.value = false
  }

  /**
   * Fetch the current student's most recent weekly reward (if any).
   * Returns null if no reward found or not a student.
   */
  async function fetchLastWeekReward(): Promise<WeeklyReward | null> {
    if (!authStore.user || !authStore.isStudent) return null

    try {
      const { data, error: fetchError } = await supabase
        .from('weekly_leaderboard_rewards')
        .select('week_start, rank, weekly_xp, coins_awarded')
        .eq('student_id', authStore.user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .single()

      if (fetchError || !data) return null

      return {
        weekStart: data.week_start,
        rank: data.rank,
        weeklyXp: data.weekly_xp,
        coinsAwarded: data.coins_awarded,
      }
    } catch {
      return null
    }
  }

  // Get top 20 weekly students (optionally filtered by grade level name)
  function getWeeklyTop20(gradeLevelName?: string | null): WeeklyLeaderboardStudent[] {
    const filtered = gradeLevelName
      ? weeklyStudents.value.filter((s) => s.gradeLevelName === gradeLevelName)
      : weeklyStudents.value

    // Re-rank after filtering
    return filtered.slice(0, 20).map((student, index) => ({
      ...student,
      rank: index + 1,
    }))
  }

  // Get current student's weekly data (O(1) via Map)
  const currentWeeklyStudent = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null
    return weeklyStudentById.value.get(authStore.user.id) ?? null
  })

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

  // Get all students sorted by rank (data is already sorted from fetch, no re-sort needed)
  const rankedStudents = computed(() => students.value)

  // Get top 20 students (already sorted by rank from fetch)
  const top20Students = computed(() => students.value.slice(0, 20))

  // Get current student's rank (O(1) via Map)
  const currentStudentRank = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null
    return studentById.value.get(authStore.user.id)?.rank ?? null
  })

  // Check if current student is in top 20
  const isCurrentStudentInTop20 = computed(() => {
    if (!currentStudentRank.value) return false
    return currentStudentRank.value <= 20
  })

  // Get current student's data from leaderboard (O(1) via Map)
  const currentStudent = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null
    return studentById.value.get(authStore.user.id) ?? null
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

  // Reset store state (call on logout)
  function $reset() {
    students.value = []
    weeklyStudents.value = []
    isLoading.value = false
    isWeeklyLoading.value = false
    error.value = null
    selectedGradeLevelId.value = null
    hasUnseenReward.value = false
  }

  return {
    // State
    students,
    weeklyStudents,
    isLoading,
    isWeeklyLoading,
    error,
    selectedGradeLevelId,
    hasUnseenReward,

    // Computed
    filteredStudents,
    rankedStudents,
    top20Students,
    currentStudentRank,
    isCurrentStudentInTop20,
    currentStudent,
    currentWeeklyStudent,

    // Actions
    fetchLeaderboard,
    fetchWeeklyLeaderboard,
    fetchLastWeekReward,
    checkUnseenReward,
    markRewardSeen,
    getStudentsByGradeLevel,
    getTop20,
    getWeeklyTop20,
    getAvatarUrl,
    setGradeLevelFilter,
    $reset,
  }
})
