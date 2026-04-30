<script setup lang="ts">
import type { ButtonElementDef } from '~/lib/uiTypes';

defineProps<{ element: ButtonElementDef }>();
const emit = defineEmits<{ (e: 'action', el: ButtonElementDef): void }>();
</script>

<template>
  <button
    :class="[
      'w-full h-full rounded-lg font-medium text-sm transition-all duration-150 active:scale-95',
      element.variant === 'primary'   && 'bg-brand-primary text-white hover:brightness-110',
      element.variant === 'secondary' && 'bg-brand-secondary text-white hover:brightness-110',
      element.variant === 'ghost'     && 'border border-white/20 text-white/80 hover:bg-white/10',
      element.variant === 'danger'    && 'bg-red-600 text-white hover:bg-red-500',
    ]"
    @click="emit('action', element)"
  >
    {{ element.text }}
  </button>
</template>
