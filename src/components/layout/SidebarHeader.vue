<script setup lang="ts">
import { SidebarHeader, SidebarSeparator } from '@/components/ui/sidebar'
import logoSvg from '@/assets/logo.svg'
</script>

<template>
  <SidebarHeader>
    <div class="flex items-center gap-2 px-2 py-1.5">
      <img :src="logoSvg" alt="Clavis logo" class="size-10" />
      <div class="grid flex-1 text-left text-sm leading-tight">
        <span class="font-logo translate-y-1 truncate text-lg font-medium text-primary"
          >Clavis</span
        >
        <span class="truncate text-xs text-muted-foreground">Learning Platform</span>
      </div>
    </div>
    <SidebarSeparator />
  </SidebarHeader>
</template>
