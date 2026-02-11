<script setup lang="ts">
import { ref, computed, Transition } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore, rarityConfig, EVOLUTION_COSTS } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Heart,
  Sparkles,
  Hand,
  ArrowUp,
  Star,
  Plus,
  Minus,
  Loader2,
  ShoppingCart,
  Apple,
  CirclePoundSterling,
  PawPrint,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()
const petsStore = usePetsStore()

const selectedPet = computed(() => petsStore.selectedPet)
const selectedOwnedPet = computed(() => petsStore.selectedOwnedPet)
const currentFood = computed(() => authStore.studentProfile?.food ?? 0)

// Pet conversation messages pool - motivational messages for students
const pettingMessages = [
  "You're doing amazing! Keep it up!",
  'Every practice makes you stronger!',
  "I believe in you! You've got this!",
  'Hard work always pays off!',
  "You're smarter than you think!",
  'Mistakes help us learn and grow!',
  'Keep going, champion!',
  'Your effort inspires me!',
  "You're making great progress!",
  'Never give up on your dreams!',
  "One step at a time, you'll get there!",
  "I'm so proud of how hard you work!",
]

const feedingMessages = [
  "Thanks! Now let's ace that next quiz!",
  'Yum! Ready to learn together?',
  "Feeling energized! Let's study!",
  'Brain food! Time to get smarter!',
  "Thanks! You're the best study buddy!",
  "Nom nom! Let's conquer those topics!",
  'Delicious! Now back to learning!',
  'I feel stronger! Just like your brain!',
]

const hungryMessages = [
  'A little snack helps us think better!',
  "Feed me and let's practice together!",
  'Learning is easier on a full tummy!',
  "Let's refuel and tackle more questions!",
]

const maxTierMessages = [
  "We've grown so much together!",
  'Your dedication got us here!',
  'Nothing can stop us now!',
  "We're an unstoppable team!",
  'All that hard work paid off!',
]

// Evolution progress
const evolutionProgress = computed(() => {
  if (!selectedOwnedPet.value) return null
  return petsStore.getEvolutionProgress(selectedOwnedPet.value)
})

// Get current tier image (optimized for display)
const currentTierImage = computed(() => {
  if (!selectedPet.value || !selectedOwnedPet.value) return ''
  return petsStore.getOptimizedPetImageUrlForTier(selectedPet.value, selectedOwnedPet.value.tier)
})

// Animation states
const isPetting = ref(false)
const isFeeding = ref(false)
const isEvolving = ref(false)
const showHearts = ref(false)
const showSparkles = ref(false)
const showFoodParticles = ref(false)

// Pet conversation bubble state
const showConversationBubble = ref(false)
const currentMessage = ref('')
const conversationType = ref<'petting' | 'feeding' | 'hungry' | 'maxTier'>('petting')
let conversationTimeout: ReturnType<typeof setTimeout> | null = null

// Food exchange dialog state
const showFoodExchangeDialog = ref(false)
const foodAmount = ref(1)
const isExchanging = ref(false)
const FOOD_PRICE = 50 // coins per food

const currentCoins = computed(() => authStore.studentProfile?.coins ?? 0)
const exchangeCost = computed(() => foodAmount.value * FOOD_PRICE)
const canAffordExchange = computed(() => currentCoins.value >= exchangeCost.value)

// Helper to get random message from pool
function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]!
}

// Show pet conversation bubble
function showPetConversation(type: 'petting' | 'feeding' | 'hungry' | 'maxTier') {
  // Clear any existing timeout
  if (conversationTimeout) {
    clearTimeout(conversationTimeout)
  }

  conversationType.value = type
  switch (type) {
    case 'petting':
      currentMessage.value = getRandomMessage(pettingMessages)
      break
    case 'feeding':
      currentMessage.value = getRandomMessage(feedingMessages)
      break
    case 'hungry':
      currentMessage.value = getRandomMessage(hungryMessages)
      break
    case 'maxTier':
      currentMessage.value = getRandomMessage(maxTierMessages)
      break
  }
  showConversationBubble.value = true

  // Auto-hide bubble after 3 seconds
  conversationTimeout = setTimeout(() => {
    showConversationBubble.value = false
  }, 3000)
}

// Click on pet to interact (same as Pet button)
function onPetClick() {
  petPet()
}

function incrementFood() {
  const maxAffordable = Math.floor(currentCoins.value / FOOD_PRICE)
  if (foodAmount.value < maxAffordable) {
    foodAmount.value++
  }
}

function decrementFood() {
  if (foodAmount.value > 1) {
    foodAmount.value--
  }
}

function resetFoodExchange() {
  foodAmount.value = 1
}

