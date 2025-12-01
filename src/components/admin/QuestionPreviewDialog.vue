<script setup lang="ts">
import { computed } from 'vue'
import type { Question } from '@/stores/questions'
import { useQuestionsStore } from '@/stores/questions'
import { CheckCircle2 } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  question: Question | null
}>()

const open = defineModel<boolean>('open', { required: true })

const questionsStore = useQuestionsStore()

const correctAnswer = computed(() => {
  if (!props.question) return ''
  if (props.question.type === 'mcq') {
    const correct = props.question.options.find((o) => o.isCorrect)
    return correct ? `${correct.id.toUpperCase()}. ${correct.text || '(Image)'}` : 'N/A'
  }
  return props.question.answer ?? 'N/A'
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          Question Preview
          <Badge v-if="question" variant="secondary">
            {{ question.type === 'mcq' ? 'Multiple Choice' : 'Short Answer' }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div v-if="question" class="space-y-6">
        <!-- Question Metadata -->
        <div class="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{{ question.gradeLevelName }}</Badge>
          <Badge variant="outline">{{ question.subjectName }}</Badge>
          <Badge variant="outline">{{ question.topicName }}</Badge>
        </div>

        <!-- Question Text -->
        <div class="space-y-2">
          <h3 class="font-semibold">Question</h3>
          <p class="text-foreground">{{ question.question }}</p>
        </div>

        <!-- Question Image -->
        <div v-if="question.imagePath" class="space-y-2">
          <h3 class="font-semibold">Question Image</h3>
          <img
            :src="questionsStore.getQuestionImageUrl(question.imagePath)"
            alt="Question image"
            class="max-h-48 rounded-lg border object-contain"
          />
        </div>

        <!-- MCQ Options -->
        <div v-if="question.type === 'mcq'" class="space-y-2">
          <h3 class="font-semibold">Options</h3>
          <div class="space-y-2">
            <div
              v-for="option in question.options"
              :key="option.id"
              class="flex items-center gap-3 rounded-lg border p-3 transition-colors"
              :class="{
                'border-green-500 bg-green-50 dark:bg-green-950/20': option.isCorrect,
              }"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full border font-medium"
                :class="{
                  'border-green-500 bg-green-500 text-white': option.isCorrect,
                }"
              >
                {{ option.id.toUpperCase() }}
              </span>
              <div class="flex flex-1 items-center gap-2">
                <span v-if="option.text">{{ option.text }}</span>
                <img
                  v-if="option.imagePath"
                  :src="questionsStore.getQuestionImageUrl(option.imagePath)"
                  :alt="`Option ${option.id.toUpperCase()}`"
                  class="max-h-16 rounded border object-contain"
                />
                <span v-if="!option.text && !option.imagePath" class="text-muted-foreground italic">
                  (Empty option)
                </span>
              </div>
              <CheckCircle2 v-if="option.isCorrect" class="size-5 shrink-0 text-green-500" />
            </div>
          </div>
        </div>

        <!-- Short Answer -->
        <div v-else class="space-y-2">
          <h3 class="font-semibold">Correct Answer</h3>
          <div class="rounded-lg border border-green-500 bg-green-50 p-3 dark:bg-green-950/20">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="size-5 shrink-0 text-green-500" />
              <span class="font-medium">{{ question.answer || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Explanation -->
        <div v-if="question.explanation" class="space-y-2">
          <h3 class="font-semibold">Explanation</h3>
          <div
            class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
          >
            <p class="text-sm text-amber-700 dark:text-amber-300">
              {{ question.explanation }}
            </p>
          </div>
        </div>

        <!-- No explanation message -->
        <div v-else class="space-y-2">
          <h3 class="font-semibold">Explanation</h3>
          <p class="text-sm text-muted-foreground italic">No explanation provided.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
