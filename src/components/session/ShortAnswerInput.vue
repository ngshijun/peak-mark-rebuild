<script setup lang="ts">
import { CheckCircle2, XCircle } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'

defineProps<{
  modelValue: string
  isAnswered: boolean
  isCorrect: boolean | null
  correctAnswer: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()
</script>

<template>
  <div class="space-y-2">
    <Input
      :model-value="modelValue"
      placeholder="Type your answer..."
      :disabled="isAnswered"
      class="text-lg"
      @update:model-value="emit('update:modelValue', $event as string)"
      @keyup.enter="!isAnswered && emit('submit')"
    />
    <div v-if="isAnswered" class="mt-4 rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <CheckCircle2 v-if="isCorrect" class="size-5 text-green-500" />
        <XCircle v-else class="size-5 text-red-500" />
        <span class="font-medium">
          {{ isCorrect ? 'Correct!' : 'Incorrect' }}
        </span>
      </div>
      <p v-if="!isCorrect" class="mt-2 text-sm text-muted-foreground">
        The correct answer is:
        <span class="font-medium text-foreground">{{ correctAnswer }}</span>
      </p>
    </div>
  </div>
</template>
