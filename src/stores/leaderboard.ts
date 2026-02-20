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

// Number of top ranks to display
const TOP_RANKS = 20

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
  currentStreak: number
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

  function mapLeaderboardRow(row: LeaderboardRow): LeaderboardStudent {
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
  }

  /**
   * Fetch leaderboard data from Supabase.
   * First counts how many students have rank <= TOP_RANKS (handles ties),
   * then fetches that many rows. Also fetches the current student's row
   * separately if they fall outside that range.
   */
  async function fetchLeaderboard(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      // Count students with rank <= TOP_RANKS (may exceed TOP_RANKS due to ties)
      const { count, error: countError } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .lte('rank', TOP_RANKS)

      if (countError) throw countError

      const fetchLimit = count ?? TOP_RANKS

      const { data, error: fetchError } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rank', { ascending: true })
        .limit(fetchLimit)

      if (fetchError) throw fetchError

      const rows = (data ?? []).map(mapLeaderboardRow)

      // If current student is not in the fetched results, fetch their row separately
      const studentId = authStore.user?.id
      if (studentId && authStore.isStudent && !rows.some((r) => r.id === studentId)) {
        const { data: selfData } = await supabase
          .from('leaderboard')
          .select('*')
          .eq('id', studentId)
          .single()

        if (selfData) {
          rows.push(mapLeaderboardRow(selfData))
        }
      }

      students.value = rows

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch leaderboard.')
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  function mapWeeklyLeaderboardRow(row: WeeklyLeaderboardRow): WeeklyLeaderboardStudent {
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
      currentStreak: row.current_streak ?? 0,
    }
  }

  /**
   * Fetch weekly leaderboard data from Supabase.
   * Same count-then-fetch strategy as fetchLeaderboard.
   */
  async function fetchWeeklyLeaderboard(): Promise<{ error: string | null }> {
    isWeeklyLoading.value = true

    try {
      const { count, error: countError } = await supabase
        .from('weekly_leaderboard')
        .select('*', { count: 'exact', head: true })
        .lte('rank', TOP_RANKS)

      if (countError) throw countError

      const fetchLimit = count ?? TOP_RANKS

      const { data, error: fetchError } = await supabase
        .from('weekly_leaderboard')
        .select('*')
        .order('rank', { ascending: true })
        .limit(fetchLimit)

      if (fetchError) throw fetchError

      const rows = (data ?? []).map(mapWeeklyLeaderboardRow)

      // If current student is not in the fetched results, fetch their row separately
      const studentId = authStore.user?.id
      if (studentId && authStore.isStudent && !rows.some((r) => r.id === studentId)) {
        const { data: selfData } = await supabase
          .from('weekly_leaderboard')
          .select('*')
          .eq('id', studentId)
          .single()

        if (selfData) {
          rows.push(mapWeeklyLeaderboardRow(selfData))
        }
      }

      weeklyStudents.value = rows

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

  // Get top-ranked weekly students (optionally filtered by grade level name)
  function getWeeklyTop20(gradeLevelName?: string | null): WeeklyLeaderboardStudent[] {
    const filtered = gradeLevelName
      ? weeklyStudents.value.filter((s) => s.gradeLevelName === gradeLevelName)
      : weeklyStudents.value

    // Re-rank after filtering with RANK()-style tie handling
    const ranked = assignRanks(filtered, (s) => s.weeklyXp)
    return ranked.filter((s) => s.rank <= TOP_RANKS)
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

  // Get top-ranked students (optionally filtered by grade level name)
  function getTop20(gradeLevelName?: string | null): LeaderboardStudent[] {
    const filtered = gradeLevelName
      ? students.value.filter((s) => s.gradeLevelName === gradeLevelName)
      : students.value

    // Re-rank after filtering with RANK()-style tie handling
    const ranked = assignRanks(filtered, (s) => s.xp)
    return ranked.filter((s) => s.rank <= TOP_RANKS)
  }

  // Get current student's rank (O(1) via Map)
  const currentStudentRank = computed(() => {
    if (!authStore.user || !authStore.isStudent) return null
    return studentById.value.get(authStore.user.id)?.rank ?? null
  })

  // Check if current student is in top ranks
  const isCurrentStudentInTop20 = computed(() => {
    if (!currentStudentRank.value) return false
    return currentStudentRank.value <= TOP_RANKS
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
