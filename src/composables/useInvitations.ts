import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/stores/auth'
import { handleError } from '@/lib/errors'
import { mapInvitationRows, type ParentStudentInvitation } from '@/lib/invitations'

export type InvitationRole = 'parent' | 'student'

export interface InvitationHooks {
  /** Return error message to block send, or null to allow */
  canSend?: (targetEmail: string) => string | null
  /** Return error message to block accept, or null to allow */
  canAccept?: () => string | null
  /** Called after successful accept with RPC result row */
  onAccepted?: (result: Record<string, unknown>) => void
}

export function useInvitations(role: InvitationRole, hooks?: InvitationHooks) {
  const authStore = useAuthStore()

  // Fields that vary by role (DB column names for Supabase queries)
  const ownIdCol = role === 'student' ? 'student_id' : 'parent_id'
  const ownEmailCol = role === 'student' ? 'student_email' : 'parent_email'
  // Camel-case keys for ParentStudentInvitation interface
  const ownIdKey = role === 'student' ? 'studentId' : ('parentId' as const)
  const ownEmailKey = role === 'student' ? 'studentEmail' : ('parentEmail' as const)
  const targetEmailKey = role === 'student' ? 'parentEmail' : ('studentEmail' as const)
  const targetType = role === 'student' ? 'parent' : 'student'
  const sendDirection = role === 'student' ? 'student_to_parent' : ('parent_to_student' as const)
  const receiveDirection = role === 'student' ? 'parent_to_student' : ('student_to_parent' as const)
  const roleCheck = role === 'student' ? () => authStore.isStudent : () => authStore.isParent

  const invitations = ref<ParentStudentInvitation[]>([])

  const receivedInvitations = computed(() => {
    if (!authStore.user || !roleCheck()) return []
    return invitations.value.filter((inv) => {
      const matchesId = inv[ownIdKey] === authStore.user!.id
      const matchesEmail = inv[ownEmailKey].toLowerCase() === authStore.user!.email.toLowerCase()
      return (
        (matchesId || matchesEmail) &&
        inv.direction === receiveDirection &&
        inv.status === 'pending'
      )
    })
  })

  const sentInvitations = computed(() => {
    if (!authStore.user || !roleCheck()) return []
    return invitations.value.filter((inv) => {
      return (
        inv[ownIdKey] === authStore.user!.id &&
        inv.direction === sendDirection &&
        inv.status === 'pending'
      )
    })
  })

  async function fetchInvitations(): Promise<{ error: string | null }> {
    if (!authStore.user || !roleCheck()) {
      return { error: `Not authenticated as ${role}` }
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('parent_student_invitations')
        .select('*')
        .or(`${ownIdCol}.eq.${authStore.user.id},${ownEmailCol}.eq.${authStore.user.email}`)
        .in('status', ['pending'])
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      invitations.value = await mapInvitationRows(data ?? [])

      return { error: null }
    } catch (err) {
      return { error: handleError(err, 'Failed to load invitations.') }
    }
  }

  async function sendInvitation(
    targetEmail: string,
  ): Promise<{ success?: boolean; invitation?: ParentStudentInvitation; error?: string }> {
    if (!authStore.user || !roleCheck()) {
      return { error: `Not authenticated as ${role}` }
    }

    // Run hook validation
    if (hooks?.canSend) {
      const hookError = hooks.canSend(targetEmail)
      if (hookError) return { error: hookError }
    }

    // Check if invitation already exists
    const existingInvitation = invitations.value.find(
      (inv) =>
        inv[targetEmailKey].toLowerCase() === targetEmail.toLowerCase() && inv.status === 'pending',
    )
    if (existingInvitation) {
      return { error: 'An invitation is already pending for this email' }
    }

    try {
      // Look up the target by email — they must exist in the system
      const { data: targetProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, name, user_type')
        .eq('email', targetEmail.toLowerCase())
        .single()

      if (lookupError || !targetProfile) {
        return { error: `No ${targetType} account found with this email address` }
      }

      if (targetProfile.user_type !== targetType) {
        return { error: `This email is not associated with a ${targetType} account` }
      }

      const insertData =
        role === 'student'
          ? {
              student_id: authStore.user.id,
              student_email: authStore.user.email,
              parent_id: targetProfile.id,
              parent_email: targetEmail,
              direction: 'student_to_parent' as const,
              status: 'pending' as const,
            }
          : {
              parent_id: authStore.user.id,
              parent_email: authStore.user.email,
              student_id: targetProfile.id,
              student_email: targetEmail,
              direction: 'parent_to_student' as const,
              status: 'pending' as const,
            }

      const { data, error: insertError } = await supabase
        .from('parent_student_invitations')
        .insert(insertData)
        .select()
        .single()

      if (insertError) throw insertError

      const invitation: ParentStudentInvitation = {
        id: data.id,
        parentId: data.parent_id,
        parentEmail: data.parent_email,
        parentName: role === 'parent' ? authStore.user.name : targetProfile.name,
        studentId: data.student_id,
        studentEmail: data.student_email,
        studentName: role === 'student' ? authStore.user.name : targetProfile.name,
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

  async function acceptInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !roleCheck()) {
      return { error: `Not authenticated as ${role}` }
    }

    const invitation = invitations.value.find((inv) => inv.id === invitationId)
    if (!invitation) {
      return { error: 'Invitation not found' }
    }

    // Run hook validation
    if (hooks?.canAccept) {
      const hookError = hooks.canAccept()
      if (hookError) return { error: hookError }
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('accept_parent_student_invitation', {
        p_invitation_id: invitationId,
        p_accepting_user_id: authStore.user.id,
        p_is_parent: role === 'parent',
      })

      if (rpcError) throw rpcError

      const result = data?.[0]
      if (result && hooks?.onAccepted) {
        hooks.onAccepted(result as Record<string, unknown>)
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

  async function rejectInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !roleCheck()) {
      return { error: `Not authenticated as ${role}` }
    }

    try {
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          [ownIdCol]: authStore.user.id,
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

  async function cancelInvitation(
    invitationId: string,
  ): Promise<{ success?: boolean; error?: string }> {
    if (!authStore.user || !roleCheck()) {
      return { error: `Not authenticated as ${role}` }
    }

    try {
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('id', invitationId)
        .eq(ownIdCol, authStore.user.id)

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

  function $reset() {
    invitations.value = []
  }

  return {
    invitations,
    receivedInvitations,
    sentInvitations,
    fetchInvitations,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    $reset,
  }
}
