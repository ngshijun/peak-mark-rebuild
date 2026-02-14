import { ref, computed, watch, type Ref } from 'vue'
import type { Question, MCQOption } from '@/stores/questions'

/**
 * Composable for shuffling MCQ/MRQ options with per-question caching.
 * Uses Fisher-Yates shuffle and caches results so navigating back
 * shows the same order.
 */
export function useQuestionShuffle(currentQuestion: Ref<Question | null>) {
  const shuffledOptionsMap = ref<Map<string, MCQOption[]>>(new Map())

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = shuffled[i]!
      shuffled[i] = shuffled[j]!
      shuffled[j] = temp
    }
    return shuffled
  }

  // Populate cache when question changes (side effect in a watcher, not computed)
  watch(
    () => currentQuestion.value,
    (question) => {
      if (!question || (question.type !== 'mcq' && question.type !== 'mrq')) return
      if (shuffledOptionsMap.value.has(question.id)) return

      const nonEmptyOptions = question.options.filter(
        (opt) => (opt.text && opt.text.trim()) || opt.imagePath,
      )
      shuffledOptionsMap.value.set(question.id, shuffleArray(nonEmptyOptions))
    },
    { immediate: true },
  )

  // Pure computed — only reads from the cache
  const displayOptions = computed(() => {
    if (
      !currentQuestion.value ||
      (currentQuestion.value.type !== 'mcq' && currentQuestion.value.type !== 'mrq')
    )
      return []

    return shuffledOptionsMap.value.get(currentQuestion.value.id) ?? []
  })

  function clearCache() {
    shuffledOptionsMap.value.clear()
  }

  return { displayOptions, clearCache }
}
