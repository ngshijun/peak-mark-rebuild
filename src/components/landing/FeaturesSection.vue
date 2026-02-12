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

const features = [
  {
    icon: GraduationCap,
    title: 'Aligned with SJKC Curriculum',
    description: 'All content is aligned with KSSR Malaysian curriculum standard.',
  },
  {
    icon: BookOpen,
    title: 'Interactive Practice',
    description:
      'Quick 5-10 minute quiz sessions with MCQ and MRQ questions across various subjects and topics.',
  },
  {
    icon: MessageSquareText,
    title: 'Instant Feedback',
    description: 'Improve from mistakes with immediate explanations and answers.',
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description:
      'View detailed statistics, practice history, and performance analytics. Identify strengths and areas for improvement.',
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

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
