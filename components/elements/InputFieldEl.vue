<script setup lang="ts">
import type { InputFieldElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: InputFieldElementDef; runtime?: any; builderMode?: boolean }>();
const emit = defineEmits<{ (e: 'update', field: string, value: unknown): void }>();

const model = computed({
  get: () => String(props.runtime?.state?.value?.inputs?.[props.element.id] ?? props.element.defaultValue ?? ''),
  set: (value: string) => {
    props.runtime?.setInputValue?.(props.element.id, value);
  },
});

const disabled = computed(() => Boolean(props.runtime?.isElementDisabled?.(props.element)));

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  model.value = value;
  emit('update', props.element.fieldName, value);
}

async function onSelectChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  model.value = value;
  emit('update', props.element.fieldName, value);
  await commit('select:change');
}

async function commit(trigger: 'input:commit' | 'select:change') {
  if (props.builderMode || disabled.value) return;
  await props.runtime?.triggerElement?.(props.element, trigger);
}
</script>

<template>
  <div class="w-full h-full flex items-center">
    <template v-if="element.inputType === 'select'">
      <select
        :value="model"
        class="w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
        :style="{
          background: element.backgroundColor ?? 'rgba(255,255,255,0.05)',
          color: element.textColor ?? '#ffffff',
          border: `1px solid ${element.borderColor ?? 'rgba(255,255,255,0.15)'}`,
          borderRadius: `${element.radius ?? 12}px`,
        }"
        :disabled="disabled"
        @change="onSelectChange"
      >
        <option value="" disabled>{{ element.placeholder ?? 'Select...' }}</option>
        <option v-for="opt in element.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </template>
    <template v-else>
      <input
        :type="element.inputType"
        :placeholder="element.placeholder ?? ''"
        :value="model"
        :disabled="disabled"
        class="w-full h-full px-3 text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
        :style="{
          background: element.backgroundColor ?? 'rgba(255,255,255,0.05)',
          color: element.textColor ?? '#ffffff',
          border: `1px solid ${element.borderColor ?? 'rgba(255,255,255,0.15)'}`,
          borderRadius: `${element.radius ?? 12}px`,
        }"
        @input="onInput"
        @blur="commit('input:commit')"
        @keyup.enter="commit('input:commit')"
      />
    </template>
  </div>
</template>
