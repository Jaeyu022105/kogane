<script setup lang="ts">
import { Layers, PenTool, Plus, Trash2 } from 'lucide-vue-next';
import type {
  ElementDef,
  ElementEventBinding,
  EventTrigger,
  QuerySource,
  RuntimeActionDefinition,
} from '~/lib/uiTypes';
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
  updateTheme,
  updateAllElements,
} = useCanvas();

const activeTab = ref<'design' | 'layers'>('design');

const ACTION_TYPES: RuntimeActionDefinition['type'][] = ['insert', 'update', 'delete', 'query', 'emit', 'navigate', 'upload'];
const QUERY_SOURCE_OPTIONS: QuerySource[] = ['business-table', 'audit-log'];
const supportedTriggers = computed(() =>
  selectedElement.value
    ? TRIGGERS_BY_ELEMENT_TYPE[selectedElement.value.type] ?? []
    : [],
);

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

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseCsv(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function stringifyCsv(value?: string[]) {
  return value?.join(', ') ?? '';
}

function parseFilterText(value: string): Record<string, string> | undefined {
  const entries = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return null;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      if (!key || !rawValue) return null;
      return [key, rawValue] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function stringifyFilterText(filters?: Record<string, string>) {
  return Object.entries(filters ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function addEvent() {
  if (!selectedElement.value || supportedTriggers.value.length === 0) return;
  updateEvents([
    ...((selectedElement.value as any).events ?? []),
    {
      id: crypto.randomUUID(),
      trigger: supportedTriggers.value[0] ?? 'click',
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

function updateEventAction(index: number, patchValue: Partial<RuntimeActionDefinition>) {
  if (!selectedElement.value) return;
  const nextEvents = [...((selectedElement.value as any).events ?? [])];
  nextEvents[index] = {
    ...nextEvents[index],
    action: {
      ...nextEvents[index].action,
      ...patchValue,
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

function setQuerySource(source: QuerySource) {
  if (!selectedElement.value) return;

  if (selectedElement.value.type === 'table-view') {
    patch({
      source,
      tableName: source === 'audit-log' ? undefined : (selectedElement.value as any).tableName,
    } as any);
  }

  if (selectedElement.value.type === 'chart') {
    patch({
      source,
      tableName: source === 'audit-log' ? undefined : (selectedElement.value as any).tableName,
      aggregation: source === 'audit-log'
        ? ((selectedElement.value as any).aggregation ?? 'count')
        : ((selectedElement.value as any).aggregation ?? 'sum'),
    } as any);
  }
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHexColor(value: string) {
  if (!HEX_COLOR_RE.test(value)) return '#000000';
  if (value.length === 7) return value;

  const [r, g, b] = value.slice(1).split('');
  return `#${r}${r}${g}${g}${b}${b}`;
}

function colorPickerValue(value: string | undefined, fallback = '#000000') {
  return value && HEX_COLOR_RE.test(value)
    ? normalizeHexColor(value)
    : fallback;
}

function applyThemeToCurrentWidgets() {
  const theme = layout.value.theme;

  updateAllElements((element) => {
    switch (element.type) {
      case 'button':
        return {
          ...element,
          backgroundColor: element.variant === 'ghost'
            ? undefined
            : element.variant === 'secondary'
              ? theme.panelHeaderBackground
              : element.variant === 'danger'
                ? '#dc2626'
                : theme.accentColor,
          textColor: element.variant === 'secondary' || element.variant === 'ghost'
            ? theme.panelText
            : '#ffffff',
        };
      case 'text':
        return {
          ...element,
          color: theme.panelText,
        };
      case 'table-view':
        return {
          ...element,
          backgroundColor: theme.panelBackground,
          headerBackgroundColor: theme.panelHeaderBackground,
          textColor: theme.panelText,
        };
      case 'input-field':
        return {
          ...element,
          backgroundColor: theme.panelHeaderBackground,
          textColor: theme.panelText,
          borderColor: theme.panelBorder,
        };
      case 'chart':
        return {
          ...element,
          backgroundColor: theme.panelBackground,
          textColor: theme.panelText,
          colorPalette: [theme.accentColor, '#0ea5e9', '#10b981', '#f59e0b'],
        };
      case 'cart-widget':
        return {
          ...element,
          backgroundColor: theme.panelBackground,
          panelColor: theme.panelHeaderBackground,
          textColor: theme.panelText,
          accentColor: theme.accentColor,
          borderColor: theme.panelBorder,
        };
      case 'upload':
        return {
          ...element,
          backgroundColor: theme.panelHeaderBackground,
          textColor: theme.panelText,
          borderColor: theme.panelBorder,
        };
      default:
        return element;
    }
  });
}
</script>

<template>
  <aside class="w-72 h-full flex flex-col overflow-y-auto bg-white" style="border-left: 1px solid rgba(61,24,32,0.1);">
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
      <section class="px-4 py-3 space-y-3" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Terminal Theme</p>
            <p class="text-[11px] mt-1 leading-relaxed" style="color: rgba(61,24,32,0.45);">
              Frame changes the terminal background. Canvas changes the screen area inside it.
            </p>
          </div>
          <button
            class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
            style="background: rgba(61,24,32,0.06); color: rgb(var(--shell-sidebar)); border: 1px solid rgba(61,24,32,0.12);"
            @click="applyThemeToCurrentWidgets"
          >
            Sync Widgets
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Terminal BG</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.frameBackground, '#130d11')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ frameBackground: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.frameBackground" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ frameBackground: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Screen BG</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.canvasBackground, '#111118')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ canvasBackground: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.canvasBackground" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ canvasBackground: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Accent</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.accentColor, '#e8748a')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ accentColor: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.accentColor" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ accentColor: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Panel BG</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.panelBackground, '#161116')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ panelBackground: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.panelBackground" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ panelBackground: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Header Text</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.topBarText, '#f5ede4')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ topBarText: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.topBarText" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ topBarText: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Panel Text</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.panelText, '#f5ede4')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ panelText: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.panelText" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ panelText: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Header BG</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.topBarBackground, '#1a1318')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ topBarBackground: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.topBarBackground" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ topBarBackground: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Grid</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.gridColor, '#8f8f98')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ gridColor: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.gridColor" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ gridColor: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Panel Header</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.panelHeaderBackground, '#21181f')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ panelHeaderBackground: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.panelHeaderBackground" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ panelHeaderBackground: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Muted Text</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.panelMutedText, '#b9aaa0')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ panelMutedText: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.panelMutedText" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ panelMutedText: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-gray-400 mb-0.5 block">Panel Border</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue(layout.theme.panelBorder, '#58474e')"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="updateTheme({ panelBorder: ($event.target as HTMLInputElement).value })"
              />
              <input :value="layout.theme.panelBorder" class="input-warm flex-1 px-2 py-1 text-sm" @input="updateTheme({ panelBorder: ($event.target as HTMLInputElement).value })" />
            </div>
          </div>
        </div>
        <p class="text-[11px] leading-relaxed" style="color: rgba(61,24,32,0.45);">
          These colors update the terminal shell, preview board, and the default colors used by newly inserted widgets. Use `Sync Widgets` to push the theme into existing preset objects too.
        </p>
      </section>

      <div v-if="!selectedElement" class="flex-1 flex flex-col p-4">
        <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center mb-8">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style="background: rgba(61,24,32,0.06);">P</div>
          <p class="text-sm" style="color: rgba(61,24,32,0.4);">Select a widget to edit how the terminal should look and behave.</p>
        </div>
        <div class="border-t pt-4 space-y-3" style="border-color: rgba(61,24,32,0.08);">
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Terminal Canvas</p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-gray-400 mb-0.5 block">Width</label>
              <input
                type="number"
                :value="layout.resolution.width"
                class="input-warm w-full px-2 py-1 text-sm"
                @input="updateResolution(Number(($event.target as HTMLInputElement).value), layout.resolution.height)"
              />
            </div>
            <div>
              <label class="text-[10px] text-gray-400 mb-0.5 block">Height</label>
              <input
                type="number"
                :value="layout.resolution.height"
                class="input-warm w-full px-2 py-1 text-sm"
                @input="updateResolution(layout.resolution.width, Number(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>
          <p class="text-[11px] leading-relaxed" style="color: rgba(61,24,32,0.45);">
            This preview now mirrors the terminal shell more closely, so spacing and contrast choices here are more trustworthy.
          </p>
        </div>
      </div>

      <div v-else class="pb-8">
        <div class="px-4 py-3 flex items-center justify-between" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">{{ selectedElement.type }}</p>
            <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ selectedElement.label || '(unnamed)' }}</p>
          </div>
          <button
            class="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
            style="color: #dc2626; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.18);"
            @click="removeElement(selectedElement.id)"
          >
            Delete
          </button>
        </div>

        <section class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <label class="block text-xs font-semibold" style="color: rgba(61,24,32,0.4);">Label</label>
          <input
            :value="selectedElement.label ?? ''"
            class="input-warm w-full px-3 py-1.5 text-sm"
            placeholder="Cashier totals"
            @input="patch({ label: ($event.target as HTMLInputElement).value })"
          />
        </section>

        <section class="px-4 py-3 space-y-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Position &amp; Size</p>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">X</label><input type="number" :value="selectedElement.position.x" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ x: Number(($event.target as HTMLInputElement).value) })" /></div>
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Y</label><input type="number" :value="selectedElement.position.y" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ y: Number(($event.target as HTMLInputElement).value) })" /></div>
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Width</label><input type="number" :value="selectedElement.position.width" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ width: Number(($event.target as HTMLInputElement).value) })" /></div>
            <div><label class="text-xs block mb-1" style="color: rgba(61,24,32,0.4);">Height</label><input type="number" :value="selectedElement.position.height" class="input-warm w-full px-2 py-1 text-sm" @input="patchPosition({ height: Number(($event.target as HTMLInputElement).value) })" /></div>
          </div>
          <div class="flex gap-2 pt-1">
            <button class="flex-1 text-xs py-1.5 rounded-full font-medium transition-colors" style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.55);" @click="sendBackward(selectedElement.id)">Back</button>
            <button class="flex-1 text-xs py-1.5 rounded-full font-medium transition-colors" style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.55);" @click="bringForward(selectedElement.id)">Forward</button>
          </div>
        </section>

        <section class="px-4 py-3 space-y-3" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Content &amp; Data</p>

          <template v-if="selectedElement.type === 'button'">
            <input :value="(selectedElement as any).text" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Button text" @input="patch({ text: ($event.target as HTMLInputElement).value } as any)" />
            <select :value="(selectedElement as any).variant" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ variant: ($event.target as HTMLSelectElement).value } as any)">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="ghost">Ghost</option>
              <option value="danger">Danger</option>
            </select>
          </template>

          <template v-else-if="selectedElement.type === 'text'">
            <textarea :value="(selectedElement as any).content" rows="4" class="input-warm w-full px-3 py-1.5 text-sm resize-none" @input="patch({ content: ($event.target as HTMLTextAreaElement).value } as any)" />
            <div class="grid grid-cols-2 gap-2">
              <input type="number" :value="(selectedElement as any).fontSize" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Font size" @input="patch({ fontSize: Number(($event.target as HTMLInputElement).value) } as any)" />
              <select :value="(selectedElement as any).fontWeight" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ fontWeight: ($event.target as HTMLSelectElement).value } as any)">
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </div>
            <select :value="(selectedElement as any).align" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ align: ($event.target as HTMLSelectElement).value } as any)">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </template>

          <template v-else-if="selectedElement.type === 'image'">
            <input :value="(selectedElement as any).src" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="https://..." @input="patch({ src: ($event.target as HTMLInputElement).value } as any)" />
            <select :value="(selectedElement as any).fit" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ fit: ($event.target as HTMLSelectElement).value } as any)">
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
            </select>
            <input type="number" :value="(selectedElement as any).radius ?? 0" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Radius" @input="patch({ radius: Number(($event.target as HTMLInputElement).value) } as any)" />
          </template>

          <template v-else-if="selectedElement.type === 'table-view'">
            <input :value="(selectedElement as any).title ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Section title" @input="patch({ title: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="(selectedElement as any).subtitle ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Short helper text" @input="patch({ subtitle: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <select :value="(selectedElement as any).source ?? 'business-table'" class="input-warm w-full px-3 py-1.5 text-sm" @change="setQuerySource(($event.target as HTMLSelectElement).value as QuerySource)">
              <option v-for="source in QUERY_SOURCE_OPTIONS" :key="source" :value="source">{{ source }}</option>
            </select>
            <input
              v-if="(selectedElement as any).source !== 'audit-log'"
              :value="(selectedElement as any).tableName ?? ''"
              class="input-warm w-full px-3 py-1.5 text-sm font-mono"
              placeholder="Table name"
              @input="patch({ tableName: ($event.target as HTMLInputElement).value || undefined } as any)"
            />
            <input :value="(selectedElement as any).columns?.join(', ') ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="name, status, amount" @input="patch({ columns: parseCsv(($event.target as HTMLInputElement).value) } as any)" />
            <div class="grid grid-cols-2 gap-2">
              <input type="number" :value="(selectedElement as any).pageSize ?? 20" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Rows" @input="patch({ pageSize: Number(($event.target as HTMLInputElement).value) } as any)" />
              <input :value="(selectedElement as any).emptyLabel ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Empty message" @input="patch({ emptyLabel: ($event.target as HTMLInputElement).value || undefined } as any)" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input
                type="number"
                :value="(selectedElement as any).autoRefreshMs ?? 0"
                class="input-warm w-full px-3 py-1.5 text-sm"
                placeholder="Auto refresh ms"
                @input="patch({ autoRefreshMs: Number(($event.target as HTMLInputElement).value) || undefined } as any)"
              />
              <input
                :value="(selectedElement as any).orderBy ?? ''"
                class="input-warm w-full px-3 py-1.5 text-sm font-mono"
                placeholder="Order by column"
                @input="patch({ orderBy: ($event.target as HTMLInputElement).value || undefined } as any)"
              />
            </div>
            <label class="flex items-center gap-2 text-xs" style="color: rgba(61,24,32,0.55);">
              <input
                type="checkbox"
                :checked="(selectedElement as any).descending !== false"
                @change="patch({ descending: ($event.target as HTMLInputElement).checked } as any)"
              />
              Sort newest / highest first
            </label>
            <textarea
              :value="stringifyFilterText((selectedElement as any).filters)"
              rows="3"
              class="input-warm w-full px-3 py-1.5 text-xs font-mono resize-none"
              placeholder="action_type=insert&#10;actor_type=inpoint"
              @input="patch({ filters: parseFilterText(($event.target as HTMLTextAreaElement).value) } as any)"
            />
            <label class="flex items-center gap-2 text-xs" style="color: rgba(61,24,32,0.55);">
              <input type="checkbox" :checked="Boolean((selectedElement as any).striped)" @change="patch({ striped: ($event.target as HTMLInputElement).checked } as any)" />
              Alternate row stripes
            </label>
          </template>

          <template v-else-if="selectedElement.type === 'input-field'">
            <input :value="(selectedElement as any).fieldName" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Field name" @input="patch({ fieldName: ($event.target as HTMLInputElement).value } as any)" />
            <input :value="(selectedElement as any).placeholder ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Placeholder" @input="patch({ placeholder: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <select :value="(selectedElement as any).inputType" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ inputType: ($event.target as HTMLSelectElement).value } as any)">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
            <input :value="(selectedElement as any).defaultValue ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Default value" @input="patch({ defaultValue: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input
              v-if="(selectedElement as any).inputType === 'select'"
              :value="stringifyCsv((selectedElement as any).options)"
              class="input-warm w-full px-3 py-1.5 text-sm"
              placeholder="cash, card, gcash"
              @input="patch({ options: parseCsv(($event.target as HTMLInputElement).value) } as any)"
            />
          </template>

          <template v-else-if="selectedElement.type === 'chart'">
            <input :value="(selectedElement as any).title ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Chart title" @input="patch({ title: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="(selectedElement as any).subtitle ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Context or note" @input="patch({ subtitle: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <select :value="(selectedElement as any).source ?? 'business-table'" class="input-warm w-full px-3 py-1.5 text-sm" @change="setQuerySource(($event.target as HTMLSelectElement).value as QuerySource)">
              <option v-for="source in QUERY_SOURCE_OPTIONS" :key="source" :value="source">{{ source }}</option>
            </select>
            <input
              v-if="(selectedElement as any).source !== 'audit-log'"
              :value="(selectedElement as any).tableName ?? ''"
              class="input-warm w-full px-3 py-1.5 text-sm font-mono"
              placeholder="Table name"
              @input="patch({ tableName: ($event.target as HTMLInputElement).value || undefined } as any)"
            />
            <select :value="(selectedElement as any).chartType" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ chartType: ($event.target as HTMLSelectElement).value } as any)">
              <option value="bar">Bar</option>
              <option value="pie">Pie</option>
              <option value="line">Line</option>
            </select>
            <select :value="(selectedElement as any).aggregation ?? 'sum'" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ aggregation: ($event.target as HTMLSelectElement).value } as any)">
              <option value="sum">Sum numeric values</option>
              <option value="count">Count rows by group</option>
            </select>
            <input :value="(selectedElement as any).labelColumn ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Group / label column" @input="patch({ labelColumn: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input
              v-if="(selectedElement as any).aggregation !== 'count'"
              :value="(selectedElement as any).valueColumn ?? ''"
              class="input-warm w-full px-3 py-1.5 text-sm font-mono"
              placeholder="Numeric value column"
              @input="patch({ valueColumn: ($event.target as HTMLInputElement).value || undefined } as any)"
            />
            <input :value="stringifyCsv((selectedElement as any).colorPalette)" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="#e8748a, #0ea5e9, #10b981" @input="patch({ colorPalette: parseCsv(($event.target as HTMLInputElement).value) } as any)" />
            <textarea
              :value="stringifyFilterText((selectedElement as any).filters)"
              rows="3"
              class="input-warm w-full px-3 py-1.5 text-xs font-mono resize-none"
              placeholder="target_table=orders&#10;actor_type=inpoint"
              @input="patch({ filters: parseFilterText(($event.target as HTMLTextAreaElement).value) } as any)"
            />
            <input :value="(selectedElement as any).emptyLabel ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Empty state" @input="patch({ emptyLabel: ($event.target as HTMLInputElement).value || undefined } as any)" />
          </template>

          <template v-else-if="selectedElement.type === 'cart-widget'">
            <input :value="(selectedElement as any).title ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Widget title" @input="patch({ title: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="(selectedElement as any).subtitle ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Station helper text" @input="patch({ subtitle: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="(selectedElement as any).productTable ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Products table" @input="patch({ productTable: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="(selectedElement as any).orderTable ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Orders table" @input="patch({ orderTable: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="stringifyCsv((selectedElement as any).displayColumns)" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="name, category" @input="patch({ displayColumns: parseCsv(($event.target as HTMLInputElement).value) } as any)" />
            <input :value="(selectedElement as any).priceColumn ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="Price column" @input="patch({ priceColumn: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <div class="grid grid-cols-2 gap-2">
              <input :value="(selectedElement as any).submitLabel ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Submit label" @input="patch({ submitLabel: ($event.target as HTMLInputElement).value || undefined } as any)" />
              <input :value="(selectedElement as any).emptyLabel ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Empty products label" @input="patch({ emptyLabel: ($event.target as HTMLInputElement).value || undefined } as any)" />
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'upload'">
            <input :value="(selectedElement as any).buttonLabel ?? ''" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Upload label" @input="patch({ buttonLabel: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <select :value="(selectedElement as any).bucket" class="input-warm w-full px-3 py-1.5 text-sm" @change="patch({ bucket: ($event.target as HTMLSelectElement).value } as any)">
              <option value="assets">assets</option>
              <option value="products">products</option>
              <option value="backgrounds">backgrounds</option>
            </select>
            <input :value="(selectedElement as any).pathTemplate ?? ''" class="input-warm w-full px-3 py-1.5 text-sm font-mono" placeholder="receipts/{{date}}.png" @input="patch({ pathTemplate: ($event.target as HTMLInputElement).value || undefined } as any)" />
            <input :value="stringifyCsv((selectedElement as any).accept)" class="input-warm w-full px-3 py-1.5 text-sm" placeholder=".png, .jpg, image/*" @input="patch({ accept: parseCsv(($event.target as HTMLInputElement).value) } as any)" />
          </template>
        </section>

        <section class="px-4 py-3 space-y-3" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Appearance</p>

          <template v-if="selectedElement.type === 'button'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Button BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).backgroundColor, layout.theme.accentColor)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).backgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="#3d1820" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Text</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).textColor, '#ffffff')"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).textColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="#ffffff" @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
            <input type="number" :value="(selectedElement as any).radius ?? 12" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Corner radius" @input="patch({ radius: Number(($event.target as HTMLInputElement).value) } as any)" />
          </template>

          <template v-else-if="selectedElement.type === 'text'">
            <label class="text-[10px] text-gray-400 mb-0.5 block">Text Color</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue((selectedElement as any).color, layout.theme.panelText)"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="patch({ color: ($event.target as HTMLInputElement).value || undefined } as any)"
              />
              <input :value="(selectedElement as any).color ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="#f5ede4" @input="patch({ color: ($event.target as HTMLInputElement).value || undefined } as any)" />
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'table-view'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Panel BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).backgroundColor, layout.theme.panelBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).backgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Panel background" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Header BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).headerBackgroundColor, layout.theme.panelHeaderBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ headerBackgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).headerBackgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Header background" @input="patch({ headerBackgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
            <label class="text-[10px] text-gray-400 mb-0.5 block">Text Color</label>
            <div class="flex gap-2">
              <input
                type="color"
                :value="colorPickerValue((selectedElement as any).textColor, layout.theme.panelText)"
                class="h-9 w-11 rounded-lg border bg-white px-1"
                style="border-color: rgba(61,24,32,0.12);"
                @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)"
              />
              <input :value="(selectedElement as any).textColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Text color" @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'input-field'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Field BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).backgroundColor, layout.theme.panelHeaderBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).backgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Field background" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Text</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).textColor, layout.theme.panelText)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).textColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Text color" @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Border</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).borderColor, layout.theme.panelBorder)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ borderColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).borderColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Border color" @input="patch({ borderColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <input type="number" :value="(selectedElement as any).radius ?? 12" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Radius" @input="patch({ radius: Number(($event.target as HTMLInputElement).value) } as any)" />
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'chart'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Panel BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).backgroundColor, layout.theme.panelBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).backgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Panel background" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Text</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).textColor, layout.theme.panelText)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).textColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Text color" @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'cart-widget'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Widget BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).backgroundColor, layout.theme.panelBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).backgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Widget background" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Inner Panel</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).panelColor, layout.theme.panelHeaderBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ panelColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).panelColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Inner panel background" @input="patch({ panelColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Text</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).textColor, layout.theme.panelText)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).textColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Text color" @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Accent</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).accentColor, layout.theme.accentColor)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ accentColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).accentColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Accent color" @input="patch({ accentColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Border</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).borderColor, layout.theme.panelBorder)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ borderColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).borderColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Border color" @input="patch({ borderColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <input type="number" :value="(selectedElement as any).radius ?? 24" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Radius" @input="patch({ radius: Number(($event.target as HTMLInputElement).value) } as any)" />
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'upload'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Panel BG</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).backgroundColor, layout.theme.panelHeaderBackground)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).backgroundColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Panel background" @input="patch({ backgroundColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Text</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).textColor, layout.theme.panelText)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).textColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Text color" @input="patch({ textColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 mb-0.5 block">Border</label>
                <div class="flex gap-2">
                  <input
                    type="color"
                    :value="colorPickerValue((selectedElement as any).borderColor, layout.theme.panelBorder)"
                    class="h-9 w-11 rounded-lg border bg-white px-1"
                    style="border-color: rgba(61,24,32,0.12);"
                    @input="patch({ borderColor: ($event.target as HTMLInputElement).value || undefined } as any)"
                  />
                  <input :value="(selectedElement as any).borderColor ?? ''" class="input-warm flex-1 px-3 py-1.5 text-sm" placeholder="Border color" @input="patch({ borderColor: ($event.target as HTMLInputElement).value || undefined } as any)" />
                </div>
              </div>
              <input type="number" :value="(selectedElement as any).radius ?? 18" class="input-warm w-full px-3 py-1.5 text-sm" placeholder="Radius" @input="patch({ radius: Number(($event.target as HTMLInputElement).value) } as any)" />
            </div>
          </template>
        </section>

        <section class="px-4 py-3 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">Events</p>
            <button v-if="supportedTriggers.length > 0" class="inline-flex items-center gap-1 text-xs font-semibold" style="color: rgb(var(--shell-pink));" @click="addEvent">
              <Plus class="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div v-if="supportedTriggers.length === 0" class="text-xs px-3 py-2 rounded-xl" style="background: rgba(61,24,32,0.04); color: rgba(61,24,32,0.45);">
            This widget handles its own behavior and does not expose custom events yet.
          </div>

          <div v-else-if="((selectedElement as any).events ?? []).length === 0" class="text-xs px-3 py-2 rounded-xl" style="background: rgba(61,24,32,0.04); color: rgba(61,24,32,0.45);">
            No events yet for this widget.
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

            <select
              v-if="eventBinding.action.type === 'query'"
              :value="eventBinding.action.source ?? 'business-table'"
              class="input-warm w-full px-2 py-1.5 text-xs"
              @change="updateEventAction(index, { source: ($event.target as HTMLSelectElement).value as QuerySource, table: ($event.target as HTMLSelectElement).value === 'audit-log' ? undefined : eventBinding.action.table })"
            >
              <option v-for="source in QUERY_SOURCE_OPTIONS" :key="source" :value="source">{{ source }}</option>
            </select>

            <input
              v-if="['insert','update','delete'].includes(eventBinding.action.type) || (eventBinding.action.type === 'query' && eventBinding.action.source !== 'audit-log')"
              :value="eventBinding.action.table ?? ''"
              class="input-warm w-full px-2 py-1.5 text-xs font-mono"
              placeholder="table name"
              @input="updateEventAction(index, { table: ($event.target as HTMLInputElement).value || undefined })"
            />

            <textarea
              v-if="eventBinding.action.type === 'query'"
              :value="stringifyJson(eventBinding.action.columns ?? [])"
              rows="3"
              class="input-warm w-full px-2 py-1.5 text-xs font-mono resize-none"
              placeholder='["created_at","action_type"]'
              @input="updateEventAction(index, { columns: parseJsonPayload(($event.target as HTMLTextAreaElement).value) as string[] })"
            />

            <textarea
              v-if="eventBinding.action.type === 'query'"
              :value="stringifyJson(eventBinding.action.where ?? {})"
              rows="3"
              class="input-warm w-full px-2 py-1.5 text-xs font-mono resize-none"
              placeholder='{"action_type":"insert"}'
              @input="updateEventAction(index, { where: parseJsonPayload(($event.target as HTMLTextAreaElement).value) as Record<string, string> })"
            />

            <input v-if="eventBinding.action.type === 'emit'" :value="eventBinding.action.event ?? ''" class="input-warm w-full px-2 py-1.5 text-xs" placeholder="event name" @input="updateEventAction(index, { event: ($event.target as HTMLInputElement).value || undefined })" />
            <input v-if="eventBinding.action.type === 'navigate'" :value="eventBinding.action.url ?? ''" class="input-warm w-full px-2 py-1.5 text-xs" placeholder="https://..." @input="updateEventAction(index, { url: ($event.target as HTMLInputElement).value || undefined })" />
            <textarea v-if="['insert','update','emit'].includes(eventBinding.action.type)" :value="stringifyJson(eventBinding.action.payload ?? {})" rows="4" class="input-warm w-full px-2 py-1.5 text-xs font-mono resize-none" @input="updateEventAction(index, { payload: parseJsonPayload(($event.target as HTMLTextAreaElement).value) })" />
            <input v-if="eventBinding.action.type === 'upload'" :value="eventBinding.action.path ?? ''" class="input-warm w-full px-2 py-1.5 text-xs font-mono" placeholder="assets/logo.png" @input="updateEventAction(index, { path: ($event.target as HTMLInputElement).value || undefined })" />
          </div>
        </section>
      </div>
    </template>
  </aside>
</template>
