<script setup lang="ts">
import { ImageUp, LockKeyhole } from 'lucide-vue-next';
import type { UploadElementDef } from '~/lib/uiTypes';
import { resolveRuntimePathTemplate } from '~/lib/runtime';
import { isLightColor } from '~/lib/workspaceBranding';

const props = defineProps<{ element: UploadElementDef; runtime?: any; builderMode?: boolean }>();

const disabled = computed(() => Boolean(props.runtime?.isElementDisabled?.(props.element)));
const uploadedUrl = computed(() => props.runtime?.state?.value?.uploads?.[props.element.id] ?? null);
const pathPreview = computed(() => resolveRuntimePathTemplate(props.element.pathTemplate ?? 'No file selected yet'));

const theme = computed(() => props.runtime?.context?.value?.layout?.theme);
const isLight = computed(() => isLightColor(props.element.backgroundColor ?? theme.value?.panelBackground ?? '#111118'));

const effectiveBg = computed(() => props.element.backgroundColor ?? (isLight.value ? '#ffffff' : 'rgba(255,255,255,0.05)'));
const effectiveText = computed(() => props.element.textColor ?? (isLight.value ? '#261a14' : '#f5ede4'));
const effectiveBorder = computed(() => props.element.borderColor ?? (isLight.value ? 'rgba(81, 49, 31, 0.18)' : 'rgba(255,255,255,0.2)'));
const effectiveMuted = computed(() => isLight.value ? 'rgba(38, 26, 20, 0.6)' : 'rgba(255,255,255,0.45)');
const iconBg = computed(() => isLight.value ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255,255,255,0.1)');

async function handleClick() {
  if (props.builderMode || disabled.value) return;
  await props.runtime?.dispatch?.({
    type: 'upload',
    bucket: props.element.bucket,
    path: props.element.pathTemplate ?? `${props.element.id}/upload`,
    accept: props.element.accept,
  }, {
    element: props.element,
    trigger: 'click',
  });
}
</script>

<template>
  <button
    class="w-full h-full px-4 py-3 text-left transition-all hover:opacity-90 disabled:opacity-40"
    :style="{
      background: effectiveBg,
      color: effectiveText,
      border: `1px dashed ${effectiveBorder}`,
      borderRadius: `${element.radius ?? 18}px`,
    }"
    :disabled="disabled"
    @click="handleClick"
  >
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl" :style="{ background: iconBg }">
        <LockKeyhole v-if="disabled" class="w-4 h-4" />
        <ImageUp v-else class="w-4 h-4" />
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ element.buttonLabel ?? 'Upload file' }}</p>
        <p class="truncate text-xs" :style="{ color: effectiveMuted }">
          {{ uploadedUrl ?? pathPreview }}
        </p>
      </div>
    </div>
  </button>
</template>
