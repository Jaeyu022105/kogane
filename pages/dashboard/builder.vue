<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ElementDef, ElementType, UiLayout } from '~/lib/uiTypes';
import Canvas from '~/components/Canvas.vue';
import PropertiesPanel from '~/components/PropertiesPanel.vue';
import { Hexagon, Type, Image as ImageIcon, Database, RectangleHorizontal, ShoppingCart, Undo2, Sparkles, Copy, Trash2 } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { business } = useBusiness();
const {
  layout,
  selectedElement,
  selectedId,
  isDirty,
  canUndo,
  canRedo,
  loadLayout,
  addElement,
  removeElement,
  undo,
  redo,
  cutElement,
  copyElement,
  pasteElement,
  duplicateElement,
  updateElement,
  cameraX,
  cameraY,
  setCamera,
} = useCanvas();

const showStudioPanel = ref(false);
const canvasWrapper = ref<HTMLElement | null>(null);

const terminals = ref<{ id: string; display_name: string; role: string; ui_layout: string }[]>([]);
const selectedTerminal = ref<string | null>(null);
const saving = ref(false);
const zoom = ref(0.7);

const route = useRoute();

const selectedElementKind = computed(() => {
  if (!selectedElement.value) return 'Canvas';
  return selectedElement.value.type.replace(/-/g, ' ');
});

const selectedElementName = computed(() => {
  if (!selectedElement.value) return 'Nothing selected';
  return selectedElement.value.label || selectedElementKind.value;
});

const resolutionLabel = computed(() => `${layout.value.resolution.width} x ${layout.value.resolution.height}`);

async function loadTerminals() {
  if (!business.value) return;
  const res = await $fetch<{ terminals: any[]; error: string | null }>('/api/terminals', {
    headers: authHeaders(),
    query: { businessId: business.value.id },
  });
  terminals.value = res.terminals ?? [];

  if (route.query.terminal && !selectedTerminal.value) {
    selectTerminal(route.query.terminal as string);
  }
}

function selectTerminal(id: string) {
  selectedTerminal.value = id;
  const ip = terminals.value.find(i => i.id === id);
  if (!ip) return;

  let parsed: any;
  try {
    parsed = typeof ip.ui_layout === 'string' ? JSON.parse(ip.ui_layout) : ip.ui_layout;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    parsed = { version: 1, resolution: { width: 1280, height: 720 }, elements: [] };
  }
  if (!parsed.elements) parsed.elements = [];

  loadLayout(parsed as UiLayout);
}

async function saveLayout() {
  if (!selectedTerminal.value) return;
  saving.value = true;
  try {
    await $fetch('/api/terminals/layout', {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: { terminalId: selectedTerminal.value, layout: layout.value },
    });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadTerminals();
  window.addEventListener('keydown', handleKeydown);
  if (canvasWrapper.value) {
    canvasWrapper.value.addEventListener('wheel', handleWheel, { passive: false });
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (canvasWrapper.value) {
    canvasWrapper.value.removeEventListener('wheel', handleWheel);
  }
});

watch(() => business.value?.id, loadTerminals);

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  if (e.key === 'Escape') {
    showStudioPanel.value = false;
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId.value) removeElement(selectedId.value);
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'c') copyElement();
    if (e.key === 'x') cutElement();
    if (e.key === 'v') pasteElement();
    if (e.key === 'd') {
      e.preventDefault();
      duplicateElement();
    }
    if (e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    if (e.key === 'y') {
      e.preventDefault();
      redo();
    }
  }
}

function handleWheel(e: WheelEvent) {
  e.preventDefault();

  const oldZoom = zoom.value;
  const newZoom = Math.max(0.1, Math.min(3, oldZoom + (e.deltaY > 0 ? -0.05 : 0.05)));
  if (oldZoom === newZoom) return;

  if (!canvasWrapper.value) {
    zoom.value = newZoom;
    return;
  }

  const rect = canvasWrapper.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - cameraX.value) / oldZoom;
  const worldY = (mouseY - cameraY.value) / oldZoom;

  const newCameraX = mouseX - worldX * newZoom;
  const newCameraY = mouseY - worldY * newZoom;

  zoom.value = newZoom;
  setCamera(newCameraX, newCameraY);
}

function patch(updates: Partial<any>) {
  if (!selectedId.value) return;
  updateElement(selectedId.value, updates);
}

