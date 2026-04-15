<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useT } from '@/composables/useT'

const t = useT()

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
  <AlertDialog :open="props.open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t.shared.removeFriendDialog.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t.shared.removeFriendDialog.description(props.friendName) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t.shared.removeFriendDialog.cancel }}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          {{ t.shared.removeFriendDialog.remove }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
