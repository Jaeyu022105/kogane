<script setup lang="ts">
import { ImageUp, LockKeyhole } from 'lucide-vue-next';
import type { UploadElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: UploadElementDef; runtime?: any; builderMode?: boolean }>();

const disabled = computed(() => Boolean(props.runtime?.isElementDisabled?.(props.element)));
const uploadedUrl = computed(() => props.runtime?.state?.value?.uploads?.[props.element.id] ?? null);

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
    class="w-full h-full px-4 py-3 text-left transition-all hover:bg-white/10 disabled:opacity-40"
    :style="{
      background: element.backgroundColor ?? 'rgba(255,255,255,0.05)',
      color: element.textColor ?? '#f5ede4',
      border: `1px dashed ${element.borderColor ?? 'rgba(255,255,255,0.2)'}`,
      borderRadius: `${element.radius ?? 18}px`,
    }"
    :disabled="disabled"
    @click="handleClick"
  >
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
        <LockKeyhole v-if="disabled" class="w-4 h-4" />
        <ImageUp v-else class="w-4 h-4" />
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ element.buttonLabel ?? 'Upload file' }}</p>
        <p class="truncate text-xs text-white/45">
          {{ uploadedUrl ?? element.pathTemplate ?? 'No file selected yet' }}
        </p>
      </div>
    </div>
  </button>
</template>