const PALETTE_ITEMS: Array<{ type: ElementType; label: string; icon: any; defaults: Partial<ElementDef> }> = [
  { type: 'button', label: 'Button', icon: Hexagon, defaults: { text: 'Button', variant: 'primary' } as any },
  { type: 'text', label: 'Text', icon: Type, defaults: { content: 'Text', fontSize: 16, fontWeight: 'normal' } as any },
  { type: 'image', label: 'Image', icon: ImageIcon, defaults: { src: '', fit: 'cover' } as any },
  { type: 'table-view', label: 'Table View', icon: Database, defaults: { tableName: '', columns: [] } as any },
  { type: 'input-field', label: 'Input', icon: RectangleHorizontal, defaults: { fieldName: 'field', inputType: 'text' } as any },
  { type: 'cart-widget', label: 'Cart', icon: ShoppingCart, defaults: { productTable: '', orderTable: '', displayColumns: [] } as any },
];

function dropElement(type: ElementType, defaults: Partial<ElementDef>) {
  addElement({
    id: crypto.randomUUID(),
    type,
    label: type,
    position: { x: 80, y: 80, width: 200, height: 60, zIndex: layout.value.elements.length + 1 },
    ...defaults,
  } as ElementDef);
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-[#f6efe8]">
    <header class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 py-3 shrink-0 bg-[#fdf7f2]" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex items-center gap-6 min-w-0">
        <h1 class="font-serif text-lg font-semibold tracking-tight" style="color: rgb(var(--shell-sidebar));">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded bg-[rgb(var(--shell-sidebar))] text-[#fdf7f2] flex items-center justify-center text-xs font-bold shadow-sm">U</div>
            Builder
          </div>
        </h1>

        <div class="h-6 w-px" style="background: rgba(61,24,32,0.1);"></div>

        <div class="relative group">
          <select
            :value="selectedTerminal ?? ''"
            class="appearance-none bg-white/60 border pl-3 pr-8 py-1.5 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[rgba(61,24,32,0.2)] hover:bg-white"
            style="border-color: rgba(61,24,32,0.15); color: rgb(var(--shell-sidebar));"
            @change="selectTerminal(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>Select terminal...</option>
            <option v-for="ip in terminals" :key="ip.id" :value="ip.id">
              {{ ip.display_name }} ({{ ip.role }})
            </option>
          </select>
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      <div class="hidden md:flex items-center justify-self-center rounded-xl border bg-white/70 px-1.5 py-1 shadow-sm" style="border-color: rgba(61,24,32,0.12);">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-black/5"
          style="color: rgba(61,24,32,0.6);"
          @click="zoom = Math.max(0.3, zoom - 0.1)"
        >
          -
        </button>
        <span class="w-14 text-center text-xs font-medium" style="color: rgba(61,24,32,0.78);">{{ Math.round(zoom * 100) }}%</span>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-black/5"
          style="color: rgba(61,24,32,0.6);"
          @click="zoom = Math.min(1.5, zoom + 0.1)"
        >
          +
        </button>
      </div>

      <div class="flex items-center justify-self-end gap-2 min-w-0">
        <button
          :disabled="!canUndo"
          class="text-xs font-medium px-3 py-2 rounded-xl transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5"
          style="color: rgba(61,24,32,0.7);"
          @click="undo"
        >
          <Undo2 class="w-4 h-4" /> Undo
        </button>

        <button
          :disabled="!canRedo"
          class="text-xs font-medium px-3 py-2 rounded-xl transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5"
          style="color: rgba(61,24,32,0.7);"
          @click="redo"
        >
          Redo <Undo2 class="w-4 h-4 scale-x-[-1]" />
        </button>

        <button
          class="text-xs font-semibold px-4 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white"
          :class="showStudioPanel ? 'shadow-sm' : ''"
          style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
          @click="showStudioPanel = !showStudioPanel"
        >
          {{ showStudioPanel ? 'Hide Studio' : 'Layers & Properties' }}
        </button>

        <button
          :disabled="!isDirty || !selectedTerminal || saving"
          class="text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-40"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 4px 12px rgba(61,24,32,0.15);"
          @click="saveLayout"
        >
          <div class="flex items-center justify-center gap-2">
            <template v-if="saving">Saving...</template>
            <template v-else-if="isDirty">Publish Changes <Sparkles class="w-4 h-4" /></template>
            <template v-else>Up to date</template>
          </div>
        </button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden bg-[#e5dfd8]">
      <aside class="w-16 shrink-0 bg-white flex flex-col items-center py-4 gap-2 z-10 shadow-sm" style="border-right: 1px solid rgba(61,24,32,0.1);">
        <button
          v-for="item in PALETTE_ITEMS"
          :key="item.type"
          class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative hover:bg-[#f8f5f2]"
          @click="dropElement(item.type, item.defaults)"
        >
          <component :is="item.icon" class="w-5 h-5 transition-transform group-hover:scale-110" style="color: rgba(61,24,32,0.7);" />
          <div class="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity">
            {{ item.label }}
          </div>
        </button>
      </aside>

      <div ref="canvasWrapper" class="canvas-container flex-1 overflow-hidden relative">
        <div class="absolute inset-0 bg-[radial-gradient(#d5cdc4_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none"></div>

        <div v-if="selectedElement" class="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center px-4">
          <div
            class="pointer-events-auto flex max-w-[min(100%,980px)] flex-wrap items-center gap-3 rounded-[28px] border bg-[#f7efe7] px-4 py-3 shadow-sm"
            style="border-color: rgba(61,24,32,0.1);"
          >
            <div class="rounded-2xl bg-[#f7f1eb] px-3 py-2 text-xs font-medium" style="color: rgba(61,24,32,0.72);">
              {{ resolutionLabel }}
            </div>

            <template v-if="selectedElement.type === 'button'">
              <select :value="(selectedElement as any).variant" class="input-warm px-3 py-2 text-xs min-w-28" @change="patch({ variant: ($event.target as HTMLSelectElement).value })">
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="ghost">Ghost</option>
                <option value="danger">Danger</option>
              </select>
            </template>

            <template v-if="selectedElement.type === 'text'">
              <input
                type="number"
                :value="(selectedElement as any).fontSize"
                class="input-warm w-20 px-3 py-2 text-xs"
                @input="patch({ fontSize: Number(($event.target as HTMLInputElement).value) })"
              />
              <select :value="(selectedElement as any).align ?? 'left'" class="input-warm px-3 py-2 text-xs min-w-24" @change="patch({ align: ($event.target as HTMLSelectElement).value })">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </template>

            <template v-if="selectedElement.type === 'image'">
              <select :value="(selectedElement as any).fit" class="input-warm px-3 py-2 text-xs min-w-24" @change="patch({ fit: ($event.target as HTMLSelectElement).value })">
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </template>

            <template v-if="selectedElement.type === 'table-view'">
              <input
                :value="(selectedElement as any).tableName"
                class="input-warm w-36 px-3 py-2 text-xs font-mono"
                placeholder="Table name"
                @input="patch({ tableName: ($event.target as HTMLInputElement).value })"
              />
            </template>

            <div class="h-8 w-px hidden md:block" style="background: rgba(61,24,32,0.08);"></div>

            <button
              class="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f7f1eb]"
              style="color: rgba(61,24,32,0.72);"
              @click="duplicateElement()"
            >
              <Copy class="w-3.5 h-3.5" />
              Duplicate
            </button>

            <button
              class="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium transition-colors hover:bg-red-50"
              style="color: #b42318;"
              @click="removeElement(selectedElement.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>

        <div v-if="!selectedTerminal" class="absolute inset-0 flex items-center justify-center">
          <div class="z-10 bg-white p-8 rounded-3xl shadow-xl border text-center pointer-events-auto" style="color: rgba(61,24,32,0.6); border-color: rgba(61,24,32,0.1);">
            <Sparkles class="w-12 h-12 mx-auto mb-4" style="color: rgb(var(--shell-sidebar));" />
            <h2 class="text-lg font-semibold mb-1" style="color: rgb(var(--shell-sidebar));">No Terminal Selected</h2>
            <p class="text-sm">Choose a terminal from the top bar to start designing its interface.</p>
          </div>
        </div>

        <Canvas v-else :business-id="business?.id ?? ''" :zoom="zoom" class="z-10 absolute inset-0" />

        <div v-if="showStudioPanel" class="absolute inset-0 z-40 flex justify-end">
          <button
            class="absolute inset-0 bg-transparent"
            aria-label="Close layers and properties"
            @click="showStudioPanel = false"
          />

          <div class="relative h-full w-[24rem] max-w-[calc(100%-1.5rem)] p-3">
            <div class="h-full rounded-[30px] border bg-white shadow-xl overflow-hidden" style="border-color: rgba(61,24,32,0.1);">
              <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.28em]" style="color: rgba(61,24,32,0.35);">Studio</p>
                  <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Layers and deep settings</p>
                </div>
                <button
                  class="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-black/5"
                  style="color: rgba(61,24,32,0.7);"
                  @click="showStudioPanel = false"
                >
                  Close
                </button>
              </div>

              <PropertiesPanel class="!w-full !border-l-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
