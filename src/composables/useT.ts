import { storeToRefs } from 'pinia'
import { useLanguageStore } from '@/stores/language'

/**
 * Reactive access to the active locale strings.
 *
 * Usage:
 *   const t = useT()
 *   // template: {{ t.student.dashboard.welcome }}
 *   // script:   t.value.student.dashboard.welcome
 *
 * Returns a Ref so Vue auto-unwraps in templates.
 */
export function useT() {
  const { t } = storeToRefs(useLanguageStore())
  return t
}
