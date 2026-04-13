<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/composables/useT'
import { useBadgesStore, TIER_ORDER } from '@/stores/badges'
import BadgeCard from '@/components/student/BadgeCard.vue'
import type { Badge, BadgeProgress } from '@/stores/badges'
import type { Database } from '@/types/database.types'

type BadgeTier = Database['public']['Enums']['badge_tier']

const t = useT()
const badgesStore = useBadgesStore()

const unlockedIdSet = computed(() => new Set(badgesStore.unlocked.map((u) => u.badge_id)))

const unlockedAtMap = computed(() => {
  const m = new Map<string, string>()
  for (const u of badgesStore.unlocked) m.set(u.badge_id, u.unlocked_at)
  return m
})

const progressMap = computed(() => {
  const m = new Map<string, BadgeProgress>()
  for (const p of badgesStore.progress) m.set(p.badge_id, p)
  return m
})

const groupedByTier = computed<Record<BadgeTier, Badge[]>>(() => {
  const groups = {
    bronze: [],
    silver: [],
    gold: [],
    platinum: [],
    diamond: [],
    master: [],
    grandmaster: [],
  } as Record<BadgeTier, Badge[]>

  for (const b of badgesStore.catalog) {
    groups[b.tier].push(b)
  }
  return groups
})
</script>

<template>
  <div class="space-y-8">
    <section v-for="tier in TIER_ORDER" :key="tier" v-show="groupedByTier[tier].length > 0">
      <h2 class="text-lg font-semibold mb-3">
        {{ t.student.achievements.tierSections[tier] }}
      </h2>
      <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <BadgeCard
          v-for="badge in groupedByTier[tier]"
          :key="badge.id"
          :badge="badge"
          :unlocked="unlockedIdSet.has(badge.id)"
          :unlocked-at="unlockedAtMap.get(badge.id) ?? null"
          :progress="progressMap.get(badge.id) ?? null"
        />
      </div>
    </section>
  </div>
</template>
