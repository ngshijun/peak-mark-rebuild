<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { usePetsStore, rarityConfig, type Pet, type PetRarity } from '@/stores/pets'
import { useAdminPetsStore } from '@/stores/admin-pets'
import { petFormSchema } from '@/lib/validations'
import { Search, Plus, Trash2, Loader2, ImagePlus, X, Pencil } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from 'vue-sonner'

const petsStore = usePetsStore()
const adminPetsStore = useAdminPetsStore()

// Pet form
const {
  handleSubmit: handlePetSubmit,
  resetForm: resetPetForm,
  setValues: setPetValues,
} = useForm({
  validationSchema: petFormSchema,
  initialValues: {
    name: '',
    rarity: 'common' as PetRarity,
  },
})

const isLoading = ref(false)

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

// Add/Edit Dialog
const showPetDialog = ref(false)
const editingPet = ref<Pet | null>(null)
const formImagePath = ref('')
const formImageFile = ref<File | null>(null)
const formTier2ImagePath = ref<string | null>(null)
const formTier2ImageFile = ref<File | null>(null)
const formTier3ImagePath = ref<string | null>(null)
const formTier3ImageFile = ref<File | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const tier2ImageInputRef = ref<HTMLInputElement | null>(null)
const tier3ImageInputRef = ref<HTMLInputElement | null>(null)
const isSaving = ref(false)

function openAddDialog() {
  editingPet.value = null
  resetPetForm()
  formImagePath.value = ''
  formImageFile.value = null
  formTier2ImagePath.value = null
  formTier2ImageFile.value = null
  formTier3ImagePath.value = null
  formTier3ImageFile.value = null
  showPetDialog.value = true
}

async function openEditDialog(pet: Pet) {
  editingPet.value = pet
  formImagePath.value = pet.imagePath
  formImageFile.value = null
  formTier2ImagePath.value = pet.tier2ImagePath
  formTier2ImageFile.value = null
  formTier3ImagePath.value = pet.tier3ImagePath
  formTier3ImageFile.value = null
  showPetDialog.value = true
  await nextTick()
  setPetValues({
    name: pet.name,
    rarity: pet.rarity,
  })
}

function handleImageUpload(event: Event, tier: 1 | 2 | 3 = 1) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (tier === 1) {
        formImageFile.value = file
        formImagePath.value = result
      } else if (tier === 2) {
        formTier2ImageFile.value = file
        formTier2ImagePath.value = result
      } else {
        formTier3ImageFile.value = file
        formTier3ImagePath.value = result
      }
    }
    reader.readAsDataURL(file)
  }
}

function removeImage(tier: 1 | 2 | 3 = 1) {
  if (tier === 1) {
    formImagePath.value = ''
    formImageFile.value = null
    if (imageInputRef.value) imageInputRef.value.value = ''
  } else if (tier === 2) {
    formTier2ImagePath.value = null
    formTier2ImageFile.value = null
    if (tier2ImageInputRef.value) tier2ImageInputRef.value.value = ''
  } else {
    formTier3ImagePath.value = null
    formTier3ImageFile.value = null
    if (tier3ImageInputRef.value) tier3ImageInputRef.value.value = ''
  }
}

