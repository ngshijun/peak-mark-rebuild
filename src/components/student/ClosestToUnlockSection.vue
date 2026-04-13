<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/composables/useT'
import { useBadgesStore } from '@/stores/badges'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import BadgeCard from '@/components/student/BadgeCard.vue'

const t = useT()
const badgesStore = useBadgesStore()

const top3 = computed(() => badgesStore.closestUnlockable)

const top3WithBadges = computed(() =>
  top3.value
    .map((p) => {
      const badge = badgesStore.catalogById.get(p.badge_id)
      return badge ? { badge, progress: p } : null
    })
    .filter(
      (x): x is { badge: NonNullable<typeof x>['badge']; progress: (typeof top3.value)[number] } =>
        x !== null,
    ),
)

const hasAnyProgress = computed(() => top3WithBadges.value.length > 0)
</script>

<template>
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-base">{{ t.student.achievements.closestToUnlock }}</CardTitle>
      <CardDescription v-if="!hasAnyProgress">
        {{ t.student.achievements.emptyState }}
      </CardDescription>
    </CardHeader>
    <CardContent v-if="hasAnyProgress">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BadgeCard
          v-for="entry in top3WithBadges"
          :key="entry.badge.id"
          :badge="entry.badge"
          :unlocked="false"
          :progress="entry.progress"
        />
      </div>
    </CardContent>
  </Card>
</template>