async function handleExchangeFood() {
  if (!canAffordExchange.value || isExchanging.value) return

  isExchanging.value = true
  try {
    const success = await authStore.spendCoins(exchangeCost.value)
    if (!success) {
      toast.error('Not enough coins!')
      return
    }

    await authStore.addFood(foodAmount.value)
    toast.success(`Exchanged ${exchangeCost.value} coins for ${foodAmount.value} food!`)
    showFoodExchangeDialog.value = false
  } catch {
    toast.error('Failed to exchange coins for food')
  } finally {
    isExchanging.value = false
  }
}

// Pet the pet
function petPet() {
  if (isPetting.value) return

  isPetting.value = true
  showHearts.value = true
  showPetConversation('petting')

  setTimeout(() => {
    isPetting.value = false
  }, 600)

  setTimeout(() => {
    showHearts.value = false
  }, 1500)
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
    toast.warning('No food available!')
    showPetConversation('hungry')
    return
  }

  isFeeding.value = true
  showSparkles.value = true
  showFoodParticles.value = true

  const result = await petsStore.feedPetForEvolution(selectedOwnedPet.value.id, 1)

  if (!result.success) {
    toast.error(result.error ?? 'Failed to feed pet')
  } else {
    showPetConversation('feeding')
    if (result.canEvolve) {
      toast.success('Your pet is ready to evolve!')
    }
  }

  setTimeout(() => {
    isFeeding.value = false
    showFoodParticles.value = false
  }, 800)

  setTimeout(() => {
    showSparkles.value = false
  }, 1200)
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
  }, 1500)
}

