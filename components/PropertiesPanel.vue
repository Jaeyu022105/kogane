<script setup lang="ts">
/**
 * PropertiesPanel — inspector for the selected element.
 * Each element type has its own section.
 */

import type { ElementDef } from '~/lib/uiTypes';

const { selectedElement, selectedId, updateElement, removeElement, bringForward, sendBackward } = useCanvas();

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
  <aside
    class="w-64 h-full flex flex-col overflow-y-auto bg-white"
    style="border-left: 1px solid rgba(61,24,32,0.1);"
  >
    <!-- Empty state -->
    <div v-if="!selectedElement" class="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
        style="background: rgba(61,24,32,0.06);"
      >
        ☝️
      </div>
      <p class="text-sm" style="color: rgba(61,24,32,0.4);">Select an element to inspect</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div
        class="px-4 py-3 flex items-center justify-between"
        style="border-bottom: 1px solid rgba(61,24,32,0.08);"
      >
        <div>
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">
            {{ selectedElement.type }}
          </p>
          <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">
            {{ selectedElement.label || '(unnamed)' }}
          </p>
        </div>
        <button
          class="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
          style="color: #dc2626; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.18);"
          @click="removeElement(selectedElement!.id)"
        >
          Delete
        </button>
      </div>

      <!-- Label -->
      <section class="px-4 py-3 space-y-1.5" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <label class="block text-xs font-semibold" style="color: rgba(61,24,32,0.4);">Label</label>
        <input
          :value="selectedElement.label ?? ''"
          class="input-warm w-full px-3 py-1.5 text-sm"
          @input="patch({ label: ($event.target as HTMLInputElement).value })"
        />
      </section>

      <!-- Position & Size -->
      <section class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Position &amp; Size</p>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">X</label>
            <input type="number" :value="selectedElement.position.x" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ x: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div>
            <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Y</label>
            <input type="number" :value="selectedElement.position.y" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ y: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div>
            <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">W</label>
            <input type="number" :value="selectedElement.position.width" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ width: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div>
            <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">H</label>
            <input type="number" :value="selectedElement.position.height" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ height: Number(($event.target as HTMLInputElement).value) })" />
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            class="flex-1 text-xs py-1.5 rounded-full font-medium transition-colors"
            style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.55);"
            @click="sendBackward(selectedElement!.id)"
          >
            ↓ Back
          </button>
          <button
            class="flex-1 text-xs py-1.5 rounded-full font-medium transition-colors"
            style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.55);"
            @click="bringForward(selectedElement!.id)"
          >
            ↑ Forward
          </button>
        </div>
      </section>

      <!-- Button -->
      <section v-if="selectedElement.type === 'button'" class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Button</p>
        <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Text</label>
        <input
          :value="(selectedElement as any).text"
          class="input-warm w-full px-3 py-1.5 text-sm"
          @input="patch({ text: ($event.target as HTMLInputElement).value } as any)"
        />
        <label class="text-xs block mb-1 mt-2" style="color: rgba(61,24,32,0.4);">Variant</label>
        <select
          :value="(selectedElement as any).variant"
          class="input-warm w-full px-3 py-1.5 text-sm"
          @change="patch({ variant: ($event.target as HTMLSelectElement).value } as any)"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="ghost">Ghost</option>
          <option value="danger">Danger</option>
        </select>
      </section>

      <!-- Text -->
      <section v-if="selectedElement.type === 'text'" class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Text</p>
        <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Content</label>
        <textarea
          :value="(selectedElement as any).content"
          rows="3"
          class="input-warm w-full px-3 py-1.5 text-sm resize-none"
          @input="patch({ content: ($event.target as HTMLTextAreaElement).value } as any)"
        />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Size (px)</label>
            <input type="number" :value="(selectedElement as any).fontSize" class="input-warm w-full px-2 py-1 text-sm" @input="patch({ fontSize: Number(($event.target as HTMLInputElement).value) } as any)" />
          </div>
          <div>
            <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Align</label>
            <select :value="(selectedElement as any).align ?? 'left'" class="input-warm w-full px-2 py-1 text-sm" @change="patch({ align: ($event.target as HTMLSelectElement).value } as any)">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Image -->
      <section v-if="selectedElement.type === 'image'" class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Image</p>
        <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">URL</label>
        <input :value="(selectedElement as any).src" class="input-warm w-full px-3 py-1.5 text-sm" @input="patch({ src: ($event.target as HTMLInputElement).value } as any)" />
        <label class="text-xs block mb-1 mt-2" style="color: rgba(61,24,32,0.4);">Fit</label>
        <select :value="(selectedElement as any).fit" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ fit: ($event.target as HTMLSelectElement).value } as any)">
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="fill">Fill</option>
        </select>
      </section>

      <!-- Table View -->
      <section v-if="selectedElement.type === 'table-view'" class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Table View</p>
        <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Table Name</label>
        <input :value="(selectedElement as any).tableName" class="input-warm w-full px-3 py-1.5 text-sm font-mono" @input="patch({ tableName: ($event.target as HTMLInputElement).value } as any)" />
        <label class="text-xs block mb-1 mt-2" style="color: rgba(61,24,32,0.4);">Columns (comma-separated)</label>
        <input
          :value="(selectedElement as any).columns?.join(', ')"
          class="input-warm w-full px-3 py-1.5 text-sm"
          @input="patch({ columns: ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean) } as any)"
        />
      </section>
    </template>
  </aside>
</template>
