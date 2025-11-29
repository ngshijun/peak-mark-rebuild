<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const themeStore = useThemeStore()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8">
        <Sun v-if="themeStore.theme === 'light'" class="size-4" />
        <Moon v-else-if="themeStore.theme === 'dark'" class="size-4" />
        <Monitor v-else class="size-4" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="themeStore.setTheme('light')">
        <Sun class="mr-2 size-4" />
        Light
      </DropdownMenuItem>
      <DropdownMenuItem @click="themeStore.setTheme('dark')">
        <Moon class="mr-2 size-4" />
        Dark
      </DropdownMenuItem>
      <DropdownMenuItem @click="themeStore.setTheme('system')">
        <Monitor class="mr-2 size-4" />
        System
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
