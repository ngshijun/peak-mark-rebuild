import { ref, computed, type Ref } from 'vue'
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

  const displayOptions = computed(() => {
    if (
      !currentQuestion.value ||
      (currentQuestion.value.type !== 'mcq' && currentQuestion.value.type !== 'mrq')
    )
      return []

    const questionId = currentQuestion.value.id

    if (shuffledOptionsMap.value.has(questionId)) {
      return shuffledOptionsMap.value.get(questionId)!
    }

    // Filter out empty options (no text and no image)
    const nonEmptyOptions = currentQuestion.value.options.filter(
      (opt) => (opt.text && opt.text.trim()) || opt.imagePath,
    )

    const shuffled = shuffleArray(nonEmptyOptions)
    shuffledOptionsMap.value.set(questionId, shuffled)

    return shuffled
  })

  function clearCache() {
    shuffledOptionsMap.value.clear()
  }

  return { displayOptions, clearCache }
}
