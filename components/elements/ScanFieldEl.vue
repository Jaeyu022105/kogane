<script setup lang="ts">
import LockKeyholeIcon from 'reicon-vue/icons/LockKeyhole';
import ScanBarcodeIcon from 'reicon-vue/icons/ScanBarcode';
import type { ScanFieldElementDef } from '~/lib/uiTypes';
import { isLightColor } from '~/lib/workspaceBranding';
import { hasUnsafeControlChars, sanitizeTextInput } from '~/lib/securityClient';

/**
 * ScanFieldEl — hardware barcode/QR scanner input.
 * Scanners emit characters as rapid keyboard events (burst).
 * When the inter-keystroke gap drops below burstThresholdMs (default 40ms),
 * every character is accumulated and committed automatically when the burst ends.
 * Manual typing (slow keystroke gaps) commits on Enter or blur like a normal input.
 */

const props = defineProps<{ element: ScanFieldElementDef; runtime?: any; builderMode?: boolean }>();

const disabled = computed(() => Boolean(props.builderMode || props.runtime?.isElementDisabled?.(props.element)));
const permissionDisabled = computed(() => Boolean(!props.builderMode && props.runtime?.isElementDisabled?.(props.element)));

const BURST_THRESHOLD_MS = computed(() => props.element.burstThresholdMs ?? 40);
const BURST_COMMIT_DELAY_MS = 120;
const MAX_SCAN_LENGTH = computed(() => {
  const configured = Number(props.element.maxLength);
  if (Number.isFinite(configured) && configured > 0) return Math.min(Math.floor(configured), 2000);
  return 500;
});

const displayValue = ref('');
let lastKeyTime = 0;
let burstBuffer = '';
let burstTimer: ReturnType<typeof setTimeout> | null = null;

const isLight = computed(() => isLightColor(props.element.backgroundColor ?? 'rgba(255,255,255,0.05)'));
const effectiveBg = computed(() => props.element.backgroundColor ?? (isLight.value ? '#ffffff' : 'rgba(255,255,255,0.05)'));
const effectiveText = computed(() => props.element.textColor ?? (isLight.value ? '#1c1917' : '#ffffff'));
const effectiveBorder = computed(() => props.element.borderColor ?? (isLight.value ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'));

function commitValue(value: string) {
  if (disabled.value) return;
  if (burstTimer) {
    clearTimeout(burstTimer);
    burstTimer = null;
  }
  const trimmed = sanitizeTextInput(value, MAX_SCAN_LENGTH.value, false).trim();
  burstBuffer = '';
  displayValue.value = '';

  if (!trimmed) {
    return;
  }

  props.runtime?.setInputValue?.(props.element.id, trimmed, props.element.fieldName);

  if (!props.builderMode) {
    props.runtime?.triggerElement?.(props.element, 'input:commit');
  }
}

function onKeydown(event: KeyboardEvent) {
  if (disabled.value) return;

  const now = Date.now();
  const gap = now - lastKeyTime;
  lastKeyTime = now;

  if (event.key === 'Enter') {
    event.preventDefault();
    if (burstTimer) {
      clearTimeout(burstTimer);
      burstTimer = null;
    }
    commitValue(burstBuffer || displayValue.value);
    return;
  }

  /* single printable character */
  if (event.key.length === 1) {
    if (hasUnsafeControlChars(event.key, false)) {
      event.preventDefault();
      return;
    }
    if (gap < BURST_THRESHOLD_MS.value) {
      /* scanner burst mode — accumulate silently up to MAX_SCAN_LENGTH */
      event.preventDefault();

      // If burstBuffer is empty, capture any initial character typed right before burst
      if (!burstBuffer && displayValue.value) {
        burstBuffer = displayValue.value;
        displayValue.value = '';
      }

      if (burstBuffer.length < MAX_SCAN_LENGTH.value) {
        burstBuffer += event.key;
      }

      if (burstTimer) clearTimeout(burstTimer);
      burstTimer = setTimeout(() => {
        if (burstBuffer) {
          commitValue(burstBuffer);
        }
      }, BURST_COMMIT_DELAY_MS);
    }
    /* else: normal keypress, fall through to standard input handling */
  }
}

function onInput(event: Event) {
  if (disabled.value) return;
  const target = event.target as HTMLInputElement;
  const clean = sanitizeTextInput(target.value, MAX_SCAN_LENGTH.value, false);
  if (target.value !== clean) {
    target.value = clean;
  }
  displayValue.value = clean;
}

function onBlur() {
  if (disabled.value) return;
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
      :maxlength="MAX_SCAN_LENGTH"
      autocomplete="off"
      :class="[
        'w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-45',
        isLight ? 'placeholder-neutral-400' : 'placeholder-white/30',
      ]"
      :style="{
        background: effectiveBg,
        color: effectiveText,
        border: `1px solid ${effectiveBorder}`,
        borderRadius: `${element.radius ?? 12}px`,
      }"
      :disabled="disabled"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <div
      class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      :style="{ color: isLight ? 'rgba(0,0,0,0.3)' : (element.textColor ? `${element.textColor}60` : 'rgba(255,255,255,0.25)') }"
    >
      <LockKeyholeIcon v-if="permissionDisabled" class="w-4 h-4 opacity-70" />
      <!-- barcode icon -->
      <ScanBarcodeIcon v-else class="w-4 h-4" />
    </div>
  </div>
</template>
