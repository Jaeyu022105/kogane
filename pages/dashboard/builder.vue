<script setup lang="ts">
import type { ElementDef, ElementType, UiLayout } from '~/lib/uiTypes';
import Canvas          from '~/components/Canvas.vue';
import PropertiesPanel from '~/components/PropertiesPanel.vue';
import { Hexagon, Type, Image as ImageIcon, Database, RectangleHorizontal, ShoppingCart, Undo2, Sparkles } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders }     = useAuth();
const { business }        = useBusiness();
const { layout, isDirty, canUndo, loadLayout, addElement, undo } = useCanvas();

const inpoints        = ref<{ id: string; display_name: string; role: string; ui_layout: string }[]>([]);
const selectedInpoint = ref<string | null>(null);
const saving          = ref(false);
const zoom            = ref(0.7);

async function loadInpoints() {
  if (!business.value) return;
  const res = await $fetch<{ inpoints: any[]; error: string | null }>('/api/inpoints', {
    headers: authHeaders(),
    query:   { businessId: business.value.id },
  });
  inpoints.value = res.inpoints ?? [];
}

function selectInpoint(id: string) {
  selectedInpoint.value = id;
  const ip = inpoints.value.find(i => i.id === id);
  if (!ip) return;
  try {
    const parsed: UiLayout = typeof ip.ui_layout === 'string' ? JSON.parse(ip.ui_layout) : ip.ui_layout;
    loadLayout(parsed);
  } catch {
    loadLayout({ version: 1, resolution: { width: 1280, height: 720 }, elements: [] });
  }
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

onMounted(loadInpoints);
watch(() => business.value?.id, loadInpoints);

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
      </div>
    </header>

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
      <div class="flex-1 overflow-auto flex items-center justify-center relative">
        <div class="absolute inset-0 bg-[radial-gradient(#d5cdc4_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
        
        <div v-if="!selectedInpoint" class="text-center z-10 bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/50" style="color: rgba(61,24,32,0.6);">
          <Sparkles class="w-12 h-12 mx-auto mb-4" style="color: rgb(var(--shell-sidebar));" />
          <h2 class="text-lg font-semibold mb-1" style="color: rgb(var(--shell-sidebar));">No Terminal Selected</h2>
          <p class="text-sm">Choose a terminal from the top bar to start designing its interface.</p>
        </div>
        <Canvas v-else :business-id="business?.id ?? ''" :zoom="zoom" class="z-10 shadow-2xl" />
      </div>

      <PropertiesPanel />
    </div>
  </div>
</template>
