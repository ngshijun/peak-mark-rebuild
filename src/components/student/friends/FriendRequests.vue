<script setup lang="ts">
import { ref } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useFriendsStore } from '@/stores/friends'
import { getAvatarUrl } from '@/lib/storage'
import { getInitials } from '@/lib/utils'
import { toast } from 'vue-sonner'
import { Check, X, Loader2 } from 'lucide-vue-next'

const friendsStore = useFriendsStore()
const respondingTo = ref<string | null>(null)

async function handleRespond(friendshipId: string, name: string, accept: boolean) {
  respondingTo.value = friendshipId
  const { error } = await friendsStore.respondRequest(friendshipId, accept)
  respondingTo.value = null

  if (error) {
    toast.error(error)
  } else {
    toast.success(accept ? `You and ${name} are now friends!` : `Declined request from ${name}`)
  }
}

async function handleCancel(friendshipId: string) {
  respondingTo.value = friendshipId
  const { error } = await friendsStore.removeFriend(friendshipId)
  respondingTo.value = null

  if (error) {
    toast.error(error)
  } else {
    toast.success('Request cancelled')
    await friendsStore.fetchRequests()
  }
}
</script>

<template>
  <div class="space-y-6 pt-4">
    <!-- Received requests -->
    <div>
      <h3 class="mb-3 text-sm font-medium">Received</h3>
      <div v-if="friendsStore.receivedRequests.length === 0" class="text-sm text-muted-foreground">
        No pending requests
      </div>
      <div
        v-for="req in friendsStore.receivedRequests"
        v-else
        :key="req.friendshipId"
        class="mb-2 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
      >
        <Avatar class="size-10">
          <AvatarImage :src="getAvatarUrl(req.avatarPath)" :alt="req.name" />
          <AvatarFallback>{{ getInitials(req.name) }}</AvatarFallback>
        </Avatar>

        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ req.name }}</p>
          <p class="text-xs text-muted-foreground">Wants to be your friend</p>
        </div>

        <div class="flex gap-2">
          <Button
            size="sm"
            :disabled="respondingTo === req.friendshipId"
            @click="handleRespond(req.friendshipId, req.name, true)"
          >
            <Loader2 v-if="respondingTo === req.friendshipId" class="size-4 animate-spin" />
            <Check v-else class="size-4" />
            Accept
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

    <!-- Sent requests -->
    <div>
      <h3 class="mb-3 text-sm font-medium">Sent</h3>
      <div v-if="friendsStore.sentRequests.length === 0" class="text-sm text-muted-foreground">
        No sent requests
      </div>
      <div
        v-for="req in friendsStore.sentRequests"
        v-else
        :key="req.friendshipId"
        class="mb-2 flex items-center gap-3 rounded-lg border p-3"
      >
        <Avatar class="size-10">
          <AvatarImage :src="getAvatarUrl(req.avatarPath)" :alt="req.name" />
          <AvatarFallback>{{ getInitials(req.name) }}</AvatarFallback>
        </Avatar>

        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ req.name }}</p>
          <p class="text-xs text-muted-foreground">Pending</p>
        </div>

        <Button
          size="sm"
          variant="outline"
          :disabled="respondingTo === req.friendshipId"
          @click="handleCancel(req.friendshipId)"
        >
          Cancel
        </Button>
      </div>
    </div>
  </div>
</template>
