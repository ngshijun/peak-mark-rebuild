<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { usePetsStore, rarityConfig, type PetRarity } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { HelpCircle, Check } from 'lucide-vue-next'

const authStore = useAuthStore()
const petsStore = usePetsStore()

const rarityOrder: PetRarity[] = ['legendary', 'epic', 'rare', 'common']

function getCollectionProgress(rarity: PetRarity) {
  const stats = petsStore.collectionStats[rarity]
  if (stats.total === 0) return 0
  return Math.round((stats.owned / stats.total) * 100)
}

function isSelected(petId: string): boolean {
  return authStore.studentProfile?.selectedPetId === petId
}

function handleSelectPet(petId: string) {
  if (isSelected(petId)) {
    petsStore.deselectPet()
  } else {
    petsStore.selectPet(petId)
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Collections</h1>
        <p class="text-muted-foreground">View all available pets and track your collection</p>
      </div>
      <div class="text-right">
        <p class="text-2xl font-bold">{{ petsStore.totalOwned }} / {{ petsStore.totalPets }}</p>
        <p class="text-sm text-muted-foreground">Pets Collected</p>
      </div>
    </div>

    <!-- Collection by Rarity -->
    <div class="space-y-6">
      <Card v-for="rarity in rarityOrder" :key="rarity">
        <CardHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <CardTitle :class="rarityConfig[rarity].color">
                {{ rarityConfig[rarity].label }}
              </CardTitle>
              <Badge variant="outline" :class="rarityConfig[rarity].color">
                {{ petsStore.collectionStats[rarity].owned }} /
                {{ petsStore.collectionStats[rarity].total }}
              </Badge>
            </div>
            <div class="w-32">
              <Progress :model-value="getCollectionProgress(rarity)" class="h-2" />
            </div>
          </div>
          <CardDescription>{{ rarityConfig[rarity].chance }}% drop rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            <div
              v-for="pet in petsStore.petsByRarity[rarity]"
              :key="pet.id"
              class="relative flex flex-col items-center rounded-lg border p-3 transition-all"
              :class="[
                petsStore.isPetOwned(pet.id)
                  ? [rarityConfig[rarity].bgColor, rarityConfig[rarity].borderColor]
                  : 'border-gray-200 bg-gray-900',
                isSelected(pet.id) ? 'ring-2 ring-primary ring-offset-2' : '',
                petsStore.isPetOwned(pet.id) ? 'cursor-pointer hover:scale-105' : '',
              ]"
              @click="petsStore.isPetOwned(pet.id) && handleSelectPet(pet.id)"
            >
              <!-- Selected indicator -->
              <div
                v-if="isSelected(pet.id)"
                class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check class="size-3" />
              </div>

              <!-- Pet Image or Question Mark -->
              <div class="flex size-12 items-center justify-center text-3xl">
                <template v-if="petsStore.isPetOwned(pet.id)">
                  {{ pet.image }}
                </template>
                <template v-else>
                  <HelpCircle class="size-8 text-gray-500" />
                </template>
              </div>

              <!-- Pet Name -->
              <p
                class="mt-2 text-center text-xs font-medium"
                :class="petsStore.isPetOwned(pet.id) ? '' : 'text-gray-500'"
              >
                {{ petsStore.isPetOwned(pet.id) ? pet.name : '???' }}
              </p>

              <!-- Count if owned multiple -->
              <Badge
                v-if="
                  petsStore.isPetOwned(pet.id) && (petsStore.getOwnedPet(pet.id)?.count ?? 0) > 1
                "
                variant="secondary"
                class="mt-1 text-xs"
              >
                x{{ petsStore.getOwnedPet(pet.id)?.count }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
