/**
 * useCanvas — manages the UI builder canvas state.
 * Handles element selection, drag/resize, z-index, and undo history.
 * Completely decoupled from rendering — the renderer reads from layout JSON.
 */

import { ref, computed, readonly } from 'vue';
import type { ElementDef, UiLayout, ElementPosition } from '~/lib/uiTypes';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';

const layout        = ref<UiLayout>({ ...DEFAULT_LAYOUT, elements: [] });
const selectedId    = ref<string | null>(null);
const undoStack     = ref<UiLayout[]>([]);
const isDirty       = ref(false);

// Snapshot the current layout for undo
function snapshot() {
  undoStack.value.push(JSON.parse(JSON.stringify(layout.value)));
  // Keep history bounded
  if (undoStack.value.length > 50) undoStack.value.shift();
  isDirty.value = true;
}

export function useCanvas() {
  const selectedElement = computed(() =>
    layout.value.elements.find(el => el.id === selectedId.value) ?? null
  );

  function loadLayout(incoming: UiLayout) {
    layout.value  = JSON.parse(JSON.stringify(incoming));
    selectedId.value = null;
    isDirty.value = false;
    undoStack.value = [];
  }

  function addElement(el: ElementDef) {
    snapshot();
    layout.value.elements.push(el);
    selectedId.value = el.id;
  }

  function removeElement(id: string) {
    snapshot();
    layout.value.elements = layout.value.elements.filter(e => e.id !== id);
    if (selectedId.value === id) selectedId.value = null;
  }

  function updateElement(id: string, patch: Partial<Omit<ElementDef, 'id' | 'type'>>) {
    snapshot();
    const idx = layout.value.elements.findIndex(e => e.id === id);
    if (idx === -1) return;
    layout.value.elements[idx] = { ...layout.value.elements[idx], ...patch } as ElementDef;
  }

  function moveElement(id: string, pos: Partial<ElementPosition>) {
    const idx = layout.value.elements.findIndex(e => e.id === id);
    if (idx === -1) return;
    layout.value.elements[idx].position = { ...layout.value.elements[idx].position, ...pos };
    isDirty.value = true;
  }

  function selectElement(id: string | null) {
    selectedId.value = id;
  }

  function bringForward(id: string) {
    snapshot();
    const el = layout.value.elements.find(e => e.id === id);
    if (el) el.position.zIndex += 1;
  }

  function sendBackward(id: string) {
    snapshot();
    const el = layout.value.elements.find(e => e.id === id);
    if (el) el.position.zIndex = Math.max(0, el.position.zIndex - 1);
  }

  function undo() {
    const prev = undoStack.value.pop();
    if (prev) {
      layout.value = prev;
      isDirty.value = true;
    }
  }

  return {
    layout:          readonly(layout),
    selectedId:      readonly(selectedId),
    selectedElement,
    isDirty:         readonly(isDirty),
    canUndo:         computed(() => undoStack.value.length > 0),
    loadLayout,
    addElement,
    removeElement,
    updateElement,
    moveElement,
    selectElement,
    bringForward,
    sendBackward,
    undo,
  };
}
