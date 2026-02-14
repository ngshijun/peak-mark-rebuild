import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import { useSubscriptionStore } from './subscription'
import { handleError } from '@/lib/errors'
import { mapInvitationRows, type ParentStudentInvitation } from '@/lib/invitations'

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
  const invitations = ref<ParentStudentInvitation[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
      // Single query with joins - fetches links, profiles, and student profiles together
      // student_profiles is nested within profiles since student_profiles.id references profiles.id
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
   * Fetch invitations for current parent
   */
  async function fetchInvitations(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    isLoading.value = true
    error.value = null

    try {
      // Fetch invitations where parent email or ID matches
      const { data, error: fetchError } = await supabase
        .from('parent_student_invitations')
        .select('*')
        .or(`parent_id.eq.${authStore.user.id},parent_email.eq.${authStore.user.email}`)
        .in('status', ['pending'])
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      invitations.value = await mapInvitationRows(data ?? [])

      return { error: null }
    } catch (err) {
      const message = handleError(err, 'Failed to load invitations.')
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
    const [childrenResult, invitationsResult] = await Promise.all([
      fetchLinkedChildren(),
      fetchInvitations(),
    ])

    if (childrenResult.error) return childrenResult
    if (invitationsResult.error) return invitationsResult

    return { error: null }
  }

  // Get invitations sent to current parent (from students)
  const receivedInvitations = computed(() => {
    if (!authStore.user || !authStore.isParent) return []
    return invitations.value.filter(
      (inv) =>
        (inv.parentId === authStore.user!.id ||
          inv.parentEmail.toLowerCase() === authStore.user!.email.toLowerCase()) &&
        inv.direction === 'student_to_parent' &&
        inv.status === 'pending',
    )
  })

  // Get invitations sent by current parent (to students)
  const sentInvitations = computed(() => {
    if (!authStore.user || !authStore.isParent) return []
    return invitations.value.filter(
      (inv) =>
        inv.parentId === authStore.user!.id &&
        inv.direction === 'parent_to_student' &&
        inv.status === 'pending',
    )
  })

  /**
   * Send invitation to child (student)
   */
  async function sendInvitation(
    childEmail: string,
  ): Promise<{ success?: boolean; invitation?: ParentStudentInvitation; error?: string }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    // Check if already linked
    const alreadyLinked = linkedChildren.value.some(
      (c) => c.email.toLowerCase() === childEmail.toLowerCase(),
    )
    if (alreadyLinked) {
      return { error: 'This child is already linked to your account' }
    }

    // Check if invitation already exists
    const existingInvitation = invitations.value.find(
      (inv) =>
        inv.studentEmail.toLowerCase() === childEmail.toLowerCase() && inv.status === 'pending',
    )
    if (existingInvitation) {
      return { error: 'An invitation is already pending for this email' }
    }

    try {
      // Look up the student by email - they must exist in the system
      const { data: studentProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, name, user_type')
        .eq('email', childEmail.toLowerCase())
        .single()

      if (lookupError || !studentProfile) {
        return { error: 'No student account found with this email address' }
      }

      if (studentProfile.user_type !== 'student') {
        return { error: 'This email is not associated with a student account' }
      }

      const { data, error: insertError } = await supabase
        .from('parent_student_invitations')
        .insert({
          parent_id: authStore.user.id,
          parent_email: authStore.user.email,
          student_id: studentProfile.id,
          student_email: childEmail,
          direction: 'parent_to_student',
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) throw insertError

      const invitation: ParentStudentInvitation = {
        id: data.id,
        parentId: data.parent_id,
        parentEmail: data.parent_email,
        parentName: authStore.user.name,
        studentId: data.student_id,
        studentEmail: data.student_email,
        studentName: studentProfile.name,
        direction: data.direction,
        status: data.status ?? 'pending',
        createdAt: data.created_at ?? new Date().toISOString(),
        respondedAt: data.responded_at,
      }

      invitations.value.push(invitation)

      return { success: true, invitation }
    } catch (err) {
      return { error: handleError(err, 'Failed to send invitation. Please try again.') }
    }
  }

  /**
   * Accept invitation from child (student)
   */
  async function acceptInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    const invitation = invitations.value.find((inv) => inv.id === invitationId)
    if (!invitation) {
      return { error: 'Invitation not found' }
    }

    try {
      // Accept invitation atomically using RPC function
      // This updates invitation status and creates the link in a single transaction
      const { data, error: rpcError } = await supabase.rpc('accept_parent_student_invitation', {
        p_invitation_id: invitationId,
        p_accepting_user_id: authStore.user.id,
        p_is_parent: true,
      })

      if (rpcError) throw rpcError

      // RPC returns an array, get the first (and only) result
      const result = data?.[0]
      if (result) {
        // Add to linked children using data from RPC response
        linkedChildren.value.push({
          id: result.student_id,
          name: result.student_name,
          email: result.student_email,
          avatarPath: result.student_avatar_path,
          gradeLevelName: result.student_grade_level_name,
          linkedAt: result.linked_at,
        })
      }

      // Remove from invitations
      const index = invitations.value.findIndex((inv) => inv.id === invitationId)
      if (index !== -1) {
        invitations.value.splice(index, 1)
      }

      return { success: true }
    } catch (err: unknown) {
      return { error: handleError(err, 'Failed to accept invitation. Please try again.') }
    }
  }

  /**
   * Reject invitation from child (student)
   */
  async function rejectInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    try {
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          parent_id: authStore.user.id,
        })
        .eq('id', invitationId)

      if (updateError) throw updateError

      // Remove from invitations
      const index = invitations.value.findIndex((inv) => inv.id === invitationId)
      if (index !== -1) {
        invitations.value.splice(index, 1)
      }

      return { success: true }
    } catch (err) {
      return { error: handleError(err, 'Failed to decline invitation. Please try again.') }
    }
  }

  /**
   * Cancel sent invitation
   */
  async function cancelInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    try {
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('id', invitationId)
        .eq('parent_id', authStore.user.id)

      if (updateError) throw updateError

      // Remove from invitations
      const index = invitations.value.findIndex((inv) => inv.id === invitationId)
      if (index !== -1) {
        invitations.value.splice(index, 1)
      }

      return { success: true }
    } catch (err) {
      return { error: handleError(err, 'Failed to cancel invitation. Please try again.') }
    }
  }

  /**
   * Remove linked child
   */
  async function removeLinkedChild(
    childId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    // Pre-check: block unlink if child has an active paid subscription
    // Instantiate lazily inside function body to avoid circular init (subscription ↔ child-link)
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

      return { success: true }
    } catch (err) {
      return { error: handleError(err, 'Failed to remove child. Please try again.') }
    }
  }

  /**
   * Get avatar URL for a child
   */
  function getAvatarUrl(avatarPath: string | null): string {
    if (!avatarPath) return ''
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  // Reset store state (call on logout)
  function $reset() {
    linkedChildren.value = []
    invitations.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    linkedChildren,
    invitations,
    isLoading,
    error,

    // Computed
    receivedInvitations,
    sentInvitations,

    // Actions
    fetchLinkedChildren,
    fetchInvitations,
    fetchAll,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    removeLinkedChild,
    getAvatarUrl,
    $reset,
  }
})
