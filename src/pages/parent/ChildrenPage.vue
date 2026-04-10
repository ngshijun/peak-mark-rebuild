<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useT } from '@/composables/useT'
import { useChildLinkStore } from '@/stores/child-link'
import { getAvatarUrl } from '@/lib/storage'
import { useSubscriptionStore } from '@/stores/subscription'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import InviteDialog from '@/components/shared/InviteDialog.vue'
import InvitationCards from '@/components/shared/InvitationCards.vue'
import ChildProfileDialog from '@/components/parent/ChildProfileDialog.vue'
import type { LinkedChild } from '@/stores/child-link'
import { Users, Trash2, Loader2 } from 'lucide-vue-next'
import fireGif from '@/assets/icons/fire.gif'
import { toast } from 'vue-sonner'
import { getInitials } from '@/lib/utils'
import { computeLevel } from '@/lib/xp'
import { formatRelativeDate } from '@/lib/date'

const childLinkStore = useChildLinkStore()
const subscriptionStore = useSubscriptionStore()
const t = useT()

const showChildDialog = ref(false)
const selectedChild = ref<LinkedChild | null>(null)

function handleChildClick(child: LinkedChild) {
  selectedChild.value = child
  showChildDialog.value = true
}

function hasActivePaidSubscription(childId: string): boolean {
  const sub = subscriptionStore.getChildSubscription(childId)
  return sub.isActive && sub.tier !== 'core'
}

const inviteDialogOpen = ref(false)
const inviteSuccess = ref(false)
const isSending = ref(false)
const actionInProgress = ref<string | null>(null)
const inviteDialogRef = ref<InstanceType<typeof InviteDialog> | null>(null)

onMounted(async () => {
  await childLinkStore.fetchAll()
})

