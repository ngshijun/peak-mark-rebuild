<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EVOLUTION_COSTS } from '@/stores/pets'
import { ArrowUp, Star, Sparkles, Loader2 } from 'lucide-vue-next'

defineProps<{
  currentTier: number
  evolutionProgress: {
    foodFed: number
    requiredFood: number
    canEvolve: boolean
    isMaxTier: boolean
  } | null
  isEvolving: boolean
}>()

const emit = defineEmits<{
  evolve: []
  'view-collection': []
}>()
</script>

<template>
  <Card class="border-purple-200 dark:border-purple-900">
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
        class="rounded-lg bg-gradient-to-r from-purple-100 to-fuchsia-100 p-4 text-center dark:bg-card dark:from-purple-950/20 dark:to-fuchsia-950/20"
      >
        <p class="text-sm text-muted-foreground">Current Tier</p>
        <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">
          {{ currentTier }}
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
          Feed {{ evolutionProgress.requiredFood - evolutionProgress.foodFed }} more food to evolve
        </p>
      </div>

      <!-- Max Tier Message -->
      <div
        v-else-if="evolutionProgress?.isMaxTier"
        class="rounded-lg bg-gradient-to-r from-yellow-100 to-amber-100 p-4 text-center dark:bg-card dark:from-yellow-900/30 dark:to-amber-900/30"
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
        @click="emit('evolve')"
      >
        <Loader2 v-if="isEvolving" class="mr-2 size-5 animate-spin" />
        <ArrowUp v-else class="mr-2 size-5" />
        Evolve to Tier {{ currentTier + 1 }}!
      </Button>

      <!-- Evolution Costs Info -->
      <div class="rounded-lg border border-purple-200 p-4 dark:border-purple-900">
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
        @click="emit('view-collection')"
      >
        <Sparkles class="mr-2 size-4 text-purple-500" />
        View Collection
      </Button>
    </CardContent>
  </Card>
</template>
