import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { handleError } from '@/lib/errors'

// Cache TTL for dashboard stats (5 minutes - balances freshness with avoiding redundant queries)
const STATS_CACHE_TTL = 5 * 60 * 1000

export interface MonthlyRevenue {
  month: string // YYYY-MM format
  label: string // e.g., "Jan 2026"
  amount: number // in currency units (not cents)
}

export interface MonthlyUpgrades {
  month: string // YYYY-MM format
  label: string // e.g., "Jan 2026"
  plus: number
  pro: number
  max: number
}

export interface DashboardStats {
  revenue: {
    total: number
    currentMonth: number
    previousMonth: number
    change: string
    currency: string
    monthly: MonthlyRevenue[] // Last 12 months
  }
  upgrades: MonthlyUpgrades[] // Last 12 months
  users: {
    total: number
    students: number
    parents: number
    admins: number
  }
  activeStudentsToday: number
  practiceSessionsToday: number
}

export const useAdminDashboardStore = defineStore('adminDashboard', () => {
  const stats = ref<DashboardStats>({
    revenue: {
      total: 0,
      currentMonth: 0,
      previousMonth: 0,
      change: '0%',
      currency: 'MYR',
      monthly: [],
    },
    upgrades: [],
    users: {
      total: 0,
      students: 0,
      parents: 0,
      admins: 0,
    },
    activeStudentsToday: 0,
    practiceSessionsToday: 0,
  })

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastFetched = ref<number | null>(null)

  /**
   * Check if cache is stale
   */
  function isCacheStale(): boolean {
    if (!lastFetched.value) return true
    return Date.now() - lastFetched.value > STATS_CACHE_TTL
  }

  // Get today's date in YYYY-MM-DD format
  function getTodayString(): string {
    const today = new Date()
    return today.toISOString().split('T')[0] ?? ''
  }

  // Get first day of current month
  function getCurrentMonthStart(): string {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }

  // Get first and last day of previous month
  function getPreviousMonthRange(): { start: string; end: string } {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    }
  }

  // Get range for last 12 months (including current month)
  function getLast12MonthsStart(): string {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    return start.toISOString()
  }

  // Fetch all dashboard stats (with cache check)
  async function fetchStats(force = false): Promise<{ error: string | null }> {
    // Skip if cache is still valid and not forced
    if (!force && !isCacheStale()) {
      return { error: null }
    }

    isLoading.value = true
    error.value = null

    try {
      const today = getTodayString()
      const currentMonthStart = getCurrentMonthStart()
      const previousMonth = getPreviousMonthRange()
      const last12MonthsStart = getLast12MonthsStart()

      // Fetch all stats in parallel
      const [
        usersResult,
        activeStudentsResult,
        practiceSessionsResult,
        totalRevenueResult,
        currentMonthRevenueResult,
        previousMonthRevenueResult,
        monthlyRevenueResult,
        monthlyUpgradesResult,
      ] = await Promise.all([
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

        // Total revenue (all time, only succeeded payments)
        supabase.from('payment_history').select('amount_cents, currency').eq('status', 'succeeded'),

        // Current month revenue
        supabase
          .from('payment_history')
          .select('amount_cents')
          .eq('status', 'succeeded')
          .gte('created_at', currentMonthStart),

        // Previous month revenue
        supabase
          .from('payment_history')
          .select('amount_cents')
          .eq('status', 'succeeded')
          .gte('created_at', previousMonth.start)
          .lte('created_at', previousMonth.end),

        // Monthly revenue for last 12 months
        supabase
          .from('payment_history')
          .select('amount_cents, created_at')
          .eq('status', 'succeeded')
          .gte('created_at', last12MonthsStart)
          .order('created_at', { ascending: true }),

        // Monthly upgrades by tier for last 12 months (excluding basic tier)
        supabase
          .from('payment_history')
          .select('tier, created_at')
          .eq('status', 'succeeded')
          .in('tier', ['plus', 'pro', 'max'])
          .gte('created_at', last12MonthsStart)
          .order('created_at', { ascending: true }),
      ])

      // Check for errors
      if (usersResult.error) {
        const message = handleError(usersResult.error, 'Failed to fetch dashboard stats.')
        error.value = message
        return { error: message }
      }

      // Process users
      if (usersResult.data) {
        const users = usersResult.data
        stats.value.users.total = users.length
        stats.value.users.students = users.filter((u) => u.user_type === 'student').length
        stats.value.users.parents = users.filter((u) => u.user_type === 'parent').length
        stats.value.users.admins = users.filter((u) => u.user_type === 'admin').length
      }

      // Process active students
      stats.value.activeStudentsToday = activeStudentsResult.count ?? 0

      // Process practice sessions
      stats.value.practiceSessionsToday = practiceSessionsResult.count ?? 0

      // Process revenue
      if (totalRevenueResult.data) {
        const totalCents = totalRevenueResult.data.reduce(
          (sum, p) => sum + (p.amount_cents || 0),
          0,
        )
        stats.value.revenue.total = totalCents / 100

        // Get currency from first payment, default to MYR
        const firstPayment = totalRevenueResult.data[0]
        stats.value.revenue.currency = firstPayment?.currency?.toUpperCase() || 'MYR'
      }

      if (currentMonthRevenueResult.data) {
        const currentCents = currentMonthRevenueResult.data.reduce(
          (sum, p) => sum + (p.amount_cents || 0),
          0,
        )
        stats.value.revenue.currentMonth = currentCents / 100
      }

      if (previousMonthRevenueResult.data) {
        const previousCents = previousMonthRevenueResult.data.reduce(
          (sum, p) => sum + (p.amount_cents || 0),
          0,
        )
        stats.value.revenue.previousMonth = previousCents / 100
      }

      // Calculate percentage change
      const current = stats.value.revenue.currentMonth
      const previous = stats.value.revenue.previousMonth
      if (previous === 0) {
        stats.value.revenue.change = current > 0 ? '+100%' : '0%'
      } else {
        const change = ((current - previous) / previous) * 100
        const sign = change >= 0 ? '+' : ''
        stats.value.revenue.change = `${sign}${change.toFixed(1)}%`
      }

      // Process monthly revenue for chart
      if (monthlyRevenueResult.data) {
        // Create a map of all 12 months with 0 as default
        const now = new Date()
        const monthlyMap = new Map<string, number>()

        // Initialize all 12 months with 0
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthlyMap.set(key, 0)
        }

        // Aggregate payments by month
        for (const payment of monthlyRevenueResult.data) {
          if (payment.created_at) {
            const date = new Date(payment.created_at)
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            const existing = monthlyMap.get(key) ?? 0
            monthlyMap.set(key, existing + (payment.amount_cents ?? 0))
          }
        }

        // Convert to array with labels
        stats.value.revenue.monthly = Array.from(monthlyMap.entries()).map(([month, cents]) => {
          const [year, monthNum] = month.split('-')
          const date = new Date(Number(year), Number(monthNum) - 1, 1)
          return {
            month,
            label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            amount: cents / 100,
          }
        })
      }

      // Process monthly upgrades for stacked bar chart
      if (monthlyUpgradesResult.data) {
        const now = new Date()
        const upgradesMap = new Map<string, { plus: number; pro: number; max: number }>()

        // Initialize all 12 months with 0 for each tier
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          upgradesMap.set(key, { plus: 0, pro: 0, max: 0 })
        }

        // Aggregate upgrades by month and tier
        for (const upgrade of monthlyUpgradesResult.data) {
          if (upgrade.created_at && upgrade.tier) {
            const date = new Date(upgrade.created_at)
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            const existing = upgradesMap.get(key)
            if (existing) {
              const tier = upgrade.tier as 'plus' | 'pro' | 'max'
              existing[tier] = (existing[tier] ?? 0) + 1
            }
          }
        }

        // Convert to array with labels
        stats.value.upgrades = Array.from(upgradesMap.entries()).map(([month, counts]) => {
          const [year, monthNum] = month.split('-')
          const date = new Date(Number(year), Number(monthNum) - 1, 1)
          return {
            month,
            label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            plus: counts.plus,
            pro: counts.pro,
            max: counts.max,
          }
        })
      }

      // Update cache timestamp
      lastFetched.value = Date.now()

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to fetch dashboard stats.')
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
