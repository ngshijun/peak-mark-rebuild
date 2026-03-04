import { computed, onMounted } from 'vue'
import { usePetsStore } from '@/stores/pets'

/**
 * Ensures pets data is loaded. Used as a fallback when route guard
 * data preloading hasn't completed yet.
 */
export function usePetsLoader() {
  const petsStore = usePetsStore()

  const isLoading = computed(() => petsStore.isLoading && petsStore.allPets.length === 0)

  onMounted(() => {
    if (petsStore.allPets.length === 0 && !petsStore.isLoading) {
      petsStore.fetchAllPets()
    }
    // fetchOwnedPets has its own independent loading — always safe to call
    if (petsStore.ownedPets.length === 0) {
      petsStore.fetchOwnedPets()
    }
  })

  return { isLoading }
}
