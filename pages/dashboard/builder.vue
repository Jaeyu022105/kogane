<script setup lang="ts">
import type { ElementDef, ElementType, UiLayout } from '~/lib/uiTypes';
import Canvas          from '~/components/Canvas.vue';
import PropertiesPanel from '~/components/PropertiesPanel.vue';
import { Hexagon, Type, Image as ImageIcon, Database, RectangleHorizontal, ShoppingCart, Undo2, Sparkles } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders }     = useAuth();
const { business }        = useBusiness();
const { layout, selectedElement, selectedId, isDirty, canUndo, canRedo, loadLayout, addElement, removeElement, undo, redo, cutElement, copyElement, pasteElement, duplicateElement, updateElement, cameraX, cameraY, setCamera } = useCanvas();

const showPropertiesPanel = ref(true);
const canvasWrapper       = ref<HTMLElement | null>(null);

const inpoints        = ref<{ id: string; display_name: string; role: string; ui_layout: string }[]>([]);
const selectedInpoint = ref<string | null>(null);
const saving          = ref(false);
const zoom            = ref(0.7);

const route           = useRoute();

async function loadInpoints() {
  if (!business.value) return;
  const res = await $fetch<{ inpoints: any[]; error: string | null }>('/api/inpoints', {
    headers: authHeaders(),
    query:   { businessId: business.value.id },
  });
  inpoints.value = res.inpoints ?? [];

  if (route.query.inpoint && !selectedInpoint.value) {
    selectInpoint(route.query.inpoint as string);
  }
}

