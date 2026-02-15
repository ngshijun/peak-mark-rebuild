<script setup lang="ts">
import { Field as VeeField } from 'vee-validate'
import { useCurriculumStore } from '@/stores/curriculum'
import type { useQuestionForm } from '@/composables/useQuestionForm'
import { ImagePlus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = withDefaults(
  defineProps<{
    form: ReturnType<typeof useQuestionForm>
    optionImageUrlGetter?: (optionId: 'a' | 'b' | 'c' | 'd') => string
  }>(),
  {
    optionImageUrlGetter: undefined,
  },
)

const curriculumStore = useCurriculumStore()

// Shorthand accessors to avoid verbose .value throughout template
const f = props.form

function getOptionImageSrc(option: { id: string; imagePath: string | null }): string {
  if (props.optionImageUrlGetter) {
    return props.optionImageUrlGetter(option.id as 'a' | 'b' | 'c' | 'd')
  }
  return option.imagePath ?? ''
}
</script>

<template>
  <!-- Question Type + Grade Level Row -->
  <div class="grid grid-cols-2 gap-4">
    <VeeField v-slot="{ handleChange, value }" name="type">
      <Field>
        <FieldLabel> Question Type <span class="text-destructive">*</span> </FieldLabel>
        <Select
          :model-value="value"
          :disabled="f.isSaving.value"
          @update:model-value="handleChange"
        >
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mcq">Multiple Choice (Single Answer)</SelectItem>
            <SelectItem value="mrq">Multiple Response (Multiple Answers)</SelectItem>
            <SelectItem value="short_answer">Short Answer</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </VeeField>

    <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="gradeLevelId">
      <Field :data-invalid="!!fieldErrors.length">
        <FieldLabel> Grade Level <span class="text-destructive">*</span> </FieldLabel>
        <Select
          :model-value="value"
          :disabled="f.isSaving.value"
          @update:model-value="
            (val) => {
              handleChange(val)
              f.setFieldValue('subjectId', '')
              f.setFieldValue('topicId', '')
            }
          "
        >
          <SelectTrigger class="w-full" :class="{ 'border-destructive': !!fieldErrors.length }">
            <SelectValue placeholder="Select grade level" />
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
        <FieldError :errors="fieldErrors" />
      </Field>
    </VeeField>
  </div>

  <!-- Subject, Topic, Sub-Topic Row -->
  <div class="grid grid-cols-3 gap-4">
    <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="subjectId">
      <Field :data-invalid="!!fieldErrors.length">
        <FieldLabel> Subject <span class="text-destructive">*</span> </FieldLabel>
        <Select
          :model-value="value"
          :disabled="!f.values.gradeLevelId || f.isSaving.value"
          @update:model-value="
            (val) => {
              handleChange(val)
              f.setFieldValue('topicId', '')
              f.setFieldValue('subTopicId', '')
            }
          "
        >
          <SelectTrigger class="w-full" :class="{ 'border-destructive': !!fieldErrors.length }">
            <SelectValue placeholder="Select subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="subject in f.availableSubjects.value"
              :key="subject.id"
              :value="subject.id"
            >
              {{ subject.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <FieldError :errors="fieldErrors" />
      </Field>
    </VeeField>

    <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="topicId">
      <Field :data-invalid="!!fieldErrors.length">
        <FieldLabel> Topic <span class="text-destructive">*</span> </FieldLabel>
        <Select
          :model-value="value"
          :disabled="!f.values.subjectId || f.isSaving.value"
          @update:model-value="
            (val) => {
              handleChange(val)
              f.setFieldValue('subTopicId', '')
            }
          "
        >
          <SelectTrigger class="w-full" :class="{ 'border-destructive': !!fieldErrors.length }">
            <SelectValue placeholder="Select topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="topic in f.availableTopics.value" :key="topic.id" :value="topic.id">
              {{ topic.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <FieldError :errors="fieldErrors" />
      </Field>
    </VeeField>

    <VeeField v-slot="{ handleChange, value, errors: fieldErrors }" name="subTopicId">
      <Field :data-invalid="!!fieldErrors.length">
        <FieldLabel> Sub-Topic <span class="text-destructive">*</span> </FieldLabel>
        <Select
          :model-value="value"
          :disabled="!f.values.topicId || f.isSaving.value"
          @update:model-value="handleChange"
        >
          <SelectTrigger class="w-full" :class="{ 'border-destructive': !!fieldErrors.length }">
            <SelectValue placeholder="Select sub-topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="subTopic in f.availableSubTopics.value"
              :key="subTopic.id"
              :value="subTopic.id"
            >
              {{ subTopic.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <FieldError :errors="fieldErrors" />
      </Field>
    </VeeField>
  </div>

  <!-- Question -->
  <VeeField v-slot="{ value, handleChange, handleBlur, errors: fieldErrors }" name="question">
    <Field :data-invalid="!!fieldErrors.length">
      <FieldLabel> Question <span class="text-destructive">*</span> </FieldLabel>
      <Textarea
        :model-value="value"
        @update:model-value="handleChange"
        @blur="handleBlur"
        placeholder="Enter the question"
        rows="3"
        :disabled="f.isSaving.value"
        :aria-invalid="!!fieldErrors.length"
        :class="{ 'border-destructive': !!fieldErrors.length }"
      />
      <FieldError :errors="fieldErrors" />
    </Field>
  </VeeField>

  <!-- Question Image -->
  <Field>
    <FieldLabel>Question Image (Optional)</FieldLabel>
    <div v-if="f.questionImage.value.displayUrl" class="relative inline-block">
      <img
        :src="f.questionImage.value.displayUrl"
        alt="Question image"
        class="max-h-48 rounded-lg border object-contain"
      />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        class="absolute -right-2 -top-2 size-6"
        :disabled="f.isSaving.value"
        @click="f.removeImage"
      >
        <X class="size-4" />
      </Button>
    </div>
    <div v-else>
      <input
        :ref="(el) => (f.imageInputRef.value = el as HTMLInputElement)"
        type="file"
        accept="image/*"
        class="hidden"
        @change="f.handleImageUpload"
      />
      <Button
        type="button"
        variant="outline"
        class="w-full"
        :disabled="f.isSaving.value"
        @click="f.imageInputRef.value?.click()"
      >
        <ImagePlus class="mr-2 size-4" />
        Add Image
      </Button>
    </div>
  </Field>

  <!-- MCQ/MRQ Options -->
  <div v-if="f.values.type === 'mcq' || f.values.type === 'mrq'" class="space-y-3">
    <Field :data-invalid="!!f.errors.value.options">
      <FieldLabel>
        Options <span class="text-destructive">*</span>
        <span class="ml-1 text-xs font-normal text-muted-foreground">
          ({{
            f.values.type === 'mcq' ? 'select the correct answer' : 'select all correct answers'
          }})
        </span>
      </FieldLabel>
      <p class="text-xs text-muted-foreground">
        Each option can have text, an image, or both.
        {{ f.values.type === 'mrq' ? 'Click to toggle correct answers.' : '' }}
      </p>
      <FieldError v-if="f.errors.value.options" :errors="[f.errors.value.options]" />
    </Field>

    <div v-for="option in f.values.options" :key="option.id" class="space-y-2">
      <div class="flex items-start gap-2">
        <Button
          type="button"
          :variant="option.isCorrect ? 'default' : 'outline'"
          size="sm"
          class="mt-1 w-8 shrink-0"
          :disabled="f.isSaving.value"
          @click="
            f.values.type === 'mcq'
              ? f.setCorrectOption(option.id)
              : f.toggleCorrectOption(option.id)
          "
        >
          {{ option.id.toUpperCase() }}
        </Button>
        <div class="flex-1 space-y-2">
          <Input
            :model-value="option.text ?? ''"
            :placeholder="`Option ${option.id.toUpperCase()} text`"
            :disabled="f.isSaving.value"
            @update:model-value="f.updateOptionText(option.id, $event as string)"
          />
          <div v-if="option.imagePath" class="relative inline-block">
            <img
              :src="getOptionImageSrc(option)"
              :alt="`Option ${option.id.toUpperCase()} image`"
              class="max-h-24 rounded border object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              class="absolute -right-2 -top-2 size-5"
              :disabled="f.isSaving.value"
              @click="f.removeOptionImage(option.id)"
            >
              <X class="size-3" />
            </Button>
          </div>
          <div v-else class="flex gap-2">
            <input
              :ref="(el) => (f.optionImageInputRefs.value[option.id] = el as HTMLInputElement)"
              type="file"
              accept="image/*"
              class="hidden"
              @change="f.handleOptionImageUpload($event, option.id)"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="f.isSaving.value"
              @click="f.optionImageInputRefs.value[option.id]?.click()"
            >
              <ImagePlus class="mr-1 size-3" />
              Add Image
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Short Answer -->
  <VeeField
    v-else-if="f.values.type === 'short_answer'"
    v-slot="{ value, handleChange, handleBlur, errors: fieldErrors }"
    name="answer"
  >
    <Field :data-invalid="!!fieldErrors.length">
      <FieldLabel> Answer <span class="text-destructive">*</span> </FieldLabel>
      <Input
        :model-value="value"
        @update:model-value="handleChange"
        @blur="handleBlur"
        placeholder="Enter the correct answer"
        :disabled="f.isSaving.value"
        :aria-invalid="!!fieldErrors.length"
        :class="{ 'border-destructive': !!fieldErrors.length }"
      />
      <FieldError :errors="fieldErrors" />
    </Field>
  </VeeField>

  <!-- Explanation -->
  <VeeField v-slot="{ value, handleChange, handleBlur }" name="explanation">
    <Field>
      <FieldLabel>Explanation (Optional)</FieldLabel>
      <Textarea
        :model-value="value"
        @update:model-value="handleChange"
        @blur="handleBlur"
        placeholder="Explain the answer"
        rows="2"
        :disabled="f.isSaving.value"
      />
    </Field>
  </VeeField>
</template>
