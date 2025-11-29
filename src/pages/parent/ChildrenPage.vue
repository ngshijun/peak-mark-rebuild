<script setup lang="ts">
import { ref } from 'vue'
import { useChildLinkStore } from '@/stores/child-link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Users, Mail, Send, Check, X, Trash2, Clock, UserPlus } from 'lucide-vue-next'

const childLinkStore = useChildLinkStore()

const inviteDialogOpen = ref(false)
const inviteEmail = ref('')
const inviteError = ref('')
const inviteSuccess = ref(false)

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function handleSendInvitation() {
  inviteError.value = ''
  inviteSuccess.value = false

  if (!inviteEmail.value.trim()) {
    inviteError.value = 'Please enter an email address'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(inviteEmail.value)) {
    inviteError.value = 'Please enter a valid email address'
    return
  }

  const result = childLinkStore.sendInvitation(inviteEmail.value.trim())
  if (result && 'error' in result && result.error) {
    inviteError.value = result.error
  } else {
    inviteSuccess.value = true
    inviteEmail.value = ''
    setTimeout(() => {
      inviteSuccess.value = false
      inviteDialogOpen.value = false
    }, 1500)
  }
}

function handleAcceptInvitation(invitationId: string) {
  childLinkStore.acceptInvitation(invitationId)
}

function handleRejectInvitation(invitationId: string) {
  childLinkStore.rejectInvitation(invitationId)
}

function handleCancelInvitation(invitationId: string) {
  childLinkStore.cancelInvitation(invitationId)
}

function handleRemoveChild(childId: string) {
  childLinkStore.removeLinkedChild(childId)
}

function resetInviteForm() {
  inviteEmail.value = ''
  inviteError.value = ''
  inviteSuccess.value = false
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header with Invite Button -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Children</h1>
        <p class="text-muted-foreground">Manage your linked children and invitations</p>
      </div>
      <Dialog v-model:open="inviteDialogOpen" @update:open="resetInviteForm">
        <DialogTrigger as-child>
          <Button>
            <UserPlus class="mr-2 size-4" />
            Invite Child
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Child</DialogTitle>
            <DialogDescription>
              Send an invitation to link a child's account. You will be able to view their progress.
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="handleSendInvitation">
            <div class="space-y-2">
              <Label for="childEmail">Child's Email</Label>
              <Input
                id="childEmail"
                v-model="inviteEmail"
                type="email"
                placeholder="Enter child's email address"
              />
              <p v-if="inviteError" class="text-sm text-destructive">{{ inviteError }}</p>
              <p v-if="inviteSuccess" class="text-sm text-green-600">
                Invitation sent successfully!
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" :disabled="inviteSuccess">
                <Send class="mr-2 size-4" />
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Linked Children Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Users class="size-5" />
          Linked Children
        </CardTitle>
        <CardDescription>Children whose progress you can view</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="childLinkStore.linkedChildren.length === 0" class="py-8 text-center">
          <Users class="mx-auto size-12 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">No linked children yet</p>
          <p class="text-xs text-muted-foreground">Invite a child to get started</p>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="child in childLinkStore.linkedChildren"
            :key="child.id"
            class="flex items-center gap-3 rounded-lg border p-3"
          >
            <Avatar>
              <AvatarFallback>{{ getInitials(child.name) }}</AvatarFallback>
            </Avatar>
            <div class="flex-1">
              <p class="font-medium">{{ child.name }}</p>
              <p class="text-sm text-muted-foreground">{{ child.email }}</p>
              <Badge variant="outline" class="mt-1">{{ child.gradeLevelName }}</Badge>
            </div>
            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button variant="ghost" size="icon" class="text-destructive hover:text-destructive">
                  <Trash2 class="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Child</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove {{ child.name }} from your linked children? You
                    will no longer be able to view their progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    @click="handleRemoveChild(child.id)"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Received Invitations (from children) Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Mail class="size-5" />
          Invitations from Children
          <Badge v-if="childLinkStore.receivedInvitations.length > 0" variant="secondary">
            {{ childLinkStore.receivedInvitations.length }}
          </Badge>
        </CardTitle>
        <CardDescription>Children who want to link with you</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="childLinkStore.receivedInvitations.length === 0" class="py-8 text-center">
          <Mail class="mx-auto size-12 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">No pending invitations</p>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="invitation in childLinkStore.receivedInvitations"
            :key="invitation.id"
            class="rounded-lg border p-4"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="font-medium">{{ invitation.studentName || invitation.studentEmail }}</p>
                <p class="text-sm text-muted-foreground">{{ invitation.studentEmail }}</p>
                <p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock class="size-3" />
                  {{ formatDate(invitation.createdAt) }}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div class="mt-3 flex gap-2">
              <Button size="sm" @click="handleAcceptInvitation(invitation.id)">
                <Check class="mr-1 size-4" />
                Accept
              </Button>
              <Button size="sm" variant="outline" @click="handleRejectInvitation(invitation.id)">
                <X class="mr-1 size-4" />
                Decline
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Sent Invitations (to children) Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Send class="size-5" />
          Sent Invitations
          <Badge v-if="childLinkStore.sentInvitations.length > 0" variant="secondary">
            {{ childLinkStore.sentInvitations.length }}
          </Badge>
        </CardTitle>
        <CardDescription>Invitations you've sent to children</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="childLinkStore.sentInvitations.length === 0" class="py-8 text-center">
          <Send class="mx-auto size-12 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">No pending invitations</p>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="invitation in childLinkStore.sentInvitations"
            :key="invitation.id"
            class="rounded-lg border p-4"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="font-medium">{{ invitation.studentEmail }}</p>
                <p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock class="size-3" />
                  Sent on {{ formatDate(invitation.createdAt) }}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div class="mt-3">
              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    size="sm"
                    variant="outline"
                    class="text-destructive hover:text-destructive"
                  >
                    <X class="mr-1 size-4" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this invitation to
                      {{ invitation.studentEmail }}?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="handleCancelInvitation(invitation.id)"
                    >
                      Cancel Invitation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