function goToCollections() {
  router.push('/student/collections')
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
    <!-- Header with Gacha and Buy Food Buttons -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">My Pet</h1>
        <p class="text-muted-foreground">Take care of your pet companion</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="router.push('/student/gacha')">
          <PawPrint class="mr-2 size-4" />
          Get Pets
        </Button>
        <Dialog v-model:open="showFoodExchangeDialog" @update:open="resetFoodExchange">
          <DialogTrigger as-child>
            <Button>
              <ShoppingCart class="mr-2 size-4" />
              Buy Food
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Buy Food</DialogTitle>
              <DialogDescription>Exchange coins for food to feed your pet.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-4">
              <!-- Exchange Rate Info -->
              <div class="rounded-lg bg-muted p-3 text-center text-sm">
                <span class="text-muted-foreground">Exchange Rate: </span>
                <span class="font-semibold">{{ FOOD_PRICE }} coins = 1 food</span>
              </div>

              <!-- Amount Selector -->
              <div class="flex items-center justify-center gap-4">
                <button
                  class="flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="foodAmount <= 1"
                  @click="decrementFood"
                >
                  <Minus class="size-5" />
                </button>
                <div class="flex min-w-20 flex-col items-center">
                  <div class="flex items-center gap-2">
                    <Apple class="size-6 text-green-600 dark:text-green-400" />
                    <span class="text-3xl font-bold">{{ foodAmount }}</span>
                  </div>
                </div>
                <button
                  class="flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canAffordExchange || currentCoins < (foodAmount + 1) * FOOD_PRICE"
                  @click="incrementFood"
                >
                  <Plus class="size-5" />
                </button>
              </div>

              <!-- Cost Display -->
              <div class="flex items-center justify-center gap-2 text-lg">
                <span class="text-muted-foreground">Cost:</span>
                <div class="flex items-center gap-1">
                  <CirclePoundSterling class="size-5 text-amber-600 dark:text-amber-400" />
                  <span
                    class="font-bold"
                    :class="canAffordExchange ? 'text-amber-600' : 'text-red-500'"
                  >
                    {{ exchangeCost.toLocaleString() }}
                  </span>
                </div>
              </div>

              <!-- Current Balance -->
              <div class="text-center text-sm text-muted-foreground">
                Your balance:
                <span class="font-semibold text-amber-600">{{
                  currentCoins.toLocaleString()
                }}</span>
                coins
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="showFoodExchangeDialog = false">Cancel</Button>
              <Button
                :disabled="!canAffordExchange || isExchanging"
                class="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600"
                @click="handleExchangeFood"
              >
                <Loader2 v-if="isExchanging" class="mr-2 size-4 animate-spin" />
                Buy Food
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <!-- No Pet Selected -->
    <Card
      v-if="!selectedPet"
      class="border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 text-center dark:border-purple-800 dark:from-purple-950/30 dark:to-fuchsia-950/30"
    >
      <CardContent class="py-12">
        <div
          class="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50"
        >
          <Heart class="size-12 text-purple-400" />
        </div>
        <h2 class="text-xl font-semibold">No Pet Selected</h2>
        <p class="mt-2 text-muted-foreground">
          Select a pet from your collection to display it here!
        </p>
        <Button
          class="mt-4 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600"
          @click="goToCollections"
        >
          Go to Collections
        </Button>
      </CardContent>
    </Card>

    <!-- Pet Display -->
    <template v-else>
      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Pet Card -->
        <Card
          class="border-purple-200 bg-gradient-to-br from-purple-50/50 to-fuchsia-50/50 dark:border-purple-800 dark:from-purple-950/20 dark:to-fuchsia-950/20 lg:col-span-2"
        >
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
              class="relative flex h-[28rem] cursor-pointer items-center justify-center overflow-hidden rounded-xl transition-all"
              :class="[
                rarityConfig[selectedPet.rarity].bgColor,
                { 'ring-4 ring-purple-400 ring-offset-2': isPetting },
              ]"
              @click="onPetClick"
            >
              <!-- Decorative background circles -->
              <div
                class="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 sm:size-80 lg:size-96"
                :class="rarityConfig[selectedPet.rarity].borderColor"
                style="border-width: 3px; border-style: dashed"
              />
              <div
                class="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 sm:size-64 lg:size-72"
                :class="rarityConfig[selectedPet.rarity].borderColor"
                style="border-width: 2px; border-style: dotted"
              />

              <!-- Floating hearts animation (scattered around the pet) -->
              <div v-if="showHearts" class="pointer-events-none absolute inset-0">
                <Heart
                  v-for="(pos, i) in [
                    { left: '25%', top: '30%' },
                    { left: '70%', top: '25%' },
                    { left: '15%', top: '55%' },
                    { left: '80%', top: '50%' },
                    { left: '35%', top: '65%' },
                    { left: '60%', top: '70%' },
                    { left: '45%', top: '40%' },
                    { left: '55%', top: '55%' },
                  ]"
                  :key="i"
                  class="absolute size-6 fill-red-500 text-red-500 animate-heart-float"
                  :style="{
                    left: pos.left,
                    top: pos.top,
                    animationDelay: `${i * 0.1}s`,
                  }"
                />
              </div>

              <!-- Sparkles animation for feeding (scattered) -->
              <div v-if="showSparkles" class="pointer-events-none absolute inset-0">
                <Sparkles
                  v-for="(pos, i) in [
                    { left: '20%', top: '25%' },
                    { left: '75%', top: '30%' },
                    { left: '30%', top: '60%' },
                    { left: '65%', top: '55%' },
                    { left: '45%', top: '35%' },
                    { left: '55%', top: '70%' },
                    { left: '15%', top: '45%' },
                    { left: '80%', top: '65%' },
                  ]"
                  :key="i"
                  class="absolute size-5 text-yellow-400 animate-sparkle"
                  :style="{
                    left: pos.left,
                    top: pos.top,
                    animationDelay: `${i * 0.12}s`,
                  }"
                />
              </div>

              <!-- Food particles animation (scattered) -->
              <div v-if="showFoodParticles" class="pointer-events-none absolute inset-0">
                <div
                  v-for="(pos, i) in [
                    { left: '25%' },
                    { left: '45%' },
                    { left: '60%' },
                    { left: '75%' },
                    { left: '35%' },
                  ]"
                  :key="i"
                  class="absolute animate-food-fall text-2xl"
                  :style="{
                    left: pos.left,
                    animationDelay: `${i * 0.12}s`,
                  }"
                >
                  🍖
                </div>
              </div>

              <!-- Evolution animation -->
              <div
                v-if="isEvolving"
                class="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div class="absolute size-40 animate-ping rounded-full bg-yellow-400/30"></div>
                <div class="absolute size-60 animate-pulse rounded-full bg-yellow-400/20"></div>
              </div>

              <!-- Pet with animations -->
              <div
                class="relative transition-all duration-300"
                :class="{
                  'scale-110 -rotate-3': isPetting,
                  'scale-105 animate-wiggle': isFeeding,
                  'scale-125 animate-glow': isEvolving,
                }"
              >
                <img
                  :src="currentTierImage"
                  :alt="selectedPet.name"
                  class="size-96 object-contain drop-shadow-lg"
                  :class="{ 'animate-bounce-slow': !isPetting && !isFeeding && !isEvolving }"
                />
              </div>

              <!-- Conversation Bubble (right-skewed) -->
              <Transition name="bubble">
                <div
                  v-if="showConversationBubble"
                  class="absolute right-4 top-1/2 z-20 -translate-y-1/2"
                >
                  <div
                    class="relative rounded-2xl border-2 border-purple-300 bg-white px-4 py-3 shadow-lg dark:border-purple-600 dark:bg-gray-800"
                  >
                    <p class="max-w-44 text-sm font-medium">{{ currentMessage }}</p>
                    <!-- Speech bubble tail pointing left (toward pet) -->
                    <div
                      class="absolute -left-2 top-1/2 size-3 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-purple-300 bg-white dark:border-purple-600 dark:bg-gray-800"
                    ></div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Interaction Buttons -->
            <div class="mt-4 flex justify-center gap-4">
              <Button
                size="lg"
                variant="outline"
                class="flex-1 border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/30 dark:text-pink-400 dark:hover:bg-pink-950/50"
                :disabled="isPetting"
                @click="petPet"
              >
                <Hand class="mr-2 size-5" />
                Pet
                <Heart class="ml-2 size-4 fill-pink-400 text-pink-400" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                class="flex-1 border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                :disabled="
                  isFeeding ||
                  currentFood <= 0 ||
                  evolutionProgress?.isMaxTier ||
                  evolutionProgress?.canEvolve
                "
                @click="feedPet"
              >
                <Apple class="mr-2 size-5" />
                Feed
                <span class="ml-2 text-xs opacity-70">({{ currentFood }})</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Evolution Card -->
        <Card class="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <ArrowUp class="size-5 text-purple-500" />
              Evolution
            </CardTitle>
            <CardDescription>Feed your pet to evolve it!</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Current Tier -->
            <div
              class="rounded-lg bg-gradient-to-r from-purple-100 to-fuchsia-100 p-4 text-center dark:from-purple-900/30 dark:to-fuchsia-900/30"
            >
              <p class="text-sm text-muted-foreground">Current Tier</p>
              <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">
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
              class="rounded-lg bg-gradient-to-r from-yellow-100 to-amber-100 p-4 text-center dark:from-yellow-900/30 dark:to-amber-900/30"
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
              <Loader2 v-if="isEvolving" class="mr-2 size-5 animate-spin" />
              <ArrowUp v-else class="mr-2 size-5" />
              Evolve to Tier {{ (selectedOwnedPet?.tier ?? 1) + 1 }}!
            </Button>

            <!-- Evolution Costs Info -->
            <div class="rounded-lg border border-purple-200 p-4 dark:border-purple-800">
              <h4 class="mb-2 text-sm font-medium">Evolution Costs</h4>
              <ul class="space-y-1 text-sm text-muted-foreground">
                <li class="flex justify-between">
                  <span>Tier 1 → 2</span>
                  <span class="font-medium">{{ EVOLUTION_COSTS.tier1to2 }} food</span>
                </li>
                <li class="flex justify-between">
                  <span>Tier 2 → 3</span>
                  <span class="font-medium">{{ EVOLUTION_COSTS.tier2to3 }} food</span>
                </li>
              </ul>
            </div>

            <!-- Quick Actions -->
            <Button
              variant="outline"
              class="w-full border-purple-300 dark:border-purple-700"
              @click="goToCollections"
            >
              <Sparkles class="mr-2 size-4 text-purple-500" />
              View Collection
            </Button>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>

