<script setup lang="ts">
/**
 * Reusable empty state component.
 */
defineProps<{
  icon:    string;
  title:   string;
  message?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 gap-3 text-center">
    <div class="text-4xl">{{ icon }}</div>
    <p class="text-white/40 text-sm font-medium">{{ title }}</p>
    <p v-if="message" class="text-white/25 text-xs max-w-xs">{{ message }}</p>
    <slot />
  </div>
</template>
