import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Pet {
  id: string
  name: string
  rarity: PetRarity
  image: string
}

export interface OwnedPet {
  petId: string
  acquiredAt: string
  count: number
}

export const rarityConfig: Record<
  PetRarity,
  { label: string; color: string; bgColor: string; borderColor: string; chance: number }
> = {
  common: {
    label: 'Common',
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    chance: 60,
  },
  rare: {
    label: 'Rare',
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    chance: 30,
  },
  epic: {
    label: 'Epic',
    color: 'text-purple-500',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    chance: 9,
  },
  legendary: {
    label: 'Legendary',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    chance: 1,
  },
}

// All available pets in the game
export const allPets: Pet[] = [
  // Common pets
  { id: 'c1', name: 'Hamster', rarity: 'common', image: '🐹' },
  { id: 'c2', name: 'Chick', rarity: 'common', image: '🐤' },
  { id: 'c3', name: 'Bunny', rarity: 'common', image: '🐰' },
  { id: 'c4', name: 'Puppy', rarity: 'common', image: '🐶' },
  { id: 'c5', name: 'Kitten', rarity: 'common', image: '🐱' },
  { id: 'c6', name: 'Piglet', rarity: 'common', image: '🐷' },
  // Rare pets
  { id: 'r1', name: 'Fox', rarity: 'rare', image: '🦊' },
  { id: 'r2', name: 'Panda', rarity: 'rare', image: '🐼' },
  { id: 'r3', name: 'Koala', rarity: 'rare', image: '🐨' },
  { id: 'r4', name: 'Penguin', rarity: 'rare', image: '🐧' },
  { id: 'r5', name: 'Owl', rarity: 'rare', image: '🦉' },
  // Epic pets
  { id: 'e1', name: 'Unicorn', rarity: 'epic', image: '🦄' },
  { id: 'e2', name: 'Dragon', rarity: 'epic', image: '🐉' },
  { id: 'e3', name: 'Phoenix', rarity: 'epic', image: '🔥' },
  // Legendary pets
  { id: 'l1', name: 'Golden Dragon', rarity: 'legendary', image: '✨🐉' },
  { id: 'l2', name: 'Celestial Fox', rarity: 'legendary', image: '💫🦊' },
]

export const usePetsStore = defineStore('pets', () => {
  const authStore = useAuthStore()

  // Mock owned pets for the demo student
  const ownedPets = ref<OwnedPet[]>([
    { petId: 'c1', acquiredAt: '2024-01-15T10:00:00', count: 2 },
    { petId: 'c3', acquiredAt: '2024-01-16T14:30:00', count: 1 },
    { petId: 'r1', acquiredAt: '2024-01-18T09:15:00', count: 1 },
  ])

  // Get pets grouped by rarity
  const petsByRarity = computed(() => {
    const grouped: Record<PetRarity, Pet[]> = {
      common: [],
      rare: [],
      epic: [],
      legendary: [],
    }

    for (const pet of allPets) {
      grouped[pet.rarity].push(pet)
    }

    return grouped
  })

  // Check if a pet is owned
  function isPetOwned(petId: string): boolean {
    return ownedPets.value.some((op) => op.petId === petId)
  }

  // Get owned pet data
  function getOwnedPet(petId: string): OwnedPet | undefined {
    return ownedPets.value.find((op) => op.petId === petId)
  }

  // Add a pet to collection (from gacha)
  function addPet(petId: string) {
    const existing = ownedPets.value.find((op) => op.petId === petId)
    if (existing) {
      existing.count++
    } else {
      ownedPets.value.push({
        petId,
        acquiredAt: new Date().toISOString(),
        count: 1,
      })
    }
  }

  // Get collection stats
  const collectionStats = computed(() => {
    const stats: Record<PetRarity, { total: number; owned: number }> = {
      common: { total: 0, owned: 0 },
      rare: { total: 0, owned: 0 },
      epic: { total: 0, owned: 0 },
      legendary: { total: 0, owned: 0 },
    }

    for (const pet of allPets) {
      stats[pet.rarity].total++
      if (isPetOwned(pet.id)) {
        stats[pet.rarity].owned++
      }
    }

    return stats
  })

  const totalOwned = computed(() => {
    return ownedPets.value.length
  })

  const totalPets = computed(() => {
    return allPets.length
  })

  // Get selected pet
  const selectedPet = computed(() => {
    const petId = authStore.studentUser?.selectedPetId
    if (!petId) return null
    return allPets.find((p) => p.id === petId) ?? null
  })

  // Select a pet (must be owned)
  function selectPet(petId: string): boolean {
    if (!isPetOwned(petId)) return false
    authStore.setSelectedPet(petId)
    return true
  }

  // Deselect pet
  function deselectPet() {
    authStore.setSelectedPet(undefined)
  }

  return {
    ownedPets,
    petsByRarity,
    isPetOwned,
    getOwnedPet,
    addPet,
    collectionStats,
    totalOwned,
    totalPets,
    selectedPet,
    selectPet,
    deselectPet,
  }
})
