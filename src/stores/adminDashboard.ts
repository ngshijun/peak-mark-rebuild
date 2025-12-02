import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'

export interface DashboardStats {
  revenue: {
    total: number
    change: string
  }
  users: {
    total: number
    students: number
    parents: number
  }
  activeStudentsToday: number
  practiceSessionsToday: number
}

export const useAdminDashboardStore = defineStore('adminDashboard', () => {
  const stats = ref<DashboardStats>({
    revenue: {
      total: 12580, // Mock data for now
      change: '+12.5%',
    },
    users: {
      total: 0,
      students: 0,
      parents: 0,
    },
    activeStudentsToday: 0,
    practiceSessionsToday: 0,
  })

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Get today's date in YYYY-MM-DD format
  function getTodayString(): string {
    const today = new Date()
    return today.toISOString().split('T')[0] ?? ''
  }

  // Fetch all dashboard stats
  async function fetchStats(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      const today = getTodayString()

      // Fetch all stats in parallel
      const [usersResult, activeStudentsResult, practiceSessionsResult] = await Promise.all([
        // Total users by type
        supabase.from('profiles').select('user_type'),

        // Active students today (rows in daily_statuses with date = today)
        supabase
          .from('daily_statuses')
          .select('id', { count: 'exact', head: true })
          .eq('date', today),

        // Practice sessions created today
        supabase
          .from('practice_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', `${today}T23:59:59.999`),
      ])

      // Check for errors
      if (usersResult.error) {
        error.value = usersResult.error.message
        return { error: usersResult.error.message }
      }

      // Process users
      if (usersResult.data) {
        const users = usersResult.data
        stats.value.users.total = users.length
        stats.value.users.students = users.filter((u) => u.user_type === 'student').length
        stats.value.users.parents = users.filter((u) => u.user_type === 'parent').length
      }

      // Process active students
      stats.value.activeStudentsToday = activeStudentsResult.count ?? 0

      // Process practice sessions
      stats.value.practiceSessionsToday = practiceSessionsResult.count ?? 0

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard stats'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Update revenue (for when Stripe is integrated)
  function updateRevenue(total: number, change: string) {
    stats.value.revenue.total = total
    stats.value.revenue.change = change
  }

  return {
    stats,
    isLoading,
    error,
    fetchStats,
    updateRevenue,
  }
})
