<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCurriculumStore } from '@/stores/curriculum'
import { Loader2 } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
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

type CurriculumLevel = 'grade' | 'subject' | 'topic' | 'subtopic'

const props = defineProps<{
  open: boolean
  deleteType: CurriculumLevel
  itemName: string
  gradeLevelId: string
  subjectId: string
  topicId: string
  subTopicId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  deleted: [
    type: CurriculumLevel,
    ids: {
      gradeLevelId: string
      subjectId: string
      topicId: string
      subTopicId: string
    },
  ]
}>()

const curriculumStore = useCurriculumStore()
const isDeleting = ref(false)
const confirmInput = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      confirmInput.value = ''
    }
  },
)

function getDescription() {
  switch (props.deleteType) {
    case 'grade':
      return 'This will permanently delete this grade level and all its subjects, topics, sub-topics, questions, and practice sessions. This action cannot be undone.'
    case 'subject':
      return 'This will permanently delete this subject and all its topics, sub-topics, questions, and practice sessions. This action cannot be undone.'
    case 'topic':
      return 'This will permanently delete this topic and all its sub-topics, questions, and practice sessions. This action cannot be undone.'
    case 'subtopic':
      return 'This will permanently delete this sub-topic and all its questions and practice sessions. This action cannot be undone.'
  }
}

async function confirmDelete() {
  isDeleting.value = true
  try {
    let result: { error: string | null }

    switch (props.deleteType) {
      case 'grade':
        result = await curriculumStore.deleteGradeLevel(props.gradeLevelId)
        if (!result.error) toast.success('Grade level deleted successfully')
        break
      case 'subject':
        result = await curriculumStore.deleteSubject(props.gradeLevelId, props.subjectId)
        if (!result.error) toast.success('Subject deleted successfully')
        break
      case 'topic':
        result = await curriculumStore.deleteTopic(
          props.gradeLevelId,
          props.subjectId,
          props.topicId,
        )
        if (!result.error) toast.success('Topic deleted successfully')
        break
      case 'subtopic':
        result = await curriculumStore.deleteSubTopic(
          props.gradeLevelId,
          props.subjectId,
          props.topicId,
          props.subTopicId,
        )
        if (!result.error) toast.success('Sub-topic deleted successfully')
        break
    }

    if (result.error) {
      toast.error(result.error)
    } else {
      emit('deleted', props.deleteType, {
        gradeLevelId: props.gradeLevelId,
        subjectId: props.subjectId,
        topicId: props.topicId,
        subTopicId: props.subTopicId,
      })
    }
  } finally {
    isDeleting.value = false
    emit('update:open', false)
  }
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{{ itemName }}"?</AlertDialogTitle>
        <AlertDialogDescription as="div">
          <p>{{ getDescription() }}</p>
          <p class="mt-3">
            To confirm, type
            <span class="font-semibold text-foreground">{{ itemName }}</span>
            below:
          </p>
          <Input
            v-model="confirmInput"
            class="mt-2"
            :placeholder="itemName"
            :disabled="isDeleting"
          />
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-white hover:bg-destructive/90"
          :disabled="isDeleting || confirmInput !== itemName"
          @click="confirmDelete"
        >
          <Loader2 v-if="isDeleting" class="mr-2 size-4 animate-spin" />
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
