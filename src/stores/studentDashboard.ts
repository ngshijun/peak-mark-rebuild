import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { usePracticeStore } from './practice'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type MoodType = Database['public']['Enums']['mood_type']

export interface DailyStatus {
  id: string
  studentId: string
  date: string // ISO date string (YYYY-MM-DD)
  mood: MoodType | null
  hasPracticed: boolean
  hasSpun: boolean
  spinReward: number | null
  createdAt: string | null
}

export const useStudentDashboardStore = defineStore('studentDashboard', () => {
  const practiceStore = usePracticeStore()
  const authStore = useAuthStore()

  // Current day's status
  const todayStatus = ref<DailyStatus | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Get today's date string in local timezone
  function getTodayString(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  // Fetch today's daily status
  async function fetchTodayStatus(): Promise<{ error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { error: 'Not logged in' }
    }

    isLoading.value = true
    error.value = null

    try {
      const today = getTodayString()

      const { data, error: fetchError } = await supabase
        .from('daily_statuses')
        .select('*')
        .eq('student_id', studentId)
        .eq('date', today)
        .maybeSingle()

      if (fetchError) {
        error.value = fetchError.message
        return { error: fetchError.message }
      }

      if (data) {
        todayStatus.value = {
          id: data.id,
          studentId: data.student_id,
          date: data.date,
          mood: data.mood,
          hasPracticed: data.has_practiced ?? false,
          hasSpun: data.has_spun ?? false,
          spinReward: data.spin_reward,
          createdAt: data.created_at,
        }
      } else {
        // No record for today yet - create one
        const { data: newData, error: insertError } = await supabase
          .from('daily_statuses')
          .insert({
            student_id: studentId,
            date: today,
            has_practiced: false,
            has_spun: false,
          })
          .select()
          .single()

        if (insertError) {
          error.value = insertError.message
          return { error: insertError.message }
        }

        todayStatus.value = {
          id: newData.id,
          studentId: newData.student_id,
          date: newData.date,
          mood: newData.mood,
          hasPracticed: newData.has_practiced ?? false,
          hasSpun: newData.has_spun ?? false,
          spinReward: newData.spin_reward,
          createdAt: newData.created_at,
        }
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch daily status'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Check if mood has been set today
  const hasMoodToday = computed(() => todayStatus.value?.mood !== null)

  // Check if already spun today
  const hasSpunToday = computed(() => todayStatus.value?.hasSpun ?? false)

  // Set today's mood
  async function setMood(mood: MoodType): Promise<{ error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { error: 'Not logged in' }
    }

    if (!todayStatus.value) {
      await fetchTodayStatus()
    }

    if (!todayStatus.value) {
      return { error: 'Could not create daily status' }
    }

    try {
      const { error: updateError } = await supabase
        .from('daily_statuses')
        .update({ mood })
        .eq('id', todayStatus.value.id)

      if (updateError) {
        return { error: updateError.message }
      }

      todayStatus.value.mood = mood
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set mood'
      return { error: message }
    }
  }

  // Spin the wheel and get a random reward (1-5 coins)
  async function spinWheel(): Promise<{ reward: number | null; error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { reward: null, error: 'Not logged in' }
    }

    if (!todayStatus.value) {
      await fetchTodayStatus()
    }

    if (!todayStatus.value) {
      return { reward: null, error: 'Could not create daily status' }
    }

    if (todayStatus.value.hasSpun) {
      return { reward: null, error: 'Already spun today' }
    }

    // Generate random reward between 1 and 5
    const reward = Math.floor(Math.random() * 5) + 1

    try {
      // Update daily status
      const { error: updateError } = await supabase
        .from('daily_statuses')
        .update({
          has_spun: true,
          spin_reward: reward,
        })
        .eq('id', todayStatus.value.id)

      if (updateError) {
        return { reward: null, error: updateError.message }
      }

      todayStatus.value.hasSpun = true
      todayStatus.value.spinReward = reward

      // Add coins to user
      await authStore.addCoins(reward)

      return { reward, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to spin wheel'
      return { reward: null, error: message }
    }
  }

  // Calculate streak from daily statuses
  async function calculateStreak(): Promise<number> {
    const studentId = authStore.user?.id
    if (!studentId) return 0

    try {
      // Fetch recent daily statuses ordered by date descending
      const { data, error: fetchError } = await supabase
        .from('daily_statuses')
        .select('date, has_practiced')
        .eq('student_id', studentId)
        .eq('has_practiced', true)
        .order('date', { ascending: false })
        .limit(100)

      if (fetchError || !data || data.length === 0) {
        return 0
      }

      const today = getTodayString()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

      // If no practice today or yesterday, streak is broken
      const mostRecentDate = data[0]?.date
      if (mostRecentDate !== today && mostRecentDate !== yesterdayStr) {
        return 0
      }

      // Count consecutive days
      let streak = 1
      let currentDate = new Date(mostRecentDate)

      for (let i = 1; i < data.length; i++) {
        const expectedPrevDate = new Date(currentDate)
        expectedPrevDate.setDate(expectedPrevDate.getDate() - 1)
        const expectedPrevStr = `${expectedPrevDate.getFullYear()}-${String(expectedPrevDate.getMonth() + 1).padStart(2, '0')}-${String(expectedPrevDate.getDate()).padStart(2, '0')}`

        if (data[i]?.date === expectedPrevStr) {
          streak++
          currentDate = expectedPrevDate
        } else {
          break
        }
      }

      return streak
    } catch {
      return 0
    }
  }

  // Current streak (computed from practice history for now, will be replaced with DB call)
  const currentStreak = computed(() => {
    const sessions = practiceStore.studentHistory
    if (sessions.length === 0) return 0

    // Get unique dates with sessions that have progress (answered at least one question)
    const practiceDates = new Set<string>()
    for (const session of sessions) {
      // Check currentQuestionIndex > 0 since answers array is not populated in history fetch
      if (session.currentQuestionIndex > 0 && session.createdAt) {
        const date = new Date(session.createdAt)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        practiceDates.add(dateStr)
      }
    }

    if (practiceDates.size === 0) return 0

    // Sort dates in descending order
    const sortedDates = Array.from(practiceDates).sort((a, b) => b.localeCompare(a))

    // Check if practiced today or yesterday (streak is still valid)
    const today = getTodayString()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    // If no practice today or yesterday, streak is broken
    if (sortedDates[0] !== today && sortedDates[0] !== yesterdayStr) {
      return 0
    }

    // Count consecutive days
    let streak = 1
    let currentDate = new Date(sortedDates[0] as string)

    for (let i = 1; i < sortedDates.length; i++) {
      const expectedPrevDate = new Date(currentDate)
      expectedPrevDate.setDate(expectedPrevDate.getDate() - 1)
      const expectedPrevStr = `${expectedPrevDate.getFullYear()}-${String(expectedPrevDate.getMonth() + 1).padStart(2, '0')}-${String(expectedPrevDate.getDate()).padStart(2, '0')}`

      if (sortedDates[i] === expectedPrevStr) {
        streak++
        currentDate = expectedPrevDate
      } else {
        break
      }
    }

    return streak
  })

  // Check if practiced today
  const hasPracticedToday = computed(() => {
    return todayStatus.value?.hasPracticed ?? false
  })

  // Mark that user has practiced today
  async function markPracticedToday(): Promise<{ error: string | null }> {
    if (!todayStatus.value) {
      await fetchTodayStatus()
    }

    if (!todayStatus.value) {
      return { error: 'Could not create daily status' }
    }

    if (todayStatus.value.hasPracticed) {
      return { error: null } // Already marked
    }

    try {
      const { error: updateError } = await supabase
        .from('daily_statuses')
        .update({ has_practiced: true })
        .eq('id', todayStatus.value.id)

      if (updateError) {
        return { error: updateError.message }
      }

      todayStatus.value.hasPracticed = true
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark practiced'
      return { error: message }
    }
  }

  return {
    todayStatus,
    isLoading,
    error,
    hasMoodToday,
    hasSpunToday,
    currentStreak,
    hasPracticedToday,
    fetchTodayStatus,
    setMood,
    spinWheel,
    calculateStreak,
    markPracticedToday,
    getTodayString,
  }
})
