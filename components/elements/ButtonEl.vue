<script setup lang="ts">
import { LockKeyhole } from 'lucide-vue-next';
import type { ButtonElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: ButtonElementDef; runtime?: any; builderMode?: boolean }>();
const emit = defineEmits<{ (e: 'action', el: ButtonElementDef): void }>();

const disabled = computed(() => Boolean(props.runtime?.isElementDisabled?.(props.element)));

async function handleClick() {
  if (props.builderMode || disabled.value) return;
  if (props.runtime) {
    await props.runtime.triggerElement(props.element, 'click');
    return;
  }
  emit('action', props.element);
}
</script>

<template>
  <button
    :class="[
      'w-full h-full rounded-lg font-medium text-sm transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
      element.variant === 'primary' && 'bg-brand-primary text-white hover:brightness-110',
      element.variant === 'secondary' && 'bg-brand-secondary text-white hover:brightness-110',
      element.variant === 'ghost' && 'border border-white/20 text-white/80 hover:bg-white/10',
      element.variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
    ]"
    :disabled="disabled"
    @click="handleClick"
  >
    <span class="inline-flex items-center justify-center gap-2">
      <LockKeyhole v-if="disabled" class="w-3.5 h-3.5" />
      {{ element.text }}
    </span>
  </button>
</template>
