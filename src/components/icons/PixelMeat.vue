<script setup lang="ts">
defineProps<{
  size?: number
}>()
</script>

<template>
  <svg
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="inline-block"
    style="image-rendering: pixelated"
  >
    <!-- Bone ends - white/cream -->
    <rect x="1" y="2" width="2" height="2" fill="#F5F5DC" />
    <rect x="1" y="5" width="2" height="2" fill="#F5F5DC" />
    <rect x="13" y="9" width="2" height="2" fill="#F5F5DC" />
    <rect x="13" y="12" width="2" height="2" fill="#F5F5DC" />

    <!-- Bone outline -->
    <rect x="0" y="3" width="1" height="3" fill="#D2B48C" />
    <rect x="3" y="2" width="1" height="1" fill="#D2B48C" />
    <rect x="3" y="6" width="1" height="1" fill="#D2B48C" />
    <rect x="12" y="9" width="1" height="1" fill="#D2B48C" />
    <rect x="12" y="13" width="1" height="1" fill="#D2B48C" />
    <rect x="15" y="10" width="1" height="3" fill="#D2B48C" />

    <!-- Meat - main red -->
    <rect x="3" y="3" width="10" height="8" fill="#CD5C5C" />
    <rect x="4" y="2" width="8" height="1" fill="#CD5C5C" />
    <rect x="4" y="11" width="8" height="1" fill="#CD5C5C" />

    <!-- Meat - darker red shadow -->
    <rect x="5" y="9" width="6" height="2" fill="#8B0000" />
    <rect x="4" y="10" width="2" height="1" fill="#8B0000" />
    <rect x="10" y="10" width="2" height="1" fill="#8B0000" />

    <!-- Meat - highlight -->
    <rect x="5" y="4" width="3" height="2" fill="#F08080" />
    <rect x="4" y="5" width="1" height="1" fill="#F08080" />

    <!-- Meat - fat/marbling -->
    <rect x="9" y="5" width="2" height="1" fill="#FFE4E1" />
    <rect x="6" y="7" width="1" height="1" fill="#FFE4E1" />
    <rect x="10" y="7" width="1" height="1" fill="#FFE4E1" />
  </svg>
</template>
