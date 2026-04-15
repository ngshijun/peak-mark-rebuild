<script setup lang="ts">
import { computed, ref } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFriendsStore, FRIEND_CAP } from '@/stores/friends'
import { useFriendSearch } from '@/composables/useFriendSearch'
import { useAuthStore } from '@/stores/auth'
import { getAvatarUrl } from '@/lib/storage'
import { getInitials } from '@/lib/utils'
import { toast } from 'vue-sonner'
import { Search, Copy, Loader2, UserPlus, SearchX } from 'lucide-vue-next'
import { useT } from '@/composables/useT'

const t = useT()

const authStore = useAuthStore()
const friendsStore = useFriendsStore()
const { searchTerm, results, isSearching } = useFriendSearch()
const sendingTo = ref<string | null>(null)

const friendCode = computed(() => authStore.studentProfile?.friendCode ?? '')

// Exclude existing friends and received requests from search results (but keep sent requests visible)
const hiddenIds = computed(() => {
  const ids = new Set<string>()
  for (const f of friendsStore.friends) ids.add(f.friendId)
  for (const r of friendsStore.receivedRequests) ids.add(r.studentId)
  return ids
})

const sentRequestIds = computed(() => new Set(friendsStore.sentRequests.map((r) => r.studentId)))

const filteredResults = computed(() => results.value.filter((r) => !hiddenIds.value.has(r.id)))

async function handleSendRequest(targetId: string, name: string) {
  if (friendsStore.isFriendCapReached) {
    toast.error(t.value.shared.addFriend.toastFriendListFull(FRIEND_CAP))
    return
  }
  sendingTo.value = targetId
  const { error } = await friendsStore.sendRequest(targetId)
  sendingTo.value = null

  if (error) {
    toast.error(error)
  } else {
    toast.success(t.value.shared.addFriend.toastRequestSent(name))
  }
}

async function copyFriendCode() {
  try {
    await navigator.clipboard.writeText(friendCode.value)
    toast.success(t.value.shared.addFriend.toastCopied)
  } catch {
    toast.error(t.value.shared.addFriend.toastCopyFailed)
  }
}
</script>

<template>
  <div class="space-y-6 pt-4">
    <!-- Friend code card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Copy class="size-5" />
          {{ t.shared.addFriend.friendCodeTitle }}
        </CardTitle>
        <CardDescription>{{ t.shared.addFriend.friendCodeDesc }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-between rounded-lg bg-muted p-3">
          <p class="font-mono text-lg font-bold tracking-widest text-primary">{{ friendCode }}</p>
          <Button size="sm" variant="outline" @click="copyFriendCode">
            <Copy class="size-4" />
            {{ t.shared.addFriend.copy }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Search card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <UserPlus class="size-5" />
          {{ t.shared.addFriend.findFriendsTitle }}
        </CardTitle>
        <CardDescription>{{ t.shared.addFriend.findFriendsDesc }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="searchTerm"
            :placeholder="t.shared.addFriend.searchPlaceholder"
            class="pl-9"
          />
        </div>

        <p v-if="friendsStore.isFriendCapReached" class="text-sm text-destructive">
          {{ t.shared.addFriend.friendLimitReached(FRIEND_CAP) }}
        </p>

        <!-- Search results -->
        <div v-if="isSearching" class="flex items-center justify-center py-12">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="searchTerm && filteredResults.length === 0" class="py-8 text-center">
          <SearchX class="mx-auto size-12 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">{{ t.shared.addFriend.noStudentsFound }}</p>
          <p class="text-xs text-muted-foreground">{{ t.shared.addFriend.tryDifferent }}</p>
        </div>

        <div v-else-if="filteredResults.length > 0" class="space-y-2">
          <div
            v-for="student in filteredResults"
            :key="student.id"
            class="flex items-center gap-3 rounded-lg border p-3"
          >
            <Avatar class="size-10">
              <AvatarImage :src="getAvatarUrl(student.avatarPath)" :alt="student.name" />
              <AvatarFallback>{{ getInitials(student.name) }}</AvatarFallback>
            </Avatar>

            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ student.name }}</p>
              <p class="font-mono text-xs text-muted-foreground">{{ student.friendCode }}</p>
            </div>

            <Button v-if="sentRequestIds.has(student.id)" size="sm" variant="secondary" disabled>
              {{ t.shared.addFriend.requestSent }}
            </Button>
            <Button
              v-else
              size="sm"
              :disabled="friendsStore.isFriendCapReached || sendingTo === student.id"
              @click="handleSendRequest(student.id, student.name)"
            >
              <Loader2 v-if="sendingTo === student.id" class="size-4 animate-spin" />
              <UserPlus v-else class="size-4" />
              {{ t.shared.addFriend.add }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
