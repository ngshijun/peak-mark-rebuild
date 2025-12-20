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
  tier2ImagePath: string | null
  tier3ImagePath: string | null
  gachaWeight: number
  createdAt: string | null
  updatedAt: string | null
}

export interface OwnedPet {
  id: string
  petId: string
  studentId: string
  count: number
  tier: number
  foodFed: number
  createdAt: string | null
}

// Evolution costs (progressive)
export const EVOLUTION_COSTS = {
  tier1to2: 10,
  tier2to3: 25,
} as const

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
        tier2ImagePath: pet.tier2_image_path,
        tier3ImagePath: pet.tier3_image_path,
        gachaWeight: pet.gacha_weight ?? 100,
        createdAt: pet.created_at,
        updatedAt: pet.updated_at,
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
        tier: op.tier ?? 1,
        foodFed: op.food_fed ?? 0,
        createdAt: op.created_at,
      }))

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch owned pets'
      return { error: message }
    }
  }

  // Get pet image URL from storage path
  function getPetImageUrl(imagePath: string | null, updatedAt?: string | null): string {
    if (!imagePath) return ''
    // If it's already a full URL, return as-is (with cache bust if needed)
    if (imagePath.startsWith('http')) {
      if (updatedAt) {
        const separator = imagePath.includes('?') ? '&' : '?'
        return `${imagePath}${separator}v=${new Date(updatedAt).getTime()}`
      }
      return imagePath
    }
    // If it's a data URL (preview), return as-is
    if (imagePath.startsWith('data:')) {
      return imagePath
    }
    // Otherwise, get the public URL from storage
    const { data } = supabase.storage.from('pet-images').getPublicUrl(imagePath)
    // Add cache-busting query param if updatedAt is provided
    if (updatedAt) {
      return `${data.publicUrl}?v=${new Date(updatedAt).getTime()}`
    }
    return data.publicUrl
  }

  // Get pet image URL based on tier
  function getPetImageUrlForTier(pet: Pet, tier: number): string {
    let imagePath: string | null = pet.imagePath
    if (tier === 2 && pet.tier2ImagePath) {
      imagePath = pet.tier2ImagePath
    } else if (tier === 3 && pet.tier3ImagePath) {
      imagePath = pet.tier3ImagePath
    }
    return getPetImageUrl(imagePath, pet.updatedAt)
  }

  // Get evolution progress for an owned pet
  function getEvolutionProgress(ownedPet: OwnedPet): {
    currentTier: number
    foodFed: number
    requiredFood: number
    canEvolve: boolean
    isMaxTier: boolean
  } {
    const currentTier = ownedPet.tier
    const isMaxTier = currentTier >= 3

    let requiredFood = 0
    if (currentTier === 1) {
      requiredFood = EVOLUTION_COSTS.tier1to2
    } else if (currentTier === 2) {
      requiredFood = EVOLUTION_COSTS.tier2to3
    }

    return {
      currentTier,
      foodFed: ownedPet.foodFed,
      requiredFood,
      canEvolve: !isMaxTier && ownedPet.foodFed >= requiredFood,
      isMaxTier,
    }
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
          tier: data.tier ?? 1,
          foodFed: data.food_fed ?? 0,
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

  // Feed a pet to accumulate food for evolution
  async function feedPetForEvolution(
    ownedPetId: string,
    foodAmount: number = 1,
  ): Promise<{
    success: boolean
    foodFed?: number
    requiredFood?: number
    canEvolve?: boolean
    error?: string
  }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { success: false, error: 'Not logged in' }
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('feed_pet_for_evolution', {
        p_owned_pet_id: ownedPetId,
        p_student_id: studentId,
        p_food_amount: foodAmount,
      })

      if (rpcError) {
        return { success: false, error: rpcError.message }
      }

      const result = data as {
        success: boolean
        error?: string
        food_fed?: number
        required_food?: number
        can_evolve?: boolean
      }

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Update local state
      const ownedPet = ownedPets.value.find((op) => op.id === ownedPetId)
      if (ownedPet) {
        ownedPet.foodFed = result.food_fed ?? ownedPet.foodFed
      }

      // Refresh auth store to get updated food count
      await authStore.refreshProfile()

      return {
        success: true,
        foodFed: result.food_fed,
        requiredFood: result.required_food,
        canEvolve: result.can_evolve,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to feed pet'
      return { success: false, error: message }
    }
  }

  // Evolve a pet to the next tier
  async function evolvePet(ownedPetId: string): Promise<{
    success: boolean
    newTier?: number
    error?: string
  }> {
    const studentId = authStore.user?.id
    if (!studentId) {
      return { success: false, error: 'Not logged in' }
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('evolve_pet', {
        p_owned_pet_id: ownedPetId,
        p_student_id: studentId,
      })

      if (rpcError) {
        return { success: false, error: rpcError.message }
      }

      const result = data as {
        success: boolean
        error?: string
        new_tier?: number
        pet_id?: string
      }

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Update local state
      const ownedPet = ownedPets.value.find((op) => op.id === ownedPetId)
      if (ownedPet) {
        ownedPet.tier = result.new_tier ?? ownedPet.tier
        ownedPet.foodFed = 0
      }

      return {
        success: true,
        newTier: result.new_tier,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to evolve pet'
      return { success: false, error: message }
    }
  }

  // Get the selected pet's owned data (including tier)
  const selectedOwnedPet = computed(() => {
    const petId = authStore.studentProfile?.selectedPetId
    if (!petId) return null
    return ownedPets.value.find((op) => op.petId === petId) ?? null
  })

  // ========== ADMIN FUNCTIONS ==========

  // Add a new pet (admin only)
  async function createPet(pet: {
    name: string
    rarity: PetRarity
    imagePath: string
    tier2ImagePath?: string | null
    tier3ImagePath?: string | null
    gachaWeight?: number
  }): Promise<{ pet: Pet | null; error: string | null }> {
    try {
      const { data, error: insertError } = await supabase
        .from('pets')
        .insert({
          name: pet.name,
          rarity: pet.rarity,
          image_path: pet.imagePath,
          tier2_image_path: pet.tier2ImagePath ?? null,
          tier3_image_path: pet.tier3ImagePath ?? null,
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
        tier2ImagePath: data.tier2_image_path,
        tier3ImagePath: data.tier3_image_path,
        gachaWeight: data.gacha_weight ?? 100,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
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
      tier2ImagePath?: string | null
      tier3ImagePath?: string | null
      gachaWeight?: number
    },
  ): Promise<{ error: string | null }> {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.rarity !== undefined) updateData.rarity = updates.rarity
      if (updates.imagePath !== undefined) updateData.image_path = updates.imagePath
      if (updates.tier2ImagePath !== undefined) updateData.tier2_image_path = updates.tier2ImagePath
      if (updates.tier3ImagePath !== undefined) updateData.tier3_image_path = updates.tier3ImagePath
      if (updates.gachaWeight !== undefined) updateData.gacha_weight = updates.gachaWeight

      const { data: updatedData, error: updateError } = await supabase
        .from('pets')
        .update(updateData)
        .eq('id', petId)
        .select('updated_at')
        .single()

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
          if (updates.tier2ImagePath !== undefined) pet.tier2ImagePath = updates.tier2ImagePath
          if (updates.tier3ImagePath !== undefined) pet.tier3ImagePath = updates.tier3ImagePath
          if (updates.gachaWeight !== undefined) pet.gachaWeight = updates.gachaWeight
          // Update the updatedAt for cache busting
          pet.updatedAt = updatedData?.updated_at ?? new Date().toISOString()
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
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '31536000', // 1 year cache for CDN
        })

      if (uploadError) {
        return { path: null, error: uploadError.message }
      }

      return { path: filePath, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image'
      return { path: null, error: message }
    }
  }

  // Reset user-specific state (call on logout)
  // Note: allPets is shared data and doesn't need reset
  function $reset() {
    ownedPets.value = []
    isLoading.value = false
    error.value = null
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
    selectedOwnedPet,

    // Helper functions
    getPetImageUrl,
    getPetImageUrlForTier,
    getEvolutionProgress,
    isPetOwned,
    getOwnedPet,
    getPetById,

    // Student actions
    addPet,
    selectPet,
    deselectPet,
    feedPetForEvolution,
    evolvePet,

    // Admin actions
    createPet,
    updatePet,
    deletePet,
    uploadPetImage,
    $reset,
  }
})
