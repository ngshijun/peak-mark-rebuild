<script setup lang="ts">
import { usePetsStore, rarityConfig } from '@/stores/pets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'vue-router'

const petsStore = usePetsStore()
const router = useRouter()

function goToCollections() {
  router.push('/student/collections')
}
</script>

<template>
  <Card
    class="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
    @click="goToCollections"
  >
    <CardHeader class="pb-2">
      <CardTitle class="text-base">My Pet</CardTitle>
      <CardDescription>Your current companion</CardDescription>
    </CardHeader>
    <CardContent>
      <template v-if="petsStore.selectedPet">
        <div class="flex items-center gap-3">
          <div
            class="flex size-14 items-center justify-center rounded-lg text-4xl"
            :class="[
              rarityConfig[petsStore.selectedPet.rarity].bgColor,
              rarityConfig[petsStore.selectedPet.rarity].borderColor,
              'border',
            ]"
          >
            {{ petsStore.selectedPet.image }}
          </div>
          <div>
            <p class="font-medium">{{ petsStore.selectedPet.name }}</p>
            <Badge
              variant="outline"
              :class="rarityConfig[petsStore.selectedPet.rarity].color"
              class="text-xs"
            >
              {{ rarityConfig[petsStore.selectedPet.rarity].label }}
            </Badge>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center gap-3">
          <div
            class="flex size-14 items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 bg-muted"
          >
            <span class="text-2xl text-muted-foreground">?</span>
          </div>
          <div>
            <p class="font-medium text-muted-foreground">No pet selected</p>
            <p class="text-xs text-muted-foreground">Tap to choose one</p>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
