import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { useSubscriptionStore } from './subscription'
import { handleError, errorMessages } from '@/lib/errors'

import { useInvitations } from '@/composables/useInvitations'

export type { ParentStudentInvitation } from '@/lib/invitations'

export interface LinkedChild {
  id: string
  name: string
  email: string
  gradeLevelName: string | null
  avatarPath: string | null
  linkedAt: string
  xp: number
  currentStreak: number
  lastActive: string | null
}

export const useChildLinkStore = defineStore('childLink', () => {
  const authStore = useAuthStore()

  const linkedChildren = ref<LinkedChild[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const inv = useInvitations('parent', {
    canSend: (email) =>
      linkedChildren.value.some((c) => c.email.toLowerCase() === email.toLowerCase())
        ? errorMessages().childAlreadyLinked
        : null,
    onAccepted: (result) => {
      linkedChildren.value.push({
        id: result.student_id,
        name: result.student_name,
        email: result.student_email,
        avatarPath: result.student_avatar_path,
        gradeLevelName: result.student_grade_level_name,
        linkedAt: result.linked_at,
        xp: 0,
        currentStreak: 0,
        lastActive: null,
      })
    },
  })

  /**
   * Fetch linked children for current parent
   * Uses a single query with joins for better performance
   */
  async function fetchLinkedChildren(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: errorMessages().notAuthenticatedAsParent }
    }

    isLoading.value = true
    error.value = null

    try {
      const { data: linksData, error: linksError } = await supabase
        .from('parent_student_links')
        .select(
          `
          id,
          student_id,
          linked_at,
          profiles!parent_student_links_student_id_fkey (
            id,
            name,
            email,
            avatar_path,
            student_profiles (
              grade_level_id,
              xp,
              coins,
              current_streak,
              updated_at,
              grade_levels (
                name
              )
            )
          )
        `,
        )
        .eq('parent_id', authStore.user.id)

      if (linksError) throw linksError

      if (!linksData || linksData.length === 0) {
        linkedChildren.value = []
        return { error: null }
      }

      // Map the joined data to LinkedChild format
      linkedChildren.value = linksData.map((link) => {
        const profile = link.profiles as {
          id: string
          name: string
          email: string
          avatar_path: string | null
          student_profiles: {
            grade_level_id: string | null
            xp: number | null
            current_streak: number
            updated_at: string | null
            grade_levels: { name: string } | null
          } | null
        } | null

        return {
          id: link.student_id,
          name: profile?.name ?? 'Unknown',
          email: profile?.email ?? '',
          avatarPath: profile?.avatar_path ?? null,
          gradeLevelName: profile?.student_profiles?.grade_levels?.name ?? null,
          linkedAt: link.linked_at ?? new Date().toISOString(),
          xp: profile?.student_profiles?.xp ?? 0,
          currentStreak: profile?.student_profiles?.current_streak ?? 0,
          lastActive: profile?.student_profiles?.updated_at ?? null,
        }
      })

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'failedLoadChildren')
      error.value = message
      return { error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch all data
   */
  async function fetchAll(): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null

    try {
      const [childrenResult, invitationsResult] = await Promise.all([
        fetchLinkedChildren(),
        inv.fetchInvitations(),
      ])

      if (childrenResult.error) return childrenResult
      if (invitationsResult.error) return invitationsResult

      return { error: null }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Remove linked child
   */
  async function removeLinkedChild(childId: string): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: errorMessages().notAuthenticatedAsParent }
    }

    // Pre-check: block unlink if child has an active paid subscription
    // Instantiate lazily inside function body to avoid circular init (subscription <-> child-link)
    const subscription = useSubscriptionStore().getChildSubscription(childId)
    if (subscription.isActive && subscription.tier !== 'core') {
      return { error: errorMessages().cannotUnlinkActiveSubParent }
    }

    try {
      const { error: deleteError } = await supabase
        .from('parent_student_links')
        .delete()
        .eq('parent_id', authStore.user.id)
        .eq('student_id', childId)

      if (deleteError) throw deleteError

      // Remove from local state
      const index = linkedChildren.value.findIndex((c) => c.id === childId)
      if (index !== -1) {
        linkedChildren.value.splice(index, 1)
      }

      return { error: null }
    } catch (err) {
      return { error: handleError(err, 'failedRemoveChild') }
    }
  }

  // Reset store state (call on logout)
  function $reset() {
    linkedChildren.value = []
    isLoading.value = false
    error.value = null
    inv.$reset()
  }

  return {
    // State
    linkedChildren,
    invitations: inv.invitations,
    isLoading,
    error,

    // Computed
    receivedInvitations: inv.receivedInvitations,
    sentInvitations: inv.sentInvitations,

    // Actions
    fetchLinkedChildren,
    fetchInvitations: inv.fetchInvitations,
    fetchAll,
    sendInvitation: inv.sendInvitation,
    acceptInvitation: inv.acceptInvitation,
    rejectInvitation: inv.rejectInvitation,
    cancelInvitation: inv.cancelInvitation,
    removeLinkedChild,
    $reset,
  }
})
