import { ref, computed, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useStudentDashboardStore } from '@/stores/student-dashboard'
import { useTour } from './useTour'
import { isFirstPetTourActive } from './useFirstPetTour'

const MOOD_REMINDER_DISMISSED_KEY = 'mood_reminder_dismissed_date'
const dismissedDate = useLocalStorage(MOOD_REMINDER_DISMISSED_KEY, '')

export const isMoodReminderOpen = ref(false)

export function openMoodReminder() {
  isMoodReminderOpen.value = true
}

export function useMoodReminder() {
  const dashboardStore = useStudentDashboardStore()
  const { showWelcomeDialog, isTourActive } = useTour()

  const isDismissedToday = computed({
    get: () => dismissedDate.value === dashboardStore.getTodayString(),
    set: (val) => {
      dismissedDate.value = val ? dashboardStore.getTodayString() : ''
    },
  })

  function shouldShow(): boolean {
    if (dashboardStore.hasMoodToday) return false
    if (isDismissedToday.value) return false
    return true
  }

  function watchAndStart() {
    const conditionsMet = computed(
      () =>
        !!dashboardStore.todayStatus &&
        !showWelcomeDialog.value &&
        !isTourActive.value &&
        !isFirstPetTourActive.value,
    )

    const fire = () => {
      if (shouldShow()) openMoodReminder()
    }

    if (conditionsMet.value) {
      fire()
      return
    }

    const stop = watch(conditionsMet, (met) => {
      if (met) {
        stop()
        fire()
      }
    })
  }

  return {
    isDismissedToday,
    watchAndStart,
  }
}
