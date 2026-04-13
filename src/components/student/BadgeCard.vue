<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/composables/useT'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Lock } from 'lucide-vue-next'
import type { Badge, BadgeProgress } from '@/stores/badges'
import type { Database } from '@/types/database.types'

type SubscriptionTier = Database['public']['Enums']['subscription_tier']

type BadgeCardState = 'unlocked' | 'tier-gated' | 'locked-progress' | 'locked'

const props = defineProps<{
  badge: Badge
  unlocked: boolean
  unlockedAt?: string | null
  progress?: BadgeProgress | null
}>()

const t = useT()
const authStore = useAuthStore()

// Subscription tier ordering for direct numeric comparison in the UI
const TIER_ORDER: Record<SubscriptionTier, number> = {
  core: 0,
  plus: 1,
  pro: 2,
  max: 3,
}

const studentSubscriptionTier = computed<SubscriptionTier>(
  () => authStore.user?.studentProfile?.subscriptionTier ?? 'core',
)

const isTierGatedLocked = computed(
  () =>
    !props.unlocked &&
    TIER_ORDER[studentSubscriptionTier.value] < TIER_ORDER[props.badge.required_tier],
)

const state = computed<BadgeCardState>(() => {
  if (props.unlocked) return 'unlocked'
  if (isTierGatedLocked.value) return 'tier-gated'
  if (props.progress) return 'locked-progress'
  return 'locked'
})

const tierColorClass = computed(() => {
  // Tailwind classes for badge tier — starting palette, can be tuned later
  switch (props.badge.tier) {
    case 'bronze':
      return 'border-amber-700 ring-amber-700/30'
    case 'silver':
      return 'border-slate-400 ring-slate-400/30'
    case 'gold':
      return 'border-yellow-500 ring-yellow-500/30'
    case 'platinum':
      return 'border-sky-400 ring-sky-400/30'
    case 'diamond':
      return 'border-cyan-400 ring-cyan-400/30'
    case 'master':
      return 'border-purple-500 ring-purple-500/30'
    case 'grandmaster':
      return 'border-rose-500 ring-rose-500/30'
    default:
      return ''
  }
})

const requiredTierLabel = computed(() => {
  switch (props.badge.required_tier) {
    case 'plus':
      return t.value.student.achievements.requiresPlus
    case 'pro':
      return t.value.student.achievements.requiresPro
    case 'max':
      return t.value.student.achievements.requiresMax
    default:
      return ''
  }
})

const badgeStrings = computed(() => {
  const slug = props.badge.slug
  const badges = t.value.student.badges as Record<
    string,
    { name: string; description: string } | undefined
  >
  return (
    badges[slug] ?? {
      name: slug,
      description: '',
    }
  )
})
</script>

<template>
  <Card
    :class="[
      'relative border-2 ring-2 ring-offset-2 transition-opacity',
      tierColorClass,
      state === 'unlocked' ? '' : 'opacity-60 grayscale',
    ]"
  >
    <CardContent class="p-4 flex flex-col items-center gap-2 text-center">
      <img :src="badge.icon_path" :alt="badgeStrings.name" class="size-16" />
      <p class="font-semibold text-sm">{{ badgeStrings.name }}</p>
      <p class="text-xs text-muted-foreground">{{ badgeStrings.description }}</p>

      <!-- Tier-gated lock overlay -->
      <div
        v-if="state === 'tier-gated'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 rounded-lg"
      >
        <Lock class="size-6 text-muted-foreground" />
        <p class="text-xs font-medium">{{ requiredTierLabel }}</p>
        <p
          class="text-xs text-muted-foreground max-w-[10rem]"
          :title="t.student.achievements.askParentTooltip"
        >
          {{ t.student.achievements.askParentTooltip }}
        </p>
      </div>

      <!-- Progress bar for locked-progress variant -->
      <div v-else-if="state === 'locked-progress' && progress" class="w-full space-y-1">
        <div class="h-2 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full bg-primary transition-all"
            :style="{ width: `${progress.progress_pct}%` }"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          {{ t.student.achievements.progressText(progress.current_value, progress.target_value) }}
        </p>
      </div>

      <!-- Locked (no progress data) -->
      <p v-else-if="state === 'locked'" class="text-xs text-muted-foreground">
        {{ t.student.achievements.lockedText }}
      </p>
    </CardContent>
  </Card>
</template>
