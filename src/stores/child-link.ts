import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { useSubscriptionStore } from './subscription'
import { handleError } from '@/lib/errors'
import { getAvatarUrl } from '@/lib/storage'
import { useInvitations } from '@/composables/useInvitations'

export type { ParentStudentInvitation } from '@/lib/invitations'

export interface LinkedChild {
  id: string
  name: string
  email: string
  gradeLevelName: string | null
  avatarPath: string | null
  linkedAt: string
}

export const useChildLinkStore = defineStore('childLink', () => {
  const authStore = useAuthStore()

  const linkedChildren = ref<LinkedChild[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const inv = useInvitations('parent', {
    canSend: (email) =>
      linkedChildren.value.some((c) => c.email.toLowerCase() === email.toLowerCase())
        ? 'This child is already linked to your account'
        : null,
    onAccepted: (result) => {
      linkedChildren.value.push({
        id: result.student_id,
        name: result.student_name,
        email: result.student_email,
        avatarPath: result.student_avatar_path,
        gradeLevelName: result.student_grade_level_name,
        linkedAt: result.linked_at,
      })
    },
  })

  /**
   * Fetch linked children for current parent
   * Uses a single query with joins for better performance
   */
  async function fetchLinkedChildren(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
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
        }
      })

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to load linked children.')
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
      return { error: 'Not authenticated as parent' }
    }

    // Pre-check: block unlink if child has an active paid subscription
    // Instantiate lazily inside function body to avoid circular init (subscription <-> child-link)
    const subscription = useSubscriptionStore().getChildSubscription(childId)
    if (subscription.isActive && subscription.tier !== 'core') {
      return {
        error:
          'Cannot unlink while an active paid subscription exists. Please cancel the subscription first.',
      }
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
      return { error: handleError(err, 'Failed to remove child. Please try again.') }
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
    getAvatarUrl,
    $reset,
  }
})
