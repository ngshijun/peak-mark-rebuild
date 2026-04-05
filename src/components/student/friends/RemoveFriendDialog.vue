<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  friendName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Remove Friend</DialogTitle>
        <DialogDescription>
          Are you sure you want to remove <strong>{{ props.friendName }}</strong> from your friends?
          Your closeness level will be reset.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
        <Button variant="destructive" @click="emit('confirm')">Remove</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
