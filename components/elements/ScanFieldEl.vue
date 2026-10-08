<script setup lang="ts">
import type { ScanFieldElementDef } from '~/lib/uiTypes';
import { isLightColor } from '~/lib/workspaceBranding';

/**
 * ScanFieldEl — hardware barcode/QR scanner input.
 * Scanners emit characters as rapid keyboard events (burst).
 * When the inter-keystroke gap drops below burstThresholdMs (default 40ms),
 * every character is accumulated and committed automatically when the burst ends.
 * Manual typing (slow keystroke gaps) commits on Enter or blur like a normal input.
 */

const props = defineProps<{ element: ScanFieldElementDef; runtime?: any; builderMode?: boolean }>();

const BURST_THRESHOLD_MS = computed(() => props.element.burstThresholdMs ?? 40);
const BURST_COMMIT_DELAY_MS = 120;

const displayValue = ref('');
let lastKeyTime = 0;
let burstBuffer = '';
let burstTimer: ReturnType<typeof setTimeout> | null = null;

const isLight = computed(() => isLightColor(props.element.backgroundColor ?? 'rgba(255,255,255,0.05)'));
const effectiveBg = computed(() => props.element.backgroundColor ?? (isLight.value ? '#ffffff' : 'rgba(255,255,255,0.05)'));
const effectiveText = computed(() => props.element.textColor ?? (isLight.value ? '#1c1917' : '#ffffff'));
const effectiveBorder = computed(() => props.element.borderColor ?? (isLight.value ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'));

function commitValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;

  props.runtime?.setInputValue?.(props.element.id, trimmed);
  displayValue.value = trimmed;

  if (!props.builderMode) {
    props.runtime?.triggerElement?.(props.element, 'input:commit');
  }

  burstBuffer = '';
  displayValue.value = '';
}

function onKeydown(event: KeyboardEvent) {
  if (props.builderMode) return;

  const now = Date.now();
  const gap = now - lastKeyTime;
  lastKeyTime = now;

  if (event.key === 'Enter') {
    if (burstTimer) clearTimeout(burstTimer);
    commitValue(burstBuffer || displayValue.value);
    return;
  }

  /* single printable character */
  if (event.key.length === 1) {
    if (gap < BURST_THRESHOLD_MS.value) {
      /* scanner burst mode — accumulate silently */
      burstBuffer += event.key;

      if (burstTimer) clearTimeout(burstTimer);
      burstTimer = setTimeout(() => {
        commitValue(burstBuffer);
      }, BURST_COMMIT_DELAY_MS);

      event.preventDefault();
    }
    /* else: normal keypress, fall through to standard input handling */
  }
}

function onInput(event: Event) {
  displayValue.value = (event.target as HTMLInputElement).value;
}

function onBlur() {
  if (displayValue.value.trim()) commitValue(displayValue.value);
}

onUnmounted(() => {
  if (burstTimer) clearTimeout(burstTimer);
});
</script>

<template>
  <div class="w-full h-full relative flex items-center">
    <input
      :value="displayValue"
      :placeholder="element.placeholder ?? 'Scan barcode or QR code…'"
      type="text"
      autocomplete="off"
      :class="[
        'w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary',
        isLight ? 'placeholder-neutral-400' : 'placeholder-white/30',
      ]"
      :style="{
        background: effectiveBg,
        color: effectiveText,
        border: `1px solid ${effectiveBorder}`,
        borderRadius: `${element.radius ?? 12}px`,
      }"
      :disabled="builderMode"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <div
      class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      :style="{ color: isLight ? 'rgba(0,0,0,0.3)' : (element.textColor ? `${element.textColor}60` : 'rgba(255,255,255,0.25)') }"
    >
      <!-- barcode icon -->
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9V5a2 2 0 012-2h2M3 15v4a2 2 0 002 2h2m10-18h2a2 2 0 012 2v4M19 15v4a2 2 0 01-2 2h-2M7 8v8M10 6v12M13 8v8M16 6v12" />
      </svg>
    </div>
  </div>
</template>
