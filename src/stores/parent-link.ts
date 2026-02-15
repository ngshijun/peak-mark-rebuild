import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { handleError } from '@/lib/errors'
import { useInvitations } from '@/composables/useInvitations'

export type { ParentStudentInvitation } from '@/lib/invitations'

export interface LinkedParent {
  id: string
  name: string
  email: string
  linkedAt: string
}

export const useParentLinkStore = defineStore('parentLink', () => {
  const authStore = useAuthStore()

  const linkedParents = ref<LinkedParent[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Whether student already has a linked parent
  const hasLinkedParent = computed(() => linkedParents.value.length > 0)

  const inv = useInvitations('student', {
    canSend: () => (hasLinkedParent.value ? 'You can only have one linked parent' : null),
    canAccept: () => (hasLinkedParent.value ? 'You can only have one linked parent' : null),
    onAccepted: (result) => {
      linkedParents.value.push({
        id: result.parent_id,
        name: result.parent_name,
        email: result.parent_email,
        linkedAt: result.linked_at,
      })
    },
  })

  /**
   * Fetch linked parents for current student
   */
  async function fetchLinkedParents(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    isLoading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('parent_student_links')
        .select(
          `
          id,
          parent_id,
          linked_at,
          profiles!parent_student_links_parent_id_fkey (
            id,
            name,
            email
          )
        `,
        )
        .eq('student_id', authStore.user.id)

      if (fetchError) throw fetchError

      linkedParents.value = (data ?? []).map((row) => {
        const profile = row.profiles as unknown as { id: string; name: string; email: string }
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          linkedAt: row.linked_at ?? new Date().toISOString(),
        }
      })

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to load linked parents.')
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
      const [parentsResult, invitationsResult] = await Promise.all([
        fetchLinkedParents(),
        inv.fetchInvitations(),
      ])

      if (parentsResult.error) return parentsResult
      if (invitationsResult.error) return invitationsResult

      return { error: null }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Remove linked parent
   */
  async function removeLinkedParent(parentId: string): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    // Pre-check: block unlink if an active paid subscription exists for this link
    try {
      const { data: activeSub } = await supabase
        .from('child_subscriptions')
        .select('id')
        .eq('parent_id', parentId)
        .eq('student_id', authStore.user.id)
        .eq('is_active', true)
        .neq('tier', 'core')
        .limit(1)
        .maybeSingle()

      if (activeSub) {
        return {
          error:
            'Cannot unlink while an active paid subscription exists. Please ask your parent to cancel the subscription first.',
        }
      }
    } catch (err) {
      return { error: handleError(err, 'Failed to check subscription status.') }
    }

    try {
      const { error: deleteError } = await supabase
        .from('parent_student_links')
        .delete()
        .eq('parent_id', parentId)
        .eq('student_id', authStore.user.id)

      if (deleteError) throw deleteError

      // Remove from local state
      const index = linkedParents.value.findIndex((p) => p.id === parentId)
      if (index !== -1) {
        linkedParents.value.splice(index, 1)
      }

      return { error: null }
    } catch (err) {
      return { error: handleError(err, 'Failed to remove parent. Please try again.') }
    }
  }

  // Parent IDs that have active paid subscriptions for this student
  const activeSubscriberIds = ref<Set<string>>(new Set())

  async function fetchActiveSubscribers(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('child_subscriptions')
        .select('parent_id')
        .eq('student_id', authStore.user.id)
        .eq('is_active', true)
        .neq('tier', 'core')

      if (fetchError) throw fetchError

      const ids = new Set<string>()
      for (const row of data ?? []) {
        ids.add(row.parent_id)
      }
      activeSubscriberIds.value = ids
      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to check subscription status.')
      return { error: message }
    }
  }

  function hasActivePaidSubscription(parentId: string): boolean {
    return activeSubscriberIds.value.has(parentId)
  }

  // Reset store state (call on logout)
  function $reset() {
    linkedParents.value = []
    activeSubscriberIds.value = new Set()
    isLoading.value = false
    error.value = null
    inv.$reset()
  }

  return {
    // State
    linkedParents,
    invitations: inv.invitations,
    isLoading,
    error,

    // Computed
    hasLinkedParent,
    receivedInvitations: inv.receivedInvitations,
    sentInvitations: inv.sentInvitations,

    // Actions
    fetchLinkedParents,
    fetchInvitations: inv.fetchInvitations,
    fetchAll,
    fetchActiveSubscribers,
    hasActivePaidSubscription,
    sendInvitation: inv.sendInvitation,
    acceptInvitation: inv.acceptInvitation,
    rejectInvitation: inv.rejectInvitation,
    cancelInvitation: inv.cancelInvitation,
    removeLinkedParent,
    $reset,
  }
})
