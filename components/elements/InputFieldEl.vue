<script setup lang="ts">
import type { InputFieldElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: InputFieldElementDef }>();
const emit  = defineEmits<{ (e: 'update', field: string, value: unknown): void }>();

const model = ref<string | number>('');

function onInput(ev: Event) {
  const v = (ev.target as HTMLInputElement).value;
  model.value = v;
  emit('update', props.element.fieldName, v);
}
</script>

<template>
  <div class="w-full h-full flex items-center">
    <template v-if="element.inputType === 'select'">
      <select
        class="w-full h-full bg-white/5 border border-white/15 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
        @change="ev => emit('update', element.fieldName, (ev.target as HTMLSelectElement).value)"
      >
        <option value="" disabled selected>{{ element.placeholder ?? 'Select…' }}</option>
        <option v-for="opt in element.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </template>
    <template v-else>
      <input
        :type="element.inputType"
        :placeholder="element.placeholder ?? ''"
        :value="model"
        class="w-full h-full bg-white/5 border border-white/15 rounded-lg px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        @input="onInput"
      />
    </template>
  </div>
</template>
