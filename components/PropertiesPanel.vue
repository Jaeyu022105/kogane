<script setup lang="ts">
/**
 * PropertiesPanel — inspector for the selected element.
 * Each element type has its own section.
 */

import type { ElementDef, ActionType, ActionPayloadMapping } from '~/lib/uiTypes';
import { Plus, X, Trash2, Layers, PenTool } from 'lucide-vue-next';

const { layout, selectedElement, selectedId, updateElement, removeElement, bringForward, sendBackward, selectElement, updateResolution } = useCanvas();

const activeTab = ref<'design' | 'layers'>('design');

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
    <div class="flex border-b" style="border-color: rgba(61,24,32,0.08);">
      <button
        class="flex-1 py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
        :class="activeTab === 'design' ? 'bg-black/5 text-brand-primary' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'design'"
      >
        <PenTool class="w-3.5 h-3.5" /> Design
      </button>
      <button
        class="flex-1 py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
        :class="activeTab === 'layers' ? 'bg-black/5 text-brand-primary' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'layers'"
      >
        <Layers class="w-3.5 h-3.5" /> Layers
      </button>
    </div>

    <!-- Layers Tab -->
    <div v-if="activeTab === 'layers'" class="flex-1 overflow-y-auto p-2 space-y-1">
      <div v-if="layout.elements.length === 0" class="text-center py-8 text-xs text-gray-400">
        No layers yet
      </div>
      <button
        v-for="el in [...layout.elements].sort((a, b) => b.position.zIndex - a.position.zIndex)"
        :key="el.id"
        class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors"
        :class="selectedId === el.id ? 'bg-brand-primary text-white' : 'hover:bg-black/5'"
        @click="selectElement(el.id)"
      >
        <span class="truncate font-medium">{{ el.label || el.type }}</span>
        <span class="text-[10px] opacity-50">{{ el.type }}</span>
      </button>
    </div>

    <!-- Design Tab -->
    <template v-else>
      <!-- Empty state -->
      <!-- Canvas Properties -->
      <div v-if="!selectedElement" class="flex-1 flex flex-col p-4">
        <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center mb-8">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
            style="background: rgba(61,24,32,0.06);"
          >
            ☝️
          </div>
          <p class="text-sm" style="color: rgba(61,24,32,0.4);">Select an element to inspect</p>
        </div>

        <div class="border-t pt-4" style="border-color: rgba(61,24,32,0.08);">
          <p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: rgba(61,24,32,0.35);">Canvas</p>
          <label class="text-xs block mb-1.5" style="color: rgba(61,24,32,0.4);">Resolution</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-gray-400 mb-0.5 block">Width</label>
              <input type="number" :value="layout.resolution.width" class="input-warm w-full px-2 py-1 text-sm" @input="updateResolution(Number(($event.target as HTMLInputElement).value), layout.resolution.height)" />
            </div>
            <div>
              <label class="text-[10px] text-gray-400 mb-0.5 block">Height</label>
              <input type="number" :value="layout.resolution.height" class="input-warm w-full px-2 py-1 text-sm" @input="updateResolution(layout.resolution.width, Number(($event.target as HTMLInputElement).value))" />
            </div>
          </div>
        </div>
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

        <!-- Events -->
        <div class="pt-3 mt-3 border-t" style="border-color: rgba(61,24,32,0.07);">
          <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: rgba(61,24,32,0.35);">Events</p>
          <label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">On Click Action</label>
          <select
            :value="(selectedElement as any).action?.type ?? 'none'"
            class="input-warm w-full px-3 py-1.5 text-sm mb-2"
            @change="patch({ action: { type: ($event.target as HTMLSelectElement).value, payload: {} } } as any)"
          >
            <option value="none">None</option>
            <option value="navigate">Navigate to URL</option>
            <option value="insert-record">Insert Database Record</option>
            <option value="custom-script">Custom JS Script</option>
          </select>

          <div v-if="(selectedElement as any).action?.type === 'navigate'" class="space-y-2 mt-2 p-3 rounded-lg bg-gray-50 border">
            <label class="text-xs block" style="color: rgba(61,24,32,0.4);">Target URL</label>
            <input
              :value="(selectedElement as any).action.payload.url ?? ''"
              class="input-warm w-full px-2 py-1.5 text-sm"
              placeholder="https://..."
              @input="patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), url: ($event.target as HTMLInputElement).value } } } as any)"
            />
          </div>

          <div v-if="(selectedElement as any).action?.type === 'insert-record'" class="space-y-2 mt-2 p-3 rounded-lg bg-gray-50 border">
            <label class="text-xs block" style="color: rgba(61,24,32,0.4);">Table Name</label>
            <input
              :value="(selectedElement as any).action.payload.tableName ?? ''"
              class="input-warm w-full px-2 py-1.5 text-sm mb-2 font-mono"
              placeholder="e.g. users"
              @input="patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), tableName: ($event.target as HTMLInputElement).value } } } as any)"
            />

            <div class="flex items-center justify-between mb-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Data Mapping</label>
              <button
                class="text-xs text-brand-primary font-medium flex items-center gap-1"
                @click="patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), dataMapping: { ...((selectedElement as any).action.payload.dataMapping), ['new_col']: { type: 'static', value: '' } } } } } as any)"
              >
                <Plus class="w-3 h-3" /> Add
              </button>
            </div>
            
            <div v-for="(mapping, colName) in ((selectedElement as any).action.payload.dataMapping ?? {})" :key="colName" class="space-y-1 p-2 bg-white rounded border border-gray-100 mb-2 shadow-sm">
              <div class="flex items-center gap-1">
                <input
                  :value="colName"
                  class="input-warm px-1.5 py-1 text-xs font-mono w-1/3"
                  placeholder="column"
                  @change="(e) => {
                    const newMap = { ...((selectedElement as any).action.payload.dataMapping) };
                    const newCol = (e.target as HTMLInputElement).value;
                    if(newCol !== colName) {
                      newMap[newCol] = newMap[colName];
                      delete newMap[colName];
                      patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), dataMapping: newMap } } } as any);
                    }
                  }"
                />
                <select
                  :value="mapping.type"
                  class="input-warm px-1 py-1 text-[0.65rem] w-1/3"
                  @change="(e) => {
                    const newMap = { ...((selectedElement as any).action.payload.dataMapping) };
                    newMap[colName] = { type: (e.target as HTMLSelectElement).value, value: '', elementId: '' };
                    patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), dataMapping: newMap } } } as any);
                  }"
                >
                  <option value="static">Static</option>
                  <option value="element_value">Element ID</option>
                </select>
                <button
                  class="text-red-400 p-1 hover:bg-red-50 rounded"
                  @click="() => {
                    const newMap = { ...((selectedElement as any).action.payload.dataMapping) };
                    delete newMap[colName];
                    patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), dataMapping: newMap } } } as any);
                  }"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
              <div v-if="mapping.type === 'static'" class="mt-1">
                <input
                  :value="mapping.value"
                  class="input-warm w-full px-2 py-1 text-xs"
                  placeholder="value"
                  @input="(e) => {
                    const newMap = { ...((selectedElement as any).action.payload.dataMapping) };
                    newMap[colName].value = (e.target as HTMLInputElement).value;
                    patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), dataMapping: newMap } } } as any);
                  }"
                />
              </div>
              <div v-else-if="mapping.type === 'element_value'" class="mt-1">
                <select
                  :value="mapping.elementId"
                  class="input-warm w-full px-2 py-1 text-xs"
                  @change="(e) => {
                    const newMap = { ...((selectedElement as any).action.payload.dataMapping) };
                    newMap[colName].elementId = (e.target as HTMLSelectElement).value;
                    patch({ action: { ...((selectedElement as any).action), payload: { ...((selectedElement as any).action.payload), dataMapping: newMap } } } as any);
                  }"
                >
                  <option value="">Select Input...</option>
                  <option v-for="el in layout.elements.filter(e => e.type === 'input-field')" :key="el.id" :value="el.id">
                    {{ el.label || el.type }} ({{ el.id.slice(0, 4) }})
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
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
    </template>
  </aside>
</template>
