import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from './auth'
import type { Database } from '@/types/database.types'

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
   */
  async function fetchLinkedChildren(): Promise<{ error: string | null }> {
    if (!authStore.user || !authStore.isParent) {
      return { error: 'Not authenticated as parent' }
    }

    isLoading.value = true
    error.value = null

    try {
      // First, fetch the links
      const { data: linksData, error: linksError } = await supabase
        .from('parent_student_links')
        .select('id, student_id, linked_at')
        .eq('parent_id', authStore.user.id)

      if (linksError) throw linksError

      if (!linksData || linksData.length === 0) {
        linkedChildren.value = []
        return { error: null }
      }

      // Get student IDs
      const studentIds = linksData.map((link) => link.student_id)

      // Fetch profiles for all linked students
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_path')
        .in('id', studentIds)

      if (profilesError) throw profilesError

      // Fetch student profiles with grade levels
      const { data: studentProfilesData, error: studentProfilesError } = await supabase
        .from('student_profiles')
        .select('id, grade_level_id, grade_levels (name)')
        .in('id', studentIds)

      if (studentProfilesError) throw studentProfilesError

      // Create maps for quick lookup
      const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) ?? [])
      const studentProfilesMap = new Map(studentProfilesData?.map((sp) => [sp.id, sp]) ?? [])

      linkedChildren.value = linksData.map((link) => {
        const profile = profilesMap.get(link.student_id)
        const studentProfile = studentProfilesMap.get(link.student_id) as
          | {
              id: string
              grade_level_id: string | null
              grade_levels: { name: string } | null
            }
          | undefined

        return {
          id: link.student_id,
          name: profile?.name ?? 'Unknown',
          email: profile?.email ?? '',
          avatarPath: profile?.avatar_path ?? null,
          gradeLevelName: studentProfile?.grade_levels?.name ?? null,
          linkedAt: link.linked_at ?? new Date().toISOString(),
        }
      })

      return { error: null }
    } catch (err) {
      console.error('Error fetching linked children:', err)
      const message = err instanceof Error ? err.message : 'Failed to fetch linked children'
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

      // For each invitation, try to get names if IDs are set
      const invitationsWithNames: ParentStudentInvitation[] = []

      for (const row of data ?? []) {
        let parentName: string | undefined
        let studentName: string | undefined

        if (row.parent_id) {
          const { data: parentProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', row.parent_id)
            .single()

          parentName = parentProfile?.name
        }

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
      console.error('Error sending invitation:', err)
      const message = err instanceof Error ? err.message : 'Failed to send invitation'
      return { error: message }
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
      // Update invitation status
      const { error: updateError } = await supabase
        .from('parent_student_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
          parent_id: authStore.user.id,
        })
        .eq('id', invitationId)

      if (updateError) throw updateError

      // Create the link
      if (invitation.studentId) {
        const { error: linkError } = await supabase.from('parent_student_links').insert({
          parent_id: authStore.user.id,
          student_id: invitation.studentId,
        })

        if (linkError) throw linkError

        // Get student profile for linked children list
        const { data: studentData } = await supabase
          .from('profiles')
          .select(
            `
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
          `,
          )
          .eq('id', invitation.studentId)
          .single()

        if (studentData) {
          const studentProfile = studentData.student_profiles as unknown as {
            grade_level_id: string | null
            grade_levels: { name: string } | null
          }

          linkedChildren.value.push({
            id: studentData.id,
            name: studentData.name,
            email: studentData.email,
            avatarPath: studentData.avatar_path,
            gradeLevelName: studentProfile?.grade_levels?.name ?? null,
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
      console.error('Error cancelling invitation:', err)
      const message = err instanceof Error ? err.message : 'Failed to cancel invitation'
      return { error: message }
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
      console.error('Error removing linked child:', err)
      const message = err instanceof Error ? err.message : 'Failed to remove linked child'
      return { error: message }
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
  }
})
