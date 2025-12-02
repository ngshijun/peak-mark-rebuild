<script setup lang="ts">
import { usePetsStore, rarityConfig } from '@/stores/pets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'vue-router'
import { PawPrint } from 'lucide-vue-next'

const petsStore = usePetsStore()
const router = useRouter()

function goToCollections() {
  router.push('/student/collections')
}
</script>

<template>
  <Card class="cursor-pointer" @click="goToCollections">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium">My Pet</CardTitle>
      <PawPrint class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <template v-if="petsStore.selectedPet">
        <div class="flex items-center gap-3">
          <div
            class="flex size-14 items-center justify-center rounded-lg"
            :class="[
              rarityConfig[petsStore.selectedPet.rarity].bgColor,
              rarityConfig[petsStore.selectedPet.rarity].borderColor,
              'border',
            ]"
          >
            <img
              :src="petsStore.getPetImageUrl(petsStore.selectedPet.imagePath)"
              :alt="petsStore.selectedPet.name"
              class="size-12 object-contain"
            />
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
