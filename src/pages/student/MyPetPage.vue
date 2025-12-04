<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore, rarityConfig, EVOLUTION_COSTS } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Heart, Sparkles, Hand, ArrowUp, Star } from 'lucide-vue-next'
import PixelMeat from '@/components/icons/PixelMeat.vue'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()
const petsStore = usePetsStore()

const selectedPet = computed(() => petsStore.selectedPet)
const selectedOwnedPet = computed(() => petsStore.selectedOwnedPet)
const currentFood = computed(() => authStore.studentProfile?.food ?? 0)

// Evolution progress
const evolutionProgress = computed(() => {
  if (!selectedOwnedPet.value) return null
  return petsStore.getEvolutionProgress(selectedOwnedPet.value)
})

// Get current tier image
const currentTierImage = computed(() => {
  if (!selectedPet.value || !selectedOwnedPet.value) return ''
  return petsStore.getPetImageUrlForTier(selectedPet.value, selectedOwnedPet.value.tier)
})

// Animation states
const isPetting = ref(false)
const isFeeding = ref(false)
const isEvolving = ref(false)
const showHearts = ref(false)
const showSparkles = ref(false)

// Pet the pet
function petPet() {
  if (isPetting.value) return

  isPetting.value = true
  showHearts.value = true

  setTimeout(() => {
    isPetting.value = false
  }, 500)

  setTimeout(() => {
    showHearts.value = false
  }, 1000)
}

// Feed the pet for evolution
async function feedPet() {
  if (isFeeding.value || !selectedOwnedPet.value) return

  if (evolutionProgress.value?.isMaxTier) {
    toast.info('Your pet is already at max tier!')
    return
  }

  if (evolutionProgress.value?.canEvolve) {
    toast.info('Your pet is ready to evolve! Click the Evolve button.')
    return
  }

  if (currentFood.value <= 0) {
    toast.warning('No food available! Buy some from the Market.')
    return
  }

  isFeeding.value = true
  showSparkles.value = true

  const result = await petsStore.feedPetForEvolution(selectedOwnedPet.value.id, 1)

  if (!result.success) {
    toast.error(result.error ?? 'Failed to feed pet')
  } else {
    if (result.canEvolve) {
      toast.success('Your pet is ready to evolve!')
    } else {
      toast.success(`Fed your pet! (${result.foodFed}/${result.requiredFood})`)
    }
  }

  setTimeout(() => {
    isFeeding.value = false
  }, 500)

  setTimeout(() => {
    showSparkles.value = false
  }, 1000)
}

// Evolve the pet
async function evolvePet() {
  if (isEvolving.value || !selectedOwnedPet.value) return

  if (!evolutionProgress.value?.canEvolve) {
    toast.warning('Not enough food fed to evolve!')
    return
  }

  isEvolving.value = true

  const result = await petsStore.evolvePet(selectedOwnedPet.value.id)

  if (!result.success) {
    toast.error(result.error ?? 'Failed to evolve pet')
  } else {
    toast.success(`Your pet evolved to Tier ${result.newTier}!`)
  }

  // Refresh owned pets to get updated data
  await petsStore.fetchOwnedPets()

  setTimeout(() => {
    isEvolving.value = false
  }, 1000)
}

function goToCollections() {
  router.push('/student/collections')
}

function goToMarket() {
  router.push('/student/market')
}

