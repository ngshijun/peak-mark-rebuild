<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/composables/useT'
import { useBadgesStore, TIER_ORDER, tierConfig } from '@/stores/badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import BadgeCard from '@/components/student/BadgeCard.vue'
import type { Badge as BadgeRow, BadgeProgress } from '@/stores/badges'
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

const groupedByTier = computed<Record<BadgeTier, BadgeRow[]>>(() => {
  const groups = {
    bronze: [],
    silver: [],
    gold: [],
    platinum: [],
    diamond: [],
    master: [],
    grandmaster: [],
  } as Record<BadgeTier, BadgeRow[]>
  for (const b of badgesStore.catalog) {
    groups[b.tier].push(b)
  }
  return groups
})

function unlockedCountFor(tier: BadgeTier): number {
  return groupedByTier.value[tier].filter((b) => unlockedIdSet.value.has(b.id)).length
}
</script>

<template>
  <div class="space-y-6">
    <template v-for="tier in TIER_ORDER" :key="tier">
      <Card v-if="groupedByTier[tier].length > 0">
        <CardHeader class="pb-3">
          <div class="flex items-center justify-between">
            <CardTitle class="flex items-center gap-2 text-base" :class="tierConfig[tier].color">
              {{ t.student.achievements.tierSections[tier] }}
            </CardTitle>
            <Badge variant="outline" :class="tierConfig[tier].color">
              {{ unlockedCountFor(tier) }} / {{ groupedByTier[tier].length }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <BadgeCard
              v-for="badge in groupedByTier[tier]"
              :key="badge.id"
              :badge="badge"
              :unlocked="unlockedIdSet.has(badge.id)"
              :unlocked-at="unlockedAtMap.get(badge.id) ?? null"
              :progress="progressMap.get(badge.id) ?? null"
            />
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
