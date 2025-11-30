import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ParentStudentInvitation, LinkedChild } from '@/types'
import { useAuthStore } from './auth'

export const useChildLinkStore = defineStore('childLink', () => {
  const authStore = useAuthStore()

  // Mock linked children for parent
  const linkedChildren = ref<LinkedChild[]>([
    {
      id: 's1',
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      gradeLevelName: 'Primary 4',
      linkedAt: '2024-01-15T10:00:00',
    },
  ])

  // Mock invitations (reusing the same type as parent-link store)
  const invitations = ref<ParentStudentInvitation[]>([
    {
      id: 'inv-child-1',
      parentId: '3',
      parentEmail: 'parent@example.com',
      parentName: 'Demo Parent',
      studentEmail: 'emma.wilson@example.com',
      studentName: 'Emma Wilson',
      direction: 'student_to_parent',
      status: 'pending',
      createdAt: '2024-01-20T14:30:00',
    },
    {
      id: 'inv-child-2',
      parentId: '3',
      parentEmail: 'parent@example.com',
      parentName: 'Demo Parent',
      studentEmail: 'james.smith@example.com',
      direction: 'parent_to_student',
      status: 'pending',
      createdAt: '2024-01-22T09:15:00',
    },
  ])

  // Get invitations sent to current parent (from students)
  const receivedInvitations = computed(() => {
    if (!authStore.user || !authStore.isParent) return []
    return invitations.value.filter(
      (inv) =>
        inv.parentId === authStore.user!.id &&
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

  // Send invitation to child (student)
  function sendInvitation(childEmail: string) {
    if (!authStore.user || !authStore.isParent) return null

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
        inv.studentEmail.toLowerCase() === childEmail.toLowerCase() &&
        inv.parentId === authStore.user!.id &&
        inv.status === 'pending',
    )
    if (existingInvitation) {
      return { error: 'An invitation is already pending for this email' }
    }

    const invitation: ParentStudentInvitation = {
      id: crypto.randomUUID(),
      parentId: authStore.user.id,
      parentEmail: authStore.user.email,
      parentName: authStore.user.name,
      studentEmail: childEmail,
      direction: 'parent_to_student',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    invitations.value.push(invitation)
    return { success: true, invitation }
  }

  // Accept invitation from child (student)
  function acceptInvitation(invitationId: string) {
    const invitation = invitations.value.find((inv) => inv.id === invitationId)
    if (!invitation) return false

    invitation.status = 'accepted'
    invitation.respondedAt = new Date().toISOString()

    // Add to linked children
    const emailName = invitation.studentEmail.split('@')[0]
    linkedChildren.value.push({
      id: invitation.studentId ?? crypto.randomUUID(),
      name: invitation.studentName ?? emailName ?? 'Child',
      email: invitation.studentEmail,
      gradeLevelName: 'Unknown', // Would be fetched from student data in real implementation
      linkedAt: new Date().toISOString(),
    })

    return true
  }

  // Reject invitation from child (student)
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

  // Remove linked child
  function removeLinkedChild(childId: string) {
    const index = linkedChildren.value.findIndex((c) => c.id === childId)
    if (index === -1) return false

    linkedChildren.value.splice(index, 1)
    return true
  }

  return {
    linkedChildren,
    invitations,
    receivedInvitations,
    sentInvitations,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    removeLinkedChild,
  }
})