// Tier label helper
function getTierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return 'Tier 1'
    case 2:
      return 'Tier 2'
    case 3:
      return 'Tier 3 (Max)'
    default:
      return `Tier ${tier}`
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">My Pet</h1>
        <p class="text-muted-foreground">Take care of your pet companion</p>
      </div>
      <div class="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
        <PixelMeat :size="20" />
        <span class="font-semibold">{{ currentFood }}</span>
      </div>
    </div>

    <!-- No Pet Selected -->
    <Card v-if="!selectedPet" class="text-center">
      <CardContent class="py-12">
        <div class="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-muted">
          <Heart class="size-12 text-muted-foreground" />
        </div>
        <h2 class="text-xl font-semibold">No Pet Selected</h2>
        <p class="mt-2 text-muted-foreground">
          Select a pet from your collection to display it here!
        </p>
        <Button class="mt-4" @click="goToCollections">Go to Collections</Button>
      </CardContent>
    </Card>

    <!-- Pet Display -->
    <template v-else>
      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Pet Card -->
        <Card class="lg:col-span-2">
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="flex items-center gap-2">
                  {{ selectedPet.name }}
                  <Badge v-if="selectedOwnedPet" variant="secondary" class="ml-1">
                    <Star class="mr-1 size-3" />
                    {{ getTierLabel(selectedOwnedPet.tier) }}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  <Badge :class="rarityConfig[selectedPet.rarity].color" variant="outline">
                    {{ rarityConfig[selectedPet.rarity].label }}
                  </Badge>
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" @click="goToCollections">Change Pet</Button>
            </div>
          </CardHeader>
          <CardContent>
            <!-- Pet Display Area -->
            <div
              class="relative flex h-80 items-center justify-center rounded-xl bg-gradient-to-b from-sky-100 to-green-100 dark:from-sky-900/30 dark:to-green-900/30"
              :class="rarityConfig[selectedPet.rarity].bgColor"
            >
              <!-- Floating hearts animation -->
              <div v-if="showHearts" class="absolute top-1/3 animate-bounce">
                <Heart class="size-8 fill-red-500 text-red-500" />
              </div>

              <!-- Sparkles animation -->
              <div v-if="showSparkles" class="absolute top-1/3 animate-ping">
                <Sparkles class="size-8 text-yellow-500" />
              </div>

              <!-- Evolution animation -->
              <div v-if="isEvolving" class="absolute inset-0 flex items-center justify-center">
                <div class="animate-ping rounded-full bg-yellow-400/50 p-16"></div>
              </div>

              <!-- Pet -->
              <div
                class="transition-transform duration-200"
                :class="{
                  'scale-110': isPetting,
                  'animate-bounce': isFeeding,
                  'scale-125': isEvolving,
                }"
              >
                <img
                  :src="currentTierImage"
                  :alt="selectedPet.name"
                  class="size-80 object-contain"
                />
              </div>
            </div>

            <!-- Interaction Buttons -->
            <div class="mt-4 flex justify-center gap-4">
              <Button
                size="lg"
                variant="outline"
                class="flex-1"
                :disabled="isPetting"
                @click="petPet"
              >
                <Hand class="mr-2 size-5" />
                Pet
              </Button>
              <Button
                size="lg"
                variant="outline"
                class="flex-1"
                :disabled="
                  isFeeding ||
                  currentFood <= 0 ||
                  evolutionProgress?.isMaxTier ||
                  evolutionProgress?.canEvolve
                "
                @click="feedPet"
              >
                <PixelMeat :size="20" class="mr-2" />
                Feed
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Evolution Card -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <ArrowUp class="size-5" />
              Evolution
            </CardTitle>
            <CardDescription>Feed your pet to evolve it!</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Current Tier -->
            <div class="rounded-lg bg-muted p-4 text-center">
              <p class="text-sm text-muted-foreground">Current Tier</p>
              <p class="text-2xl font-bold">
                {{ selectedOwnedPet?.tier ?? 1 }}
                <span class="text-base font-normal text-muted-foreground">/ 3</span>
              </p>
            </div>

            <!-- Evolution Progress -->
            <div v-if="evolutionProgress && !evolutionProgress.isMaxTier">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-medium">Evolution Progress</span>
                <span class="text-sm text-muted-foreground">
                  {{ evolutionProgress.foodFed }} / {{ evolutionProgress.requiredFood }}
                </span>
              </div>
              <Progress
                :model-value="(evolutionProgress.foodFed / evolutionProgress.requiredFood) * 100"
                class="h-3"
              />
              <p class="mt-2 text-xs text-muted-foreground">
                Feed {{ evolutionProgress.requiredFood - evolutionProgress.foodFed }} more food to
                evolve
              </p>
            </div>

            <!-- Max Tier Message -->
            <div
              v-else-if="evolutionProgress?.isMaxTier"
              class="rounded-lg bg-yellow-100 p-4 text-center dark:bg-yellow-900/30"
            >
              <Star class="mx-auto size-8 text-yellow-500" />
              <p class="mt-2 font-medium text-yellow-700 dark:text-yellow-400">Max Tier Reached!</p>
              <p class="text-sm text-yellow-600 dark:text-yellow-500">Your pet is fully evolved</p>
            </div>

            <!-- Evolve Button -->
            <Button
              v-if="evolutionProgress?.canEvolve"
              class="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              size="lg"
              :disabled="isEvolving"
              @click="evolvePet"
            >
              <ArrowUp class="mr-2 size-5" />
              Evolve to Tier {{ (selectedOwnedPet?.tier ?? 1) + 1 }}!
            </Button>

            <!-- Evolution Costs Info -->
            <div class="rounded-lg border p-4">
              <h4 class="mb-2 text-sm font-medium">Evolution Costs</h4>
              <ul class="space-y-1 text-sm text-muted-foreground">
                <li class="flex justify-between">
                  <span>Tier 1 → 2</span>
                  <span>{{ EVOLUTION_COSTS.tier1to2 }} food</span>
                </li>
                <li class="flex justify-between">
                  <span>Tier 2 → 3</span>
                  <span>{{ EVOLUTION_COSTS.tier2to3 }} food</span>
                </li>
              </ul>
            </div>

            <!-- Quick Actions -->
            <div class="space-y-2">
              <Button variant="outline" class="w-full" @click="goToMarket">
                <PixelMeat :size="16" class="mr-2" />
                Buy Food at Market
              </Button>
              <Button variant="outline" class="w-full" @click="goToCollections">
                <Sparkles class="mr-2 size-4" />
                View Collection
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
