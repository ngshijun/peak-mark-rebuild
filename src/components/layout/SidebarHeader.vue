<script setup lang="ts">
import {
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import logoSvg from '@/assets/logo.svg'
</script>

<template>
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" as-child>
          <a href="#">
            <img :src="logoSvg" alt="Clavis logo" class="size-10" />
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="font-logo translate-y-1 truncate text-lg font-medium text-primary"
                >Clavis</span
              >
              <span class="truncate text-xs text-muted-foreground">Learning Platform</span>
            </div>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
    <SidebarSeparator />
  </SidebarHeader>
</template>
