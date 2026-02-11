<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  usePetsStore,
  rarityConfig,
  COMBINE_SUCCESS_RATES,
  type PetRarity,
  type Pet,
  type OwnedPet,
} from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import {
  HelpCircle,
  Check,
  Star,
  Lock,
  Combine,
  Sparkles,
  Loader2,
  Plus,
  ArrowRight,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()
const petsStore = usePetsStore()

const rarityOrder: PetRarity[] = ['legendary', 'epic', 'rare', 'common']

// Dialog state
const showPetDialog = ref(false)
const selectedPetForDialog = ref<Pet | null>(null)
const carouselApi = ref<CarouselApi | null>(null)

function isSelected(petId: string): boolean {
  return authStore.studentProfile?.selectedPetId === petId
}

// Get pet image for display (shows current tier image)
function getPetDisplayImage(pet: Pet): string {
  const ownedPet = petsStore.getOwnedPet(pet.id)
  if (!ownedPet) return petsStore.getOptimizedPetImageUrl(pet.imagePath, pet.updatedAt)
  return petsStore.getOptimizedPetImageUrlForTier(pet, ownedPet.tier)
}

// Get pet tier for display
function getPetTier(petId: string): number {
  return petsStore.getOwnedPet(petId)?.tier ?? 1
}

// Get pet count (duplicates)
function getPetCount(petId: string): number {
  return petsStore.getOwnedPet(petId)?.count ?? 0
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

// ========== COMBINE FEATURE ==========
type CombineRarity = Exclude<PetRarity, 'legendary'>
const combineRarityOrder: CombineRarity[] = ['common', 'rare', 'epic']

// Dialog states
const showCombineDialog = ref(false)
const selectedCombineRarity = ref<CombineRarity>('common')
// Track selection count per owned pet (allows selecting same pet multiple times)
const petSelectionCounts = ref<Map<string, number>>(new Map())
const isCombining = ref(false)
const showCombineResultDialog = ref(false)
const combineResults = ref<
  Array<{
    upgraded: boolean
    resultPet: Pet | null
    resultRarity: PetRarity | null
  }>
>([])

// Get next rarity after combining
function getNextRarity(rarity: CombineRarity): PetRarity {
  const nextMap: Record<CombineRarity, PetRarity> = {
    common: 'rare',
    rare: 'epic',
    epic: 'legendary',
  }
  return nextMap[rarity]
}

// Get owned pets for the selected combine rarity
const ownedPetsForCombine = computed(() => {
  return petsStore.ownedPetsByRarity[selectedCombineRarity.value].filter((op) => op.count > 1)
})

// Total selected count
const totalSelectedCount = computed(() => {
  let total = 0
  for (const count of petSelectionCounts.value.values()) {
    total += count
  }
  return total
})

// Get selection count for a pet
function getSelectionCount(ownedPetId: string): number {
  return petSelectionCounts.value.get(ownedPetId) ?? 0
}

// Get available count for selection (owned count minus 1 to keep, minus already selected)
function getAvailableCount(ownedPet: OwnedPet): number {
  const selected = getSelectionCount(ownedPet.id)
  // Must keep at least 1 copy of each pet
  return Math.max(0, ownedPet.count - 1 - selected)
}

// Increment pet selection
function incrementSelection(ownedPet: OwnedPet) {
  if (totalSelectedCount.value >= 4) return
  if (getAvailableCount(ownedPet) <= 0) return

  const newMap = new Map(petSelectionCounts.value)
  const current = newMap.get(ownedPet.id) ?? 0
  newMap.set(ownedPet.id, current + 1)
  petSelectionCounts.value = newMap
}

// Decrement pet selection
function decrementSelection(ownedPet: OwnedPet) {
  const current = getSelectionCount(ownedPet.id)
  if (current <= 0) return

  const newMap = new Map(petSelectionCounts.value)
  if (current === 1) {
    newMap.delete(ownedPet.id)
  } else {
    newMap.set(ownedPet.id, current - 1)
  }
  petSelectionCounts.value = newMap
}

// Clear selection when changing rarity
function handleCombineRarityChange(rarity: CombineRarity) {
  selectedCombineRarity.value = rarity
  petSelectionCounts.value = new Map()
}

// Open combine dialog
function openCombineDialog() {
  showCombineDialog.value = true
  petSelectionCounts.value = new Map()
}

// Close combine dialog
function closeCombineDialog() {
  showCombineDialog.value = false
  petSelectionCounts.value = new Map()
}

// Get Pet data for an owned pet
function getPetForOwnedPet(ownedPet: OwnedPet): Pet | undefined {
  return petsStore.getPetById(ownedPet.petId)
}

// Build array of owned pet IDs for combining (with duplicates for same pet)
function buildCombineIds(): string[] {
  const ids: string[] = []
  for (const [ownedPetId, count] of petSelectionCounts.value.entries()) {
    for (let i = 0; i < count; i++) {
      ids.push(ownedPetId)
    }
  }
  return ids
}

// Get selected pets as array for preview (with duplicates)
const selectedPetsPreview = computed(() => {
  const pets: Array<{ ownedPet: OwnedPet; pet: Pet }> = []
  for (const [ownedPetId, count] of petSelectionCounts.value.entries()) {
    const ownedPet = ownedPetsForCombine.value.find((op) => op.id === ownedPetId)
    if (ownedPet) {
      const pet = getPetForOwnedPet(ownedPet)
      if (pet) {
        for (let i = 0; i < count; i++) {
          pets.push({ ownedPet, pet })
        }
      }
    }
  }
  return pets
})

// Clear all selections
function clearAllSelections() {
  petSelectionCounts.value = new Map()
}

// Calculate total pets available for quick combine (must keep at least 1 of each)
const quickCombineCount = computed(() => {
  let totalAvailable = 0
  for (const ownedPet of ownedPetsForCombine.value) {
    // Can only use count - 1 (keep at least 1 of each pet)
    totalAvailable += Math.max(0, ownedPet.count - 1)
  }
  return Math.floor(totalAvailable / 4)
})

// Get combine count for a specific rarity (must keep at least 1 of each)
function getCombineCountForRarity(rarity: CombineRarity): number {
  let totalAvailable = 0
  for (const ownedPet of petsStore.ownedPetsByRarity[rarity]) {
    // Can only use count - 1 (keep at least 1 of each pet)
    totalAvailable += Math.max(0, ownedPet.count - 1)
  }
  return Math.floor(totalAvailable / 4)
}

// Perform single combine
async function handleCombine() {
  if (totalSelectedCount.value !== 4) return

  isCombining.value = true
  const ownedPetIds = buildCombineIds()

  try {
    const result = await petsStore.combinePets(ownedPetIds)

    if (!result.success) {
      toast.error(result.error ?? 'Failed to combine pets')
      return
    }

    // Show result dialog
    const resultPet = result.resultPetId ? petsStore.getPetById(result.resultPetId) : null
    combineResults.value = [
      {
        upgraded: result.upgraded ?? false,
        resultPet: resultPet ?? null,
        resultRarity: result.resultRarity ?? null,
      },
    ]
    showCombineResultDialog.value = true
    showCombineDialog.value = false
    petSelectionCounts.value = new Map()
  } catch {
    toast.error('Failed to combine pets')
  } finally {
    isCombining.value = false
  }
}

// Perform quick combine (all available sets)
async function handleQuickCombine() {
  if (quickCombineCount.value === 0) return

  isCombining.value = true
  const results: Array<{
    upgraded: boolean
    resultPet: Pet | null
    resultRarity: PetRarity | null
  }> = []

  try {
    // Build list of all pet IDs with their counts (keep at least 1 of each)
    const petPool: string[] = []
    for (const ownedPet of ownedPetsForCombine.value) {
      // Only add count - 1 to pool (keep at least 1)
      const availableCount = Math.max(0, ownedPet.count - 1)
      for (let i = 0; i < availableCount; i++) {
        petPool.push(ownedPet.id)
      }
    }

    // Combine in sets of 4
    const combineCount = Math.floor(petPool.length / 4)
    for (let i = 0; i < combineCount; i++) {
      const idsToUse = petPool.slice(i * 4, (i + 1) * 4)
      const result = await petsStore.combinePets(idsToUse)

      if (result.success) {
        const resultPet = result.resultPetId ? petsStore.getPetById(result.resultPetId) : null
        results.push({
          upgraded: result.upgraded ?? false,
          resultPet: resultPet ?? null,
          resultRarity: result.resultRarity ?? null,
        })
      }
    }

    if (results.length > 0) {
      combineResults.value = results
      showCombineResultDialog.value = true
      showCombineDialog.value = false
    } else {
      toast.error('Failed to combine pets')
    }

    petSelectionCounts.value = new Map()
  } catch {
    toast.error('Failed to combine pets')
  } finally {
    isCombining.value = false
  }
}

function closeCombineResult() {
  showCombineResultDialog.value = false
  combineResults.value = []
  showCombineDialog.value = true
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Collections</h1>
        <p class="text-muted-foreground">View all available pets and track your collection</p>
      </div>
      <div class="flex items-center gap-4">
        <Button @click="openCombineDialog">
          <Combine class="mr-2 size-4" />
          Combine
        </Button>
        <div class="text-right">
          <p class="text-2xl font-bold">{{ petsStore.totalOwned }} / {{ petsStore.totalPets }}</p>
          <p class="text-sm text-muted-foreground">Pets Collected</p>
        </div>
      </div>
    </div>

    <!-- Collection by Rarity -->
    <div class="space-y-6">
      <Card v-for="rarity in rarityOrder" :key="rarity">
        <CardHeader class="pb-3">
          <div class="flex items-center justify-between">
            <CardTitle
              class="flex items-center gap-2 text-base"
              :class="rarityConfig[rarity].color"
            >
              {{ rarityConfig[rarity].label }}
            </CardTitle>
            <Badge variant="outline" :class="rarityConfig[rarity].color">
              {{ petsStore.collectionStats[rarity].owned }} /
              {{ petsStore.collectionStats[rarity].total }}
            </Badge>
          </div>
          <CardDescription>{{ rarityConfig[rarity].chance }}% drop rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            <div
              v-for="pet in petsStore.petsByRarity[rarity]"
              :key="pet.id"
              class="relative flex flex-col items-center rounded-lg border px-2 pb-2 pt-3 transition-all"
              :class="[
                petsStore.isPetOwned(pet.id)
                  ? [rarityConfig[rarity].bgColor, rarityConfig[rarity].borderColor]
                  : 'border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900',
                isSelected(pet.id) ? 'ring-2 ring-primary ring-offset-2' : '',
                petsStore.isPetOwned(pet.id) ? 'cursor-pointer hover:scale-105' : '',
              ]"
              @click="petsStore.isPetOwned(pet.id) && openPetDialog(pet)"
            >
              <!-- Selected indicator -->
              <div
                v-if="isSelected(pet.id)"
                class="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
              >
                ★
              </div>

              <!-- Duplicate count badge -->
              <div
                v-if="petsStore.isPetOwned(pet.id) && getPetCount(pet.id) > 1"
                class="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white"
              >
                {{ getPetCount(pet.id) }}
              </div>

              <!-- Pet Image or Question Mark -->
              <div class="flex aspect-square w-full items-center justify-center">
                <template v-if="petsStore.isPetOwned(pet.id)">
                  <img
                    :src="getPetDisplayImage(pet)"
                    :alt="pet.name"
                    loading="lazy"
                    class="size-full object-contain"
                  />
                </template>
                <template v-else>
                  <HelpCircle class="size-14 text-gray-400 dark:text-gray-600" />
                </template>
              </div>

              <!-- Pet Name + Tier Badge -->
              <div class="mt-1 flex items-center justify-center gap-1">
                <p
                  class="text-center text-xs font-medium leading-tight"
                  :class="
                    petsStore.isPetOwned(pet.id)
                      ? rarityConfig[rarity].textColor
                      : 'text-gray-400 dark:text-gray-600'
                  "
                >
                  {{ pet.name }}
                </p>
                <Badge
                  v-if="petsStore.isPetOwned(pet.id) && getPetTier(pet.id) > 1"
                  variant="outline"
                  class="text-[10px] px-1 py-0"
                >
                  T{{ getPetTier(pet.id) }}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Combine Pets Dialog -->
    <Dialog :open="showCombineDialog" @update:open="closeCombineDialog">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Combine class="size-5 text-purple-500" />
            Combine Pets
          </DialogTitle>
          <DialogDescription>
            Select 4 pets of the same rarity to combine them for a chance at a higher rarity pet
          </DialogDescription>
        </DialogHeader>

        <!-- Rarity Tabs -->
        <Tabs :model-value="selectedCombineRarity" class="w-full">
          <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger
              v-for="rarity in combineRarityOrder"
              :key="rarity"
              :value="rarity"
              :class="rarityConfig[rarity].color"
              @click="handleCombineRarityChange(rarity)"
            >
              {{ rarityConfig[rarity].label }}
              <Badge variant="secondary" class="ml-2">
                {{ getCombineCountForRarity(rarity) }}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- 4-Slot Preview (horizontal row) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Selected ({{ totalSelectedCount }}/4)</p>
            <Button
              v-if="totalSelectedCount > 0"
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="clearAllSelections"
            >
              Clear
            </Button>
          </div>

          <div class="grid grid-cols-4 gap-2">
            <div
              v-for="i in 4"
              :key="i"
              class="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed p-1.5"
              :class="[
                selectedPetsPreview[i - 1]
                  ? [
                      'border-solid',
                      rarityConfig[selectedCombineRarity].bgColor,
                      rarityConfig[selectedCombineRarity].borderColor,
                    ]
                  : [rarityConfig[selectedCombineRarity].borderColor, 'opacity-40'],
              ]"
            >
              <template v-if="selectedPetsPreview[i - 1]">
                <img
                  :src="
                    petsStore.getThumbnailPetImageUrl(
                      selectedPetsPreview[i - 1]!.pet.imagePath,
                      selectedPetsPreview[i - 1]!.pet.updatedAt,
                    )
                  "
                  :alt="selectedPetsPreview[i - 1]!.pet.name"
                  class="size-16 object-contain sm:size-20"
                />
                <p class="mt-1 max-w-full truncate text-center text-xs font-medium">
                  {{ selectedPetsPreview[i - 1]!.pet.name }}
                </p>
              </template>
              <template v-else>
                <Plus class="size-6 text-muted-foreground" />
              </template>
            </div>
          </div>
        </div>

        <!-- Success Rate Badge -->
        <div class="flex items-center justify-center gap-2">
          <Badge variant="outline" class="gap-1.5 px-3 py-1 text-sm">
            <span :class="rarityConfig[selectedCombineRarity].color" class="font-medium">
              {{ rarityConfig[selectedCombineRarity].label }}
            </span>
            <ArrowRight class="size-3.5" />
            <span
              :class="rarityConfig[getNextRarity(selectedCombineRarity)].color"
              class="font-medium"
            >
              {{ rarityConfig[getNextRarity(selectedCombineRarity)].label }}
            </span>
            <span class="text-muted-foreground">·</span>
            <span class="font-semibold">
              {{ COMBINE_SUCCESS_RATES[selectedCombineRarity] }}% success
            </span>
          </Badge>
        </div>

        <!-- Pet Selection Grid -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Your Pets</p>
            <p class="text-xs text-muted-foreground">Click to add, right-click to remove</p>
          </div>

          <div
            v-if="ownedPetsForCombine.length > 0"
            class="max-h-[280px] overflow-y-auto rounded-lg border p-2"
          >
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
              <div
                v-for="ownedPet in ownedPetsForCombine"
                :key="ownedPet.id"
                class="relative flex cursor-pointer flex-col items-center rounded-lg border-2 p-2 transition-all hover:scale-105"
                :class="[
                  getSelectionCount(ownedPet.id) > 0
                    ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/50'
                    : [
                        rarityConfig[selectedCombineRarity].bgColor,
                        rarityConfig[selectedCombineRarity].borderColor,
                      ],
                  getAvailableCount(ownedPet) === 0 ? 'opacity-50' : '',
                ]"
                @click="incrementSelection(ownedPet)"
                @contextmenu.prevent="decrementSelection(ownedPet)"
              >
                <!-- Selection count badge -->
                <div
                  v-if="getSelectionCount(ownedPet.id) > 0"
                  class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white"
                >
                  {{ getSelectionCount(ownedPet.id) }}
                </div>

                <!-- Pet Image -->
                <img
                  v-if="getPetForOwnedPet(ownedPet)"
                  :src="
                    petsStore.getThumbnailPetImageUrl(
                      getPetForOwnedPet(ownedPet)!.imagePath,
                      getPetForOwnedPet(ownedPet)!.updatedAt,
                    )
                  "
                  :alt="getPetForOwnedPet(ownedPet)!.name"
                  loading="lazy"
                  class="size-16 object-contain sm:size-20"
                />

                <!-- Pet Name & Count -->
                <p class="mt-1 max-w-full truncate text-center text-xs font-medium">
                  {{ getPetForOwnedPet(ownedPet)?.name }}
                </p>
                <p v-if="ownedPet.count > 1" class="text-[10px] text-muted-foreground">
                  x{{ ownedPet.count - 1 }}
                </p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="flex flex-col items-center justify-center rounded-lg border py-8 text-center text-muted-foreground"
          >
            <HelpCircle class="mb-2 size-10 opacity-50" />
            <p class="text-sm">No {{ rarityConfig[selectedCombineRarity].label }} pets</p>
          </div>
        </div>

        <!-- Footer Buttons -->
        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            :disabled="quickCombineCount === 0 || isCombining"
            @click="handleQuickCombine"
          >
            <Loader2 v-if="isCombining" class="mr-2 size-4 animate-spin" />
            <Sparkles v-else class="mr-2 size-4" />
            Combine All ({{ quickCombineCount }}x)
          </Button>
          <Button :disabled="totalSelectedCount !== 4 || isCombining" @click="handleCombine">
            <Loader2 v-if="isCombining" class="mr-2 size-4 animate-spin" />
            <Combine v-else class="mr-2 size-4" />
            {{ isCombining ? 'Combining...' : 'Combine' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Combine Result Dialog -->
    <Dialog :open="showCombineResultDialog" @update:open="closeCombineResult">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-xl">
            <span class="text-2xl">🎉</span>
            Combination Complete!
          </DialogTitle>
          <DialogDescription>
            {{
              combineResults.length === 1
                ? combineResults[0]?.upgraded
                  ? 'Congratulations! Your pets combined into a higher rarity!'
                  : 'The combination failed, but you still got a pet back.'
                : `You performed ${combineResults.length} combinations!`
            }}
          </DialogDescription>
        </DialogHeader>

        <!-- Single Result -->
        <div
          v-if="combineResults.length === 1 && combineResults[0]?.resultPet"
          class="flex flex-col items-center py-6"
        >
          <Badge
            v-if="combineResults[0].upgraded"
            class="mb-4 animate-pulse bg-gradient-to-r from-yellow-400 to-amber-500 text-white"
          >
            <Sparkles class="mr-1 size-3" />
            UPGRADED!
          </Badge>

          <div
            class="flex flex-col items-center rounded-xl border-2 p-6"
            :class="[
              combineResults[0].resultRarity
                ? [
                    rarityConfig[combineResults[0].resultRarity].bgColor,
                    rarityConfig[combineResults[0].resultRarity].borderColor,
                  ]
                : '',
            ]"
          >
            <img
              :src="
                petsStore.getOptimizedPetImageUrl(
                  combineResults[0].resultPet.imagePath,
                  combineResults[0].resultPet.updatedAt,
                )
              "
              :alt="combineResults[0].resultPet.name"
              class="size-40 object-contain"
            />
            <p class="mt-3 text-lg font-bold">{{ combineResults[0].resultPet.name }}</p>
            <Badge
              v-if="combineResults[0].resultRarity"
              :class="rarityConfig[combineResults[0].resultRarity].color"
              variant="outline"
              class="mt-2"
            >
              {{ rarityConfig[combineResults[0].resultRarity].label }}
            </Badge>
          </div>
        </div>

        <!-- Multiple Results (Quick Combine) -->
        <div v-else-if="combineResults.length > 1" class="py-4">
          <!-- Summary -->
          <div class="mb-4 flex justify-center gap-4 text-center">
            <div>
              <p class="text-2xl font-bold text-green-500">
                {{ combineResults.filter((r) => r.upgraded).length }}
              </p>
              <p class="text-sm text-muted-foreground">Upgraded</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-500">
                {{ combineResults.filter((r) => !r.upgraded).length }}
              </p>
              <p class="text-sm text-muted-foreground">Same Rarity</p>
            </div>
          </div>

          <!-- Results Grid -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="(result, index) in combineResults"
              :key="index"
              class="relative flex flex-col items-center rounded-lg border-2 p-3"
              :class="[
                result.resultRarity
                  ? [
                      rarityConfig[result.resultRarity].bgColor,
                      rarityConfig[result.resultRarity].borderColor,
                    ]
                  : '',
              ]"
            >
              <Badge
                v-if="result.upgraded"
                class="absolute -right-1 -top-1 bg-green-500 px-1 text-[9px]"
              >
                UP!
              </Badge>
              <img
                v-if="result.resultPet"
                :src="
                  petsStore.getOptimizedPetImageUrl(
                    result.resultPet.imagePath,
                    result.resultPet.updatedAt,
                  )
                "
                :alt="result.resultPet.name"
                class="size-24 object-contain"
              />
              <p class="mt-1 truncate text-center text-xs font-medium">
                {{ result.resultPet?.name }}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button class="w-full" @click="closeCombineResult"> Close </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