<style scoped>
@keyframes float-up {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-100px) scale(0.5);
  }
}

.animate-float-up {
  animation: float-up 1.5s ease-out forwards;
}

@keyframes heart-float {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translateY(-10px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-80px) scale(0.6);
  }
}

.animate-heart-float {
  animation: heart-float 1.5s ease-out forwards;
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
}

.animate-sparkle {
  animation: sparkle 1s ease-in-out infinite;
}

@keyframes food-fall {
  0% {
    opacity: 1;
    transform: translateY(-20px) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translateY(80px) rotate(360deg);
  }
}

.animate-food-fall {
  animation: food-fall 0.8s ease-in forwards;
}

@keyframes wiggle {
  0%,
  100% {
    transform: rotate(-3deg);
  }
  50% {
    transform: rotate(3deg);
  }
}

.animate-wiggle {
  animation: wiggle 0.3s ease-in-out infinite;
}

@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.animate-bounce-slow {
  animation: bounce-slow 2s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    filter: drop-shadow(0 0 10px rgba(234, 179, 8, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 30px rgba(234, 179, 8, 0.8));
  }
}

.animate-glow {
  animation: glow 0.5s ease-in-out infinite;
}

/* Speech bubble transition (right-skewed) */
.bubble-enter-active {
  animation: bubble-in 0.3s ease-out;
}

.bubble-leave-active {
  animation: bubble-out 0.2s ease-in;
}

@keyframes bubble-in {
  0% {
    opacity: 0;
    transform: translateY(-50%) translateX(-20px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

@keyframes bubble-out {
  0% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-50%) translateX(20px) scale(0.8);
  }
}
</style>
