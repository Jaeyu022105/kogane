<script setup lang="ts">
/**
 * Inline spinner with optional label.
 */
defineProps<{
  label?: string;
  size?:  'sm' | 'md' | 'lg';
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div
      :class="[
        'rounded-full border-2 border-t-transparent animate-spin',
        size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8',
      ]"
      style="border-color: rgba(61,24,32,0.2); border-top-color: transparent;"
    />
    <p v-if="label" class="text-xs" style="color: rgba(61,24,32,0.45);">{{ label }}</p>
  </div>
</template>
