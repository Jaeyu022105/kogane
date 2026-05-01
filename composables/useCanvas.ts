/**
 * useCanvas — manages the UI builder canvas state.
 * Handles element selection, drag/resize, z-index, and undo history.
 * Completely decoupled from rendering — the renderer reads from layout JSON.
 */

import { ref, computed, readonly } from 'vue';
import type { ElementDef, UiLayout, ElementPosition } from '~/lib/uiTypes';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';

const layout = ref<UiLayout>({ ...DEFAULT_LAYOUT, elements: [] });
const selectedId = ref<string | null>(null);
const undoStack = ref<UiLayout[]>([]);
const redoStack = ref<UiLayout[]>([]);
const isDirty = ref(false);
const clipboard = ref<ElementDef | null>(null);

// Camera state
const cameraX = ref(0);
const cameraY = ref(0);

// Snapshot the current layout for undo
function snapshot() {
  undoStack.value.push(JSON.parse(JSON.stringify(layout.value)));
  if (undoStack.value.length > 50) undoStack.value.shift();
  redoStack.value = [];
  isDirty.value = true;
}

export function useCanvas() {
  const selectedElement = computed(() =>
    layout.value.elements.find(el => el.id === selectedId.value) ?? null
  );

  function loadLayout(incoming: UiLayout) {
    layout.value = JSON.parse(JSON.stringify(incoming));
    selectedId.value = null;
    isDirty.value = false;
    undoStack.value = [];
    redoStack.value = [];

    // Auto center based on window size
    const cw = typeof window !== 'undefined' ? window.innerWidth - 300 : 1280;
    const ch = typeof window !== 'undefined' ? window.innerHeight - 100 : 720;
    cameraX.value = (cw - layout.value.resolution.width * 0.7) / 2;
    cameraY.value = (ch - layout.value.resolution.height * 0.7) / 2;
  }

  function updateResolution(width: number, height: number) {
    snapshot();
    layout.value.resolution = { width, height };
    isDirty.value = true;
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
    if (undoStack.value.length === 0) return;
    const current = JSON.parse(JSON.stringify(layout.value));
    redoStack.value.push(current);
    const prev = undoStack.value.pop();
    if (prev) {
      layout.value = prev;
      isDirty.value = true;
    }
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    const current = JSON.parse(JSON.stringify(layout.value));
    undoStack.value.push(current);
    const next = redoStack.value.pop();
    if (next) {
      layout.value = next;
      isDirty.value = true;
    }
  }

  function cutElement() {
    if (!selectedId.value) return;
    copyElement();
    removeElement(selectedId.value);
  }

  function copyElement() {
    if (!selectedId.value) return;
    const el = layout.value.elements.find(e => e.id === selectedId.value);
    if (!el) return;
    clipboard.value = JSON.parse(JSON.stringify(el));
  }

  function pasteElement() {
    if (!clipboard.value) return;
    snapshot();
    const newId = crypto.randomUUID();
    layout.value.elements.push({
      ...JSON.parse(JSON.stringify(clipboard.value)),
      id: newId,
      position: {
        ...clipboard.value.position,
        x: clipboard.value.position.x + 20,
        y: clipboard.value.position.y + 20,
        zIndex: layout.value.elements.length + 1,
      }
    });
    selectedId.value = newId;
  }

  function duplicateElement() {
    copyElement();
    pasteElement();
  }

  function setCamera(x: number, y: number) {
    cameraX.value = x;
    cameraY.value = y;
  }

  return {
    layout: readonly(layout),
    selectedId: readonly(selectedId),
    selectedElement,
    isDirty: readonly(isDirty),
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    cameraX: readonly(cameraX),
    cameraY: readonly(cameraY),
    loadLayout,
    addElement,
    removeElement,
    updateElement,
    updateResolution,
    moveElement,
    selectElement,
    bringForward,
    sendBackward,
    undo,
    redo,
    cutElement,
    copyElement,
    pasteElement,
    duplicateElement,
    setCamera,
  };
}
