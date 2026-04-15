<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { type CurriculumIds, curriculumEntityConfig } from '@/lib/curriculumEntityConfig'
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
import { useT } from '@/composables/useT'

const t = useT()

const props = defineProps<{
  open: boolean
  imageType: 'subject' | 'topic' | 'subtopic'
  gradeLevelId: string
  subjectId: string
  topicId: string
  subTopicId: string
  itemName: string
  currentImageUrl: string
  currentImagePath: string | null
  hasCustomImage: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const curriculumStore = useCurriculumStore()
const config = computed(() => curriculumEntityConfig[props.imageType])

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

const ids = computed<CurriculumIds>(() => ({
  gradeLevelId: props.gradeLevelId,
  subjectId: props.subjectId,
  topicId: props.topicId,
  subTopicId: props.subTopicId,
}))

async function handleSave() {
  if (!imageFile.value) {
    emit('update:open', false)
    return
  }

  isSaving.value = true

  try {
    const uploadResult = await curriculumStore.uploadCurriculumImage(
      imageFile.value,
      props.imageType,
      props.currentImagePath,
    )

    if (uploadResult.error || !uploadResult.path) {
      toast.error(t.value.shared.curriculumEditImageDialog.toastError(uploadResult.error ?? ''))
      return
    }

    const result = await config.value.updateCoverImage(
      curriculumStore,
      ids.value,
      uploadResult.path,
    )
    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(t.value.shared.curriculumEditImageDialog.toastUpdated)
    emit('update:open', false)
  } finally {
    isSaving.value = false
  }
}

async function handleRemove() {
  isSaving.value = true

  try {
    const result = await config.value.updateCoverImage(curriculumStore, ids.value, null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(t.value.shared.curriculumEditImageDialog.toastRemoved)
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
        <DialogTitle>{{ t.shared.curriculumEditImageDialog.title }}</DialogTitle>
        <DialogDescription>{{
          t.shared.curriculumEditImageDialog.description(itemName)
        }}</DialogDescription>
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
            {{
              imageFile
                ? t.shared.curriculumEditImageDialog.changeImage
                : t.shared.curriculumEditImageDialog.selectNewImage
            }}
          </Button>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
          {{ t.shared.curriculumEditImageDialog.cancel }}
        </Button>
        <Button
          v-if="hasCustom && !imageFile"
          variant="destructive"
          :disabled="isSaving"
          @click="handleRemove"
        >
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          {{ t.shared.curriculumEditImageDialog.removeImage }}
        </Button>
        <Button :disabled="!imageFile || isSaving" @click="handleSave">
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          {{ t.shared.curriculumEditImageDialog.save }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
