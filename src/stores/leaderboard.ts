import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'
import { handleError } from '@/lib/errors'
import { computeLevel } from '@/lib/xp'
import { getAvatarUrl } from '@/lib/storage'

type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
type WeeklyLeaderboardRow = Database['public']['Views']['weekly_leaderboard']['Row']

// Maximum number of entries to fetch for leaderboards
const LEADERBOARD_LIMIT = 100

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

/**
 * Assign RANK()-style ranks to a sorted list.
 * Items with the same score get the same rank; next rank jumps by the count of ties.
 */
function assignRanks<T>(items: T[], getScore: (item: T) => number): (T & { rank: number })[] {
  let currentRank = 1
  return items.map((item, index) => {
    const prev = items[index - 1]
    if (index > 0 && prev !== undefined && getScore(item) === getScore(prev)) {
      return { ...item, rank: currentRank }
    }
    currentRank = index + 1
    return { ...item, rank: currentRank }
  })
}

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const authStore = useAuthStore()
  const students = ref<LeaderboardStudent[]>([])
  const weeklyStudents = ref<WeeklyLeaderboardStudent[]>([])
  const isLoading = ref(false)
  const isWeeklyLoading = ref(false)
  const error = ref<string | null>(null)
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
  async function fetchLeaderboard(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rank', { ascending: true })
        .limit(LEADERBOARD_LIMIT)

      if (fetchError) throw fetchError

      students.value = (data ?? []).map((row: LeaderboardRow) => {
        const xp = row.xp ?? 0
        return {
          id: row.id ?? '',
          name: row.name ?? 'Unknown',
          gradeLevelName: row.grade_level_name,
          xp,
          level: computeLevel(xp),
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
        .limit(LEADERBOARD_LIMIT)

      if (fetchError) throw fetchError

      weeklyStudents.value = (data ?? []).map((row: WeeklyLeaderboardRow) => {
        const totalXp = row.total_xp ?? 0
        return {
          id: row.id ?? '',
          name: row.name ?? 'Unknown',
          gradeLevelName: row.grade_level_name,
          weeklyXp: row.weekly_xp ?? 0,
          totalXp,
          level: computeLevel(totalXp),
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

  /**
   * Check if the student has an unseen weekly reward.
   * Call this on app init / login.
   */
  async function checkUnseenReward() {
    if (!authStore.user || !authStore.isStudent) {
      hasUnseenReward.value = false
      return
    }

    try {
      const { count } = await supabase
        .from('weekly_leaderboard_rewards')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', authStore.user.id)
        .is('seen_at', null)

      hasUnseenReward.value = (count ?? 0) > 0
    } catch (err) {
      console.error('Failed to check unseen rewards:', err)
      hasUnseenReward.value = false
    }
  }

  /**
   * Mark a reward as seen in the database (persists across devices).
   */
  async function markRewardSeen(weekStart: string) {
    hasUnseenReward.value = false

    if (!authStore.user) return

    await supabase
      .from('weekly_leaderboard_rewards')
      .update({ seen_at: new Date().toISOString() })
      .eq('student_id', authStore.user.id)
      .eq('week_start', weekStart)
  }

  /**
   * Fetch the current student's most recent unseen weekly reward (if any).
   * Returns null if no reward found or not a student.
   */
  async function fetchLastWeekReward(): Promise<WeeklyReward | null> {
    if (!authStore.user || !authStore.isStudent) return null

    try {
      const { data, error: fetchError } = await supabase
        .from('weekly_leaderboard_rewards')
        .select('week_start, rank, weekly_xp, coins_awarded')
        .eq('student_id', authStore.user.id)
        .is('seen_at', null)
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
    } catch (err) {
      console.error('Failed to claim weekly reward:', err)
      return null
    }
  }

  // Get top 20 weekly students (optionally filtered by grade level name)
  function getWeeklyTop20(gradeLevelName?: string | null): WeeklyLeaderboardStudent[] {
    const filtered = gradeLevelName
      ? weeklyStudents.value.filter((s) => s.gradeLevelName === gradeLevelName)
      : weeklyStudents.value

    // Re-rank after filtering with RANK()-style tie handling
    return assignRanks(filtered.slice(0, 20), (s) => s.weeklyXp)
  }

  // Get current student's weekly data (O(1) via Map)
  const currentWeeklyStudent = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null
    return weeklyStudentById.value.get(authStore.user.id) ?? null
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

    // Re-rank after filtering with RANK()-style tie handling
    return assignRanks(filtered.slice(0, 20), (s) => s.xp)
  }

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

  // Reset store state (call on logout)
  function $reset() {
    students.value = []
    weeklyStudents.value = []
    isLoading.value = false
    isWeeklyLoading.value = false
    error.value = null
    hasUnseenReward.value = false
  }

  return {
    // State
    students,
    weeklyStudents,
    isLoading,
    isWeeklyLoading,
    error,
    hasUnseenReward,

    // Computed
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
    $reset,
  }
})
