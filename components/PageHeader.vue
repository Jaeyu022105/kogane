<script setup lang="ts">
defineProps<{
  title:    string;
  subtitle?: string;
}>();
</script>

<template>
  <header
    class="px-8 py-5 flex items-center justify-between shrink-0"
    style="background: rgb(var(--shell-bg)); border-bottom: 1px solid rgba(61,24,32,0.1);"
  >
    <div>
      <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-3">
      <slot />
    </div>
  </header>
</template>
