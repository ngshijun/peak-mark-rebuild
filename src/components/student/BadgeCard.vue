<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/composables/useT'
import { useAuthStore } from '@/stores/auth'
import { tierConfig, type Badge, type BadgeProgress } from '@/stores/badges'
import { Lock, CirclePoundSterling } from 'lucide-vue-next'
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

const SUB_TIER_ORDER: Record<SubscriptionTier, number> = {
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
    SUB_TIER_ORDER[studentSubscriptionTier.value] < SUB_TIER_ORDER[props.badge.required_tier],
)

const state = computed<BadgeCardState>(() => {
  if (props.unlocked) return 'unlocked'
  if (isTierGatedLocked.value) return 'tier-gated'
  if (props.progress) return 'locked-progress'
  return 'locked'
})

const cfg = computed(() => tierConfig[props.badge.tier])

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
  return badges[slug] ?? { name: slug, description: '' }
})
</script>

<template>
  <div
    class="relative flex flex-col items-center rounded-lg border px-2 pb-2 pt-3 transition-all"
    :class="[
      state === 'unlocked' || state === 'locked-progress'
        ? [cfg.bgColor, cfg.borderColor]
        : 'border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-muted',
    ]"
  >
    <!-- Badge icon -->
    <div class="flex aspect-square w-full items-center justify-center">
      <img
        :src="badge.icon_path"
        :alt="badgeStrings.name"
        loading="lazy"
        class="size-full object-contain"
        :class="{ 'brightness-0 opacity-20': state !== 'unlocked' }"
      />
    </div>

    <!-- Name -->
    <p
      class="mt-1 text-center text-xs font-medium leading-tight"
      :class="state === 'unlocked' ? cfg.textColor : 'text-gray-400 dark:text-gray-600'"
    >
      {{ badgeStrings.name }}
    </p>

    <!-- Description -->
    <p
      v-if="badgeStrings.description"
      class="mt-0.5 text-center text-[10px] leading-tight text-muted-foreground line-clamp-2"
    >
      {{ badgeStrings.description }}
    </p>

    <!-- Coin reward -->
    <div
      v-if="badge.coin_reward > 0"
      class="mt-1 flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
    >
      <CirclePoundSterling class="size-3" />
      <span>{{ t.student.achievements.coinReward(badge.coin_reward) }}</span>
    </div>

    <!-- Progress bar (locked-progress state) -->
    <div v-if="state === 'locked-progress' && progress" class="mt-1.5 w-full space-y-0.5">
      <div class="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          class="h-full bg-primary transition-all"
          :style="{ width: `${progress.progress_pct}%` }"
        />
      </div>
      <p class="text-center text-[10px] text-muted-foreground">
        {{ t.student.achievements.progressText(progress.current_value, progress.target_value) }}
      </p>
    </div>

    <!-- Locked (no progress data available) -->
    <p v-if="state === 'locked'" class="mt-1 text-center text-[10px] text-muted-foreground">
      {{ t.student.achievements.lockedText }}
    </p>

    <!-- Tier-gated overlay -->
    <div
      v-if="state === 'tier-gated'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-background/85"
    >
      <Lock class="size-5 text-muted-foreground" />
      <p class="text-[10px] font-medium">{{ requiredTierLabel }}</p>
      <p
        class="max-w-[8rem] text-center text-[9px] text-muted-foreground"
        :title="t.student.achievements.askParentTooltip"
      >
        {{ t.student.achievements.askParentTooltip }}
      </p>
    </div>
  </div>
</template>
