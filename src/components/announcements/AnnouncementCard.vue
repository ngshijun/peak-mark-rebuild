<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pin } from 'lucide-vue-next'
import type { Announcement } from '@/stores/announcements'
import { getAudienceConfig } from '@/stores/announcements'
import { formatTimeAgo } from '@/lib/date'
import { useT } from '@/composables/useT'

const t = useT()

defineProps<{
  announcement: Announcement
  showUnreadIndicator?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  click: [announcement: Announcement]
}>()
</script>

<template>
  <Card
    class="cursor-pointer transition-colors hover:bg-muted/50"
    :class="{ 'opacity-60': showUnreadIndicator && announcement.isRead }"
    @click="emit('click', announcement)"
  >
    <CardHeader class="pb-2" :class="compact ? 'p-3' : ''">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <!-- Unread indicator -->
          <div
            v-if="showUnreadIndicator && !announcement.isRead"
            class="size-2 shrink-0 rounded-full bg-primary"
          />
          <!-- Pin indicator -->
          <Pin v-if="announcement.isPinned" class="size-3.5 shrink-0 text-primary" />
          <CardTitle class="text-base font-semibold truncate" :class="compact ? 'text-sm' : ''">
            {{ announcement.title }}
          </CardTitle>
        </div>
        <Badge
          v-if="!compact"
          variant="outline"
          :class="getAudienceConfig()[announcement.targetAudience].color"
          class="shrink-0"
        >
          {{ getAudienceConfig()[announcement.targetAudience].label }}
        </Badge>
      </div>
    </CardHeader>
    <CardContent :class="compact ? 'p-3 pt-0' : ''">
      <!-- Time ago -->
      <p class="text-xs text-muted-foreground">
        {{ formatTimeAgo(announcement.createdAt, t.shared.timeAgo) }}
      </p>
    </CardContent>
  </Card>
</template>
