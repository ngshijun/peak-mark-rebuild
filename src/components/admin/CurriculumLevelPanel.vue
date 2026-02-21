<script setup lang="ts" generic="T extends { id: string; name: string }">
import { Plus, Trash2, ImagePlus, Pencil } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

defineProps<{
  items: T[]
  clickable?: boolean
  hasImage?: boolean
  getCoverImageUrl?: (item: T) => string | null
  getDescription: (item: T) => string
  emptyTitle: string
  emptyDescription: string
  addLabel: string
}>()

const emit = defineEmits<{
  select: [item: T]
  'edit-name': [item: T]
  'edit-image': [item: T]
  delete: [item: T]
  add: []
}>()
</script>

<template>
  <div>
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="item in items"
        :key="item.id"
        class="group relative transition-shadow hover:shadow-lg"
        :class="[clickable && 'cursor-pointer', hasImage && 'flex h-full flex-col overflow-hidden']"
        @click="clickable && emit('select', item)"
      >
        <div
          v-if="hasImage && getCoverImageUrl?.(item)"
          class="aspect-video w-full overflow-hidden"
        >
          <img
            :src="getCoverImageUrl?.(item) ?? ''"
            :alt="item.name"
            class="size-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <CardContent :class="hasImage ? 'mt-auto px-4 pb-4 pt-2' : 'p-4'">
          <h3 class="text-lg font-semibold">{{ item.name }}</h3>
          <p class="text-sm text-muted-foreground">{{ getDescription(item) }}</p>
        </CardContent>
        <div
          class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Button
            variant="secondary"
            size="icon"
            class="size-8"
            @click.stop="emit('edit-name', item)"
          >
            <Pencil class="size-4" />
          </Button>
          <Button
            v-if="hasImage"
            variant="secondary"
            size="icon"
            class="size-8"
            @click.stop="emit('edit-image', item)"
          >
            <ImagePlus class="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            class="size-8"
            @click.stop="emit('delete', item)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </Card>
    </div>

    <div v-if="items.length === 0" class="rounded-lg border border-dashed p-12 text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        <Plus class="size-6 text-muted-foreground" />
      </div>
      <h3 class="mt-4 text-lg font-medium">{{ emptyTitle }}</h3>
      <p class="mt-2 text-sm text-muted-foreground">{{ emptyDescription }}</p>
      <Button class="mt-4" @click="emit('add')">
        <Plus class="mr-2 size-4" />
        {{ addLabel }}
      </Button>
    </div>
  </div>
</template>
