<script setup lang="ts">
import { computed } from 'vue'
import { usePetsStore, rarityConfig, type PetRarity } from '@/stores/pets'
import type { StudentOwnedPet } from '@/stores/admin-student-engagement'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const props = defineProps<{
  ownedPets: StudentOwnedPet[]
  selectedPetId: string | null
  totalPets: number
}>()

const petsStore = usePetsStore()

const rarityOrder: PetRarity[] = ['legendary', 'epic', 'rare', 'common']

const ownedPetMap = computed(() => {
  const map = new Map<string, StudentOwnedPet>()
  for (const op of props.ownedPets) {
    map.set(op.petId, op)
  }
  return map
})

const petCollectionStats = computed(() => {
  const stats: Record<PetRarity, { total: number; owned: number }> = {
    common: { total: 0, owned: 0 },
    rare: { total: 0, owned: 0 },
    epic: { total: 0, owned: 0 },
    legendary: { total: 0, owned: 0 },
  }
  for (const pet of petsStore.allPets) {
    stats[pet.rarity].total++
    if (ownedPetMap.value.has(pet.id)) {
      stats[pet.rarity].owned++
    }
  }
  return stats
})

function getPetImagePath(pet: StudentOwnedPet): string {
  if (pet.tier >= 3 && pet.tier3ImagePath) return pet.tier3ImagePath
  if (pet.tier >= 2 && pet.tier2ImagePath) return pet.tier2ImagePath
  return pet.imagePath
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        {{ ownedPets.length }} / {{ totalPets }} pets collected
      </p>
    </div>

    <Card v-for="rarity in rarityOrder" :key="rarity">
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <CardTitle class="flex items-center gap-2 text-base" :class="rarityConfig[rarity].color">
            {{ rarityConfig[rarity].label }}
          </CardTitle>
          <Badge variant="outline" :class="rarityConfig[rarity].color">
            {{ petCollectionStats[rarity].owned }} / {{ petCollectionStats[rarity].total }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          <div
            v-for="pet in petsStore.petsByRarity[rarity]"
            :key="pet.id"
            class="relative flex flex-col items-center rounded-lg border px-2 pb-2 pt-3"
            :class="[
              ownedPetMap.has(pet.id)
                ? [rarityConfig[rarity].bgColor, rarityConfig[rarity].borderColor]
                : 'border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-muted',
              ownedPetMap.get(pet.id)?.petId === selectedPetId
                ? 'ring-2 ring-primary ring-offset-2'
                : '',
            ]"
          >
            <div
              v-if="ownedPetMap.get(pet.id)?.petId === selectedPetId"
              class="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
            >
              ★
            </div>

            <div
              v-if="ownedPetMap.has(pet.id) && (ownedPetMap.get(pet.id)?.count ?? 0) > 1"
              class="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white"
            >
              {{ ownedPetMap.get(pet.id)?.count }}
            </div>

            <div class="flex aspect-square w-full items-center justify-center">
              <img
                :src="
                  ownedPetMap.has(pet.id)
                    ? petsStore.getOptimizedPetImageUrl(getPetImagePath(ownedPetMap.get(pet.id)!))
                    : petsStore.getOptimizedPetImageUrl(pet.imagePath, pet.updatedAt)
                "
                :alt="pet.name"
                loading="lazy"
                class="size-full object-contain"
                :class="{ 'brightness-0 opacity-20': !ownedPetMap.has(pet.id) }"
              />
            </div>

            <div class="mt-1 flex items-center justify-center gap-1">
              <p
                class="text-center text-xs font-medium leading-tight"
                :class="
                  ownedPetMap.has(pet.id)
                    ? rarityConfig[rarity].textColor
                    : 'text-gray-400 dark:text-gray-600'
                "
              >
                {{ pet.name }}
              </p>
              <Badge
                v-if="ownedPetMap.has(pet.id) && (ownedPetMap.get(pet.id)?.tier ?? 1) > 1"
                variant="outline"
                class="text-[10px] px-1 py-0"
              >
                T{{ ownedPetMap.get(pet.id)?.tier }}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
