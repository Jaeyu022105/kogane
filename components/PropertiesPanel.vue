<script setup lang="ts">
import { Layers, PenTool, Plus, Trash2 } from 'lucide-vue-next';
import type { ElementDef, ElementEventBinding, EventTrigger, RuntimeActionDefinition } from '~/lib/uiTypes';
import { TRIGGERS_BY_ELEMENT_TYPE } from '~/lib/uiTypes';

const {
  layout,
  activeElements,
  selectedElement,
  selectedId,
  updateElement,
  removeElement,
  bringForward,
  sendBackward,
  selectElement,
  updateResolution,
} = useCanvas();

const activeTab = ref<'design' | 'layers'>('design');

function patch(updates: Partial<Omit<ElementDef, 'id' | 'type'>>) {
  if (!selectedId.value) return;
  updateElement(selectedId.value, updates);
}

function patchPosition(pos: Partial<{ x: number; y: number; width: number; height: number; zIndex: number }>) {
  if (!selectedElement.value) return;
  patch({ position: { ...selectedElement.value.position, ...pos } });
}

function updateEvents(nextEvents: ElementEventBinding[]) {
  patch({ events: nextEvents } as any);
}

function parseJsonPayload(value: string) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function addEvent() {
  if (!selectedElement.value) return;
  updateEvents([
    ...((selectedElement.value as any).events ?? []),
    {
      id: crypto.randomUUID(),
      trigger: TRIGGERS_BY_ELEMENT_TYPE[selectedElement.value.type][0] ?? 'click',
      action: {
        type: 'emit',
        event: 'modal:close',
      } satisfies RuntimeActionDefinition,
    },
  ]);
}

function updateEvent(index: number, patchValue: Partial<ElementEventBinding>) {
  if (!selectedElement.value) return;
  const nextEvents = [...((selectedElement.value as any).events ?? [])];
  nextEvents[index] = {
    ...nextEvents[index],
    ...patchValue,
    action: {
      ...nextEvents[index].action,
      ...(patchValue.action ?? {}),
    },
  };
  updateEvents(nextEvents);
}

function removeEvent(index: number) {
  if (!selectedElement.value) return;
  const nextEvents = [...((selectedElement.value as any).events ?? [])];
  nextEvents.splice(index, 1);
  updateEvents(nextEvents);
}

const ACTION_TYPES: RuntimeActionDefinition['type'][] = ['insert', 'update', 'delete', 'query', 'emit', 'navigate', 'upload'];
</script>

