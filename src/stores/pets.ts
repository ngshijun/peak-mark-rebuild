import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

export type PetRarity = Database['public']['Enums']['pet_rarity']

export interface Pet {
  id: string
  name: string
  rarity: PetRarity
  imagePath: string
  gachaWeight: number
  createdAt: string | null
}

export interface OwnedPet {
  id: string
  petId: string
  studentId: string
  count: number
  createdAt: string | null
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

export const usePetsStore = defineStore('pets', () => {
  const authStore = useAuthStore()

  // State
  const allPets = ref<Pet[]>([])
  const ownedPets = ref<OwnedPet[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Fetch all pets from database
  async function fetchAllPets(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('pets')
        .select('*')
        .order('rarity')
        .order('name')

      if (fetchError) {
        error.value = fetchError.message
        return { error: fetchError.message }
      }

      allPets.value = (data || []).map((pet) => ({
        id: pet.id,
        name: pet.name,
        rarity: pet.rarity,
        imagePath: pet.image_path,
        gachaWeight: pet.gacha_weight ?? 100,
        createdAt: pet.created_at,
      }))

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pets'
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Fetch owned pets for current student
  async function fetchOwnedPets(): Promise<{ error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { error: 'Not logged in' }
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('owned_pets')
        .select('*')
        .eq('student_id', studentId)

      if (fetchError) {
        return { error: fetchError.message }
      }

      ownedPets.value = (data || []).map((op) => ({
        id: op.id,
        petId: op.pet_id,
        studentId: op.student_id,
        count: op.count ?? 1,
        createdAt: op.created_at,
      }))

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch owned pets'
      return { error: message }
    }
  }

  // Get pet image URL from storage path
  function getPetImageUrl(imagePath: string): string {
    // If it's already a full URL or emoji, return as-is
    if (imagePath.startsWith('http') || !imagePath.includes('/')) {
      return imagePath
    }
    const { data } = supabase.storage.from('pet-images').getPublicUrl(imagePath)
    return data.publicUrl
  }

  // Get pets grouped by rarity
  const petsByRarity = computed(() => {
    const grouped: Record<PetRarity, Pet[]> = {
      common: [],
      rare: [],
      epic: [],
      legendary: [],
    }

    for (const pet of allPets.value) {
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

  // Get pet by ID
  function getPetById(petId: string): Pet | undefined {
    return allPets.value.find((p) => p.id === petId)
  }

  // Add a pet to collection (from gacha)
  async function addPet(petId: string): Promise<{ error: string | null }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { error: 'Not logged in' }
    }

    try {
      // Check if already owned
      const existing = ownedPets.value.find((op) => op.petId === petId)

      if (existing) {
        // Increment count
        const { error: updateError } = await supabase
          .from('owned_pets')
          .update({ count: existing.count + 1 })
          .eq('id', existing.id)

        if (updateError) {
          return { error: updateError.message }
        }

        existing.count++
      } else {
        // Insert new owned pet
        const { data, error: insertError } = await supabase
          .from('owned_pets')
          .insert({
            student_id: studentId,
            pet_id: petId,
            count: 1,
          })
          .select()
          .single()

        if (insertError) {
          return { error: insertError.message }
        }

        ownedPets.value.push({
          id: data.id,
          petId: data.pet_id,
          studentId: data.student_id,
          count: data.count ?? 1,
          createdAt: data.created_at,
        })
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add pet'
      return { error: message }
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

    for (const pet of allPets.value) {
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
    return allPets.value.length
  })

  // Get selected pet
  const selectedPet = computed(() => {
    const petId = authStore.studentProfile?.selectedPetId
    if (!petId) return null
    return allPets.value.find((p) => p.id === petId) ?? null
  })

  // Select a pet (must be owned)
  async function selectPet(petId: string): Promise<{ error: string | null }> {
    if (!isPetOwned(petId)) {
      return { error: 'Pet not owned' }
    }

    const result = await authStore.setSelectedPet(petId)
    return result
  }

  // Deselect pet
  async function deselectPet(): Promise<{ error: string | null }> {
    const result = await authStore.setSelectedPet(null)
    return result
  }

  // ========== ADMIN FUNCTIONS ==========

  // Add a new pet (admin only)
  async function createPet(pet: {
    name: string
    rarity: PetRarity
    imagePath: string
    gachaWeight?: number
  }): Promise<{ pet: Pet | null; error: string | null }> {
    try {
      const { data, error: insertError } = await supabase
        .from('pets')
        .insert({
          name: pet.name,
          rarity: pet.rarity,
          image_path: pet.imagePath,
          gacha_weight: pet.gachaWeight ?? 100,
        })
        .select()
        .single()

      if (insertError) {
        return { pet: null, error: insertError.message }
      }

      const newPet: Pet = {
        id: data.id,
        name: data.name,
        rarity: data.rarity,
        imagePath: data.image_path,
        gachaWeight: data.gacha_weight ?? 100,
        createdAt: data.created_at,
      }

      allPets.value.push(newPet)
      return { pet: newPet, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create pet'
      return { pet: null, error: message }
    }
  }

  // Update a pet (admin only)
  async function updatePet(
    petId: string,
    updates: {
      name?: string
      rarity?: PetRarity
      imagePath?: string
      gachaWeight?: number
    },
  ): Promise<{ error: string | null }> {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.rarity !== undefined) updateData.rarity = updates.rarity
      if (updates.imagePath !== undefined) updateData.image_path = updates.imagePath
      if (updates.gachaWeight !== undefined) updateData.gacha_weight = updates.gachaWeight

      const { error: updateError } = await supabase.from('pets').update(updateData).eq('id', petId)

      if (updateError) {
        return { error: updateError.message }
      }

      // Update local state
      const index = allPets.value.findIndex((p) => p.id === petId)
      if (index !== -1) {
        const pet = allPets.value[index]
        if (pet) {
          if (updates.name !== undefined) pet.name = updates.name
          if (updates.rarity !== undefined) pet.rarity = updates.rarity
          if (updates.imagePath !== undefined) pet.imagePath = updates.imagePath
          if (updates.gachaWeight !== undefined) pet.gachaWeight = updates.gachaWeight
        }
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pet'
      return { error: message }
    }
  }

  // Delete a pet (admin only)
  async function deletePet(petId: string): Promise<{ error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('pets').delete().eq('id', petId)

      if (deleteError) {
        return { error: deleteError.message }
      }

      // Remove from local state
      const index = allPets.value.findIndex((p) => p.id === petId)
      if (index !== -1) {
        allPets.value.splice(index, 1)
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete pet'
      return { error: message }
    }
  }

  // Upload pet image to storage
  async function uploadPetImage(
    file: File,
    petId?: string,
  ): Promise<{ path: string | null; error: string | null }> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = petId ? `${petId}.${fileExt}` : `${Date.now()}.${fileExt}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from('pet-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        return { path: null, error: uploadError.message }
      }

      return { path: filePath, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image'
      return { path: null, error: message }
    }
  }

  return {
    // State
    allPets,
    ownedPets,
    isLoading,
    error,

    // Fetch functions
    fetchAllPets,
    fetchOwnedPets,

    // Getters
    petsByRarity,
    collectionStats,
    totalOwned,
    totalPets,
    selectedPet,

    // Helper functions
    getPetImageUrl,
    isPetOwned,
    getOwnedPet,
    getPetById,

    // Student actions
    addPet,
    selectPet,
    deselectPet,

    // Admin actions
    createPet,
    updatePet,
    deletePet,
    uploadPetImage,
  }
})
