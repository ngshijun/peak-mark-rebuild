<script setup lang="ts">
import { shallowRef, watch, computed } from 'vue'
import { type DateValue, getLocalTimeZone, today, parseDate } from '@internationalized/date'
import { createYearRange } from 'reka-ui/date'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  currentDateOfBirth: string | null
  isSaving: boolean
}>()

const emit = defineEmits<{
  save: [dateString: string | null]
}>()

const open = defineModel<boolean>('open', { required: true })

const dateValue = shallowRef<DateValue | undefined>(undefined)

const maxDate = computed(() => today(getLocalTimeZone()))

const yearRange = computed(() => {
  const now = today(getLocalTimeZone())
  return createYearRange({
    start: now.cycle('year', -100),
    end: now,
  }).reverse()
})

watch(open, (isOpen) => {
  if (isOpen) {
    if (props.currentDateOfBirth) {
      const dateStr = props.currentDateOfBirth.split('T')[0]
      dateValue.value = dateStr ? parseDate(dateStr) : undefined
    } else {
      dateValue.value = undefined
    }
  }
})

function handleSave() {
  emit('save', dateValue.value?.toString() ?? null)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit Birthday</DialogTitle>
        <DialogDescription>Select your date of birth.</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <Field>
          <FieldLabel>Birthday</FieldLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                class="w-full justify-start text-left font-normal"
                :class="{ 'text-muted-foreground': !dateValue }"
                :disabled="isSaving"
              >
                <CalendarIcon class="mr-2 size-4" />
                <span v-if="dateValue">
                  {{
                    new Date(dateValue.toString()).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  }}
                </span>
                <span v-else>Pick a date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar
                :model-value="dateValue"
                :max-value="maxDate"
                :year-range="yearRange"
                layout="month-and-year"
                initial-focus
                @update:model-value="(v) => (dateValue = v)"
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isSaving" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="isSaving" @click="handleSave">
          <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
