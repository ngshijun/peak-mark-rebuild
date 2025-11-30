<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { usePetsStore, rarityConfig, type Pet, type PetRarity } from '@/stores/pets'
import { Search, Plus, Trash2, Edit, ArrowUpDown, Loader2, ImagePlus, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/ui/data-table'
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

const searchQuery = ref('')
const isLoading = ref(false)

// Fetch pets on mount
onMounted(async () => {
  if (petsStore.allPets.length === 0) {
    await petsStore.fetchAllPets()
  }
})

// Filter pets based on search
const filteredPets = computed(() => {
  if (!searchQuery.value) return petsStore.allPets
  const query = searchQuery.value.toLowerCase()
  return petsStore.allPets.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      rarityConfig[p.rarity].label.toLowerCase().includes(query),
  )
})

// Add/Edit Dialog
const showPetDialog = ref(false)
const editingPet = ref<Pet | null>(null)
const formName = ref('')
const formRarity = ref<PetRarity>('common')
const formGachaWeight = ref(100)
const formImagePath = ref('')
const formImageFile = ref<File | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const isSaving = ref(false)

function openAddDialog() {
  editingPet.value = null
  formName.value = ''
  formRarity.value = 'common'
  formGachaWeight.value = 100
  formImagePath.value = ''
  formImageFile.value = null
  showPetDialog.value = true
}

function openEditDialog(pet: Pet) {
  editingPet.value = pet
  formName.value = pet.name
  formRarity.value = pet.rarity
  formGachaWeight.value = pet.gachaWeight
  formImagePath.value = pet.imagePath
  formImageFile.value = null
  showPetDialog.value = true
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    formImageFile.value = file
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      formImagePath.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeImage() {
  formImagePath.value = ''
  formImageFile.value = null
  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

async function handleSave() {
  if (!formName.value.trim()) {
    toast.error('Pet name is required')
    return
  }

  isSaving.value = true

  try {
    let imagePath = formImagePath.value

    // Upload image if new file selected
    if (formImageFile.value) {
      const { path, error: uploadError } = await petsStore.uploadPetImage(
        formImageFile.value,
        editingPet.value?.id,
      )
      if (uploadError) {
        toast.error(uploadError)
        return
      }
      imagePath = path || ''
    }

    if (editingPet.value) {
      // Update existing pet
      const { error } = await petsStore.updatePet(editingPet.value.id, {
        name: formName.value,
        rarity: formRarity.value,
        gachaWeight: formGachaWeight.value,
        imagePath,
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Pet updated successfully')
    } else {
      // Create new pet
      if (!imagePath) {
        toast.error('Pet image is required')
        return
      }
      const { error } = await petsStore.createPet({
        name: formName.value,
        rarity: formRarity.value,
        gachaWeight: formGachaWeight.value,
        imagePath,
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
    const { error } = await petsStore.deletePet(deletingPet.value.id)
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

// Column definitions
const columns: ColumnDef<Pet>[] = [
  {
    accessorKey: 'imagePath',
    header: 'Image',
    cell: ({ row }) => {
      const pet = row.original
      return h('img', {
        src: petsStore.getPetImageUrl(pet.imagePath),
        alt: pet.name,
        class: 'size-12 object-contain rounded-lg border',
      })
    },
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Name', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'font-medium' }, row.original.name)
    },
  },
  {
    accessorKey: 'rarity',
    header: 'Rarity',
    cell: ({ row }) => {
      const rarity = row.original.rarity
      return h(
        Badge,
        { variant: 'outline', class: rarityConfig[rarity].color },
        () => rarityConfig[rarity].label,
      )
    },
  },
  {
    accessorKey: 'gachaWeight',
    header: ({ column }) => {
      return h(
        Button,
        {
          variant: 'ghost',
          onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
        },
        () => ['Weight', h(ArrowUpDown, { class: 'ml-2 size-4' })],
      )
    },
    cell: ({ row }) => {
      return h('div', { class: 'text-center' }, row.original.gachaWeight.toString())
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const pet = row.original
      return h('div', { class: 'flex gap-1' }, [
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'size-8',
            onClick: () => openEditDialog(pet),
          },
          () => h(Edit, { class: 'size-4' }),
        ),
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'size-8 text-destructive hover:text-destructive',
            onClick: () => openDeleteDialog(pet),
          },
          () => h(Trash2, { class: 'size-4' }),
        ),
      ])
    },
  },
]
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Pets</h1>
        <p class="text-muted-foreground">Manage gacha pets and their rarities.</p>
      </div>
      <Button @click="openAddDialog">
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
          <Input v-model="searchQuery" placeholder="Search pets..." class="pl-9" />
        </div>
      </div>

      <!-- Data Table -->
      <DataTable :columns="columns" :data="filteredPets" />

      <!-- Empty State -->
      <div v-if="filteredPets.length === 0 && !searchQuery" class="py-12 text-center">
        <p class="text-muted-foreground">No pets yet. Add your first pet!</p>
      </div>
    </template>

    <!-- Add/Edit Pet Dialog -->
    <Dialog v-model:open="showPetDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingPet ? 'Edit Pet' : 'Add Pet' }}</DialogTitle>
          <DialogDescription>
            {{ editingPet ? 'Update pet details.' : 'Create a new gacha pet.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Pet Name -->
          <div class="space-y-2">
            <Label>Name</Label>
            <Input v-model="formName" placeholder="Enter pet name" :disabled="isSaving" />
          </div>

          <!-- Rarity and Gacha Weight Row -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Rarity -->
            <div class="space-y-2">
              <Label>Rarity</Label>
              <Select v-model="formRarity" :disabled="isSaving">
                <SelectTrigger class="w-full">
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
            </div>

            <!-- Gacha Weight -->
            <div class="space-y-2">
              <Label>Gacha Weight</Label>
              <Input
                v-model.number="formGachaWeight"
                type="number"
                min="1"
                placeholder="100"
                class="w-full"
                :disabled="isSaving"
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Higher weight = more likely to be pulled within its rarity tier.
          </p>

          <!-- Pet Image -->
          <div class="space-y-2">
            <Label>Image</Label>
            <div v-if="formImagePath" class="relative inline-block">
              <img
                :src="formImageFile ? formImagePath : petsStore.getPetImageUrl(formImagePath)"
                alt="Pet preview"
                class="max-h-32 rounded-lg border object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                class="absolute -right-2 -top-2 size-6"
                :disabled="isSaving"
                @click="removeImage"
              >
                <X class="size-4" />
              </Button>
            </div>
            <div v-else>
              <input
                ref="imageInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleImageUpload"
              />
              <Button
                type="button"
                variant="outline"
                class="w-full"
                :disabled="isSaving"
                @click="imageInputRef?.click()"
              >
                <ImagePlus class="mr-2 size-4" />
                Upload Image
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="isSaving" @click="showPetDialog = false">
            Cancel
          </Button>
          <Button :disabled="!formName || isSaving" @click="handleSave">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            {{ editingPet ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
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
          <AlertDialogAction :disabled="isDeleting" @click="confirmDelete">
            <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
