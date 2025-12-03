<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore, rarityConfig } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Heart, Sparkles, Hand, Cookie } from 'lucide-vue-next'
import PixelMeat from '@/components/icons/PixelMeat.vue'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()
const petsStore = usePetsStore()

const selectedPet = computed(() => petsStore.selectedPet)
const currentFood = computed(() => authStore.studentProfile?.food ?? 0)

// Pet stats (mock - could be stored per pet)
const happiness = ref(70)
const hunger = ref(50)

// Animation states
const isPetting = ref(false)
const isFeeding = ref(false)
const showHearts = ref(false)
const showSparkles = ref(false)

// Pet the pet
function petPet() {
  if (isPetting.value) return

  isPetting.value = true
  showHearts.value = true
  happiness.value = Math.min(100, happiness.value + 5)

  setTimeout(() => {
    isPetting.value = false
  }, 500)

  setTimeout(() => {
    showHearts.value = false
  }, 1000)
}

// Feed the pet
async function feedPet() {
  if (isFeeding.value) return

  if (currentFood.value <= 0) {
    toast.warning('No food available! Buy some from the Market.')
    return
  }

  const success = await authStore.useFood(1)
  if (!success) {
    toast.error('Failed to feed pet')
    return
  }

  isFeeding.value = true
  showSparkles.value = true
  hunger.value = Math.min(100, hunger.value + 20)
  happiness.value = Math.min(100, happiness.value + 10)
  toast.success('Your pet enjoyed the food!')

  setTimeout(() => {
    isFeeding.value = false
  }, 500)

  setTimeout(() => {
    showSparkles.value = false
  }, 1000)
}

function goToCollections() {
  router.push('/student/collections')
}

function goToMarket() {
  router.push('/student/market')
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
                <CardTitle>{{ selectedPet.name }}</CardTitle>
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
              class="relative flex h-64 items-center justify-center rounded-xl bg-gradient-to-b from-sky-100 to-green-100 dark:from-sky-900/30 dark:to-green-900/30"
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

              <!-- Pet -->
              <div
                class="transition-transform duration-200"
                :class="{
                  'scale-110': isPetting,
                  'animate-bounce': isFeeding,
                }"
              >
                <img
                  :src="petsStore.getPetImageUrl(selectedPet.imagePath)"
                  :alt="selectedPet.name"
                  class="size-32 object-contain"
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
                :disabled="isFeeding || currentFood <= 0"
                @click="feedPet"
              >
                <PixelMeat :size="20" class="mr-2" />
                Feed
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Stats Card -->
        <Card>
          <CardHeader>
            <CardTitle>Pet Stats</CardTitle>
            <CardDescription>Keep your pet happy and well-fed!</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Happiness -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Heart class="size-4 text-pink-500" />
                  Happiness
                </span>
                <span class="text-sm text-muted-foreground">{{ happiness }}%</span>
              </div>
              <Progress :model-value="happiness" class="h-3" />
            </div>

            <!-- Hunger -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Cookie class="size-4 text-amber-500" />
                  Fullness
                </span>
                <span class="text-sm text-muted-foreground">{{ hunger }}%</span>
              </div>
              <Progress :model-value="hunger" class="h-3" />
            </div>

            <!-- Tips -->
            <div class="rounded-lg bg-muted p-4">
              <h4 class="mb-2 font-medium">Tips</h4>
              <ul class="space-y-1 text-sm text-muted-foreground">
                <li>Pet your companion to increase happiness</li>
                <li>Feed your pet to keep it full and happy</li>
                <li>Buy food from the Market</li>
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
