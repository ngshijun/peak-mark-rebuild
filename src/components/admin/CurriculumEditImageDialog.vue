<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { ImagePlus, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
  imageType: 'subject' | 'topic' | 'subtopic'
  gradeLevelId: string
  subjectId: string
  topicId: string
  subTopicId: string
  itemName: string
  currentImageUrl: string
  hasCustomImage: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const curriculumStore = useCurriculumStore()

const isSaving = ref(false)
const imagePreview = ref('')
const imageFile = ref<File | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const hasCustom = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      imagePreview.value = props.currentImageUrl
      imageFile.value = null
      hasCustom.value = props.hasCustomImage
    }
  },
)

function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    imageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

async function handleSave() {
  if (!imageFile.value) {
    emit('update:open', false)
    return
  }

  isSaving.value = true

  try {
    let itemId: string
    if (props.imageType === 'subject') {
      itemId = props.subjectId
    } else if (props.imageType === 'topic') {
      itemId = props.topicId
    } else {
      itemId = props.subTopicId
    }

    const uploadResult = await curriculumStore.uploadCurriculumImage(
      imageFile.value,
      props.imageType,
      itemId,
    )

    if (!uploadResult.success || !uploadResult.path) {
      toast.error(uploadResult.error ?? 'Failed to upload image')
      return
    }

    if (props.imageType === 'subject') {
      const result = await curriculumStore.updateSubjectCoverImage(
        props.gradeLevelId,
        props.subjectId,
        uploadResult.path,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
    } else if (props.imageType === 'topic') {
      const result = await curriculumStore.updateTopicCoverImage(
        props.gradeLevelId,
        props.subjectId,
        props.topicId,
        uploadResult.path,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
    } else {
      const result = await curriculumStore.updateSubTopicCoverImage(
        props.gradeLevelId,
        props.subjectId,
        props.topicId,
        props.subTopicId,
        uploadResult.path,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
    }

    toast.success('Cover image updated successfully')
    emit('update:open', false)
  } finally {
    isSaving.value = false
  }
}

async function handleRemove() {
  isSaving.value = true

  try {
    let result: { success: boolean; error: string | null }

    if (props.imageType === 'subject') {
      result = await curriculumStore.updateSubjectCoverImage(
        props.gradeLevelId,
        props.subjectId,
        null,
      )
    } else if (props.imageType === 'topic') {
      result = await curriculumStore.updateTopicCoverImage(
        props.gradeLevelId,
        props.subjectId,
        props.topicId,
        null,
      )
    } else {
      result = await curriculumStore.updateSubTopicCoverImage(
        props.gradeLevelId,
        props.subjectId,
        props.topicId,
        props.subTopicId,
        null,
      )
    }

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Cover image removed successfully')
    emit('update:open', false)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit Cover Image</DialogTitle>
        <DialogDescription> Update the cover image for "{{ itemName }}" </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div v-if="imagePreview" class="aspect-video w-full overflow-hidden rounded-lg border">
          <img :src="imagePreview" :alt="itemName" class="size-full object-cover" />
        </div>

        <div>
          <input
            ref="imageInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleImageSelect"
          />
          <Button
            type="button"
            variant="outline"
            class="w-full"
            :disabled="isSaving"
            @click="imageInputRef?.click()"
          >
            <ImagePlus class="mr-2 size-4" />
            {{ imageFile ? 'Change Image' : 'Select New Image' }}
          </Button>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button
          v-if="hasCustom && !imageFile"
          variant="destructive"
          :disabled="isSaving"
          @click="handleRemove"
        >
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          Remove Image
        </Button>
        <Button :disabled="!imageFile || isSaving" @click="handleSave">
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
