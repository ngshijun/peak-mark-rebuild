<script setup lang="ts">
import { SidebarHeader, SidebarSeparator } from '@/components/ui/sidebar'
import { useT } from '@/composables/useT'
import logoSvg from '@/assets/logo.svg'

const t = useT()
</script>

<template>
  <SidebarHeader>
    <div class="flex items-center gap-2 px-2 py-1.5">
      <img :src="logoSvg" alt="Clavis logo" class="size-10" />
      <div class="grid flex-1 text-left text-sm leading-tight">
        <span class="font-logo translate-y-1 truncate text-lg font-medium text-primary"
          >Clavis</span
        >
        <span class="truncate text-xs text-muted-foreground">{{
          t.shared.layout.sidebar.learningPlatform
        }}</span>
      </div>
    </div>
    <SidebarSeparator />
  </SidebarHeader>
</template>
