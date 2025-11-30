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
      const message = err instanceof Error ? err.message : 'Failed to fetch linked parents'
      error.value = message
      return { error: message }
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

      // For each invitation, try to get parent name if parent_id is set
      const invitationsWithNames: ParentStudentInvitation[] = []

      for (const row of data ?? []) {
        let parentName: string | undefined

        if (row.parent_id) {
          const { data: parentProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', row.parent_id)
            .single()

          parentName = parentProfile?.name
        }

        let studentName: string | undefined

        if (row.student_id) {
          const { data: studentProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', row.student_id)
            .single()

          studentName = studentProfile?.name
        }

        invitationsWithNames.push({
          id: row.id,
          parentId: row.parent_id,
          parentEmail: row.parent_email,
          parentName,
          studentId: row.student_id,
          studentEmail: row.student_email,
          studentName,
          direction: row.direction,
          status: row.status ?? 'pending',
          createdAt: row.created_at ?? new Date().toISOString(),
          respondedAt: row.responded_at,
        })
      }

      invitations.value = invitationsWithNames

      return { error: null }
    } catch (err) {
      console.error('Error fetching invitations:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch invitations'
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
      const { data, error: insertError } = await supabase
        .from('parent_student_invitations')
        .insert({
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
      const message = err instanceof Error ? err.message : 'Failed to send invitation'
      return { error: message }
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
      // Update invitation status
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
          student_id: authStore.user.id,
        })
        .eq('id', invitationId)

      if (updateError) throw updateError

      // Create the link
      if (invitation.parentId) {
        const { error: linkError } = await supabase.from('parent_student_links').insert({
          parent_id: invitation.parentId,
          student_id: authStore.user.id,
        })

        if (linkError) throw linkError

        // Get parent profile for linked parents list
        const { data: parentProfile } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('id', invitation.parentId)
          .single()

        if (parentProfile) {
          linkedParents.value.push({
            id: parentProfile.id,
            name: parentProfile.name,
            email: parentProfile.email,
            linkedAt: new Date().toISOString(),
          })
        }
      }

      // Remove from invitations
      const index = invitations.value.findIndex((inv) => inv.id === invitationId)
      if (index !== -1) {
        invitations.value.splice(index, 1)
      }

      return { success: true }
    } catch (err) {
      console.error('Error accepting invitation:', err)
      const message = err instanceof Error ? err.message : 'Failed to accept invitation'
      return { error: message }
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
      const message = err instanceof Error ? err.message : 'Failed to reject invitation'
      return { error: message }
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
      const message = err instanceof Error ? err.message : 'Failed to cancel invitation'
      return { error: message }
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
      const message = err instanceof Error ? err.message : 'Failed to remove linked parent'
      return { error: message }
    }
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
  }
})
