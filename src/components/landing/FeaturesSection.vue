<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen, BarChart3, Trophy, Users } from 'lucide-vue-next'

const features = [
  {
    icon: BookOpen,
    title: 'Interactive Practice',
    description:
      'Engage with MCQ and MRQ questions across various subjects. Track your progress through each topic and sub-topic.',
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description:
      'View detailed statistics, session history, and performance analytics. Identify strengths and areas for improvement.',
  },
  {
    icon: Trophy,
    title: 'Gamification & Rewards',
    description:
      'Earn XP, coins, and food. Collect and evolve cute pets through the gacha system. Compete on the leaderboard.',
  },
  {
    icon: Users,
    title: 'Parent Dashboard',
    description:
      'Parents can link with children, monitor their progress, view detailed statistics, and manage subscriptions.',
  },
]
</script>

<template>
  <section class="border-t bg-muted/30 py-20">
    <div class="container mx-auto px-4">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <h2 class="mb-4 text-3xl font-bold md:text-4xl">Everything You Need to Excel</h2>
        <p class="text-lg text-muted-foreground">
          A comprehensive learning platform designed to make studying effective and enjoyable.
        </p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card v-for="feature in features" :key="feature.title" class="border-0 bg-background">
          <CardHeader>
            <div class="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <component :is="feature.icon" class="size-6 text-primary" />
            </div>
            <CardTitle class="text-xl">{{ feature.title }}</CardTitle>
            <CardDescription class="text-base">{{ feature.description }}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  </section>
</template>
