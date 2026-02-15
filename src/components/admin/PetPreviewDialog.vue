<script setup lang="ts">
import { usePetsStore, rarityConfig, type Pet } from '@/stores/pets'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

defineProps<{
  pet: Pet | null
}>()

const open = defineModel<boolean>('open', { required: true })

const petsStore = usePetsStore()

function getPetTierImage(pet: Pet, tier: 1 | 2 | 3) {
  const path = tier === 1 ? pet.imagePath : tier === 2 ? pet.tier2ImagePath : pet.tier3ImagePath
  if (!path) return null
  return petsStore.getOptimizedPetImageUrl(path, pet.updatedAt)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          Pet Preview
          <Badge
            v-if="pet"
            variant="secondary"
            :class="[rarityConfig[pet.rarity].bgColor, rarityConfig[pet.rarity].color]"
          >
            {{ rarityConfig[pet.rarity].label }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div v-if="pet" class="space-y-4">
        <p class="text-lg font-semibold">{{ pet.name }}</p>

        <div
          class="grid grid-cols-3 gap-4 rounded-lg p-4"
          :class="rarityConfig[pet.rarity].bgColor"
        >
          <div
            v-for="tier in [1, 2, 3] as const"
            :key="tier"
            class="flex flex-col items-center gap-3"
          >
            <div class="flex aspect-square w-full items-center justify-center">
              <img
                v-if="getPetTierImage(pet, tier)"
                :src="getPetTierImage(pet, tier)!"
                :alt="`${pet.name} Tier ${tier}`"
                class="size-full object-contain"
              />
              <span v-else class="text-sm text-muted-foreground">—</span>
            </div>
            <span class="text-sm font-medium text-muted-foreground">Tier {{ tier }}</span>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
