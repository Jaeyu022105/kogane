<script setup lang="ts">
/**
 * Reusable empty state component.
 */
defineProps<{
  icon:     string;
  title:    string;
  message?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 gap-3 text-center">
    <div
      class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-1"
      style="background: rgba(61,24,32,0.06);"
    >
      {{ icon }}
    </div>
    <p class="text-sm font-semibold" style="color: rgba(61,24,32,0.5);">{{ title }}</p>
    <p v-if="message" class="text-xs max-w-xs" style="color: rgba(61,24,32,0.35);">{{ message }}</p>
    <slot />
  </div>
</template>
