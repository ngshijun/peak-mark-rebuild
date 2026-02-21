import { ref, onMounted, onUnmounted } from 'vue'
import { getMYTDayOfWeek, toMYTDateString, mytDateToUTCDate } from '@/lib/date'

/**
 * Composable for a countdown timer to next Monday 00:00 MYT.
 * Updates every 60 seconds. Returns a formatted countdown string.
 */
export function useCountdownTimer() {
  const countdown = ref('')
  let interval: ReturnType<typeof setInterval> | null = null

  function getNextMondayMYT(): Date {
    const dayOfWeek = getMYTDayOfWeek() // 0=Sun, 1=Mon, ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek

    // Get today in MYT as a UTC-midnight date, add days, then shift to MYT midnight
    const todayUTC = mytDateToUTCDate(toMYTDateString())
    const nextMondayUTC = new Date(todayUTC)
    nextMondayUTC.setUTCDate(todayUTC.getUTCDate() + daysUntilMonday)

    // Convert MYT midnight (00:00+08:00) to UTC: subtract 8 hours
    return new Date(nextMondayUTC.getTime() - 8 * 60 * 60 * 1000)
  }

  function update() {
    const now = new Date()
    const target = getNextMondayMYT()
    const diff = target.getTime() - now.getTime()

    if (diff <= 0) {
      countdown.value = 'Ending...'
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (days > 0) {
      countdown.value = `${days}d ${hours}h ${minutes}m ${seconds}s`
    } else if (hours > 0) {
      countdown.value = `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      countdown.value = `${minutes}m ${seconds}s`
    } else {
      countdown.value = `${seconds}s`
    }
  }

  onMounted(() => {
    update()
    interval = setInterval(update, 1_000)
  })

  onUnmounted(() => {
    if (interval) {
      clearInterval(interval)
    }
  })

  return { countdown }
}
