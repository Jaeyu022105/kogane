/**
 * useCanvas manages the builder canvas state, selection, history, and active layer.
 */

import { ref, computed, readonly } from 'vue';
import type { ElementDef, ElementPosition, ModalLayerDef, UiLayout } from '~/lib/uiTypes';
import { cloneLayout, DEFAULT_LAYOUT, normalizeLayout } from '~/lib/uiTypes';

const layout = ref<UiLayout>(cloneLayout(DEFAULT_LAYOUT));
const selectedId = ref<string | null>(null);
const activeLayerId = ref<string>('main');
const undoStack = ref<UiLayout[]>([]);
const redoStack = ref<UiLayout[]>([]);
const isDirty = ref(false);
const clipboard = ref<ElementDef | null>(null);
const cameraX = ref(0);
const cameraY = ref(0);

function snapshot() {
  undoStack.value.push(cloneLayout(layout.value));
  if (undoStack.value.length > 50) undoStack.value.shift();
  redoStack.value = [];
  isDirty.value = true;
}

function getLayerElements(targetLayout = layout.value): ElementDef[] {
  if (activeLayerId.value === 'main') return targetLayout.elements;
  const modal = targetLayout.modals?.find((item) => item.id === activeLayerId.value);
  return modal?.elements ?? targetLayout.elements;
}

export function useCanvas() {
  const activeLayer = computed<ModalLayerDef | null>(() => {
    if (activeLayerId.value === 'main') return null;
    return layout.value.modals?.find((item) => item.id === activeLayerId.value) ?? null;
  });

  const activeElements = computed(() => getLayerElements());

  const selectedElement = computed(() =>
    activeElements.value.find((element) => element.id === selectedId.value) ?? null,
  );

  function loadLayout(incoming: UiLayout) {
    layout.value = normalizeLayout(incoming);
    selectedId.value = null;
    activeLayerId.value = 'main';
    isDirty.value = false;
    undoStack.value = [];
    redoStack.value = [];

    const cw = typeof window !== 'undefined' ? window.innerWidth - 300 : 1280;
    const ch = typeof window !== 'undefined' ? window.innerHeight - 100 : 720;
    cameraX.value = (cw - layout.value.resolution.width * 0.7) / 2;
    cameraY.value = (ch - layout.value.resolution.height * 0.7) / 2;
  }

  function setActiveLayer(id: string) {
    activeLayerId.value = id;
    selectedId.value = null;
  }

  function updateResolution(width: number, height: number) {
    snapshot();
    layout.value.resolution = { width, height };
  }

  function updateTheme(patch: Partial<UiLayout['theme']>) {
    snapshot();
    layout.value.theme = {
      ...layout.value.theme,
      ...patch,
    };
  }

  function updateAllElements(mapper: (element: ElementDef) => ElementDef) {
    snapshot();
    layout.value.elements = layout.value.elements.map((element) => mapper(element));
    layout.value.modals = (layout.value.modals ?? []).map((modal) => ({
      ...modal,
      elements: modal.elements.map((element) => mapper(element)),
    }));
  }

  function addModal(name: string, presentation: ModalLayerDef['presentation'] = 'custom') {
    snapshot();
    layout.value.modals = layout.value.modals ?? [];
    const modal: ModalLayerDef = {
      id: crypto.randomUUID(),
      name,
      presentation,
      elements: [],
    };
    layout.value.modals.push(modal);
    activeLayerId.value = modal.id;
  }

  function removeModal(id: string) {
    snapshot();
    layout.value.modals = (layout.value.modals ?? []).filter((modal) => modal.id !== id);
    if (activeLayerId.value === id) {
      activeLayerId.value = 'main';
      selectedId.value = null;
    }
  }

  function addElement(element: ElementDef) {
    snapshot();
    getLayerElements().push(element);
    selectedId.value = element.id;
  }

  function addElements(elements: ElementDef[]) {
    if (elements.length === 0) return;
    snapshot();
    getLayerElements().push(...elements);
    selectedId.value = elements[elements.length - 1]?.id ?? null;
  }

  function removeElement(id: string) {
    snapshot();
    const nextElements = getLayerElements().filter((element) => element.id !== id);
    if (activeLayerId.value === 'main') {
      layout.value.elements = nextElements;
    } else {
      const modal = layout.value.modals?.find((item) => item.id === activeLayerId.value);
      if (modal) modal.elements = nextElements;
    }
    if (selectedId.value === id) selectedId.value = null;
  }

  function updateElement(id: string, patch: Partial<Omit<ElementDef, 'id' | 'type'>>) {
    snapshot();
    const elements = getLayerElements();
    const index = elements.findIndex((element) => element.id === id);
    if (index === -1) return;
    elements[index] = { ...elements[index], ...patch } as ElementDef;
  }

  function moveElement(id: string, pos: Partial<ElementPosition>) {
    const elements = getLayerElements();
    const index = elements.findIndex((element) => element.id === id);
    if (index === -1) return;
    elements[index].position = { ...elements[index].position, ...pos };
    isDirty.value = true;
  }

  function selectElement(id: string | null) {
    selectedId.value = id;
  }

  function markSaved() {
    isDirty.value = false;
  }

  function bringForward(id: string) {
    snapshot();
    const element = getLayerElements().find((item) => item.id === id);
    if (element) element.position.zIndex += 1;
  }

  function sendBackward(id: string) {
    snapshot();
    const element = getLayerElements().find((item) => item.id === id);
    if (element) element.position.zIndex = Math.max(0, element.position.zIndex - 1);
  }

  function undo() {
    if (undoStack.value.length === 0) return;
    redoStack.value.push(cloneLayout(layout.value));
    const previous = undoStack.value.pop();
    if (previous) {
      layout.value = previous;
      isDirty.value = true;
    }
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    undoStack.value.push(cloneLayout(layout.value));
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
    const element = getLayerElements().find((item) => item.id === selectedId.value);
    if (!element) return;
    clipboard.value = cloneLayout({
      version: layout.value.version,
      resolution: layout.value.resolution,
      elements: [element],
      modals: [],
    }).elements[0];
  }

  function pasteElement() {
    if (!clipboard.value) return;
    snapshot();
    const newId = crypto.randomUUID();
    const elements = getLayerElements();
    elements.push({
      ...cloneLayout({
        version: layout.value.version,
        resolution: layout.value.resolution,
        elements: [clipboard.value],
        modals: [],
      }).elements[0],
      id: newId,
      position: {
        ...clipboard.value.position,
        x: clipboard.value.position.x + 20,
        y: clipboard.value.position.y + 20,
        zIndex: elements.length + 1,
      },
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
    activeLayerId: readonly(activeLayerId),
    activeLayer,
    activeElements,
    selectedId: readonly(selectedId),
    selectedElement,
    isDirty: readonly(isDirty),
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    cameraX: readonly(cameraX),
    cameraY: readonly(cameraY),
    loadLayout,
    setActiveLayer,
    addModal,
    removeModal,
    addElement,
    addElements,
    removeElement,
    updateElement,
    updateResolution,
    updateTheme,
    updateAllElements,
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
    markSaved,
  };
}
