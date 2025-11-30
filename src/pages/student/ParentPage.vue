<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useParentLinkStore } from '@/stores/parent-link'
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
import { Users, Mail, Send, Check, X, Trash2, Clock, UserPlus, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const parentLinkStore = useParentLinkStore()

const inviteDialogOpen = ref(false)
const inviteEmail = ref('')
const inviteError = ref('')
const inviteSuccess = ref(false)
const isSending = ref(false)
const processingInvitationId = ref<string | null>(null)
const removingParentId = ref<string | null>(null)

// Fetch data on mount
onMounted(async () => {
  await parentLinkStore.fetchAll()
})

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function handleSendInvitation() {
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

  isSending.value = true

  try {
    const result = await parentLinkStore.sendInvitation(inviteEmail.value.trim())
    if (result.error) {
      inviteError.value = result.error
    } else {
      inviteSuccess.value = true
      inviteEmail.value = ''
      toast.success('Invitation sent successfully!')
      setTimeout(() => {
        inviteSuccess.value = false
        inviteDialogOpen.value = false
      }, 1500)
    }
  } finally {
    isSending.value = false
  }
}

async function handleAcceptInvitation(invitationId: string) {
  processingInvitationId.value = invitationId
  try {
    const result = await parentLinkStore.acceptInvitation(invitationId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Invitation accepted!')
    }
  } finally {
    processingInvitationId.value = null
  }
}

async function handleRejectInvitation(invitationId: string) {
  processingInvitationId.value = invitationId
  try {
    const result = await parentLinkStore.rejectInvitation(invitationId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Invitation declined')
    }
  } finally {
    processingInvitationId.value = null
  }
}

async function handleCancelInvitation(invitationId: string) {
  processingInvitationId.value = invitationId
  try {
    const result = await parentLinkStore.cancelInvitation(invitationId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Invitation cancelled')
    }
  } finally {
    processingInvitationId.value = null
  }
}

async function handleRemoveParent(parentId: string) {
  removingParentId.value = parentId
  try {
    const result = await parentLinkStore.removeLinkedParent(parentId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Parent removed')
    }
  } finally {
    removingParentId.value = null
  }
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
        <h1 class="text-2xl font-bold">Parent</h1>
        <p class="text-muted-foreground">Manage your linked parents and invitations</p>
      </div>
      <Dialog v-model:open="inviteDialogOpen" @update:open="resetInviteForm">
        <DialogTrigger as-child>
          <Button>
            <UserPlus class="mr-2 size-4" />
            Invite Parent
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Parent</DialogTitle>
            <DialogDescription>
              Send an invitation to link a parent account. They will be able to view your progress.
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="handleSendInvitation">
            <div class="space-y-2">
              <Label for="parentEmail">Parent's Email</Label>
              <Input
                id="parentEmail"
                v-model="inviteEmail"
                type="email"
                placeholder="Enter parent's email address"
                :disabled="isSending"
              />
              <p v-if="inviteError" class="text-sm text-destructive">{{ inviteError }}</p>
              <p v-if="inviteSuccess" class="text-sm text-green-600">
                Invitation sent successfully!
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" :disabled="isSending || inviteSuccess">
                <Loader2 v-if="isSending" class="mr-2 size-4 animate-spin" />
                <Send v-else class="mr-2 size-4" />
                {{ isSending ? 'Sending...' : 'Send Invitation' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Loading State -->
    <div v-if="parentLinkStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Linked Parents Card -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Users class="size-5" />
            Linked Parents
          </CardTitle>
          <CardDescription>Parents who can view your progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="parentLinkStore.linkedParents.length === 0" class="py-8 text-center">
            <Users class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">No linked parents yet</p>
            <p class="text-xs text-muted-foreground">Invite a parent to get started</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="parent in parentLinkStore.linkedParents"
              :key="parent.id"
              class="flex items-center gap-3 rounded-lg border p-3"
            >
              <Avatar>
                <AvatarFallback>{{ getInitials(parent.name) }}</AvatarFallback>
              </Avatar>
              <div class="flex-1">
                <p class="font-medium">{{ parent.name }}</p>
                <p class="text-sm text-muted-foreground">{{ parent.email }}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="text-destructive hover:text-destructive"
                    :disabled="removingParentId === parent.id"
                  >
                    <Loader2 v-if="removingParentId === parent.id" class="size-4 animate-spin" />
                    <Trash2 v-else class="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Parent</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {{ parent.name }} from your linked parents?
                      They will no longer be able to view your progress.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="handleRemoveParent(parent.id)"
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

      <!-- Received Invitations (from parents) Card -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Mail class="size-5" />
            Invitations from Parents
            <Badge v-if="parentLinkStore.receivedInvitations.length > 0" variant="secondary">
              {{ parentLinkStore.receivedInvitations.length }}
            </Badge>
          </CardTitle>
          <CardDescription>Parents who want to link with you</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="parentLinkStore.receivedInvitations.length === 0" class="py-8 text-center">
            <Mail class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">No pending invitations</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="invitation in parentLinkStore.receivedInvitations"
              :key="invitation.id"
              class="rounded-lg border p-4"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-medium">{{ invitation.parentName || invitation.parentEmail }}</p>
                  <p class="text-sm text-muted-foreground">{{ invitation.parentEmail }}</p>
                  <p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock class="size-3" />
                    {{ formatDate(invitation.createdAt) }}
                  </p>
                </div>
                <Badge variant="outline">Pending</Badge>
              </div>
              <div class="mt-3 flex gap-2">
                <Button
                  size="sm"
                  :disabled="processingInvitationId === invitation.id"
                  @click="handleAcceptInvitation(invitation.id)"
                >
                  <Loader2
                    v-if="processingInvitationId === invitation.id"
                    class="mr-1 size-4 animate-spin"
                  />
                  <Check v-else class="mr-1 size-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="processingInvitationId === invitation.id"
                  @click="handleRejectInvitation(invitation.id)"
                >
                  <X class="mr-1 size-4" />
                  Decline
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Sent Invitations (to parents) Card -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Send class="size-5" />
            Sent Invitations
            <Badge v-if="parentLinkStore.sentInvitations.length > 0" variant="secondary">
              {{ parentLinkStore.sentInvitations.length }}
            </Badge>
          </CardTitle>
          <CardDescription>Invitations you've sent to parents</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="parentLinkStore.sentInvitations.length === 0" class="py-8 text-center">
            <Send class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">No pending invitations</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="invitation in parentLinkStore.sentInvitations"
              :key="invitation.id"
              class="rounded-lg border p-4"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-medium">{{ invitation.parentEmail }}</p>
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
                      :disabled="processingInvitationId === invitation.id"
                    >
                      <Loader2
                        v-if="processingInvitationId === invitation.id"
                        class="mr-1 size-4 animate-spin"
                      />
                      <X v-else class="mr-1 size-4" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel this invitation to
                        {{ invitation.parentEmail }}?
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
    </template>
  </div>
</template>
