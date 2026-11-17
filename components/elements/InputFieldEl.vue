<script setup lang="ts">
import EyeIcon from 'reicon-vue/icons/Eye';
import EyeOffIcon from 'reicon-vue/icons/EyeOff';
import type { InputFieldElementDef } from '~/lib/uiTypes';
import { isLightColor } from '~/lib/workspaceBranding';
import { sanitizeTextInput } from '~/lib/securityClient';

const props = defineProps<{ element: InputFieldElementDef; runtime?: any; builderMode?: boolean }>();
const emit = defineEmits<{ (e: 'update', field: string, value: unknown): void }>();

const isLight = computed(() => isLightColor(props.element.backgroundColor));
const inputColor = computed(() => props.element.textColor ?? (isLight.value ? '#261a14' : '#ffffff'));
const inputBg = computed(() => props.element.backgroundColor ?? (isLight.value ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'));
const inputBorder = computed(() => props.element.borderColor ?? (isLight.value ? 'rgba(81,49,31,0.18)' : 'rgba(255,255,255,0.15)'));

const showPassword = ref(false);
const computedInputType = computed(() => {
  if (props.element.inputType === 'password') {
    return showPassword.value ? 'text' : 'password';
  }
  return props.element.inputType;
});

const MAX_INPUT_LENGTH = computed(() => {
  const configured = Number(props.element.maxLength);
  if (Number.isFinite(configured) && configured > 0) return Math.min(Math.floor(configured), 10_000);
  return 1000;
});

const model = computed({
  get: () => {
    const raw = props.runtime?.state?.value?.inputs?.[props.element.id];
    if (raw !== undefined && raw !== null) return String(raw);
    return props.element.defaultValue ?? '';
  },
  set: (value: string) => {
    const clean = sanitizeTextInput(value, MAX_INPUT_LENGTH.value, false);
    props.runtime?.setInputValue?.(props.element.id, clean, props.element.fieldName);
  },
});

const disabled = computed(() => Boolean(props.runtime?.isElementDisabled?.(props.element)));

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = sanitizeTextInput(target.value, MAX_INPUT_LENGTH.value, false);
  if (target.value !== value) {
    target.value = value;
  }
  model.value = value;
  emit('update', props.element.fieldName, value);
}

async function onSelectChange(event: Event) {
  const value = sanitizeTextInput((event.target as HTMLSelectElement).value, MAX_INPUT_LENGTH.value, false);
  model.value = value;
  emit('update', props.element.fieldName, value);
  await commit('select:change');
}

async function commit(trigger: 'input:commit' | 'select:change') {
  if (props.builderMode || disabled.value) return;
  await props.runtime?.triggerElement?.(props.element, trigger);
}

onMounted(() => {
  if (props.element.defaultValue !== undefined && props.element.defaultValue !== null && props.element.defaultValue !== '') {
    const existing = props.runtime?.state?.value?.inputs?.[props.element.id];
    if (existing === undefined) {
      const cleanDefault = sanitizeTextInput(props.element.defaultValue, MAX_INPUT_LENGTH.value, false);
      props.runtime?.setInputValue?.(props.element.id, cleanDefault, props.element.fieldName);
    }
  }
});
</script>

<template>
  <div class="w-full h-full flex items-center">
    <template v-if="element.inputType === 'select'">
      <select
        :value="model"
        :aria-label="element.fieldName || element.placeholder || 'Select...'"
        class="w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
        :style="{
          background: inputBg,
          color: inputColor,
          border: `1px solid ${inputBorder}`,
          borderRadius: `${element.radius ?? 12}px`,
        }"
        :disabled="disabled"
        @change="onSelectChange"
      >
        <option value="" disabled :style="{ background: isLight ? '#ffffff' : '#1c1917', color: inputColor }">
          {{ element.placeholder ?? 'Select...' }}
        </option>
        <option
          v-for="opt in element.options"
          :key="opt"
          :value="opt"
          :style="{ background: isLight ? '#ffffff' : '#1c1917', color: inputColor }"
        >
          {{ opt }}
        </option>
      </select>
    </template>
    <template v-else>
      <div class="relative w-full h-full flex items-center">
        <input
          :type="computedInputType"
          :placeholder="element.placeholder ?? ''"
          :aria-label="element.fieldName || element.placeholder || 'Input'"
          :value="model"
          :maxlength="MAX_INPUT_LENGTH"
          :disabled="disabled"
          class="w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
          :class="[
            isLight ? 'placeholder-black/35' : 'placeholder-white/30',
            { 'pr-10': element.inputType === 'password' },
          ]"
          :style="{
            background: inputBg,
            color: inputColor,
            border: `1px solid ${inputBorder}`,
            borderRadius: `${element.radius ?? 12}px`,
          }"
          @input="onInput"
          @blur="commit('input:commit')"
          @keyup.enter="commit('input:commit')"
        />
        <button
          v-if="element.inputType === 'password'"
          type="button"
          class="absolute right-2.5 p-1 transition-colors bg-transparent border-0 cursor-pointer flex items-center justify-center"
          :style="{ color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }"
          :title="showPassword ? 'Hide password' : 'Show password'"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <EyeOffIcon v-if="showPassword" class="w-4 h-4" />
          <EyeIcon v-else class="w-4 h-4" />
        </button>
      </div>
    </template>
  </div>
</template>
