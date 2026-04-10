<script setup lang="ts">
import { useForm, Field as VeeField } from 'vee-validate'
import { inviteEmailFormSchema } from '@/lib/validations'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserPlus, Send, Loader2 } from 'lucide-vue-next'
import { useT } from '@/composables/useT'

const t = useT()

const props = defineProps<{
  open: boolean
  entityLabel: string // "Parent" or "Child"
  isSending: boolean
  inviteSuccess: boolean
  triggerDisabled?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [email: string]
  reset: []
}>()

const { handleSubmit, resetForm, setFieldError } = useForm({
  validationSchema: inviteEmailFormSchema,
  initialValues: {
    email: '',
  },
})

const onSubmit = handleSubmit((values) => {
  emit('submit', values.email.trim())
})

function handleOpenChange(value: boolean) {
  emit('update:open', value)
  if (!value) {
    resetForm()
    emit('reset')
  }
}

defineExpose({ setFieldError })
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogTrigger as-child>
      <Button :disabled="triggerDisabled">
        <UserPlus class="mr-2 size-4" />
        {{ t.shared.inviteDialog.inviteButton(entityLabel) }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t.shared.inviteDialog.title(entityLabel) }}</DialogTitle>
        <DialogDescription>
          <slot name="description">
            {{ t.shared.inviteDialog.defaultDescription(entityLabel) }}
          </slot>
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit="onSubmit">
        <VeeField v-slot="{ field, errors }" name="email">
          <Field :data-invalid="!!errors.length">
            <FieldLabel :for="`${entityLabel.toLowerCase()}Email`">
              {{ t.shared.inviteDialog.emailLabel(entityLabel) }}
              <span class="text-destructive">*</span>
            </FieldLabel>
            <Input
              :id="`${entityLabel.toLowerCase()}Email`"
              type="email"
              :placeholder="t.shared.inviteDialog.emailPlaceholder(entityLabel)"
              :disabled="isSending"
              :aria-invalid="!!errors.length"
              v-bind="field"
            />
            <FieldError :errors="errors" />
            <p v-if="inviteSuccess" class="text-sm text-green-600">
              {{ t.shared.inviteDialog.invitationSent }}
            </p>
          </Field>
        </VeeField>
        <DialogFooter>
          <Button type="submit" :disabled="isSending || inviteSuccess">
            <Loader2 v-if="isSending" class="mr-2 size-4 animate-spin" />
            <Send v-else class="mr-2 size-4" />
            {{ isSending ? t.shared.inviteDialog.sending : t.shared.inviteDialog.sendInvitation }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
