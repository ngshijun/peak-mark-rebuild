import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

type InvitationRow = Database['public']['Tables']['parent_student_invitations']['Row']
type LinkRow = Database['public']['Tables']['parent_student_links']['Row']
type InvitationDirection = Database['public']['Enums']['invitation_direction']
type InvitationStatus = Database['public']['Enums']['invitation_status']

export interface ParentStudentInvitation {
  id: string
  parentId: string | null
  parentEmail: string
  parentName?: string
  studentId: string | null
  studentEmail: string
  studentName?: string
  direction: InvitationDirection
  status: InvitationStatus
  createdAt: string
  respondedAt: string | null
}

export interface LinkedParent {
  id: string
  name: string
  email: string
  linkedAt: string
}

export const useParentLinkStore = defineStore('parentLink', () => {
  const authStore = useAuthStore()

  const linkedParents = ref<LinkedParent[]>([])
  const invitations = ref<ParentStudentInvitation[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
      console.error('Error fetching linked parents:', err)
      error.value = 'Failed to load linked parents'
      return { error: 'Failed to load linked parents' }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch invitations for current student
   */
  async function fetchInvitations(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    isLoading.value = true
    error.value = null

    try {
      // Fetch invitations where student email matches
      const { data, error: fetchError } = await supabase
        .from('parent_student_invitations')
        .select('*')
        .or(`student_id.eq.${authStore.user.id},student_email.eq.${authStore.user.email}`)
        .in('status', ['pending'])
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Collect all unique user IDs that need profile lookup
      const userIds = new Set<string>()
      for (const row of data ?? []) {
        if (row.parent_id) userIds.add(row.parent_id)
        if (row.student_id) userIds.add(row.student_id)
      }

      // Batch fetch all profiles in a single query
      const profilesMap = new Map<string, string>()
      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(userIds))

        for (const profile of profilesData ?? []) {
          profilesMap.set(profile.id, profile.name)
        }
      }

      // Build invitations with names from the map
      invitations.value = (data ?? []).map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        parentEmail: row.parent_email,
        parentName: row.parent_id ? profilesMap.get(row.parent_id) : undefined,
        studentId: row.student_id,
        studentEmail: row.student_email,
        studentName: row.student_id ? profilesMap.get(row.student_id) : undefined,
        direction: row.direction,
        status: row.status ?? 'pending',
        createdAt: row.created_at ?? new Date().toISOString(),
        respondedAt: row.responded_at,
      }))

      return { error: null }
    } catch (err) {
      console.error('Error fetching invitations:', err)
      error.value = 'Failed to load invitations'
      return { error: 'Failed to load invitations' }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch all data
   */
  async function fetchAll(): Promise<{ error: string | null }> {
    const [parentsResult, invitationsResult] = await Promise.all([
      fetchLinkedParents(),
      fetchInvitations(),
    ])

    if (parentsResult.error) return parentsResult
    if (invitationsResult.error) return invitationsResult

    return { error: null }
  }

  // Get invitations sent to current student (from parents)
  const receivedInvitations = computed(() => {
    if (!authStore.user || !authStore.isStudent) return []
    return invitations.value.filter(
      (inv) =>
        (inv.studentId === authStore.user!.id ||
          inv.studentEmail.toLowerCase() === authStore.user!.email.toLowerCase()) &&
        inv.direction === 'parent_to_student' &&
        inv.status === 'pending',
    )
  })

  // Get invitations sent by current student (to parents)
  const sentInvitations = computed(() => {
    if (!authStore.user || !authStore.isStudent) return []
    return invitations.value.filter(
      (inv) =>
        inv.studentId === authStore.user!.id &&
        inv.direction === 'student_to_parent' &&
        inv.status === 'pending',
    )
  })

  /**
   * Send invitation to parent
   */
  async function sendInvitation(
    parentEmail: string,
  ): Promise<{ success?: boolean; invitation?: ParentStudentInvitation; error?: string }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    // Check if already linked
    const alreadyLinked = linkedParents.value.some(
      (p) => p.email.toLowerCase() === parentEmail.toLowerCase(),
    )
    if (alreadyLinked) {
      return { error: 'This parent is already linked to your account' }
    }

    // Check if invitation already exists
    const existingInvitation = invitations.value.find(
      (inv) =>
        inv.parentEmail.toLowerCase() === parentEmail.toLowerCase() && inv.status === 'pending',
    )
    if (existingInvitation) {
      return { error: 'An invitation is already pending for this email' }
    }

    try {
      // Look up the parent by email - they must exist in the system
      const { data: parentProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, name, user_type')
        .eq('email', parentEmail.toLowerCase())
        .single()

      if (lookupError || !parentProfile) {
        return { error: 'No parent account found with this email address' }
      }

      if (parentProfile.user_type !== 'parent') {
        return { error: 'This email is not associated with a parent account' }
      }

      const { data, error: insertError } = await supabase
        .from('parent_student_invitations')
        .insert({
          parent_id: parentProfile.id,
          parent_email: parentEmail,
          student_id: authStore.user.id,
          student_email: authStore.user.email,
          direction: 'student_to_parent',
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) throw insertError

      const invitation: ParentStudentInvitation = {
        id: data.id,
        parentId: data.parent_id,
        parentEmail: data.parent_email,
        parentName: parentProfile.name,
        studentId: data.student_id,
        studentEmail: data.student_email,
        studentName: authStore.user.name,
        direction: data.direction,
        status: data.status ?? 'pending',
        createdAt: data.created_at ?? new Date().toISOString(),
        respondedAt: data.responded_at,
      }

      invitations.value.push(invitation)

      return { success: true, invitation }
    } catch (err) {
      console.error('Error sending invitation:', err)
      return { error: 'Failed to send invitation. Please try again.' }
    }
  }

  /**
   * Accept invitation from parent
   */
  async function acceptInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
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
        p_is_parent: false,
      })

      if (rpcError) throw rpcError

      // RPC returns an array, get the first (and only) result
      const result = data?.[0]
      if (result) {
        // Add to linked parents using data from RPC response
        linkedParents.value.push({
          id: result.parent_id,
          name: result.parent_name,
          email: result.parent_email,
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
      console.error('Error accepting invitation:', err)
      return { error: 'Failed to accept invitation. Please try again.' }
    }
  }

  /**
   * Reject invitation from parent
   */
  async function rejectInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    try {
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          student_id: authStore.user.id,
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
      console.error('Error rejecting invitation:', err)
      return { error: 'Failed to decline invitation. Please try again.' }
    }
  }

  /**
   * Cancel sent invitation
   */
  async function cancelInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
    }

    try {
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('id', invitationId)
        .eq('student_id', authStore.user.id)

      if (updateError) throw updateError

      // Remove from invitations
      const index = invitations.value.findIndex((inv) => inv.id === invitationId)
      if (index !== -1) {
        invitations.value.splice(index, 1)
      }

      return { success: true }
    } catch (err) {
      console.error('Error cancelling invitation:', err)
      return { error: 'Failed to cancel invitation. Please try again.' }
    }
  }

  /**
   * Remove linked parent
   */
  async function removeLinkedParent(
    parentId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !authStore.isStudent) {
      return { error: 'Not authenticated as student' }
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

      return { success: true }
    } catch (err) {
      console.error('Error removing linked parent:', err)
      return { error: 'Failed to remove parent. Please try again.' }
    }
  }

  // Reset store state (call on logout)
  function $reset() {
    linkedParents.value = []
    invitations.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    linkedParents,
    invitations,
    isLoading,
    error,

    // Computed
    receivedInvitations,
    sentInvitations,

    // Actions
    fetchLinkedParents,
    fetchInvitations,
    fetchAll,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    removeLinkedParent,
    $reset,
  }
})
