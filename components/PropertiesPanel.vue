<script setup lang="ts">
/**
 * PropertiesPanel — inspector for the selected element.
 * Each element type has its own section. Adding a new type = add one section here.
 * Reads/writes through useCanvas() — no direct state mutation.
 */

import type { ElementDef, ElementType, ColumnType } from '~/lib/uiTypes';

const {
  selectedElement,
  selectedId,
  updateElement,
  removeElement,
  bringForward,
  sendBackward,
} = useCanvas();

// Generic field updater — preserves unrelated keys
function patch(updates: Partial<Omit<ElementDef, 'id' | 'type'>>) {
  if (!selectedId.value) return;
  updateElement(selectedId.value, updates);
}

function patchPosition(pos: Partial<{ x: number; y: number; width: number; height: number; zIndex: number }>) {
  if (!selectedElement.value) return;
  patch({ position: { ...selectedElement.value.position, ...pos } });
}
</script>

<template>
  <aside class="w-64 h-full flex flex-col surface border-l border-white/10 overflow-y-auto">
    <!-- Empty state -->
    <div v-if="!selectedElement" class="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
      <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">☝️</div>
      <p class="text-white/40 text-sm">Select an element to inspect</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <p class="text-xs text-white/40 uppercase tracking-wide">{{ selectedElement.type }}</p>
          <p class="text-sm font-semibold text-white">{{ selectedElement.label || '(unnamed)' }}</p>
        </div>
        <button
          class="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
          @click="removeElement(selectedElement!.id)"
        >
          Delete
        </button>
      </div>

      <!-- Label -->
      <section class="px-4 py-3 border-b border-white/10 space-y-2">
        <label class="block text-xs text-white/50">Label</label>
        <input
          :value="selectedElement.label ?? ''"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @input="patch({ label: ($event.target as HTMLInputElement).value })"
        />
      </section>

      <!-- Position & Size -->
      <section class="px-4 py-3 border-b border-white/10 space-y-2">
        <p class="text-xs text-white/50 uppercase tracking-wide">Position & Size</p>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs text-white/40 block mb-1">X</label>
            <input
              type="number"
              :value="selectedElement.position.x"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              @input="patchPosition({ x: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Y</label>
            <input
              type="number"
              :value="selectedElement.position.y"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              @input="patchPosition({ y: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">W</label>
            <input
              type="number"
              :value="selectedElement.position.width"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              @input="patchPosition({ width: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">H</label>
            <input
              type="number"
              :value="selectedElement.position.height"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              @input="patchPosition({ height: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>

        <!-- Z-index controls -->
        <div class="flex gap-2 pt-1">
          <button
            class="flex-1 text-xs py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            @click="sendBackward(selectedElement!.id)"
          >
            ↓ Back
          </button>
          <button
            class="flex-1 text-xs py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            @click="bringForward(selectedElement!.id)"
          >
            ↑ Forward
          </button>
        </div>
      </section>

      <!-- Type-specific properties -->

      <!-- Button -->
      <section v-if="selectedElement.type === 'button'" class="px-4 py-3 border-b border-white/10 space-y-2">
        <p class="text-xs text-white/50 uppercase tracking-wide">Button</p>
        <label class="text-xs text-white/40 block mb-1">Text</label>
        <input
          :value="(selectedElement as any).text"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @input="patch({ text: ($event.target as HTMLInputElement).value } as any)"
        />
        <label class="text-xs text-white/40 block mb-1 mt-2">Variant</label>
        <select
          :value="(selectedElement as any).variant"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @change="patch({ variant: ($event.target as HTMLSelectElement).value } as any)"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="ghost">Ghost</option>
          <option value="danger">Danger</option>
        </select>
      </section>

      <!-- Text -->
      <section v-if="selectedElement.type === 'text'" class="px-4 py-3 border-b border-white/10 space-y-2">
        <p class="text-xs text-white/50 uppercase tracking-wide">Text</p>
        <label class="text-xs text-white/40 block mb-1">Content</label>
        <textarea
          :value="(selectedElement as any).content"
          rows="3"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
          @input="patch({ content: ($event.target as HTMLTextAreaElement).value } as any)"
        />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs text-white/40 block mb-1">Size (px)</label>
            <input
              type="number"
              :value="(selectedElement as any).fontSize"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              @input="patch({ fontSize: Number(($event.target as HTMLInputElement).value) } as any)"
            />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Align</label>
            <select
              :value="(selectedElement as any).align ?? 'left'"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              @change="patch({ align: ($event.target as HTMLSelectElement).value } as any)"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Image -->
      <section v-if="selectedElement.type === 'image'" class="px-4 py-3 border-b border-white/10 space-y-2">
        <p class="text-xs text-white/50 uppercase tracking-wide">Image</p>
        <label class="text-xs text-white/40 block mb-1">URL</label>
        <input
          :value="(selectedElement as any).src"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @input="patch({ src: ($event.target as HTMLInputElement).value } as any)"
        />
        <label class="text-xs text-white/40 block mb-1 mt-2">Fit</label>
        <select
          :value="(selectedElement as any).fit"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @change="patch({ fit: ($event.target as HTMLSelectElement).value } as any)"
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="fill">Fill</option>
        </select>
      </section>

      <!-- Table View -->
      <section v-if="selectedElement.type === 'table-view'" class="px-4 py-3 border-b border-white/10 space-y-2">
        <p class="text-xs text-white/50 uppercase tracking-wide">Table View</p>
        <label class="text-xs text-white/40 block mb-1">Table Name</label>
        <input
          :value="(selectedElement as any).tableName"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @input="patch({ tableName: ($event.target as HTMLInputElement).value } as any)"
        />
        <label class="text-xs text-white/40 block mb-1 mt-2">Columns (comma-separated)</label>
        <input
          :value="(selectedElement as any).columns?.join(', ')"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
          @input="patch({ columns: ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean) } as any)"
        />
      </section>
    </template>
  </aside>
</template>
