<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/composables/useT'
import { useBadgesStore } from '@/stores/badges'
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
  <section>
    <h2 class="text-lg font-semibold mb-3">
      {{ t.student.achievements.closestToUnlock }}
    </h2>

    <div v-if="hasAnyProgress" class="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <BadgeCard
        v-for="entry in top3WithBadges"
        :key="entry.badge.id"
        :badge="entry.badge"
        :unlocked="false"
        :progress="entry.progress"
      />
    </div>

    <p v-else class="text-sm text-muted-foreground">
      {{ t.student.achievements.emptyState }}
    </p>
  </section>
</template>
