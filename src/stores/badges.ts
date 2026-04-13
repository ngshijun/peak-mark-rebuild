import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/stores/auth'
import { useCelebrationQueue } from '@/composables/useCelebrationQueue'
import type { Database } from '@/types/database.types'

export type Badge = Database['public']['Tables']['badges']['Row']
export type StudentBadge = Database['public']['Tables']['student_badges']['Row']
export type BadgeTier = Database['public']['Enums']['badge_tier']

export interface BadgeProgress {
  badge_id: string
  current_value: number
  target_value: number
  progress_pct: number
}

export const TIER_ORDER: BadgeTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'grandmaster',
]

export const tierConfig: Record<
  BadgeTier,
  {
    color: string
    bgColor: string
    borderColor: string
    textColor: string
  }
> = {
  bronze: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-300 dark:border-amber-800',
    textColor: 'text-amber-800 dark:text-amber-200',
  },
  silver: {
    color: 'text-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-900/30',
    borderColor: 'border-slate-300 dark:border-slate-700',
    textColor: 'text-slate-700 dark:text-slate-200',
  },
  gold: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-300 dark:border-yellow-800',
    textColor: 'text-yellow-800 dark:text-yellow-200',
  },
  platinum: {
    color: 'text-sky-500',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    borderColor: 'border-sky-300 dark:border-sky-800',
    textColor: 'text-sky-800 dark:text-sky-200',
  },
  diamond: {
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-300 dark:border-cyan-800',
    textColor: 'text-cyan-800 dark:text-cyan-200',
  },
  master: {
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-300 dark:border-purple-800',
    textColor: 'text-purple-800 dark:text-purple-200',
  },
  grandmaster: {
    color: 'text-rose-500',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-300 dark:border-rose-800',
    textColor: 'text-rose-800 dark:text-rose-200',
  },
}

export const useBadgesStore = defineStore('badges', () => {
  const catalog = shallowRef<Badge[]>([])
  const unlocked = ref<StudentBadge[]>([])
  const progress = ref<BadgeProgress[]>([])
  const isLoading = ref(false)
  const hasLoaded = ref(false)
  const error = ref<string | null>(null)

  const authStore = useAuthStore()
  const celebrationQueue = useCelebrationQueue()

  // Lookup: badge by id for fast access from student_badges rows
  const catalogById = computed(() => {
    const m = new Map<string, Badge>()
    for (const b of catalog.value) m.set(b.id, b)
    return m
  })

  // Unread indicator: count of unlocks with seen_at = null
  const unreadCount = computed(() => unlocked.value.filter((u) => u.seen_at === null).length)

  // Top 3 badges closest to unlock (excluding tier-gated)
  const closestUnlockable = computed<BadgeProgress[]>(() => {
    return [...progress.value]
      .filter((p) => p.progress_pct < 100)
      .sort((a, b) => b.progress_pct - a.progress_pct)
      .slice(0, 3)
  })

  async function loadAll(): Promise<void> {
    if (!authStore.user) return
    isLoading.value = true
    error.value = null

    try {
      const [catalogRes, unlockedRes, progressRes] = await Promise.all([
        supabase.from('badges').select('*').eq('is_active', true).order('created_at'),
        supabase.from('student_badges').select('*').eq('student_id', authStore.user.id),
        supabase.rpc('get_student_badge_progress', {
          p_student_id: authStore.user.id,
        }),
      ])

      if (catalogRes.error) throw catalogRes.error
      if (unlockedRes.error) throw unlockedRes.error
      if (progressRes.error) throw progressRes.error

      catalog.value = catalogRes.data ?? []
      unlocked.value = unlockedRes.data ?? []
      progress.value = (progressRes.data ?? []) as BadgeProgress[]
      hasLoaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'failed to load badges'
    } finally {
      isLoading.value = false
    }
  }

  async function markAllSeen(): Promise<void> {
    if (!authStore.user) return
    const unread = unlocked.value.filter((u) => u.seen_at === null)
    if (unread.length === 0) return

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('student_badges')
      .update({ seen_at: now })
      .eq('student_id', authStore.user.id)
      .is('seen_at', null)

    if (!updateError) {
      // Mirror into local state
      for (const u of unread) u.seen_at = now
    }
  }

  /**
   * Called by store integrations (practice, pets) after RPC responses.
   * Updates the unlocked list and pushes each badge into the celebration queue.
   */
  function handleNewlyUnlocked(badges: Badge[]): void {
    if (!badges || badges.length === 0) return
    if (!authStore.user) return

    const now = new Date().toISOString()
    // Collect any badges not already in the catalog cache, then reassign
    // catalog in one shot — shallowRef only tracks .value replacement, not
    // in-place mutations like .push().
    const unfamiliar = badges.filter((b) => !catalogById.value.has(b.id))
    if (unfamiliar.length > 0) {
      catalog.value = [...catalog.value, ...unfamiliar]
    }
    for (const b of badges) {
      // Insert into local unlocked list (unseen — dialog is the "seeing")
      unlocked.value.push({
        student_id: authStore.user.id,
        badge_id: b.id,
        unlocked_at: now,
        seen_at: null,
      })
    }

    celebrationQueue.enqueue(badges.map((badge) => ({ type: 'badgeUnlock' as const, badge })))
  }

  async function refreshProgress(): Promise<void> {
    if (!authStore.user) return
    const { data, error: rpcError } = await supabase.rpc('get_student_badge_progress', {
      p_student_id: authStore.user.id,
    })
    if (!rpcError) {
      progress.value = (data ?? []) as BadgeProgress[]
    }
  }

  function reset(): void {
    catalog.value = []
    unlocked.value = []
    progress.value = []
    hasLoaded.value = false
    isLoading.value = false
    error.value = null
  }

  return {
    catalog,
    unlocked,
    progress,
    isLoading,
    hasLoaded,
    error,
    catalogById,
    unreadCount,
    closestUnlockable,
    loadAll,
    markAllSeen,
    handleNewlyUnlocked,
    refreshProgress,
    reset,
  }
})
