<script setup lang="ts">
import { ref } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { storeToRefs } from 'pinia'
import { useLanguageStore } from '@/stores/language'
import { supabase } from '@/lib/supabaseClient'
import { contactFormSchema } from '@/lib/validations'
import { Loader2, Send } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { toast } from 'vue-sonner'

const { t } = storeToRefs(useLanguageStore())

const isSubmitting = ref(false)
const honeypot = ref('')

const { handleSubmit, resetForm, submitCount } = useForm({
  validationSchema: contactFormSchema,
  initialValues: { name: '', email: '', subject: '', message: '' },
})

const onSubmit = handleSubmit(async (formValues) => {
  if (honeypot.value) return // bot detected

  isSubmitting.value = true
  try {
    const { error } = await supabase.functions.invoke('send-contact-email', {
      body: { ...formValues, source: 'landing' },
    })
    if (error) throw error
    toast.success(t.value.contact.successMessage)
    resetForm()
  } catch {
    toast.error(t.value.contact.errorMessage)
  } finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <section class="border-t py-20">
    <div class="container mx-auto px-4">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <h2 class="mb-4 text-3xl font-bold md:text-4xl">
          {{ t.contact.title }}
        </h2>
        <p class="text-lg text-muted-foreground">
          {{ t.contact.subtitle }}
        </p>
      </div>

      <div class="mx-auto max-w-lg">
        <form class="space-y-4" @submit="onSubmit">
          <!-- Honeypot field -->
          <div class="absolute -z-10 opacity-0" aria-hidden="true">
            <input name="website" type="text" tabindex="-1" autocomplete="off" v-model="honeypot" />
          </div>

          <VeeField
            v-slot="{ field, errors }"
            :validate-on-blur="false"
            :validate-on-change="false"
            :validate-on-input="false"
            :validate-on-model-update="submitCount > 0"
            name="name"
          >
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="contact-name">
                {{ t.contact.name }} <span class="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="contact-name"
                type="text"
                :placeholder="t.contact.namePlaceholder"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField
            v-slot="{ field, errors }"
            :validate-on-blur="false"
            :validate-on-change="false"
            :validate-on-input="false"
            :validate-on-model-update="submitCount > 0"
            name="email"
          >
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="contact-email">
                {{ t.contact.email }} <span class="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="contact-email"
                type="email"
                :placeholder="t.contact.emailPlaceholder"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField
            v-slot="{ field, errors }"
            :validate-on-blur="false"
            :validate-on-change="false"
            :validate-on-input="false"
            :validate-on-model-update="submitCount > 0"
            name="subject"
          >
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="contact-subject">
                {{ t.contact.subject }} <span class="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="contact-subject"
                type="text"
                :placeholder="t.contact.subjectPlaceholder"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <VeeField
            v-slot="{ field, errors }"
            :validate-on-blur="false"
            :validate-on-change="false"
            :validate-on-input="false"
            :validate-on-model-update="submitCount > 0"
            name="message"
          >
            <Field :data-invalid="!!errors.length">
              <FieldLabel for="contact-message">
                {{ t.contact.message }} <span class="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="contact-message"
                :placeholder="t.contact.messagePlaceholder"
                :disabled="isSubmitting"
                :aria-invalid="!!errors.length"
                class="min-h-32"
                v-bind="field"
              />
              <FieldError :errors="errors" />
            </Field>
          </VeeField>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            <Loader2 v-if="isSubmitting" class="mr-2 size-4 animate-spin" />
            <Send v-else class="mr-2 size-4" />
            {{ isSubmitting ? t.contact.submitting : t.contact.submit }}
          </Button>
        </form>
      </div>
    </div>
  </section>
</template>
