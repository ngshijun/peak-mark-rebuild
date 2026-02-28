<script setup lang="ts">
import { ref, computed } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { supabase } from '@/lib/supabaseClient'
import { contactMessageSchema } from '@/lib/validations'
import { Loader2, Send } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const isSubmitting = ref(false)

const isPriority = computed(() =>
  subscriptionStore.childSubscriptions.some((sub) => sub.tier !== 'core'),
)

const { handleSubmit, resetForm, submitCount } = useForm({
  validationSchema: contactMessageSchema,
  initialValues: {
    subject: '',
    message: '',
  },
})

const onSubmit = handleSubmit(async (formValues) => {
  isSubmitting.value = true
  try {
    const { error } = await supabase.functions.invoke('send-contact-email', {
      body: {
        name: authStore.user?.name ?? '',
        email: authStore.user?.email ?? '',
        ...formValues,
        source: 'app',
        priority: isPriority.value,
      },
    })
    if (error) throw error
    toast.success("Message sent successfully! We'll get back to you soon.")
    resetForm()
  } catch {
    toast.error('Failed to send message. Please try again later.')
  } finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold">Contact Us</h1>
      <p class="text-muted-foreground">Have a question or feedback? We'd love to hear from you.</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Send us a message</CardTitle>
        <CardDescription>We typically respond within 24 hours.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit="onSubmit">
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
                Subject <span class="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="contact-subject"
                type="text"
                placeholder="What is this about?"
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
                Message <span class="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="contact-message"
                placeholder="Tell us what's on your mind..."
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
            {{ isSubmitting ? 'Sending...' : 'Send Message' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
