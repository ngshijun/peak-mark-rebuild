<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore, rarityConfig, type Pet, type PetRarity } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Gift, Star, Sparkles, Loader2 } from 'lucide-vue-next'
import PixelCoin from '@/components/icons/PixelCoin.vue'

const authStore = useAuthStore()
const petsStore = usePetsStore()

// Reversed rarity order for display (legendary first)
const rarityOrder: (keyof typeof rarityConfig)[] = ['legendary', 'epic', 'rare', 'common']

// Gacha costs (in coins)
const SINGLE_PULL_COST = 100
const MULTI_PULL_COST = 900 // 10 pulls for price of 9

// State
const isRolling = ref(false)
const showResultDialog = ref(false)
const pullResults = ref<Pet[]>([])
const currentCoins = computed(() => authStore.studentProfile?.coins ?? 0)

// Fetch pets on mount
onMounted(async () => {
  if (petsStore.allPets.length === 0) {
    await petsStore.fetchAllPets()
  }
  await petsStore.fetchOwnedPets()
})

// Fixed rarity percentages (order matters for cumulative calculation)
const RARITY_CHANCES: { rarity: PetRarity; chance: number }[] = [
  { rarity: 'legendary', chance: 1 }, // 0-1%
  { rarity: 'epic', chance: 9 }, // 1-10%
  { rarity: 'rare', chance: 30 }, // 10-40%
  { rarity: 'common', chance: 60 }, // 40-100%
]

// Get random pet based on fixed rarity percentages
function getRandomPet(): Pet {
  const roll = Math.random() * 100
  let cumulative = 0
  let selectedRarity: PetRarity = 'common'

  for (const { rarity, chance } of RARITY_CHANCES) {
    cumulative += chance
    if (roll < cumulative) {
      selectedRarity = rarity
      break
    }
  }

  const petsOfRarity = petsStore.allPets.filter((pet) => pet.rarity === selectedRarity)
  const randomPet = petsOfRarity[Math.floor(Math.random() * petsOfRarity.length)]
  if (!randomPet) {
    return petsStore.allPets[0] as Pet
  }
  return randomPet
}

// Single pull
async function singlePull() {
  if (currentCoins.value < SINGLE_PULL_COST) return

  isRolling.value = true
  authStore.spendCoins(SINGLE_PULL_COST)

  setTimeout(async () => {
    const pet = getRandomPet()
    pullResults.value = [pet]
    await petsStore.addPet(pet.id)
    isRolling.value = false
    showResultDialog.value = true
  }, 1500)
}

// Multi pull (10x)
async function multiPull() {
  if (currentCoins.value < MULTI_PULL_COST) return

  isRolling.value = true
  authStore.spendCoins(MULTI_PULL_COST)

  setTimeout(async () => {
    const pets = Array.from({ length: 10 }, () => getRandomPet())
    pullResults.value = pets
    for (const pet of pets) {
      await petsStore.addPet(pet.id)
    }
    isRolling.value = false
    showResultDialog.value = true
  }, 2000)
}

function closeResults() {
  showResultDialog.value = false
  pullResults.value = []
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold">Gacha</h1>
      <p class="text-muted-foreground">Spend coins to get new pets!</p>
    </div>

    <!-- Loading State -->
    <div v-if="petsStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <div class="grid gap-6 lg:grid-cols-4">
        <!-- Gacha Machine -->
        <Card class="overflow-hidden lg:col-span-3">
          <CardHeader class="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardTitle class="flex items-center gap-2">
              <Gift class="size-6" />
              Lucky Draw
            </CardTitle>
            <CardDescription class="text-white/80"
              >Try your luck and win amazing items!</CardDescription
            >
          </CardHeader>
          <CardContent class="p-6">
            <div class="flex flex-col items-center gap-6">
              <!-- Gacha Animation Area -->
              <div
                class="flex size-48 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100"
              >
                <div
                  class="flex size-36 items-center justify-center rounded-full bg-gradient-to-br from-purple-200 to-pink-200"
                  :class="{ 'animate-pulse': isRolling }"
                >
                  <Gift v-if="!isRolling" class="size-16 text-purple-500" />
                  <Sparkles v-else class="size-16 animate-spin text-pink-500" />
                </div>
              </div>

              <!-- Pull Buttons -->
              <div class="flex flex-col gap-4 sm:flex-row">
                <Button
                  size="lg"
                  class="min-w-40 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  :disabled="isRolling || currentCoins < SINGLE_PULL_COST"
                  @click="singlePull"
                >
                  <Star class="mr-2 size-5" />
                  Single Pull
                  <Badge variant="secondary" class="ml-2 gap-1">
                    <PixelCoin :size="12" />
                    {{ SINGLE_PULL_COST }}
                  </Badge>
                </Button>
                <Button
                  size="lg"
                  class="min-w-40 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                  :disabled="isRolling || currentCoins < MULTI_PULL_COST"
                  @click="multiPull"
                >
                  <Sparkles class="mr-2 size-5" />
                  10x Pull
                  <Badge variant="secondary" class="ml-2 gap-1">
                    <PixelCoin :size="12" />
                    {{ MULTI_PULL_COST }}
                  </Badge>
                </Button>
              </div>

              <p v-if="currentCoins < SINGLE_PULL_COST" class="text-sm text-muted-foreground">
                Not enough coins! Complete practice sessions to earn more.
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Rarity Info -->
        <Card class="lg:col-span-1">
          <CardHeader>
            <CardTitle>Drop Rates</CardTitle>
            <CardDescription>Chances of getting each rarity</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex flex-col gap-3">
              <div
                v-for="rarity in rarityOrder"
                :key="rarity"
                class="rounded-lg p-4 text-center"
                :class="rarityConfig[rarity].bgColor"
              >
                <p class="text-sm font-medium" :class="rarityConfig[rarity].color">
                  {{ rarityConfig[rarity].label }}
                </p>
                <p class="text-2xl font-bold" :class="rarityConfig[rarity].color">
                  {{ rarityConfig[rarity].chance }}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- Results Dialog -->
    <Dialog :open="showResultDialog" @update:open="closeResults">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Sparkles class="size-5 text-yellow-500" />
            You Got {{ pullResults.length }} Pet{{ pullResults.length > 1 ? 's' : '' }}!
          </DialogTitle>
          <DialogDescription>Here are your new pets</DialogDescription>
        </DialogHeader>
        <div
          class="grid gap-3"
          :class="pullResults.length > 1 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-1'"
        >
          <div
            v-for="(pet, index) in pullResults"
            :key="index"
            class="flex flex-col items-center rounded-lg border p-4"
            :class="rarityConfig[pet.rarity].bgColor"
          >
            <img
              :src="petsStore.getThumbnailPetImageUrl(pet.imagePath, pet.updatedAt)"
              :alt="pet.name"
              class="size-16 object-contain"
            />
            <p class="mt-2 text-center text-sm font-medium">{{ pet.name }}</p>
            <Badge :class="rarityConfig[pet.rarity].color" variant="outline" class="mt-1">
              {{ rarityConfig[pet.rarity].label }}
            </Badge>
          </div>
        </div>
        <div class="flex justify-end">
          <Button @click="closeResults">Awesome!</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
