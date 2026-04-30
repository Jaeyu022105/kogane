<script setup lang="ts">
/**
 * UI Builder page — Figma-like canvas editor for in-point layouts.
 * Three-panel layout: element palette | canvas | properties panel
 */

import type { ElementDef, ElementType, UiLayout } from '~/lib/uiTypes';
import Canvas          from '~/components/Canvas.vue';
import PropertiesPanel from '~/components/PropertiesPanel.vue';

definePageMeta({ layout: 'dashboard' });

const { authHeaders }     = useAuth();
const { business }        = useBusiness();
const { layout, isDirty, canUndo, loadLayout, addElement, undo } = useCanvas();

// ── Inpoint selection ─────────────────────────────────────────────────────────

const inpoints    = ref<{ id: string; display_name: string; role: string; ui_layout: string }[]>([]);
const selectedInpoint = ref<string | null>(null);
const saving      = ref(false);
const zoom        = ref(0.7);

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
    const parsed: UiLayout = typeof ip.ui_layout === 'string'
      ? JSON.parse(ip.ui_layout)
      : ip.ui_layout;
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

// ── Element palette ───────────────────────────────────────────────────────────

const PALETTE_ITEMS: Array<{ type: ElementType; label: string; icon: string; defaults: Partial<ElementDef> }> = [
  { type: 'button',      label: 'Button',      icon: '⬡', defaults: { text: 'Button', variant: 'primary' } as any },
  { type: 'text',        label: 'Text',        icon: 'T',  defaults: { content: 'Text', fontSize: 16, fontWeight: 'normal' } as any },
  { type: 'image',       label: 'Image',       icon: '🖼', defaults: { src: '', fit: 'cover' } as any },
  { type: 'table-view',  label: 'Table View',  icon: '⛁', defaults: { tableName: '', columns: [] } as any },
  { type: 'input-field', label: 'Input',       icon: '▭', defaults: { fieldName: 'field', inputType: 'text' } as any },
  { type: 'cart-widget', label: 'Cart',        icon: '🛒', defaults: { productTable: '', orderTable: '', displayColumns: [] } as any },
];

function dropElement(type: ElementType, defaults: Partial<ElementDef>) {
  const id = crypto.randomUUID();
  addElement({
    id,
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
    <header class="px-6 py-3 border-b border-white/8 flex items-center gap-4 shrink-0">
      <div class="flex-1">
        <h1 class="text-base font-bold text-white">UI Builder</h1>
      </div>

      <!-- Inpoint selector -->
      <select
        :value="selectedInpoint ?? ''"
        class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary max-w-[200px]"
        @change="selectInpoint(($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Select terminal…</option>
        <option v-for="ip in inpoints" :key="ip.id" :value="ip.id">
          {{ ip.display_name }} ({{ ip.role }})
        </option>
      </select>

      <!-- Zoom -->
      <div class="flex items-center gap-2">
        <button class="text-white/40 hover:text-white text-sm" @click="zoom = Math.max(0.3, zoom - 0.1)">－</button>
        <span class="text-xs text-white/40 w-12 text-center">{{ Math.round(zoom * 100) }}%</span>
        <button class="text-white/40 hover:text-white text-sm" @click="zoom = Math.min(1.5, zoom + 0.1)">＋</button>
      </div>

      <!-- Undo -->
      <button
        :disabled="!canUndo"
        class="text-xs text-white/50 hover:text-white disabled:opacity-30 transition-colors"
        @click="undo"
      >
        ↩ Undo
      </button>

      <!-- Save -->
      <button
        :disabled="!isDirty || !selectedInpoint || saving"
        class="bg-brand-primary hover:brightness-110 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-all shadow-lg shadow-brand-primary/20"
        @click="saveLayout"
      >
        {{ saving ? 'Saving…' : isDirty ? 'Save *' : 'Saved' }}
      </button>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Element Palette (left) -->
      <aside class="w-44 shrink-0 surface border-r border-white/10 flex flex-col py-4 gap-1 px-2">
        <p class="text-xs text-white/30 uppercase tracking-wide px-2 mb-2">Elements</p>
        <button
          v-for="item in PALETTE_ITEMS"
          :key="item.type"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-all text-left w-full"
          @click="dropElement(item.type, item.defaults)"
        >
          <span class="text-base w-5 text-center">{{ item.icon }}</span>
          {{ item.label }}
        </button>
      </aside>

      <!-- Canvas area (center) -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-8 bg-[#0c0c14]">
        <div v-if="!selectedInpoint" class="text-center text-white/30 text-sm">
          <div class="text-4xl mb-3">⬛</div>
          <p>Select a terminal above to start editing its layout</p>
        </div>
        <Canvas
          v-else
          :business-id="business?.id ?? ''"
          :zoom="zoom"
        />
      </div>

      <!-- Properties Panel (right) -->
      <PropertiesPanel />
    </div>
  </div>
</template>
