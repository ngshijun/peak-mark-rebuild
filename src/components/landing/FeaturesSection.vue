<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BookOpen,
  BarChart3,
  Trophy,
  Users,
  GraduationCap,
  MessageSquareText,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useLanguageStore } from '@/stores/language'

const { t } = storeToRefs(useLanguageStore())

const featureIcons = [GraduationCap, BookOpen, MessageSquareText, BarChart3, Trophy, Users]
</script>

<template>
  <section class="border-t bg-muted/30 py-20">
    <div class="container mx-auto px-4">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <h2 class="mb-4 text-3xl font-bold md:text-4xl">{{ t.features.title }}</h2>
        <p class="text-lg text-muted-foreground">
          {{ t.features.subtitle }}
        </p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="(feature, index) in t.features.items"
          :key="index"
          class="border-0 bg-background"
        >
          <CardHeader>
            <div class="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <component :is="featureIcons[index]" class="size-6 text-primary" />
            </div>
            <CardTitle class="text-xl">{{ feature.title }}</CardTitle>
            <CardDescription class="text-base">{{ feature.description }}</CardDescription>
          </CardHeader>
          <div class="px-6 pb-6">
            <div
              class="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50"
            >
              <p class="text-xs text-muted-foreground">Screenshot</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </section>
</template>
