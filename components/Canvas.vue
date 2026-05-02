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
  activeElements,
  selectedId,
  cameraX,
  cameraY,
  selectElement,
  moveElement,
  updateElement,
  setCamera,
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
  if (editingTextId.value && editingTextId.value !== el.id) {
    editingTextId.value = null;
  }
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

const editingTextId = ref<string | null>(null);

function onDblclickEl(ev: MouseEvent, el: ElementDef) {
  ev.stopPropagation();
  if (el.type === 'text') {
    editingTextId.value = el.id;
    // small delay to let vue render the textarea then focus it
    setTimeout(() => {
      const ta = document.getElementById(`edit-${el.id}`) as HTMLTextAreaElement;
      if (ta) ta.focus();
    }, 10);
  }
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

// ── Pan state ─────────────────────────────────────────────────────────────────

const pan = ref<{
  startX: number;
  startY: number;
  origCamX: number;
  origCamY: number;
} | null>(null);

function onMousedownCanvas(ev: MouseEvent) {
  if (ev.button !== 0 && ev.button !== 1) return; // allow left or middle click to pan when clicking empty area
  selectElement(null);
  editingTextId.value = null;

  pan.value = {
    startX: ev.clientX,
    startY: ev.clientY,
    origCamX: cameraX.value,
    origCamY: cameraY.value,
  };

  window.addEventListener('mousemove', onPanMove);
  window.addEventListener('mouseup',   onPanUp, { once: true });
}

function onPanMove(ev: MouseEvent) {
  if (!pan.value) return;

  const dx = ev.clientX - pan.value.startX;
  const dy = ev.clientY - pan.value.startY;

  setCamera(pan.value.origCamX + dx, pan.value.origCamY + dy);
}

function onPanUp() {
  pan.value = null;
  window.removeEventListener('mousemove', onPanMove);
}

// ── Resize handle ─────────────────────────────────────────────────────────────

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

const resize = ref<{
  elId:    string;
  handle:  ResizeHandle;
  startX:  number;
  startY:  number;
  origX:   number;
  origY:   number;
  origW:   number;
  origH:   number;
} | null>(null);

function onMousedownResize(ev: MouseEvent, el: ElementDef, handle: ResizeHandle) {
  ev.stopPropagation();

  resize.value = {
    elId:   el.id,
    handle,
    startX: ev.clientX,
    startY: ev.clientY,
    origX:  el.position.x,
    origY:  el.position.y,
    origW:  el.position.width,
    origH:  el.position.height,
  };

  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup',   onResizeUp, { once: true });
}

function onResizeMove(ev: MouseEvent) {
  if (!resize.value) return;

  const dx = (ev.clientX - resize.value.startX) / zoom.value;
  const dy = (ev.clientY - resize.value.startY) / zoom.value;

  const { handle, origX, origY, origW, origH } = resize.value;
  let nextX = origX;
  let nextY = origY;
  let nextW = origW;
  let nextH = origH;

  const MIN_W = 40;
  const MIN_H = 24;

  if (handle.includes('e')) {
    nextW = Math.max(MIN_W, origW + dx);
  } else if (handle.includes('w')) {
    const maxDx = origW - MIN_W;
    const clampedDx = Math.min(dx, maxDx);
    nextX = origX + clampedDx;
    nextW = origW - clampedDx;
  }

  if (handle.includes('s')) {
    nextH = Math.max(MIN_H, origH + dy);
  } else if (handle.includes('n')) {
    const maxDy = origH - MIN_H;
    const clampedDy = Math.min(dy, maxDy);
    nextY = origY + clampedDy;
    nextH = origH - clampedDy;
  }

  updateElement(resize.value.elId, {
    position: {
      ...activeElements.value.find(e => e.id === resize.value!.elId)!.position,
      x:      snap(nextX),
      y:      snap(nextY),
      width:  snap(nextW),
      height: snap(nextH),
    },
  });
}

function onResizeUp() {
  resize.value = null;
  window.removeEventListener('mousemove', onResizeMove);
}
</script>

<template>
  <!-- Canvas root — full size transparent wrapper catching pan/deselect -->
  <div
    class="w-full h-full overflow-hidden"
    @mousedown="onMousedownCanvas"
  >
    <!-- Transform wrapper for pan and zoom -->
    <div
      class="absolute"
      :style="{ transform: `translate(${cameraX}px, ${cameraY}px) scale(${zoom})`, transformOrigin: '0 0' }"
    >
      <!-- The actual layout page / board -->
      <div
        class="relative bg-[#111118] border border-white/10 shadow-2xl overflow-hidden"
        :style="{
          width:  `${layout.resolution.width}px`,
          height: `${layout.resolution.height}px`,
        }"
      >
        <!-- Grid dots -->
        <svg class="absolute inset-0 pointer-events-none opacity-20" width="100%" height="100%">
          <defs>
            <pattern id="grid" :width="GRID_PX" :height="GRID_PX" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.75" fill="rgba(255,255,255,0.4)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <!-- Render each element -->
        <div
          v-for="el in activeElements"
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
          @dblclick="onDblclickEl($event, el)"
        >
          <!-- Selection ring -->
          <div
            v-if="selectedId === el.id"
            class="absolute inset-0 ring-2 ring-brand-primary pointer-events-none z-10"
          />

          <!-- Element content (non-interactive in builder) -->
          <template v-if="editingTextId === el.id && el.type === 'text'">
            <textarea
              :id="`edit-${el.id}`"
              :value="(el as any).content"
              class="w-full h-full bg-transparent resize-none outline-none border-none p-0 m-0"
              :style="{
                fontSize: `${(el as any).fontSize ?? 16}px`,
                fontWeight: (el as any).fontWeight ?? 'normal',
                color: (el as any).color ?? '#000',
                textAlign: (el as any).align ?? 'left',
              }"
              @input="updateElement(el.id, { content: ($event.target as HTMLTextAreaElement).value } as any)"
              @blur="editingTextId = null"
              @mousedown.stop
            />
          </template>
          <template v-else>
            <ElementRenderer
              :element="el"
              :business-id="businessId"
              :builder-mode="true"
            />
          </template>

          <!-- Resize handles -->
          <template v-if="selectedId === el.id">
            <div
              class="absolute top-0 left-0 w-3 h-3 bg-brand-primary rounded-br cursor-nw-resize z-20"
              style="margin: -1.5px 0 0 -1.5px;"
              @mousedown.stop="onMousedownResize($event, el, 'nw')"
            />
            <div
              class="absolute top-0 right-0 w-3 h-3 bg-brand-primary rounded-bl cursor-ne-resize z-20"
              style="margin: -1.5px -1.5px 0 0;"
              @mousedown.stop="onMousedownResize($event, el, 'ne')"
            />
            <div
              class="absolute bottom-0 left-0 w-3 h-3 bg-brand-primary rounded-tr cursor-sw-resize z-20"
              style="margin: 0 0 -1.5px -1.5px;"
              @mousedown.stop="onMousedownResize($event, el, 'sw')"
            />
            <div
              class="absolute bottom-0 right-0 w-3 h-3 bg-brand-primary rounded-tl cursor-se-resize z-20"
              style="margin: 0 -1.5px -1.5px 0;"
              @mousedown.stop="onMousedownResize($event, el, 'se')"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
