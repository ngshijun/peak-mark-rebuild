<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import {
  type CurriculumLevel,
  type CurriculumIds,
  curriculumEntityConfig,
} from '@/lib/curriculumEntityConfig'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
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
  editType: CurriculumLevel
  currentName: string
  gradeLevelId: string
  subjectId: string
  topicId: string
  subTopicId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const curriculumStore = useCurriculumStore()
const config = computed(() => curriculumEntityConfig[props.editType])
const isSaving = ref(false)
const nameValue = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      nameValue.value = props.currentName
    }
  },
)

async function handleSave() {
  const trimmedName = nameValue.value.trim()
  if (!trimmedName) {
    toast.error('Name cannot be empty')
    return
  }

  if (trimmedName === props.currentName) {
    emit('update:open', false)
    return
  }

  isSaving.value = true

  try {
    const ids: CurriculumIds = {
      gradeLevelId: props.gradeLevelId,
      subjectId: props.subjectId,
      topicId: props.topicId,
      subTopicId: props.subTopicId,
    }

    const result = await config.value.updateName(curriculumStore, ids, trimmedName)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Name updated successfully')
      emit('update:open', false)
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit {{ config.label }} Name</DialogTitle>
        <DialogDescription> Update the name for "{{ currentName }}" </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <Field>
          <FieldLabel for="edit-name-input">{{ config.inputLabel }}</FieldLabel>
          <Input
            id="edit-name-input"
            v-model="nameValue"
            :placeholder="'Enter ' + config.inputLabel.toLowerCase()"
            :disabled="isSaving"
            @keydown.enter.prevent="handleSave"
          />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="isSaving || !nameValue.trim()" @click="handleSave">
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
