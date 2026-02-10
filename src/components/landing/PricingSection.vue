<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-vue-next'

const plans = [
  {
    name: 'Core',
    price: 'Free',
    description: 'Perfect for getting started',
    features: [
      '3 daily practice sessions',
      'All subjects & topics',
      'Track your learning progress',
      'Collect & evolve cute pets',
      'Compete on the weekly leaderboard',
    ],
    popular: false,
  },
  {
    name: 'Plus',
    price: 'RM 9.99',
    period: '/month',
    description: 'For dedicated learners',
    features: [
      '10 daily practice sessions',
      'All subjects & topics',
      'Track your learning progress',
      'Collect & evolve cute pets',
      'Compete on the weekly leaderboard',
    ],
    popular: false,
  },
  {
    name: 'Pro',
    price: 'RM 19.99',
    period: '/month',
    description: 'For serious students',
    features: [
      '20 daily practice sessions',
      'All subjects & topics',
      'Review mistakes with full explanations',
      'Collect & evolve cute pets',
      'Compete on the weekly leaderboard',
      'Priority email support',
    ],
    popular: true,
  },
  {
    name: 'Max',
    price: 'RM 29.99',
    period: '/month',
    description: 'Ultimate learning experience',
    features: [
      '30 daily practice sessions',
      'All subjects & topics',
      'Review mistakes with full explanations',
      'Collect & evolve cute pets',
      'Compete on the weekly leaderboard',
      'AI-powered feedback after every session',
      'Priority email support',
    ],
    popular: false,
  },
]
</script>

<template>
  <section class="border-t bg-muted/30 py-20">
    <div class="container mx-auto px-4">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <h2 class="mb-4 text-3xl font-bold md:text-4xl">Simple, Transparent Pricing</h2>
        <p class="text-lg text-muted-foreground">
          Choose the plan that fits your learning needs. Start free, upgrade anytime.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card
          v-for="plan in plans"
          :key="plan.name"
          :class="['relative flex flex-col', plan.popular ? 'border-primary shadow-lg' : '']"
        >
          <Badge v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2">
            Most Popular
          </Badge>
          <CardHeader>
            <CardTitle>{{ plan.name }}</CardTitle>
            <CardDescription>{{ plan.description }}</CardDescription>
            <div class="mt-4">
              <span class="text-3xl font-bold">{{ plan.price }}</span>
              <span v-if="plan.period" class="text-muted-foreground">{{ plan.period }}</span>
            </div>
          </CardHeader>
          <CardContent class="flex flex-1 flex-col">
            <ul class="mb-6 flex-1 space-y-3">
              <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-2">
                <Check class="size-4 text-primary" />
                <span class="text-sm">{{ feature }}</span>
              </li>
            </ul>
            <Button :variant="plan.popular ? 'default' : 'outline'" class="w-full" as-child>
              <RouterLink to="/signup">Get Started</RouterLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>
