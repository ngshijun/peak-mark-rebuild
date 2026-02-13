<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Quote } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useLanguageStore } from '@/stores/language'

const { t } = storeToRefs(useLanguageStore())
</script>

<template>
  <section class="py-20">
    <div class="container mx-auto px-4">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <h2 class="mb-4 text-3xl font-bold md:text-4xl">{{ t.testimonials.title }}</h2>
        <p class="text-lg text-muted-foreground">
          {{ t.testimonials.subtitle }}
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card v-for="(testimonial, index) in t.testimonials.items" :key="index" class="relative">
          <CardContent class="pt-6">
            <Quote class="absolute right-4 top-4 size-8 text-muted-foreground/20" />
            <p class="mb-6 text-muted-foreground">{{ testimonial.quote }}</p>
            <div class="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{{ testimonial.initials }}</AvatarFallback>
              </Avatar>
              <div>
                <p class="font-medium">{{ testimonial.name }}</p>
                <p class="text-sm text-muted-foreground">{{ testimonial.role }}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>
