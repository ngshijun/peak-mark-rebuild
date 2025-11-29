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
    <!-- Outer ring - dark gold -->
    <rect x="5" y="0" width="6" height="1" fill="#B8860B" />
    <rect x="3" y="1" width="2" height="1" fill="#B8860B" />
    <rect x="11" y="1" width="2" height="1" fill="#B8860B" />
    <rect x="2" y="2" width="1" height="1" fill="#B8860B" />
    <rect x="13" y="2" width="1" height="1" fill="#B8860B" />
    <rect x="1" y="3" width="1" height="2" fill="#B8860B" />
    <rect x="14" y="3" width="1" height="2" fill="#B8860B" />
    <rect x="0" y="5" width="1" height="6" fill="#B8860B" />
    <rect x="15" y="5" width="1" height="6" fill="#B8860B" />
    <rect x="1" y="11" width="1" height="2" fill="#B8860B" />
    <rect x="14" y="11" width="1" height="2" fill="#B8860B" />
    <rect x="2" y="13" width="1" height="1" fill="#B8860B" />
    <rect x="13" y="13" width="1" height="1" fill="#B8860B" />
    <rect x="3" y="14" width="2" height="1" fill="#B8860B" />
    <rect x="11" y="14" width="2" height="1" fill="#B8860B" />
    <rect x="5" y="15" width="6" height="1" fill="#B8860B" />

    <!-- Main gold fill -->
    <rect x="5" y="1" width="6" height="1" fill="#FFD700" />
    <rect x="3" y="2" width="10" height="1" fill="#FFD700" />
    <rect x="2" y="3" width="12" height="2" fill="#FFD700" />
    <rect x="1" y="5" width="14" height="6" fill="#FFD700" />
    <rect x="2" y="11" width="12" height="2" fill="#FFD700" />
    <rect x="3" y="13" width="10" height="1" fill="#FFD700" />
    <rect x="5" y="14" width="6" height="1" fill="#FFD700" />

    <!-- Highlight - light gold/yellow -->
    <rect x="5" y="2" width="4" height="1" fill="#FFEC8B" />
    <rect x="3" y="3" width="3" height="1" fill="#FFEC8B" />
    <rect x="2" y="4" width="3" height="1" fill="#FFEC8B" />
    <rect x="2" y="5" width="2" height="3" fill="#FFEC8B" />

    <!-- Shadow - darker gold -->
    <rect x="12" y="10" width="2" height="1" fill="#DAA520" />
    <rect x="11" y="11" width="3" height="1" fill="#DAA520" />
    <rect x="10" y="12" width="3" height="1" fill="#DAA520" />
    <rect x="9" y="13" width="2" height="1" fill="#DAA520" />

    <!-- Center dollar sign or decoration -->
    <rect x="7" y="4" width="2" height="1" fill="#DAA520" />
    <rect x="6" y="5" width="1" height="1" fill="#DAA520" />
    <rect x="7" y="6" width="2" height="1" fill="#DAA520" />
    <rect x="9" y="7" width="1" height="1" fill="#DAA520" />
    <rect x="7" y="8" width="2" height="1" fill="#DAA520" />
    <rect x="6" y="9" width="1" height="1" fill="#DAA520" />
    <rect x="7" y="10" width="2" height="1" fill="#DAA520" />
  </svg>
</template>
