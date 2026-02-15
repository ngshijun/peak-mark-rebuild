<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePetsStore, rarityConfig, type Pet, type PetRarity } from '@/stores/pets'
import { useAdminPetsStore } from '@/stores/admin-pets'
import { Search, Plus, Trash2, Loader2, Pencil } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import PetFormDialog from '@/components/admin/PetFormDialog.vue'
import PetPreviewDialog from '@/components/admin/PetPreviewDialog.vue'
import { toast } from 'vue-sonner'

const petsStore = usePetsStore()
const adminPetsStore = useAdminPetsStore()

// Fetch pets on mount
onMounted(async () => {
  if (petsStore.allPets.length === 0) {
    await petsStore.fetchAllPets()
  }
})

const rarities = Object.keys(rarityConfig) as PetRarity[]
const raritiesDesc = [...rarities].reverse()

function filteredPetsByRarity(rarity: PetRarity) {
  const pets = petsStore.petsByRarity[rarity] ?? []
  const searchQuery = adminPetsStore.adminPetsFilters.search
  if (!searchQuery) return pets
  const query = searchQuery.toLowerCase()
  return pets.filter((p) => p.name.toLowerCase().includes(query))
}

const allFilteredPets = computed(() => raritiesDesc.flatMap((r) => filteredPetsByRarity(r)))

// Preview Dialog
const showPreviewDialog = ref(false)
const previewPet = ref<Pet | null>(null)

function openPreviewDialog(pet: Pet) {
  previewPet.value = pet
  showPreviewDialog.value = true
}

// Add/Edit Dialog
const showPetDialog = ref(false)
const editingPet = ref<Pet | null>(null)

function openAddDialog() {
  editingPet.value = null
  showPetDialog.value = true
}

function openEditDialog(pet: Pet) {
  editingPet.value = pet
  showPetDialog.value = true
}

async function onPetSaved() {
  await petsStore.fetchAllPets()
}

// Delete Dialog
const showDeleteDialog = ref(false)
const deletingPet = ref<Pet | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(pet: Pet) {
  deletingPet.value = pet
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingPet.value) return

  isDeleting.value = true
  try {
    const { error } = await adminPetsStore.deletePet(deletingPet.value.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Pet deleted successfully')
      await petsStore.fetchAllPets()
    }
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
    deletingPet.value = null
  }
}

function getPetTierImage(pet: Pet, tier: 1 | 2 | 3) {
  const path = tier === 1 ? pet.imagePath : tier === 2 ? pet.tier2ImagePath : pet.tier3ImagePath
  if (!path) return null
  return petsStore.getOptimizedPetImageUrl(path, pet.updatedAt)
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Pets</h1>
        <p class="text-muted-foreground">Manage gacha pets and their rarities.</p>
      </div>
      <Button :disabled="petsStore.isLoading" @click="openAddDialog">
        <Plus class="mr-2 size-4" />
        Add Pet
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="petsStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Search Bar -->
      <div class="mb-4 flex items-center gap-2">
        <div class="relative max-w-sm flex-1">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="adminPetsStore.adminPetsFilters.search"
            placeholder="Search pets..."
            class="pl-9"
            @update:model-value="adminPetsStore.setAdminPetsSearch(String($event))"
          />
        </div>
      </div>

      <!-- Rarity Tabs -->
      <Tabs default-value="all">
        <TabsList>
          <TabsTrigger value="all">
            All
            <span class="ml-1 text-xs text-muted-foreground"> ({{ allFilteredPets.length }}) </span>
          </TabsTrigger>
          <TabsTrigger v-for="rarity in rarities" :key="rarity" :value="rarity">
            <span :class="rarityConfig[rarity].color">{{ rarityConfig[rarity].label }}</span>
            <span class="ml-1 text-xs text-muted-foreground">
              ({{ filteredPetsByRarity(rarity).length }})
            </span>
          </TabsTrigger>
        </TabsList>

        <!-- All tab (highest rarity first) -->
        <TabsContent value="all">
          <div v-if="allFilteredPets.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card
              v-for="pet in allFilteredPets"
              :key="pet.id"
              class="overflow-hidden gap-0 py-0"
              :class="rarityConfig[pet.rarity].borderColor"
            >
              <button
                class="grid cursor-pointer grid-cols-3 gap-1 px-2 pt-2"
                :class="rarityConfig[pet.rarity].bgColor"
                @click="openPreviewDialog(pet)"
              >
                <div
                  v-for="tier in [1, 2, 3] as const"
                  :key="tier"
                  class="flex aspect-square items-center justify-center"
                >
                  <img
                    v-if="getPetTierImage(pet, tier)"
                    :src="getPetTierImage(pet, tier)!"
                    :alt="`${pet.name} T${tier}`"
                    loading="lazy"
                    class="size-full object-contain"
                  />
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </div>
              </button>
              <div class="flex items-center justify-between px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ pet.name }}</span>
                  <Badge
                    variant="secondary"
                    :class="[rarityConfig[pet.rarity].bgColor, rarityConfig[pet.rarity].color]"
                  >
                    {{ rarityConfig[pet.rarity].label }}
                  </Badge>
                </div>
                <div class="flex gap-1">
                  <Button variant="ghost" size="icon" class="size-7" @click="openEditDialog(pet)">
                    <Pencil class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 text-destructive hover:text-destructive"
                    @click="openDeleteDialog(pet)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
          <div v-else class="py-12 text-center">
            <p class="text-muted-foreground">No pets yet. Add your first pet!</p>
          </div>
        </TabsContent>

        <!-- Per-rarity tabs -->
        <TabsContent v-for="rarity in rarities" :key="rarity" :value="rarity">
          <div
            v-if="filteredPetsByRarity(rarity).length"
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <Card
              v-for="pet in filteredPetsByRarity(rarity)"
              :key="pet.id"
              class="overflow-hidden gap-0 py-0"
              :class="rarityConfig[rarity].borderColor"
            >
              <!-- Tier images row -->
              <button
                class="grid cursor-pointer grid-cols-3 gap-1 px-2 pt-2"
                :class="rarityConfig[rarity].bgColor"
                @click="openPreviewDialog(pet)"
              >
                <div
                  v-for="tier in [1, 2, 3] as const"
                  :key="tier"
                  class="flex aspect-square items-center justify-center"
                >
                  <img
                    v-if="getPetTierImage(pet, tier)"
                    :src="getPetTierImage(pet, tier)!"
                    :alt="`${pet.name} T${tier}`"
                    loading="lazy"
                    class="size-full object-contain"
                  />
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </div>
              </button>

              <!-- Info + actions -->
              <div class="flex items-center justify-between px-3 py-2">
                <span class="font-medium">{{ pet.name }}</span>
                <div class="flex gap-1">
                  <Button variant="ghost" size="icon" class="size-7" @click="openEditDialog(pet)">
                    <Pencil class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 text-destructive hover:text-destructive"
                    @click="openDeleteDialog(pet)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div v-else class="py-12 text-center">
            <p class="text-muted-foreground">
              {{
                adminPetsStore.adminPetsFilters.search
                  ? 'No matching pets.'
                  : 'No pets in this rarity yet.'
              }}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </template>

    <!-- Pet Preview Dialog -->
    <PetPreviewDialog v-model:open="showPreviewDialog" :pet="previewPet" />

    <!-- Add/Edit Pet Dialog -->
    <PetFormDialog v-model:open="showPetDialog" :pet="editingPet" @saved="onPetSaved" />

    <!-- Delete Pet Confirmation -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Pet</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{{ deletingPet?.name }}"? This will also remove it from
            all student collections.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="isDeleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
