<script setup lang="ts">
import PublicHeader from '@/components/landing/PublicHeader.vue'
import HeroSection from '@/components/landing/HeroSection.vue'
import FeaturesSection from '@/components/landing/FeaturesSection.vue'
import TestimonialsSection from '@/components/landing/TestimonialsSection.vue'
import PricingSection from '@/components/landing/PricingSection.vue'
import FooterSection from '@/components/landing/FooterSection.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <PublicHeader />
    <main class="flex-1">
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
    </main>
    <FooterSection />
  </div>
</template>
