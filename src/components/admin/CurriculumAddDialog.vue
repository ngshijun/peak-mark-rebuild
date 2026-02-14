<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useCurriculumStore } from '@/stores/curriculum'
import { addCurriculumItemFormSchema } from '@/lib/validations'
import { ImagePlus, Loader2, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { toast } from 'vue-sonner'

type CurriculumLevel = 'grade' | 'subject' | 'topic' | 'subtopic'

const props = defineProps<{
  open: boolean
  addType: CurriculumLevel
  gradeLevelId: string
  subjectId: string
  topicId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const curriculumStore = useCurriculumStore()

const { handleSubmit, resetForm } = useForm({
  validationSchema: addCurriculumItemFormSchema,
  initialValues: { name: '' },
})

const isSaving = ref(false)
const imagePreview = ref('')
const imageFile = ref<File | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const dialogGradeLevelId = ref('')
const dialogSubjectId = ref('')
const dialogTopicId = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm()
      imagePreview.value = ''
      imageFile.value = null
      dialogGradeLevelId.value = props.gradeLevelId
      dialogSubjectId.value = props.subjectId
      dialogTopicId.value = props.topicId
    }
  },
)

function getDialogTitle() {
  switch (props.addType) {
    case 'grade':
      return 'Add Grade Level'
    case 'subject':
      return 'Add Subject'
    case 'topic':
      return 'Add Topic'
    case 'subtopic':
      return 'Add Sub-Topic'
  }
}

function getDialogDescription() {
  switch (props.addType) {
    case 'grade':
      return 'Add a new grade level to the curriculum.'
    case 'subject':
      return 'Add a new subject with an optional cover image.'
    case 'topic':
      return 'Add a new topic with an optional cover image.'
    case 'subtopic':
      return 'Add a new sub-topic with an optional cover image.'
  }
}

function getInputLabel() {
  switch (props.addType) {
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

function removeImage() {
  imagePreview.value = ''
  imageFile.value = null
  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

const handleAdd = handleSubmit(async (values) => {
  isSaving.value = true

  try {
    let itemId: string | undefined

    if (props.addType === 'grade') {
      const result = await curriculumStore.addGradeLevel(values.name.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Grade level added successfully')
    } else if (props.addType === 'subject' && dialogGradeLevelId.value) {
      const result = await curriculumStore.addSubject(dialogGradeLevelId.value, values.name.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      itemId = result.id

      if (imageFile.value && itemId) {
        const uploadResult = await curriculumStore.uploadCurriculumImage(
          imageFile.value,
          'subject',
          itemId,
        )
        if (uploadResult.success && uploadResult.path) {
          await curriculumStore.updateSubjectCoverImage(
            dialogGradeLevelId.value,
            itemId,
            uploadResult.path,
          )
        }
      }
      toast.success('Subject added successfully')
    } else if (props.addType === 'topic' && dialogGradeLevelId.value && dialogSubjectId.value) {
      const result = await curriculumStore.addTopic(
        dialogGradeLevelId.value,
        dialogSubjectId.value,
        values.name.trim(),
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      itemId = result.id

      if (imageFile.value && itemId) {
        const uploadResult = await curriculumStore.uploadCurriculumImage(
          imageFile.value,
          'topic',
          itemId,
        )
        if (uploadResult.success && uploadResult.path) {
          await curriculumStore.updateTopicCoverImage(
            dialogGradeLevelId.value,
            dialogSubjectId.value,
            itemId,
            uploadResult.path,
          )
        }
      }
      toast.success('Topic added successfully')
    } else if (
      props.addType === 'subtopic' &&
      dialogGradeLevelId.value &&
      dialogSubjectId.value &&
      dialogTopicId.value
    ) {
      const result = await curriculumStore.addSubTopic(
        dialogGradeLevelId.value,
        dialogSubjectId.value,
        dialogTopicId.value,
        values.name.trim(),
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      itemId = result.id

      if (imageFile.value && itemId) {
        const uploadResult = await curriculumStore.uploadCurriculumImage(
          imageFile.value,
          'subtopic',
          itemId,
        )
        if (uploadResult.success && uploadResult.path) {
          await curriculumStore.updateSubTopicCoverImage(
            dialogGradeLevelId.value,
            dialogSubjectId.value,
            dialogTopicId.value,
            itemId,
            uploadResult.path,
          )
        }
      }
      toast.success('Sub-topic added successfully')
    }

    emit('update:open', false)
  } finally {
    isSaving.value = false
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ getDialogTitle() }}</DialogTitle>
        <DialogDescription>{{ getDialogDescription() }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4 py-4" @submit="handleAdd">
        <!-- Grade Level Select (for subject when not in context) -->
        <div v-if="addType === 'subject' && !dialogGradeLevelId" class="space-y-2">
          <FieldLabel>Grade Level</FieldLabel>
          <Select v-model="dialogGradeLevelId">
            <SelectTrigger>
              <SelectValue placeholder="Select a grade level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="grade in curriculumStore.gradeLevels"
                :key="grade.id"
                :value="grade.id"
              >
                {{ grade.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Subject Select (for topic when not in context) -->
        <div v-if="addType === 'topic' && dialogGradeLevelId && !dialogSubjectId" class="space-y-2">
          <FieldLabel>Subject</FieldLabel>
          <Select v-model="dialogSubjectId">
            <SelectTrigger>
              <SelectValue placeholder="Select a subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="subject in curriculumStore.gradeLevels.find(
                  (g) => g.id === dialogGradeLevelId,
                )?.subjects ?? []"
                :key="subject.id"
                :value="subject.id"
              >
                {{ subject.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Name Input -->
        <VeeField v-slot="{ field, errors }" name="name">
          <Field :data-invalid="!!errors.length">
            <FieldLabel :for="addType + '-name'">{{ getInputLabel() }}</FieldLabel>
            <Input
              :id="addType + '-name'"
              :placeholder="'Enter ' + getInputLabel().toLowerCase()"
              :disabled="isSaving"
              :aria-invalid="!!errors.length"
              v-bind="field"
            />
            <FieldError :errors="errors" />
          </Field>
        </VeeField>

        <!-- Cover Image (for subject/topic/subtopic) -->
        <div v-if="addType !== 'grade'" class="space-y-2">
          <FieldLabel>Cover Image (optional)</FieldLabel>
          <div v-if="imagePreview" class="relative">
            <div class="aspect-video w-full overflow-hidden rounded-lg border">
              <img :src="imagePreview" alt="Cover image preview" class="size-full object-cover" />
            </div>
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
              Add Cover Image
            </Button>
            <p class="mt-1 text-xs text-muted-foreground">Leave empty to use a default image.</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="isSaving">
            <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
            Add
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
