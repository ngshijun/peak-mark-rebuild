import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { handleError } from '@/lib/errors'
import { uploadStorageFile } from '@/lib/storage'
import { usePetsStore, type Pet, type PetRarity } from './pets'

export const useAdminPetsStore = defineStore('adminPets', () => {
  // Admin PetsPage state (persisted across navigation)
  const adminPetsFilters = ref({
    search: '',
  })

  function setAdminPetsSearch(search: string) {
    adminPetsFilters.value.search = search
  }

  // Add a new pet (admin only)
  async function createPet(pet: {
    name: string
    rarity: PetRarity
    imagePath: string
    tier2ImagePath?: string | null
    tier3ImagePath?: string | null
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
        })
        .select()
        .single()

      if (insertError) {
        return { pet: null, error: handleError(insertError, 'failedCreatePet') }
      }

      const newPet: Pet = {
        id: data.id,
        name: data.name,
        rarity: data.rarity,
        imagePath: data.image_path,
        tier2ImagePath: data.tier2_image_path,
        tier3ImagePath: data.tier3_image_path,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }

      const petsStore = usePetsStore()
      petsStore.allPets.push(newPet)
      return { pet: newPet, error: null }
    } catch (err) {
      const message = handleError(err, 'failedCreatePet')
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
    },
  ): Promise<{ error: string | null }> {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.rarity !== undefined) updateData.rarity = updates.rarity
      if (updates.imagePath !== undefined) updateData.image_path = updates.imagePath
      if (updates.tier2ImagePath !== undefined) updateData.tier2_image_path = updates.tier2ImagePath
      if (updates.tier3ImagePath !== undefined) updateData.tier3_image_path = updates.tier3ImagePath

      const { data: updatedData, error: updateError } = await supabase
        .from('pets')
        .update(updateData)
        .eq('id', petId)
        .select('updated_at')
        .single()

      if (updateError) {
        return { error: handleError(updateError, 'failedUpdatePet') }
      }

      // Update local state in shared store
      const petsStore = usePetsStore()
      const index = petsStore.allPets.findIndex((p) => p.id === petId)
      if (index !== -1) {
        const pet = petsStore.allPets[index]
        if (pet) {
          if (updates.name !== undefined) pet.name = updates.name
          if (updates.rarity !== undefined) pet.rarity = updates.rarity
          if (updates.imagePath !== undefined) pet.imagePath = updates.imagePath
          if (updates.tier2ImagePath !== undefined) pet.tier2ImagePath = updates.tier2ImagePath
          if (updates.tier3ImagePath !== undefined) pet.tier3ImagePath = updates.tier3ImagePath
          // Update the updatedAt for cache busting
          pet.updatedAt = updatedData?.updated_at ?? new Date().toISOString()
        }
      }

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'failedUpdatePet')
      return { error: message }
    }
  }

  // Delete a pet (admin only)
  async function deletePet(petId: string): Promise<{ error: string | null }> {
    try {
      const { error: deleteError } = await supabase.from('pets').delete().eq('id', petId)

      if (deleteError) {
        return { error: handleError(deleteError, 'failedDeletePet') }
      }

      // Remove from shared store
      const petsStore = usePetsStore()
      const index = petsStore.allPets.findIndex((p) => p.id === petId)
      if (index !== -1) {
        petsStore.allPets.splice(index, 1)
      }

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'failedDeletePet')
      return { error: message }
    }
  }

  function uploadPetImage(file: File, oldPath?: string | null) {
    return uploadStorageFile('pet-images', file, { oldPath })
  }

  function $reset() {
    adminPetsFilters.value = { search: '' }
  }

  return {
    adminPetsFilters,
    setAdminPetsSearch,
    createPet,
    updatePet,
    deletePet,
    uploadPetImage,
    $reset,
  }
})
