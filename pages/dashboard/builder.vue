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
    <header class="px-6 py-3 flex items-center gap-4 shrink-0 bg-white" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex-1">
        <h1 class="font-serif text-base font-normal" style="color: rgb(var(--shell-sidebar));">UI Builder</h1>
      </div>

      <select
        :value="selectedInpoint ?? ''"
        class="input-warm px-3 py-1.5 text-sm max-w-[200px]"
        @change="selectInpoint(($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Select terminal…</option>
        <option v-for="ip in inpoints" :key="ip.id" :value="ip.id">
          {{ ip.display_name }} ({{ ip.role }})
        </option>
      </select>

      <div class="flex items-center gap-2">
        <button class="text-sm w-6 h-6 rounded-full flex items-center justify-center" style="color: rgba(61,24,32,0.5); background: rgba(61,24,32,0.07);" @click="zoom = Math.max(0.3, zoom - 0.1)">−</button>
        <span class="text-xs w-12 text-center" style="color: rgba(61,24,32,0.5);">{{ Math.round(zoom * 100) }}%</span>
        <button class="text-sm w-6 h-6 rounded-full flex items-center justify-center" style="color: rgba(61,24,32,0.5); background: rgba(61,24,32,0.07);" @click="zoom = Math.min(1.5, zoom + 0.1)">+</button>
      </div>

      <button :disabled="!canUndo" class="text-xs font-medium disabled:opacity-30 flex items-center gap-1.5" style="color: rgba(61,24,32,0.5);" @click="undo">
        <Undo2 class="w-3.5 h-3.5" /> Undo
      </button>

      <button
        :disabled="!isDirty || !selectedInpoint || saving"
        class="text-sm font-semibold px-4 py-1.5 rounded-full transition-all disabled:opacity-40"
        style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 6px rgba(61,24,32,0.18);"
        @click="saveLayout"
      >
        <div class="flex items-center justify-center gap-1.5">
          <template v-if="saving">Saving…</template>
          <template v-else-if="isDirty">Save <Sparkles class="w-3.5 h-3.5" /></template>
          <template v-else>Saved</template>
        </div>
      </button>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Palette -->
      <aside class="w-44 shrink-0 bg-white flex flex-col py-4 gap-0.5 px-2" style="border-right: 1px solid rgba(61,24,32,0.1);">
        <p class="text-xs font-bold uppercase tracking-widest px-2 mb-3" style="color: rgba(61,24,32,0.35);">Elements</p>
        <button
          v-for="item in PALETTE_ITEMS"
          :key="item.type"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left w-full"
          style="color: rgba(61,24,32,0.6);"
          @click="dropElement(item.type, item.defaults)"
          @mouseenter="(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'rgba(61,24,32,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgb(61,24,32)'; }"
          @mouseleave="(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(61,24,32,0.6)'; }"
        >
          <component :is="item.icon" class="w-4 h-4 opacity-70" />
          {{ item.label }}
        </button>
      </aside>

      <!-- Canvas -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-8" style="background: #ede5dc;">
        <div v-if="!selectedInpoint" class="text-center" style="color: rgba(61,24,32,0.35);">
          <Sparkles class="w-10 h-10 mx-auto mb-3" />
          <p class="text-sm">Select a terminal above to start editing its layout</p>
        </div>
        <Canvas v-else :business-id="business?.id ?? ''" :zoom="zoom" />
      </div>

      <PropertiesPanel />
    </div>
  </div>
</template>
