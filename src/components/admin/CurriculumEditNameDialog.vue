<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
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

type CurriculumLevel = 'grade' | 'subject' | 'topic' | 'subtopic'

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

function getTitle() {
  switch (props.editType) {
    case 'grade':
      return 'Edit Grade Level Name'
    case 'subject':
      return 'Edit Subject Name'
    case 'topic':
      return 'Edit Topic Name'
    case 'subtopic':
      return 'Edit Sub-Topic Name'
  }
}

function getInputLabel() {
  switch (props.editType) {
    case 'grade':
      return 'Grade Level Name'
    case 'subject':
      return 'Subject Name'
    case 'topic':
      return 'Topic Name'
    case 'subtopic':
      return 'Sub-Topic Name'
  }
}

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
    let result: { success: boolean; error: string | null }

    switch (props.editType) {
      case 'grade':
        result = await curriculumStore.updateGradeLevel(props.gradeLevelId, trimmedName)
        break
      case 'subject':
        result = await curriculumStore.updateSubject(props.gradeLevelId, props.subjectId, {
          name: trimmedName,
        })
        break
      case 'topic':
        result = await curriculumStore.updateTopic(
          props.gradeLevelId,
          props.subjectId,
          props.topicId,
          { name: trimmedName },
        )
        break
      case 'subtopic':
        result = await curriculumStore.updateSubTopic(
          props.gradeLevelId,
          props.subjectId,
          props.topicId,
          props.subTopicId,
          { name: trimmedName },
        )
        break
    }

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
        <DialogTitle>{{ getTitle() }}</DialogTitle>
        <DialogDescription> Update the name for "{{ currentName }}" </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <Field>
          <FieldLabel for="edit-name-input">{{ getInputLabel() }}</FieldLabel>
          <Input
            id="edit-name-input"
            v-model="nameValue"
            :placeholder="'Enter ' + getInputLabel().toLowerCase()"
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
