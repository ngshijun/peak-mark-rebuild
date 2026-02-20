<script setup lang="ts">
import { usePetsStore, rarityConfig, type PetRarity, type Pet } from '@/stores/pets'
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
import { Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  results: Array<{
    upgraded: boolean
    isNew: boolean
    resultPet: Pet | null
    resultRarity: PetRarity | null
  }>
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const petsStore = usePetsStore()

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="close">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-xl">
          <span class="text-2xl">🎉</span>
          Combination Complete!
        </DialogTitle>
        <DialogDescription>
          {{
            props.results.length === 1
              ? props.results[0]?.upgraded
                ? 'Congratulations! Your pets combined into a higher rarity!'
                : 'The combination failed, but you still got a pet back.'
              : `You performed ${props.results.length} combinations!`
          }}
        </DialogDescription>
      </DialogHeader>

      <!-- Single Result -->
      <div
        v-if="props.results.length === 1 && props.results[0]?.resultPet"
        class="flex flex-col items-center py-6"
      >
        <div class="mb-4 flex gap-2">
          <Badge
            v-if="props.results[0].upgraded"
            class="animate-pulse bg-gradient-to-r from-yellow-400 to-amber-500 text-white"
          >
            <Sparkles class="mr-1 size-3" />
            UPGRADED!
          </Badge>
          <Badge v-if="props.results[0].isNew" class="bg-green-500 text-white"> NEW! </Badge>
        </div>

        <div
          class="flex flex-col items-center rounded-xl border-2 p-6"
          :class="[
            props.results[0].resultRarity
              ? [
                  rarityConfig[props.results[0].resultRarity].bgColor,
                  rarityConfig[props.results[0].resultRarity].borderColor,
                ]
              : '',
          ]"
        >
          <img
            :src="
              petsStore.getOptimizedPetImageUrl(
                props.results[0].resultPet.imagePath,
                props.results[0].resultPet.updatedAt,
              )
            "
            :alt="props.results[0].resultPet.name"
            class="size-40 object-contain"
          />
          <p class="mt-3 text-lg font-bold">{{ props.results[0].resultPet.name }}</p>
          <Badge
            v-if="props.results[0].resultRarity"
            :class="rarityConfig[props.results[0].resultRarity].color"
            variant="outline"
            class="mt-2"
          >
            {{ rarityConfig[props.results[0].resultRarity].label }}
          </Badge>
        </div>
      </div>

      <!-- Multiple Results (Quick Combine) -->
      <div v-else-if="props.results.length > 1" class="py-4">
        <!-- Summary -->
        <div class="mb-4 flex justify-center gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-green-500">
              {{ props.results.filter((r) => r.upgraded).length }}
            </p>
            <p class="text-sm text-muted-foreground">Upgraded</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-500">
              {{ props.results.filter((r) => !r.upgraded).length }}
            </p>
            <p class="text-sm text-muted-foreground">Same Rarity</p>
          </div>
        </div>

        <!-- Results Grid -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="(result, index) in props.results"
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
            <div class="absolute -right-1 -top-1 flex flex-col gap-0.5">
              <Badge v-if="result.upgraded" class="bg-green-500 px-1 text-[9px]"> UP! </Badge>
              <Badge v-if="result.isNew" class="bg-green-500 px-1 text-[9px]"> NEW! </Badge>
            </div>
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
        <Button class="w-full" @click="close"> Close </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
