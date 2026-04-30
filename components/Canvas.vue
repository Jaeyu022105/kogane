<script setup lang="ts">
/**
 * Canvas — the Figma-like builder canvas.
 * Manages drag, resize, selection highlight, and snap grid.
 * All state lives in useCanvas() — this component is pure presentation + interaction.
 */

import type { ElementDef, ElementPosition } from '~/lib/uiTypes';
import ElementRenderer from '~/components/ElementRenderer.vue';

const props = defineProps<{
  businessId: string;
  zoom?:      number;
}>();

const {
  layout,
  selectedId,
  selectElement,
  moveElement,
  updateElement,
} = useCanvas();

const zoom    = computed(() => props.zoom ?? 1);
const GRID_PX = 8; // snap grid size in canvas units

// ── Drag state ────────────────────────────────────────────────────────────────

const drag = ref<{
  elId:    string;
  startX:  number;
  startY:  number;
  origX:   number;
  origY:   number;
} | null>(null);

function onMousedownEl(ev: MouseEvent, el: ElementDef) {
  ev.stopPropagation();
  selectElement(el.id);

  drag.value = {
    elId:   el.id,
    startX: ev.clientX,
    startY: ev.clientY,
    origX:  el.position.x,
    origY:  el.position.y,
  };

  window.addEventListener('mousemove', onMousemove);
  window.addEventListener('mouseup',   onMouseup, { once: true });
}

function snap(v: number): number {
  return Math.round(v / GRID_PX) * GRID_PX;
}

function onMousemove(ev: MouseEvent) {
  if (!drag.value) return;

  const dx = (ev.clientX - drag.value.startX) / zoom.value;
  const dy = (ev.clientY - drag.value.startY) / zoom.value;

  moveElement(drag.value.elId, {
    x: snap(drag.value.origX + dx),
    y: snap(drag.value.origY + dy),
  });
}

function onMouseup() {
  drag.value = null;
  window.removeEventListener('mousemove', onMousemove);
}

// ── Resize handle ─────────────────────────────────────────────────────────────

const resize = ref<{
  elId:    string;
  startX:  number;
  startY:  number;
  origW:   number;
  origH:   number;
} | null>(null);

function onMousedownResize(ev: MouseEvent, el: ElementDef) {
  ev.stopPropagation();

  resize.value = {
    elId:   el.id,
    startX: ev.clientX,
    startY: ev.clientY,
    origW:  el.position.width,
    origH:  el.position.height,
  };

  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup',   onResizeUp, { once: true });
}

function onResizeMove(ev: MouseEvent) {
  if (!resize.value) return;

  const dw = (ev.clientX - resize.value.startX) / zoom.value;
  const dh = (ev.clientY - resize.value.startY) / zoom.value;

  updateElement(resize.value.elId, {
    position: {
      ...layout.value.elements.find(e => e.id === resize.value!.elId)!.position,
      width:  snap(Math.max(40, resize.value.origW + dw)),
      height: snap(Math.max(24, resize.value.origH + dh)),
    },
  });
}

function onResizeUp() {
  resize.value = null;
  window.removeEventListener('mousemove', onResizeMove);
}
</script>

<template>
  <!-- Canvas root — click on empty area to deselect -->
  <div
    class="relative overflow-hidden bg-[#111118] rounded-xl border border-white/10"
    :style="{
      width:  `${layout.resolution.width * zoom}px`,
      height: `${layout.resolution.height * zoom}px`,
    }"
    @mousedown.self="selectElement(null)"
  >
    <!-- Grid dots -->
    <svg
      class="absolute inset-0 pointer-events-none opacity-20"
      :width="layout.resolution.width * zoom"
      :height="layout.resolution.height * zoom"
    >
      <defs>
        <pattern id="grid" :width="GRID_PX * zoom" :height="GRID_PX * zoom" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.75" fill="rgba(255,255,255,0.4)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    <!-- Scale wrapper for zoom -->
    <div
      class="absolute inset-0"
      :style="{ transform: `scale(${zoom})`, transformOrigin: 'top left' }"
    >
      <!-- Render each element with its drag handle overlay -->
      <div
        v-for="el in layout.elements"
        :key="el.id"
        class="absolute group"
        :style="{
          left:    `${el.position.x}px`,
          top:     `${el.position.y}px`,
          width:   `${el.position.width}px`,
          height:  `${el.position.height}px`,
          zIndex:  el.position.zIndex,
        }"
        @mousedown="onMousedownEl($event, el)"
      >
        <!-- Selection ring -->
        <div
          v-if="selectedId === el.id"
          class="absolute inset-0 ring-2 ring-brand-primary rounded pointer-events-none z-10"
        />

        <!-- Element content (non-interactive in builder) -->
        <ElementRenderer
          :element="el"
          :business-id="businessId"
          :builder-mode="true"
        />

        <!-- Resize handle (bottom-right corner) -->
        <div
          v-if="selectedId === el.id"
          class="absolute bottom-0 right-0 w-3 h-3 bg-brand-primary rounded-tl cursor-se-resize z-20"
          @mousedown.stop="onMousedownResize($event, el)"
        />
      </div>
    </div>
  </div>
</template>
