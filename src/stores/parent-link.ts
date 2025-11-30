import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ParentStudentInvitation, LinkedParent } from '@/types'
import { useAuthStore } from './auth'

export const useParentLinkStore = defineStore('parentLink', () => {
  const authStore = useAuthStore()

  // Mock linked parents for student
  const linkedParents = ref<LinkedParent[]>([
    {
      id: 'p1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      linkedAt: '2024-01-15T10:00:00',
    },
  ])

  // Mock invitations
  const invitations = ref<ParentStudentInvitation[]>([
    {
      id: 'inv1',
      parentEmail: 'michael.chen@example.com',
      parentName: 'Michael Chen',
      studentId: '2',
      studentEmail: 'student@example.com',
      studentName: 'Demo Student',
      direction: 'parent_to_student',
      status: 'pending',
      createdAt: '2024-01-20T14:30:00',
    },
    {
      id: 'inv2',
      parentEmail: 'jennifer.lee@example.com',
      studentId: '2',
      studentEmail: 'student@example.com',
      studentName: 'Demo Student',
      direction: 'student_to_parent',
      status: 'pending',
      createdAt: '2024-01-22T09:15:00',
    },
  ])

  // Get invitations sent to current student (from parents)
  const receivedInvitations = computed(() => {
    if (!authStore.user || !authStore.isStudent) return []
    return invitations.value.filter(
      (inv) =>
        inv.studentId === authStore.user!.id &&
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

  // Send invitation to parent
  function sendInvitation(parentEmail: string) {
    if (!authStore.user || !authStore.isStudent) return null

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
        inv.parentEmail.toLowerCase() === parentEmail.toLowerCase() &&
        inv.studentId === authStore.user!.id &&
        inv.status === 'pending',
    )
    if (existingInvitation) {
      return { error: 'An invitation is already pending for this email' }
    }

    const invitation: ParentStudentInvitation = {
      id: crypto.randomUUID(),
      parentEmail,
      studentId: authStore.user.id,
      studentEmail: authStore.user.email,
      studentName: authStore.user.name,
      direction: 'student_to_parent',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    invitations.value.push(invitation)
    return { success: true, invitation }
  }

  // Accept invitation from parent
  function acceptInvitation(invitationId: string) {
    const invitation = invitations.value.find((inv) => inv.id === invitationId)
    if (!invitation) return false

    invitation.status = 'accepted'
    invitation.respondedAt = new Date().toISOString()

    // Add to linked parents
    const emailName = invitation.parentEmail.split('@')[0]
    linkedParents.value.push({
      id: invitation.parentId ?? crypto.randomUUID(),
      name: invitation.parentName ?? emailName ?? 'Parent',
      email: invitation.parentEmail,
      linkedAt: new Date().toISOString(),
    })

    return true
  }

  // Reject invitation from parent
  function rejectInvitation(invitationId: string) {
    const invitation = invitations.value.find((inv) => inv.id === invitationId)
    if (!invitation) return false

    invitation.status = 'rejected'
    invitation.respondedAt = new Date().toISOString()
    return true
  }

  // Cancel sent invitation
  function cancelInvitation(invitationId: string) {
    const index = invitations.value.findIndex((inv) => inv.id === invitationId)
    if (index === -1) return false

    invitations.value.splice(index, 1)
    return true
  }

  // Remove linked parent
  function removeLinkedParent(parentId: string) {
    const index = linkedParents.value.findIndex((p) => p.id === parentId)
    if (index === -1) return false

    linkedParents.value.splice(index, 1)
    return true
  }

  return {
    linkedParents,
    invitations,
    receivedInvitations,
    sentInvitations,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    removeLinkedParent,
  }
})