function selectInpoint(id: string) {
  selectedInpoint.value = id;
  const ip = inpoints.value.find(i => i.id === id);
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
  if (!selectedInpoint.value) return;
  saving.value = true;
  try {
    await $fetch('/api/inpoints/layout', {
      method:  'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    { inpointId: selectedInpoint.value, layout: layout.value },
    });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadInpoints();
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

watch(() => business.value?.id, loadInpoints);

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  
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
  { type: 'button',      label: 'Button',     icon: Hexagon, defaults: { text: 'Button', variant: 'primary' } as any },
  { type: 'text',        label: 'Text',       icon: Type,  defaults: { content: 'Text', fontSize: 16, fontWeight: 'normal' } as any },
  { type: 'image',       label: 'Image',      icon: ImageIcon, defaults: { src: '', fit: 'cover' } as any },
  { type: 'table-view',  label: 'Table View', icon: Database, defaults: { tableName: '', columns: [] } as any },
  { type: 'input-field', label: 'Input',      icon: RectangleHorizontal, defaults: { fieldName: 'field', inputType: 'text' } as any },
  { type: 'cart-widget', label: 'Cart',       icon: ShoppingCart, defaults: { productTable: '', orderTable: '', displayColumns: [] } as any },
];

function dropElement(type: ElementType, defaults: Partial<ElementDef>) {
  addElement({
    id:       crypto.randomUUID(),
    type,
    label:    type,
    position: { x: 80, y: 80, width: 200, height: 60, zIndex: layout.value.elements.length + 1 },
    ...defaults,
  } as ElementDef);
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Topbar -->
    <header class="px-6 py-3 flex items-center justify-between shrink-0 bg-[#fdf7f2]" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex items-center gap-6">
        <h1 class="font-serif text-lg font-semibold tracking-tight" style="color: rgb(var(--shell-sidebar));">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded bg-[rgb(var(--shell-sidebar))] text-[#fdf7f2] flex items-center justify-center text-xs font-bold shadow-sm">U</div>
            Builder
          </div>
        </h1>

        <div class="h-6 w-px" style="background: rgba(61,24,32,0.1);"></div>

        <div class="relative group">
          <select
            :value="selectedInpoint ?? ''"
            class="appearance-none bg-white/50 border pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[rgba(61,24,32,0.2)] hover:bg-white"
            style="border-color: rgba(61,24,32,0.15); color: rgb(var(--shell-sidebar));"
            @change="selectInpoint(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>Select terminal…</option>
            <option v-for="ip in inpoints" :key="ip.id" :value="ip.id">
              {{ ip.display_name }} ({{ ip.role }})
            </option>
          </select>
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      <div class="flex items-center bg-white border rounded-lg p-1 shadow-sm" style="border-color: rgba(61,24,32,0.1);">
        <button class="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors" style="color: rgba(61,24,32,0.6);" @click="zoom = Math.max(0.3, zoom - 0.1)">−</button>
        <span class="text-xs font-mono w-12 text-center" style="color: rgba(61,24,32,0.8);">{{ Math.round(zoom * 100) }}%</span>
        <button class="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors" style="color: rgba(61,24,32,0.6);" @click="zoom = Math.min(1.5, zoom + 0.1)">+</button>
      </div>

      <div class="flex items-center gap-3">
        <button 
          :disabled="!canUndo" 
          class="text-xs font-medium px-3 py-2 rounded-lg transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5" 
          style="color: rgba(61,24,32,0.7);" 
          @click="undo"
        >
          <Undo2 class="w-4 h-4" /> Undo
        </button>

        <button 
          v-if="canRedo"
          class="text-xs font-medium px-3 py-2 rounded-lg transition-all hover:bg-black/5 flex items-center gap-1.5" 
          style="color: rgba(61,24,32,0.7);" 
          @click="redo"
        >
          Redo <Undo2 class="w-4 h-4 scale-x-[-1]" />
        </button>

        <button
          :disabled="!isDirty || !selectedInpoint || saving"
          class="text-sm font-semibold px-5 py-2 rounded-lg transition-all disabled:opacity-40"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 4px 12px rgba(61,24,32,0.15);"
          @click="saveLayout"
        >
          <div class="flex items-center justify-center gap-2">
            <template v-if="saving">Saving…</template>
            <template v-else-if="isDirty">Publish Changes <Sparkles class="w-4 h-4" /></template>
            <template v-else>Up to date</template>
          </div>
        </button>

        <div class="h-6 w-px mx-1" style="background: rgba(61,24,32,0.1);"></div>

        <button
          class="text-xs font-medium px-3 py-2 rounded-lg transition-all hover:bg-black/5"
          :class="showPropertiesPanel ? 'bg-black/5' : ''"
          style="color: rgba(61,24,32,0.7);"
          @click="showPropertiesPanel = !showPropertiesPanel"
        >
          Properties
        </button>
      </div>
    </header>

    <!-- Context / Simplified Properties Top Bar -->
    <div v-if="selectedElement" class="h-12 bg-white flex items-center px-4 shrink-0 shadow-sm z-20 gap-4" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">
        {{ selectedElement.type }}
      </div>
      
      <div class="h-4 w-px" style="background: rgba(61,24,32,0.1);"></div>

      <template v-if="selectedElement.type === 'button'">
        <div class="flex items-center gap-2">
          <label class="text-xs" style="color: rgba(61,24,32,0.6);">Variant</label>
          <select :value="(selectedElement as any).variant" class="input-warm px-2 py-1 text-xs" @change="patch({ variant: ($event.target as HTMLSelectElement).value })">
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="ghost">Ghost</option>
            <option value="danger">Danger</option>
          </select>
        </div>
      </template>

      <template v-if="selectedElement.type === 'text'">
        <div class="flex items-center gap-2">
          <label class="text-xs" style="color: rgba(61,24,32,0.6);">Size</label>
          <input type="number" :value="(selectedElement as any).fontSize" class="input-warm w-16 px-2 py-1 text-xs" @input="patch({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs" style="color: rgba(61,24,32,0.6);">Align</label>
          <select :value="(selectedElement as any).align ?? 'left'" class="input-warm px-2 py-1 text-xs" @change="patch({ align: ($event.target as HTMLSelectElement).value })">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </template>

      <template v-if="selectedElement.type === 'image'">
        <div class="flex items-center gap-2">
          <label class="text-xs" style="color: rgba(61,24,32,0.6);">Fit</label>
          <select :value="(selectedElement as any).fit" class="input-warm px-2 py-1 text-xs" @change="patch({ fit: ($event.target as HTMLSelectElement).value })">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </div>
      </template>

      <template v-if="selectedElement.type === 'table-view'">
        <div class="flex items-center gap-2">
          <label class="text-xs" style="color: rgba(61,24,32,0.6);">Table</label>
          <input :value="(selectedElement as any).tableName" class="input-warm w-32 px-2 py-1 text-xs font-mono" placeholder="Table Name" @input="patch({ tableName: ($event.target as HTMLInputElement).value })" />
        </div>
      </template>
    </div>

    <div class="flex-1 flex overflow-hidden bg-[#e5dfd8]">
      <!-- Palette Sidebar (Icon based like Figma) -->
      <aside class="w-16 shrink-0 bg-white flex flex-col items-center py-4 gap-2 z-10 shadow-sm" style="border-right: 1px solid rgba(61,24,32,0.1);">
        <button
          v-for="item in PALETTE_ITEMS"
          :key="item.type"
          class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
          :class="['hover:bg-[#f8f5f2]']"
          @click="dropElement(item.type, item.defaults)"
        >
          <component :is="item.icon" class="w-5 h-5 transition-transform group-hover:scale-110" style="color: rgba(61,24,32,0.7);" />
          
          <!-- Tooltip -->
          <div class="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity">
            {{ item.label }}
          </div>
        </button>
      </aside>

      <!-- Canvas -->
      <div ref="canvasWrapper" class="canvas-container flex-1 overflow-hidden relative">
        <div class="absolute inset-0 bg-[radial-gradient(#d5cdc4_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none"></div>
        
        <div v-if="!selectedInpoint" class="absolute inset-0 flex items-center justify-center">
          <div class="z-10 bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/50 text-center pointer-events-auto" style="color: rgba(61,24,32,0.6);">
            <Sparkles class="w-12 h-12 mx-auto mb-4" style="color: rgb(var(--shell-sidebar));" />
            <h2 class="text-lg font-semibold mb-1" style="color: rgb(var(--shell-sidebar));">No Terminal Selected</h2>
            <p class="text-sm">Choose a terminal from the top bar to start designing its interface.</p>
          </div>
        </div>
        <Canvas v-else :business-id="business?.id ?? ''" :zoom="zoom" class="z-10 absolute inset-0" />
      </div>

      <PropertiesPanel v-if="showPropertiesPanel" />
    </div>
  </div>
</template>
