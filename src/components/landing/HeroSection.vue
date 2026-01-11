<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-vue-next'
</script>

<template>
  <section class="relative overflow-hidden py-20 md:py-32">
    <div class="container mx-auto px-4">
      <div class="mx-auto max-w-3xl text-center">
        <div class="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
          <Sparkles class="size-4 text-primary" />
          <span>Make learning fun and rewarding</span>
        </div>

        <h1 class="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Master Your Studies with
          <span class="text-primary">Peak Mark</span>
        </h1>

        <p class="mb-8 text-lg text-muted-foreground md:text-xl">
          An engaging learning platform where students practice, earn rewards, collect pets, and track their progress.
          Parents can monitor their children's learning journey in real-time.
        </p>

        <div class="flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" as-child>
            <RouterLink to="/signup">Get Started Free</RouterLink>
          </Button>
          <Button size="lg" variant="outline" as-child>
            <RouterLink to="/login">I Have an Account</RouterLink>
          </Button>
        </div>
      </div>
    </div>

    <!-- Background decoration -->
    <div class="absolute inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div class="absolute -bottom-40 left-1/4 size-60 rounded-full bg-primary/5 blur-3xl" />
      <div class="absolute -bottom-20 right-1/4 size-40 rounded-full bg-primary/10 blur-3xl" />
    </div>
  </section>
</template>
