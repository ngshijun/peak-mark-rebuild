import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'
import { handleError } from '@/lib/errors'
import { computeLevel } from '@/lib/xp'

type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
type WeeklyLeaderboardRow = Database['public']['Views']['weekly_leaderboard']['Row']

// Number of top ranks to display
const TOP_RANKS = 20

export interface LeaderboardStudent {
  id: string
  name: string
  gradeLevelId: string | null
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

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const authStore = useAuthStore()

  // All-time leaderboard state (scoped to the active grade-level filter).
  // `students` holds the top N for the current filter; `self` holds the
  // current student's row so the "your rank" row can be shown out-of-top-N.
  const students = ref<LeaderboardStudent[]>([])
  const self = ref<LeaderboardStudent | null>(null)
  const isLoading = ref(false)

  // Weekly leaderboard state (no grade-level filter in the UI).
  const weeklyStudents = ref<WeeklyLeaderboardStudent[]>([])
  const weeklySelf = ref<WeeklyLeaderboardStudent | null>(null)
  const isWeeklyLoading = ref(false)

  const error = ref<string | null>(null)
  const hasUnseenReward = ref(false)

  type RankColumn = 'rank' | 'grade_rank'

  function mapLeaderboardRow(row: LeaderboardRow, rankColumn: RankColumn): LeaderboardStudent {
    const xp = row.xp ?? 0
    return {
      id: row.id ?? '',
      name: row.name ?? 'Unknown',
      gradeLevelId: row.grade_level_id,
      gradeLevelName: row.grade_level_name,
      xp,
      level: computeLevel(xp),
      rank: row[rankColumn] ?? 0,
      avatarPath: row.avatar_path,
      currentStreak: row.current_streak ?? 0,
    }
  }

  /**
   * Fetch the top-ranked students for either the global leaderboard or a
   * specific grade level, plus the current student's row when they fall
   * outside the top N. Rank comes from the view's `rank` (global) or
   * `grade_rank` (partitioned by grade_level_id) — never recomputed client-side.
   */
  async function fetchLeaderboard(
    gradeLevelId: string | null = null,
  ): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null
    self.value = null

    try {
      const rankColumn: RankColumn = gradeLevelId ? 'grade_rank' : 'rank'

      // Count tie-inclusive: RANK() can place more than TOP_RANKS rows at
      // rank <= TOP_RANKS if the 20th place is tied.
      let countQuery = supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .lte(rankColumn, TOP_RANKS)
      if (gradeLevelId) {
        countQuery = countQuery.eq('grade_level_id', gradeLevelId)
      }
      const { count, error: countError } = await countQuery
      if (countError) throw countError

      const fetchLimit = count ?? TOP_RANKS

      let dataQuery = supabase
        .from('leaderboard')
        .select('*')
        .order(rankColumn, { ascending: true })
        .limit(fetchLimit)
      if (gradeLevelId) {
        dataQuery = dataQuery.eq('grade_level_id', gradeLevelId)
      }
      const { data, error: fetchError } = await dataQuery
      if (fetchError) throw fetchError

      students.value = (data ?? []).map((row) => mapLeaderboardRow(row, rankColumn))

      // Skip the self fetch if they're already in the top-N slice.
      const studentId = authStore.user?.id
      if (studentId && authStore.isStudent && !students.value.some((s) => s.id === studentId)) {
        let selfQuery = supabase.from('leaderboard').select('*').eq('id', studentId)
        if (gradeLevelId) {
          selfQuery = selfQuery.eq('grade_level_id', gradeLevelId)
        }
        const { data: selfData } = await selfQuery.maybeSingle()
        self.value = selfData ? mapLeaderboardRow(selfData, rankColumn) : null
      }

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'failedFetchLeaderboard')
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

  async function fetchWeeklyLeaderboard(): Promise<{ error: string | null }> {
    isWeeklyLoading.value = true
    weeklySelf.value = null

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

      weeklyStudents.value = (data ?? []).map(mapWeeklyLeaderboardRow)

      // Skip the self fetch if they're already in the top-N slice.
      // maybeSingle() for the fallback: a student with 0 weekly XP is
      // filtered out of the view by its HAVING weekly_xp > 0 clause.
      const studentId = authStore.user?.id
      if (
        studentId &&
        authStore.isStudent &&
        !weeklyStudents.value.some((s) => s.id === studentId)
      ) {
        const { data: selfData } = await supabase
          .from('weekly_leaderboard')
          .select('*')
          .eq('id', studentId)
          .maybeSingle()
        weeklySelf.value = selfData ? mapWeeklyLeaderboardRow(selfData) : null
      }

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'failedFetchWeeklyLeaderboard')
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

  // Reset store state (call on logout)
  function $reset() {
    students.value = []
    self.value = null
    weeklyStudents.value = []
    weeklySelf.value = null
    isLoading.value = false
    isWeeklyLoading.value = false
    error.value = null
    hasUnseenReward.value = false
  }

  return {
    // State
    students,
    self,
    weeklyStudents,
    weeklySelf,
    isLoading,
    isWeeklyLoading,
    error,
    hasUnseenReward,

    // Actions
    fetchLeaderboard,
    fetchWeeklyLeaderboard,
    fetchLastWeekReward,
    checkUnseenReward,
    markRewardSeen,
    $reset,
  }
})
