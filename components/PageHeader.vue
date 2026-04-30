<script setup lang="ts">
defineProps<{
  title:    string;
  subtitle?: string;
}>();
</script>

<template>
  <header class="px-8 py-5 border-b border-white/8 flex items-center justify-between shrink-0">
    <div>
      <h1 class="text-xl font-bold text-white">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-white/40 mt-0.5">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-3">
      <slot />
    </div>
  </header>
</template>