async function handleInviteSubmit(email: string) {
  inviteSuccess.value = false
  isSending.value = true

  try {
    const result = await childLinkStore.sendInvitation(email)
    if (result.error) {
      inviteDialogRef.value?.setFieldError('email', result.error)
    } else {
      inviteSuccess.value = true
      toast.success(t.value.parent.children.toastInvitationSent)
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
  actionInProgress.value = invitationId
  const result = await childLinkStore.acceptInvitation(invitationId)
  actionInProgress.value = null
  if (result.error) {
    toast.error(result.error)
  } else {
    toast.success(t.value.parent.children.toastChildLinked)
  }
}

async function handleRejectInvitation(invitationId: string) {
  actionInProgress.value = invitationId
  const result = await childLinkStore.rejectInvitation(invitationId)
  actionInProgress.value = null
  if (result.error) {
    toast.error(result.error)
  } else {
    toast.success(t.value.parent.children.toastInvitationDeclined)
  }
}

async function handleCancelInvitation(invitationId: string) {
  actionInProgress.value = invitationId
  const result = await childLinkStore.cancelInvitation(invitationId)
  actionInProgress.value = null
  if (result.error) {
    toast.error(result.error)
  } else {
    toast.success(t.value.parent.children.toastInvitationCancelled)
  }
}

async function handleRemoveChild(childId: string) {
  actionInProgress.value = childId
  const { error } = await childLinkStore.removeLinkedChild(childId)
  actionInProgress.value = null
  if (error) {
    toast.error(error)
  } else {
    toast.info(t.value.parent.children.toastChildRemoved)
  }
}
</script>

<template>
  <div class="space-y-6 p-6">
    <!-- Header with Invite Button -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t.parent.children.title }}</h1>
        <p class="text-muted-foreground">{{ t.parent.children.subtitle }}</p>
      </div>
      <InviteDialog
        ref="inviteDialogRef"
        v-model:open="inviteDialogOpen"
        :entity-label="t.parent.children.entityLabel"
        :is-sending="isSending"
        :invite-success="inviteSuccess"
        :trigger-disabled="childLinkStore.isLoading"
        @submit="handleInviteSubmit"
        @reset="inviteSuccess = false"
      >
        <template #description>
          {{ t.parent.children.inviteDialogDescription }}
        </template>
      </InviteDialog>
    </div>

    <!-- Loading State -->
    <div v-if="childLinkStore.isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Linked Children Card -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Users class="size-5" />
            {{ t.parent.children.linkedChildrenTitle }}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <div v-if="childLinkStore.linkedChildren.length === 0" class="py-8 text-center">
            <Users class="mx-auto size-12 text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">
              {{ t.parent.children.noLinkedChildren }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t.parent.children.noLinkedChildrenHint }}
            </p>
          </div>
          <div v-else class="divide-y border-y">
            <div
              v-for="child in childLinkStore.linkedChildren"
              :key="child.id"
              class="flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
              @click="handleChildClick(child)"
            >
              <Avatar class="size-10">
                <AvatarImage :src="getAvatarUrl(child.avatarPath)" :alt="child.name" />
                <AvatarFallback>{{ getInitials(child.name) }}</AvatarFallback>
              </Avatar>

              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ child.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ child.gradeLevelName ?? t.parent.children.noGradeSet }}
                </p>
              </div>

              <div class="flex items-start gap-6">
                <div class="w-12 text-center">
                  <p class="text-xs text-muted-foreground">{{ t.parent.children.levelLabel }}</p>
                  <p class="flex h-6 items-center justify-center font-semibold">
                    {{ computeLevel(child.xp) }}
                  </p>
                </div>
                <div class="w-12 text-center">
                  <p class="text-xs text-muted-foreground">{{ t.parent.children.streakLabel }}</p>
                  <p class="flex h-6 items-center justify-center gap-1 font-semibold">
                    <img
                      v-if="child.currentStreak > 0"
                      :src="fireGif"
                      alt="fire"
                      loading="lazy"
                      class="size-4"
                    />
                    {{ child.currentStreak }}
                  </p>
                </div>
                <div class="w-20 text-center">
                  <p class="text-xs text-muted-foreground">
                    {{ t.parent.children.lastActiveLabel }}
                  </p>
                  <p class="flex h-6 items-center justify-center font-semibold">
                    {{ formatRelativeDate(child.lastActive) }}
                  </p>
                </div>
              </div>
              <AlertDialog @click.stop>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="text-destructive hover:text-destructive"
                    :disabled="actionInProgress === child.id"
                  >
                    <Loader2 v-if="actionInProgress === child.id" class="size-4 animate-spin" />
                    <Trash2 v-else class="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{{ t.parent.children.removeChildTitle }}</AlertDialogTitle>
                    <AlertDialogDescription v-if="hasActivePaidSubscription(child.id)">
                      {{ t.parent.children.removeChildHasSub(child.name) }}
                    </AlertDialogDescription>
                    <AlertDialogDescription v-else>
                      {{ t.parent.children.removeChildConfirm(child.name) }}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel v-if="hasActivePaidSubscription(child.id)">
                      {{ t.parent.children.removeChildClose }}
                    </AlertDialogCancel>
                    <template v-else>
                      <AlertDialogCancel>{{
                        t.parent.children.removeChildCancel
                      }}</AlertDialogCancel>
                      <AlertDialogAction
                        class="bg-destructive text-white hover:bg-destructive/90"
                        @click="handleRemoveChild(child.id)"
                      >
                        {{ t.parent.children.removeChildAction }}
                      </AlertDialogAction>
                    </template>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <InvitationCards
        :received-invitations="childLinkStore.receivedInvitations"
        :sent-invitations="childLinkStore.sentInvitations"
        :processing-id="actionInProgress"
        :received-title="t.parent.children.receivedInvitationsTitle"
        :sent-title="t.parent.children.sentInvitationsTitle"
        :get-display-name="(inv) => inv.studentName || inv.studentEmail"
        :get-display-email="(inv) => inv.studentEmail"
        :get-sent-email="(inv) => inv.studentEmail"
        @accept="handleAcceptInvitation"
        @reject="handleRejectInvitation"
        @cancel="handleCancelInvitation"
      />
    </template>

    <ChildProfileDialog v-model:open="showChildDialog" :child="selectedChild" />
  </div>
</template>
