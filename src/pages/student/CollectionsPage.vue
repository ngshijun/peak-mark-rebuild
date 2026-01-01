<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore, rarityConfig, type PetRarity, type Pet } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { HelpCircle, Check, Star, Lock } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()
const petsStore = usePetsStore()

const rarityOrder: PetRarity[] = ['legendary', 'epic', 'rare', 'common']

// Dialog state
const showPetDialog = ref(false)
const selectedPetForDialog = ref<Pet | null>(null)
const carouselApi = ref<CarouselApi | null>(null)

function getCollectionProgress(rarity: PetRarity) {
  const stats = petsStore.collectionStats[rarity]
  if (stats.total === 0) return 0
  return Math.round((stats.owned / stats.total) * 100)
}

function isSelected(petId: string): boolean {
  return authStore.studentProfile?.selectedPetId === petId
}

// Get pet image for display (shows current tier image) - thumbnail for grid
function getPetDisplayImage(pet: Pet): string {
  const ownedPet = petsStore.getOwnedPet(pet.id)
  if (!ownedPet) return petsStore.getThumbnailPetImageUrl(pet.imagePath, pet.updatedAt)
  return petsStore.getThumbnailPetImageUrlForTier(pet, ownedPet.tier)
}

// Get pet tier for display
function getPetTier(petId: string): number {
  return petsStore.getOwnedPet(petId)?.tier ?? 1
}

// Open pet detail dialog
function openPetDialog(pet: Pet) {
  selectedPetForDialog.value = pet
  showPetDialog.value = true
  // Scroll to current tier after dialog opens
  nextTick(() => {
    const currentTier = getPetTier(pet.id)
    // Small delay to ensure carousel is initialized
    setTimeout(() => {
      carouselApi.value?.scrollTo(currentTier - 1, true) // 0-indexed, instant scroll
    }, 50)
  })
}

// Handle carousel API initialization
function onCarouselInit(api: CarouselApi) {
  if (!api) return
  carouselApi.value = api
  // Scroll to current tier when API is ready
  if (selectedPetForDialog.value) {
    const currentTier = getPetTier(selectedPetForDialog.value.id)
    api.scrollTo(currentTier - 1, true)
  }
}

// Get optimized image URL for a specific tier (for dialog display)
function getTierImageUrl(pet: Pet, tier: number): string {
  return petsStore.getOptimizedPetImageUrlForTier(pet, tier)
}

// Check if tier is unlocked
function isTierUnlocked(petId: string, tier: number): boolean {
  const ownedPet = petsStore.getOwnedPet(petId)
  if (!ownedPet) return false
  return ownedPet.tier >= tier
}

async function handleSelectPet(petId: string) {
  const pet = petsStore.allPets.find((p) => p.id === petId)
  if (isSelected(petId)) {
    await petsStore.deselectPet()
    toast.info('Pet deselected')
  } else {
    await petsStore.selectPet(petId)
    toast.success(`${pet?.name ?? 'Pet'} selected!`)
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
              @click="petsStore.isPetOwned(pet.id) && openPetDialog(pet)"
            >
              <!-- Selected indicator -->
              <div
                v-if="isSelected(pet.id)"
                class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check class="size-3" />
              </div>

              <!-- Pet Image or Question Mark -->
              <div class="flex size-16 items-center justify-center">
                <template v-if="petsStore.isPetOwned(pet.id)">
                  <img
                    :src="getPetDisplayImage(pet)"
                    :alt="pet.name"
                    loading="lazy"
                    class="size-14 object-contain"
                  />
                </template>
                <template v-else>
                  <HelpCircle class="size-10 text-gray-500" />
                </template>
              </div>

              <!-- Pet Name -->
              <p
                class="mt-2 text-center text-xs font-medium"
                :class="
                  petsStore.isPetOwned(pet.id) ? rarityConfig[rarity].textColor : 'text-gray-500'
                "
              >
                {{ petsStore.isPetOwned(pet.id) ? pet.name : '???' }}
              </p>

              <!-- Tier Badge -->
              <Badge v-if="petsStore.isPetOwned(pet.id)" variant="secondary" class="mt-1 text-xs">
                <Star class="mr-0.5 size-2.5" />
                T{{ getPetTier(pet.id) }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Pet Detail Dialog -->
    <Dialog v-model:open="showPetDialog">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader v-if="selectedPetForDialog">
          <DialogTitle class="flex items-center gap-2">
            {{ selectedPetForDialog.name }}
            <Badge variant="outline" :class="rarityConfig[selectedPetForDialog.rarity].color">
              {{ rarityConfig[selectedPetForDialog.rarity].label }}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Current Tier: {{ getPetTier(selectedPetForDialog.id) }} / 3
          </DialogDescription>
        </DialogHeader>

        <!-- Pet Tier Carousel -->
        <div v-if="selectedPetForDialog" class="px-10 py-4">
          <Carousel class="mx-auto w-full" @init-api="onCarouselInit">
            <CarouselContent>
              <CarouselItem v-for="tier in 3" :key="tier">
                <div class="flex flex-col items-center gap-3 p-2">
                  <!-- Tier Label -->
                  <Badge
                    :variant="
                      isTierUnlocked(selectedPetForDialog.id, tier) ? 'default' : 'secondary'
                    "
                    class="text-sm"
                  >
                    <Star class="mr-1 size-3" />
                    Tier {{ tier }}
                  </Badge>

                  <!-- Pet Image -->
                  <div
                    class="relative flex aspect-square w-full items-center justify-center rounded-xl border-2 p-6"
                    :class="[
                      isTierUnlocked(selectedPetForDialog.id, tier)
                        ? [
                            rarityConfig[selectedPetForDialog.rarity].bgColor,
                            rarityConfig[selectedPetForDialog.rarity].borderColor,
                          ]
                        : 'border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800',
                    ]"
                  >
                    <img
                      :src="getTierImageUrl(selectedPetForDialog, tier)"
                      :alt="`${selectedPetForDialog.name} Tier ${tier}`"
                      loading="lazy"
                      class="size-full object-contain transition-all"
                      :class="{
                        'brightness-0 opacity-20': !isTierUnlocked(selectedPetForDialog.id, tier),
                      }"
                    />
                    <!-- Lock overlay for locked tiers -->
                    <div
                      v-if="!isTierUnlocked(selectedPetForDialog.id, tier)"
                      class="absolute inset-0 flex items-center justify-center"
                    >
                      <div class="rounded-full bg-background/80 p-3">
                        <Lock class="size-8 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  <!-- Tier Status -->
                  <p class="text-sm text-muted-foreground">
                    {{
                      isTierUnlocked(selectedPetForDialog.id, tier)
                        ? 'Unlocked'
                        : 'Feed your pet to evolve!'
                    }}
                  </p>
                </div>
              </CarouselItem>
            </CarouselContent>
            <CarouselPrevious class="-left-10" />
            <CarouselNext class="-right-10" />
          </Carousel>
        </div>

        <DialogFooter v-if="selectedPetForDialog" class="flex-col gap-2 sm:flex-col">
          <Button
            v-if="isSelected(selectedPetForDialog.id)"
            variant="outline"
            class="w-full"
            @click="handleSelectPet(selectedPetForDialog.id)"
          >
            <Check class="mr-2 size-4" />
            Deselect Pet
          </Button>
          <Button v-else class="w-full" @click="handleSelectPet(selectedPetForDialog.id)">
            <Star class="mr-2 size-4" />
            Select as My Pet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
