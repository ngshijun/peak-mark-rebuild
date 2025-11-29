import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePracticeStore } from './practice'
import { useAuthStore } from './auth'

export type MoodType = 'sad' | 'neutral' | 'happy'

export interface DailyStatus {
  date: string // ISO date string (YYYY-MM-DD)
  mood?: MoodType
  hasSpun: boolean
  spinReward?: number
}

export const useStudentDashboardStore = defineStore('studentDashboard', () => {
  const practiceStore = usePracticeStore()
  const authStore = useAuthStore()

  // Store daily statuses by date
  const dailyStatuses = ref<Map<string, DailyStatus>>(new Map())

  // Get today's date string
  function getTodayString(): string {
    return new Date().toISOString().split('T')[0] as string
  }

  // Get or create today's status
  const todayStatus = computed((): DailyStatus => {
    const today = getTodayString()
    const existing = dailyStatuses.value.get(today)
    if (existing) return existing
    return {
      date: today,
      mood: undefined,
      hasSpun: false,
      spinReward: undefined,
    }
  })

  // Check if mood has been set today
  const hasMoodToday = computed(() => todayStatus.value.mood !== undefined)

  // Check if already spun today
  const hasSpunToday = computed(() => todayStatus.value.hasSpun)

  // Set today's mood
  function setMood(mood: MoodType) {
    const today = getTodayString()
    const existing = dailyStatuses.value.get(today)
    if (existing) {
      existing.mood = mood
    } else {
      dailyStatuses.value.set(today, {
        date: today,
        mood,
        hasSpun: false,
      })
    }
  }

  // Spin the wheel and get a random reward (1-5 coins)
  function spinWheel(): number | null {
    const today = getTodayString()
    const existing = dailyStatuses.value.get(today)

    if (existing?.hasSpun) {
      return null // Already spun today
    }

    // Generate random reward between 1 and 5
    const reward = Math.floor(Math.random() * 5) + 1

    if (existing) {
      existing.hasSpun = true
      existing.spinReward = reward
    } else {
      dailyStatuses.value.set(today, {
        date: today,
        mood: undefined,
        hasSpun: true,
        spinReward: reward,
      })
    }

    // Add coins to user
    authStore.addCoins(reward)

    return reward
  }

  // Calculate streak from practice history
  const currentStreak = computed(() => {
    const sessions = practiceStore.studentHistory
    if (sessions.length === 0) return 0

    // Get unique dates with completed sessions (or sessions with answers)
    const practiceDates = new Set<string>()
    for (const session of sessions) {
      if (session.answers.length > 0) {
        const date = new Date(session.startedAt).toISOString().split('T')[0] as string
        practiceDates.add(date)
      }
    }

    if (practiceDates.size === 0) return 0

    // Sort dates in descending order
    const sortedDates = Array.from(practiceDates).sort((a, b) => b.localeCompare(a))

    // Check if practiced today or yesterday (streak is still valid)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] as string
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0] as string

    // If no practice today or yesterday, streak is broken
    if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
      return 0
    }

    // Count consecutive days
    let streak = 1
    let currentDate = new Date(sortedDates[0] as string)

    for (let i = 1; i < sortedDates.length; i++) {
      const expectedPrevDate = new Date(currentDate)
      expectedPrevDate.setDate(expectedPrevDate.getDate() - 1)
      const expectedPrevStr = expectedPrevDate.toISOString().split('T')[0] as string

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
    const todayStr = getTodayString()
    return practiceStore.studentHistory.some((session) => {
      const sessionDate = new Date(session.startedAt).toISOString().split('T')[0] as string
      return sessionDate === todayStr && session.answers.length > 0
    })
  })

  return {
    dailyStatuses,
    todayStatus,
    hasMoodToday,
    hasSpunToday,
    currentStreak,
    hasPracticedToday,
    setMood,
    spinWheel,
    getTodayString,
  }
})
