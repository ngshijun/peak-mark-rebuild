import { ref } from 'vue'

/**
 * Composable for managing pet animation states (petting, feeding, evolution)
 * with timeout-based auto-reset.
 */
export function usePetAnimation() {
  const isPetting = ref(false)
  const isFeeding = ref(false)
  const isEvolving = ref(false)
  const showHearts = ref(false)
  const showSparkles = ref(false)
  const showFoodParticles = ref(false)

  function triggerPet() {
    if (isPetting.value) return false
    isPetting.value = true
    showHearts.value = true

    setTimeout(() => {
      isPetting.value = false
    }, 300)
    setTimeout(() => {
      showHearts.value = false
    }, 300)

    return true
  }

  function triggerFeed() {
    isFeeding.value = true
    showSparkles.value = true
    showFoodParticles.value = true

    setTimeout(() => {
      isFeeding.value = false
      showFoodParticles.value = false
    }, 300)
    setTimeout(() => {
      showSparkles.value = false
    }, 300)
  }

  function endFeed() {
    isFeeding.value = false
    showFoodParticles.value = false
    showSparkles.value = false
  }

  function triggerEvolve() {
    isEvolving.value = true
  }

  function endEvolve() {
    isEvolving.value = false
  }

  return {
    isPetting,
    isFeeding,
    isEvolving,
    showHearts,
    showSparkles,
    showFoodParticles,
    triggerPet,
    triggerFeed,
    endFeed,
    triggerEvolve,
    endEvolve,
  }
}
