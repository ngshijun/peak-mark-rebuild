<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useFriendsStore, FRIEND_CAP } from '@/stores/friends'
import { getAvatarUrl } from '@/lib/storage'
import { getInitials } from '@/lib/utils'
import { toast } from 'vue-sonner'
import { Check, X, Loader2, Mail, Send } from 'lucide-vue-next'
import { useT } from '@/composables/useT'

const friendsStore = useFriendsStore()
const t = useT()
const respondingTo = ref<string | null>(null)

async function handleRespond(friendshipId: string, name: string, accept: boolean) {
  if (accept && friendsStore.isFriendCapReached) {
    toast.error(t.value.shared.friendRequests.toastFriendListFull(FRIEND_CAP))
    return
  }
  respondingTo.value = friendshipId
  const { error } = await friendsStore.respondRequest(friendshipId, accept)
  respondingTo.value = null

  if (error) {
    toast.error(error)
  } else {
    toast.success(
      accept
        ? t.value.shared.friendRequests.toastAccepted(name)
        : t.value.shared.friendRequests.toastDeclined(name),
    )
  }
}

async function handleCancel(friendshipId: string) {
  respondingTo.value = friendshipId
  const { error } = await friendsStore.removeFriend(friendshipId)
  respondingTo.value = null

  if (error) {
    toast.error(error)
  } else {
    toast.success(t.value.shared.friendRequests.toastCancelled)
  }
}
</script>

<template>
  <div class="space-y-6 pt-4">
    <!-- Received requests -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Mail class="size-5" />
          {{ t.shared.friendRequests.receivedTitle }}
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div v-if="friendsStore.receivedRequests.length === 0" class="py-8 text-center">
          <Mail class="mx-auto size-12 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">
            {{ t.shared.friendRequests.noPendingReceived }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t.shared.friendRequests.noPendingReceivedHint }}
          </p>
        </div>
        <div v-else class="divide-y border-y">
          <div
            v-for="req in friendsStore.receivedRequests"
            :key="req.friendshipId"
            class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
          >
            <Avatar class="size-10">
              <AvatarImage :src="getAvatarUrl(req.avatarPath)" :alt="req.name" />
              <AvatarFallback>{{ getInitials(req.name) }}</AvatarFallback>
            </Avatar>

            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ req.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ t.shared.friendRequests.wantsToBeYourFriend }}
              </p>
            </div>

            <div class="flex gap-2">
              <Button
                size="sm"
                :disabled="respondingTo === req.friendshipId"
                @click="handleRespond(req.friendshipId, req.name, true)"
              >
                <Loader2 v-if="respondingTo === req.friendshipId" class="size-4 animate-spin" />
                <Check v-else class="size-4" />
                {{ t.shared.friendRequests.accept }}
              </Button>
              <Button
                size="sm"
                variant="outline"
                :disabled="respondingTo === req.friendshipId"
                @click="handleRespond(req.friendshipId, req.name, false)"
              >
                <X class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Sent requests -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Send class="size-5" />
          {{ t.shared.friendRequests.sentTitle }}
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div v-if="friendsStore.sentRequests.length === 0" class="py-8 text-center">
          <Send class="mx-auto size-12 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">
            {{ t.shared.friendRequests.noSentRequests }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t.shared.friendRequests.noSentRequestsHint }}
          </p>
        </div>
        <div v-else class="divide-y border-y">
          <div
            v-for="req in friendsStore.sentRequests"
            :key="req.friendshipId"
            class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
          >
            <Avatar class="size-10">
              <AvatarImage :src="getAvatarUrl(req.avatarPath)" :alt="req.name" />
              <AvatarFallback>{{ getInitials(req.name) }}</AvatarFallback>
            </Avatar>

            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ req.name }}</p>
              <p class="text-xs text-muted-foreground">{{ t.shared.friendRequests.pending }}</p>
            </div>

            <Button
              size="sm"
              variant="outline"
              :disabled="respondingTo === req.friendshipId"
              @click="handleCancel(req.friendshipId)"
            >
              {{ t.shared.friendRequests.cancel }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