const handleSave = handlePetSubmit(async (values) => {
  isSaving.value = true

  try {
    let imagePath = formImagePath.value
    let tier2ImagePath = formTier2ImagePath.value
    let tier3ImagePath = formTier3ImagePath.value

    // Upload tier 1 image if new file selected
    if (formImageFile.value) {
      const { path, error: uploadError } = await adminPetsStore.uploadPetImage(
        formImageFile.value,
        editingPet.value?.id,
      )
      if (uploadError) {
        toast.error(uploadError)
        return
      }
      imagePath = path || ''
    }

    // Upload tier 2 image if new file selected
    if (formTier2ImageFile.value) {
      const { path, error: uploadError } = await adminPetsStore.uploadPetImage(
        formTier2ImageFile.value,
        editingPet.value?.id ? `${editingPet.value.id}_tier2` : undefined,
      )
      if (uploadError) {
        toast.error(uploadError)
        return
      }
      tier2ImagePath = path || null
    }

    // Upload tier 3 image if new file selected
    if (formTier3ImageFile.value) {
      const { path, error: uploadError } = await adminPetsStore.uploadPetImage(
        formTier3ImageFile.value,
        editingPet.value?.id ? `${editingPet.value.id}_tier3` : undefined,
      )
      if (uploadError) {
        toast.error(uploadError)
        return
      }
      tier3ImagePath = path || null
    }

    if (editingPet.value) {
      // Update existing pet
      const { error } = await adminPetsStore.updatePet(editingPet.value.id, {
        name: values.name,
        rarity: values.rarity,
        imagePath,
        tier2ImagePath,
        tier3ImagePath,
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Pet updated successfully')
    } else {
      // Create new pet
      if (!imagePath) {
        toast.error('Tier 1 image is required')
        return
      }
      const { error } = await adminPetsStore.createPet({
        name: values.name,
        rarity: values.rarity,
        imagePath,
        tier2ImagePath,
        tier3ImagePath,
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Pet created successfully')
    }

    showPetDialog.value = false
    await petsStore.fetchAllPets()
  } finally {
    isSaving.value = false
  }
})

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
  return petsStore.getPetImageUrl(path, pet.updatedAt)
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
              <div
                class="grid grid-cols-3 gap-1 px-2 pt-2"
                :class="rarityConfig[pet.rarity].bgColor"
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
              </div>
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
              <div class="grid grid-cols-3 gap-1 px-2 pt-2" :class="rarityConfig[rarity].bgColor">
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
              </div>

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

    <!-- Add/Edit Pet Dialog -->
    <Dialog v-model:open="showPetDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ editingPet ? 'Edit Pet' : 'Add Pet' }}</DialogTitle>
          <DialogDescription>
            {{ editingPet ? 'Update pet details.' : 'Create a new gacha pet.' }}
          </DialogDescription>
        </DialogHeader>

        <form class="space-y-4 py-4" @submit="handleSave">
          <!-- Pet Name -->
          <VeeField v-slot="{ field, errors }" name="name">
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="pet-name">Name</FieldLabel>
              <Input
                id="pet-name"
                placeholder="Enter pet name"
                :disabled="isSaving"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <!-- Rarity -->
          <VeeField v-slot="{ handleChange, value, errors }" name="rarity">
            <Field :data-invalid="!!errors.length">
              <FieldLabel>Rarity</FieldLabel>
              <Select :model-value="value" :disabled="isSaving" @update:model-value="handleChange">
                <SelectTrigger class="w-full" :class="{ 'border-destructive': !!errors.length }">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(config, rarity) in rarityConfig"
                    :key="rarity"
                    :value="rarity"
                  >
                    <span :class="config.color">{{ config.label }}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <!-- Pet Images (3 Tiers) -->
          <div class="space-y-4">
            <FieldLabel>Evolution Images</FieldLabel>
            <div class="grid grid-cols-3 gap-3">
              <!-- Tier 1 Image -->
              <div class="space-y-2">
                <p class="text-xs font-medium text-muted-foreground">Tier 1 (Required)</p>
                <div v-if="formImagePath" class="relative">
                  <img
                    :src="
                      formImageFile
                        ? formImagePath
                        : petsStore.getPetImageUrl(formImagePath, editingPet?.updatedAt)
                    "
                    alt="Tier 1 preview"
                    class="aspect-square w-full rounded-lg border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    class="absolute -right-1 -top-1 size-5"
                    :disabled="isSaving"
                    @click="removeImage(1)"
                  >
                    <X class="size-3" />
                  </Button>
                </div>
                <div v-else>
                  <input
                    ref="imageInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => handleImageUpload(e, 1)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="w-full"
                    :disabled="isSaving"
                    @click="imageInputRef?.click()"
                  >
                    <ImagePlus class="mr-1 size-3" />
                    T1
                  </Button>
                </div>
              </div>

              <!-- Tier 2 Image -->
              <div class="space-y-2">
                <p class="text-xs font-medium text-muted-foreground">Tier 2 (Optional)</p>
                <div v-if="formTier2ImagePath" class="relative">
                  <img
                    :src="
                      formTier2ImageFile
                        ? formTier2ImagePath
                        : petsStore.getPetImageUrl(formTier2ImagePath, editingPet?.updatedAt)
                    "
                    alt="Tier 2 preview"
                    class="aspect-square w-full rounded-lg border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    class="absolute -right-1 -top-1 size-5"
                    :disabled="isSaving"
                    @click="removeImage(2)"
                  >
                    <X class="size-3" />
                  </Button>
                </div>
                <div v-else>
                  <input
                    ref="tier2ImageInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => handleImageUpload(e, 2)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="w-full"
                    :disabled="isSaving"
                    @click="tier2ImageInputRef?.click()"
                  >
                    <ImagePlus class="mr-1 size-3" />
                    T2
                  </Button>
                </div>
              </div>

              <!-- Tier 3 Image -->
              <div class="space-y-2">
                <p class="text-xs font-medium text-muted-foreground">Tier 3 (Optional)</p>
                <div v-if="formTier3ImagePath" class="relative">
                  <img
                    :src="
                      formTier3ImageFile
                        ? formTier3ImagePath
                        : petsStore.getPetImageUrl(formTier3ImagePath, editingPet?.updatedAt)
                    "
                    alt="Tier 3 preview"
                    class="aspect-square w-full rounded-lg border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    class="absolute -right-1 -top-1 size-5"
                    :disabled="isSaving"
                    @click="removeImage(3)"
                  >
                    <X class="size-3" />
                  </Button>
                </div>
                <div v-else>
                  <input
                    ref="tier3ImageInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => handleImageUpload(e, 3)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="w-full"
                    :disabled="isSaving"
                    @click="tier3ImageInputRef?.click()"
                  >
                    <ImagePlus class="mr-1 size-3" />
                    T3
                  </Button>
                </div>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              If tier images are not provided, the previous tier's image will be used.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="showPetDialog = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isSaving">
              <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
              {{ editingPet ? 'Update' : 'Create' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

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