<template>
  <aside class="w-64 h-full flex flex-col overflow-y-auto bg-white" style="border-left: 1px solid rgba(61,24,32,0.1);">
    <div class="flex border-b" style="border-color: rgba(61,24,32,0.08);">
      <button class="flex-1 py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5" :class="activeTab === 'design' ? 'bg-black/5 text-brand-primary' : 'text-gray-400 hover:text-gray-600'" @click="activeTab = 'design'">
        <PenTool class="w-3.5 h-3.5" /> Design
      </button>
      <button class="flex-1 py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5" :class="activeTab === 'layers' ? 'bg-black/5 text-brand-primary' : 'text-gray-400 hover:text-gray-600'" @click="activeTab = 'layers'">
        <Layers class="w-3.5 h-3.5" /> Layers
      </button>
    </div>

    <div v-if="activeTab === 'layers'" class="flex-1 overflow-y-auto p-2 space-y-1">
      <div v-if="activeElements.length === 0" class="text-center py-8 text-xs text-gray-400">No elements yet</div>
      <button
        v-for="element in [...activeElements].sort((left, right) => right.position.zIndex - left.position.zIndex)"
        :key="element.id"
        class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors"
        :class="selectedId === element.id ? 'bg-brand-primary text-white' : 'hover:bg-black/5'"
        @click="selectElement(element.id)"
      >
        <span class="truncate font-medium">{{ element.label || element.type }}</span>
        <span class="text-[10px] opacity-50">{{ element.type }}</span>
      </button>
    </div>

    <template v-else>
      <div v-if="!selectedElement" class="flex-1 flex flex-col p-4">
        <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center mb-8">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style="background: rgba(61,24,32,0.06);">I</div>
          <p class="text-sm" style="color: rgba(61,24,32,0.4);">Select an element to inspect</p>
        </div>
        <div class="border-t pt-4" style="border-color: rgba(61,24,32,0.08);">
          <p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: rgba(61,24,32,0.35);">Canvas</p>
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

      <div v-else class="pb-8">
        <div class="px-4 py-3 flex items-center justify-between" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">{{ selectedElement.type }}</p>
            <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ selectedElement.label || '(unnamed)' }}</p>
          </div>
          <button class="text-xs px-2.5 py-1 rounded-full font-medium transition-colors" style="color: #dc2626; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.18);" @click="removeElement(selectedElement.id)">
            Delete
          </button>
        </div>

        <section class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <label class="block text-xs font-semibold" style="color: rgba(61,24,32,0.4);">Label</label>
          <input :value="selectedElement.label ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" @input="patch({ label: ($event.target as HTMLInputElement).value })" />
        </section>

        <section class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Position &amp; Size</p>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">X</label><input type="number" :value="selectedElement.position.x" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ x: Number(($event.target as HTMLInputElement).value) })" /></div>
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Y</label><input type="number" :value="selectedElement.position.y" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ y: Number(($event.target as HTMLInputElement).value) })" /></div>
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">W</label><input type="number" :value="selectedElement.position.width" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ width: Number(($event.target as HTMLInputElement).value) })" /></div>
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">H</label><input type="number" :value="selectedElement.position.height" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ height: Number(($event.target as HTMLInputElement).value) })" /></div>
          </div>
          <div class="flex gap-2 pt-1">
            <button class="flex-1 text-xs py-1.5 rounded-full font-medium transition-colors" style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.55);" @click="sendBackward(selectedElement.id)">Back</button>
            <button class="flex-1 text-xs py-1.5 rounded-full font-medium transition-colors" style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.55);" @click="bringForward(selectedElement.id)">Forward</button>
          </div>
        </section>

        <section class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Content</p>
          <template v-if="selectedElement.type === 'button'">
            <input :value="(selectedElement as any).text" class="input-warm w-full px-3 py-1.5 text-sm" @input="patch({ text: ($event.target as HTMLInputElement).value } as any)" />
            <select :value="(selectedElement as any).variant" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ variant: ($event.target as HTMLSelectElement).value } as any)">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="ghost">Ghost</option>
              <option value="danger">Danger</option>
            </select>
          </template>
          <template v-else-if="selectedElement.type === 'text'">
            <textarea :value="(selectedElement as any).content" rows="3" class="input-warm w-full px-3 py-1.5 text-sm resize-none" @input="patch({ content: ($event.target as HTMLTextAreaElement).value } as any)" />
          </template>
          <template v-else-if="selectedElement.type === 'image'">
            <input :value="(selectedElement as any).src" class="input-warm w-full px-3 py-1.5 text-sm" @input="patch({ src: ($event.target as HTMLInputElement).value } as any)" />
          </template>
          <template v-else-if="selectedElement.type === 'table-view'">
            <input :value="(selectedElement as any).tableName ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" @input="patch({ tableName: ($event.target as HTMLInputElement).value } as any)" />
            <input :value="(selectedElement as any).columns?.join(', ') ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" @input="patch({ columns: ($event.target as HTMLInputElement).value.split(',').map(part => part.trim()).filter(Boolean) } as any)" />
          </template>
          <template v-else-if="selectedElement.type === 'input-field'">
            <input :value="(selectedElement as any).fieldName" class="input-warm w-full px-3 py-1.5 text-sm" @input="patch({ fieldName: ($event.target as HTMLInputElement).value } as any)" />
            <select :value="(selectedElement as any).inputType" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ inputType: ($event.target as HTMLSelectElement).value } as any)">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
          </template>
          <template v-else-if="selectedElement.type === 'chart'">
            <select :value="(selectedElement as any).chartType" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ chartType: ($event.target as HTMLSelectElement).value } as any)">
              <option value="bar">Bar Chart</option>
              <option value="pie">Pie Chart</option>
              <option value="line">Line Chart</option>
            </select>
            <input :value="(selectedElement as any).tableName ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Table name" @input="patch({ tableName: ($event.target as HTMLInputElement).value } as any)" />
            <input :value="(selectedElement as any).labelColumn ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Label column" @input="patch({ labelColumn: ($event.target as HTMLInputElement).value } as any)" />
            <input :value="(selectedElement as any).valueColumn ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Value column" @input="patch({ valueColumn: ($event.target as HTMLInputElement).value } as any)" />
          </template>
          <template v-else-if="selectedElement.type === 'upload'">
            <select :value="(selectedElement as any).bucket" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ bucket: ($event.target as HTMLSelectElement).value } as any)">
              <option value="assets">assets</option>
              <option value="products">products</option>
              <option value="backgrounds">backgrounds</option>
            </select>
            <input :value="(selectedElement as any).pathTemplate ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="products/item.png" @input="patch({ pathTemplate: ($event.target as HTMLInputElement).value } as any)" />
          </template>
        </section>

        <section class="px-4 py-3 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Events</p>
            <button class="inline-flex items-center gap-1 text-xs font-semibold" style="color: rgb(var(--shell-pink));" @click="addEvent">
              <Plus class="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div v-if="((selectedElement as any).events ?? []).length === 0" class="text-xs px-3 py-2 rounded-xl" style="background: rgba(61,24,32,0.04); color: rgba(61,24,32,0.45);">
            No events yet for this element.
          </div>

          <div
            v-for="(eventBinding, index) in ((selectedElement as any).events ?? [])"
            :key="eventBinding.id ?? index"
            class="rounded-2xl border p-3 space-y-2"
            style="border-color: rgba(61,24,32,0.08);"
          >
            <div class="flex items-center gap-2">
              <select :value="eventBinding.trigger" class="input-warm flex-1 px-2 py-1.5 text-xs" @change="updateEvent(index, { trigger: ($event.target as HTMLSelectElement).value as EventTrigger })">
                <option v-for="trigger in TRIGGERS_BY_ELEMENT_TYPE[selectedElement.type]" :key="trigger" :value="trigger">{{ trigger }}</option>
              </select>
              <button class="p-1.5 rounded-lg text-red-500 hover:bg-red-50" @click="removeEvent(index)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <select :value="eventBinding.action.type" class="input-warm w-full px-2 py-1.5 text-xs" @change="updateEvent(index, { action: { ...eventBinding.action, type: ($event.target as HTMLSelectElement).value as any } })">
              <option v-for="actionType in ACTION_TYPES" :key="actionType" :value="actionType">{{ actionType }}</option>
            </select>

            <input v-if="['insert','update','delete','query'].includes(eventBinding.action.type)" :value="eventBinding.action.table ?? ''" class="input-warm w-full px-2 py-1.5 text-xs font-mono" placeholder="table name" @input="updateEvent(index, { action: { ...eventBinding.action, table: ($event.target as HTMLInputElement).value } })" />
            <input v-if="eventBinding.action.type === 'emit'" :value="eventBinding.action.event ?? ''" class="input-warm w-full px-2 py-1.5 text-xs" placeholder="event name" @input="updateEvent(index, { action: { ...eventBinding.action, event: ($event.target as HTMLInputElement).value } })" />
            <input v-if="eventBinding.action.type === 'navigate'" :value="eventBinding.action.url ?? ''" class="input-warm w-full px-2 py-1.5 text-xs" placeholder="https://..." @input="updateEvent(index, { action: { ...eventBinding.action, url: ($event.target as HTMLInputElement).value } })" />
            <textarea v-if="['insert','update','emit'].includes(eventBinding.action.type)" :value="JSON.stringify(eventBinding.action.payload ?? {}, null, 2)" rows="4" class="input-warm w-full px-2 py-1.5 text-xs font-mono resize-none" @input="updateEvent(index, { action: { ...eventBinding.action, payload: parseJsonPayload(($event.target as HTMLTextAreaElement).value) } })" />
            <input v-if="eventBinding.action.type === 'upload'" :value="eventBinding.action.path ?? ''" class="input-warm w-full px-2 py-1.5 text-xs font-mono" placeholder="assets/logo.png" @input="updateEvent(index, { action: { ...eventBinding.action, path: ($event.target as HTMLInputElement).value } })" />
          </div>
        </section>
      </div>
    </template>
  </aside>
</template>
