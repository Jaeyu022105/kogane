<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  BarChart2,
  Copy,
  Database,
  Hexagon,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Plus,
  RectangleHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
} from 'lucide-vue-next';
import Canvas from '~/components/Canvas.vue';
import PropertiesPanel from '~/components/PropertiesPanel.vue';
import { DEFAULT_LAYOUT_THEME, type ElementDef, type ElementType, type UiLayout } from '~/lib/uiTypes';
import { BUILDER_PRESETS } from '~/lib/builderPresets';
import { inferPermissionPreset, normalizePermissions } from '~/lib/permissions';
import { STATION_OBJECTS, type StationObjectElementBlueprint } from '~/lib/stationObjects';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { business } = useBusiness();
const {
  layout,
  activeElements,
  activeLayer,
  activeLayerId,
  selectedElement,
  selectedId,
  isDirty,
  canUndo,
  canRedo,
  loadLayout,
  setActiveLayer,
  addModal,
  addElement,
  addElements,
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

interface BuilderPaletteItem {
  id: string;
  type: ElementType;
  label: string;
  description: string;
  icon: any;
  defaults?: Partial<ElementDef>;
  bundleElements?: StationObjectElementBlueprint[];
  defaultWidth: number;
  defaultHeight: number;
}

const showStudioPanel  = ref(false);
const showPresetsPanel = ref(false);
const canvasWrapper    = ref<HTMLElement | null>(null);
const terminals        = ref<Array<{ id: string; display_name: string; role: string; ui_layout: string; permissions: string | null }>>([]);
const selectedTerminal = ref<string | null>(null);
const saving           = ref(false);
const zoom             = ref(0.7);

/* pending drop — when set, clicking on canvas creates element at cursor position,
   and dragging draws a box to define the element's size */
const pendingDrop = ref<BuilderPaletteItem | null>(null);

const route = useRoute();

const layerLabel = computed(() => activeLayer.value?.name ?? 'Main Screen');
const resolutionLabel = computed(() => `${layout.value.resolution.width} x ${layout.value.resolution.height}`);
const selectedTerminalRecord = computed(() => terminals.value.find((item) => item.id === selectedTerminal.value) ?? null);
const selectedTerminalPermissions = computed(() => normalizePermissions(selectedTerminalRecord.value?.permissions ?? null));
const selectedStationPreset = computed(() => inferPermissionPreset(selectedTerminalRecord.value?.permissions ?? null));
const selectedStationKey = computed(() => selectedStationPreset.value?.key ?? null);
const currentTheme = computed(() => layout.value.theme ?? DEFAULT_LAYOUT_THEME);

const STATION_OBJECT_ICON_MAP = {
  layers: Layers,
  database: Database,
  chart: BarChart2,
  sparkles: Sparkles,
} as const;

const PALETTE_ITEMS: BuilderPaletteItem[] = [
  { id: 'button', type: 'button', label: 'Button', description: 'Generic action button.', icon: Hexagon, defaults: { text: 'Button', variant: 'primary', radius: 16 } as any, defaultWidth: 220, defaultHeight: 64 },
  { id: 'text', type: 'text', label: 'Text', description: 'Headings, labels, and helper text.', icon: Type, defaults: { content: 'Text', fontSize: 16, fontWeight: 'normal' } as any, defaultWidth: 260, defaultHeight: 80 },
  { id: 'image', type: 'image', label: 'Image', description: 'Images, branding, or signage.', icon: ImageIcon, defaults: { src: '', fit: 'cover' } as any, defaultWidth: 240, defaultHeight: 180 },
  { id: 'table-view', type: 'table-view', label: 'Table View', description: 'Flexible database table view.', icon: Database, defaults: { source: 'business-table', title: 'Data Table', tableName: '', columns: [], pageSize: 20, striped: true } as any, defaultWidth: 520, defaultHeight: 320 },
  { id: 'input-field', type: 'input-field', label: 'Input', description: 'Single form field.', icon: RectangleHorizontal, defaults: { fieldName: 'field', inputType: 'text', radius: 16 } as any, defaultWidth: 260, defaultHeight: 56 },
  { id: 'chart', type: 'chart', label: 'Chart', description: 'Business table or audit-log chart.', icon: BarChart2, defaults: { source: 'business-table', title: 'Data Chart', chartType: 'bar', aggregation: 'sum', tableName: '', labelColumn: '', valueColumn: '' } as any, defaultWidth: 460, defaultHeight: 300 },
  { id: 'upload', type: 'upload', label: 'Upload', description: 'File or asset uploader.', icon: Upload, defaults: { bucket: 'assets', buttonLabel: 'Upload file', radius: 18 } as any, defaultWidth: 260, defaultHeight: 88 },
];

const stationObjectItems = computed<BuilderPaletteItem[]>(() =>
  STATION_OBJECTS.map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    description: item.description,
    icon: STATION_OBJECT_ICON_MAP[item.icon],
    defaults: item.defaults,
    bundleElements: item.elements,
    defaultWidth: item.defaultSize.width,
    defaultHeight: item.defaultSize.height,
  })),
);

const recommendedStationObjects = computed(() => {
  if (!selectedStationKey.value) return stationObjectItems.value;

  return stationObjectItems.value.filter((item) =>
    STATION_OBJECTS.find((objectItem) => objectItem.id === item.id)?.recommendedFor.includes(selectedStationKey.value!),
  );
});

const optionalStationObjects = computed(() => {
  if (!selectedStationKey.value) return [];

  return stationObjectItems.value.filter((item) =>
    STATION_OBJECTS.find((objectItem) => objectItem.id === item.id)?.optionalFor?.includes(selectedStationKey.value!),
  );
});

const extraStationObjects = computed(() => {
  if (!selectedStationKey.value) return [];

  const claimed = new Set([
    ...recommendedStationObjects.value.map((item) => item.id),
    ...optionalStationObjects.value.map((item) => item.id),
  ]);

  return stationObjectItems.value.filter((item) => !claimed.has(item.id));
});

const recommendedPaletteItems = computed(() => {
  const recommended = new Set(selectedStationPreset.value?.recommendedElements ?? ['button', 'text', 'input-field', 'table-view']);
  return PALETTE_ITEMS.filter((item) => recommended.has(item.type));
});

const optionalPaletteItems = computed(() => {
  const recommended = new Set(recommendedPaletteItems.value.map((item) => item.type));
  const optional = new Set(selectedStationPreset.value?.optionalElements ?? []);
  return PALETTE_ITEMS.filter((item) => optional.has(item.type) && !recommended.has(item.type));
});

const extraPaletteItems = computed(() => {
  const claimed = new Set([
    ...recommendedPaletteItems.value.map((item) => item.type),
    ...optionalPaletteItems.value.map((item) => item.type),
  ]);
  return PALETTE_ITEMS.filter((item) => !claimed.has(item.type));
});

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
  const terminal = terminals.value.find((item) => item.id === id);
  if (!terminal) return;
  showStudioPanel.value = true;

  let parsed: UiLayout | null = null;
  try {
    parsed = typeof terminal.ui_layout === 'string'
      ? JSON.parse(terminal.ui_layout)
      : terminal.ui_layout;
  } catch {
    parsed = null;
  }

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

function handleKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (event.key === 'Escape') {
    showStudioPanel.value  = false;
    showPresetsPanel.value = false;
    pendingDrop.value      = null;
    return;
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId.value) {
    removeElement(selectedId.value);
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    if (event.key === 'c') copyElement();
    if (event.key === 'x') cutElement();
    if (event.key === 'v') pasteElement();
    if (event.key === 'd') {
      event.preventDefault();
      duplicateElement();
    }
    if (event.key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if (event.key === 'y') {
      event.preventDefault();
      redo();
    }
  }
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();

  const oldZoom = zoom.value;
  const nextZoom = Math.max(0.1, Math.min(3, oldZoom + (event.deltaY > 0 ? -0.05 : 0.05)));
  if (oldZoom === nextZoom || !canvasWrapper.value) {
    zoom.value = nextZoom;
    return;
  }

  const rect = canvasWrapper.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  const worldX = (mouseX - cameraX.value) / oldZoom;
  const worldY = (mouseY - cameraY.value) / oldZoom;

  zoom.value = nextZoom;
  setCamera(mouseX - worldX * nextZoom, mouseY - worldY * nextZoom);
}

function patchSelected(updates: Partial<any>) {
  if (!selectedId.value) return;
  updateElement(selectedId.value, updates);
}

function applyThemeToElementDefaults(type: ElementType, defaults: Partial<ElementDef> = {}) {
  const theme = currentTheme.value;

  switch (type) {
    case 'text':
      return {
        color: (defaults as any).color ?? theme.panelText,
        ...(defaults as any),
      };
    case 'button': {
      const buttonVariant = (defaults as any).variant ?? 'primary';
      return {
        backgroundColor: (defaults as any).backgroundColor ?? (buttonVariant === 'ghost' || buttonVariant === 'danger' ? undefined : theme.accentColor),
        textColor: (defaults as any).textColor ?? '#ffffff',
        ...(defaults as any),
      };
    }
    case 'table-view':
      return {
        backgroundColor: (defaults as any).backgroundColor ?? theme.panelBackground,
        headerBackgroundColor: (defaults as any).headerBackgroundColor ?? theme.panelHeaderBackground,
        textColor: (defaults as any).textColor ?? theme.panelText,
        ...(defaults as any),
      };
    case 'input-field':
      return {
        backgroundColor: (defaults as any).backgroundColor ?? theme.panelHeaderBackground,
        textColor: (defaults as any).textColor ?? theme.panelText,
        borderColor: (defaults as any).borderColor ?? theme.panelBorder,
        ...(defaults as any),
      };
    case 'chart':
      return {
        backgroundColor: (defaults as any).backgroundColor ?? theme.panelBackground,
        textColor: (defaults as any).textColor ?? theme.panelText,
        colorPalette: (defaults as any).colorPalette ?? [theme.accentColor, '#0ea5e9', '#10b981', '#f59e0b'],
        ...(defaults as any),
      };
    case 'upload':
      return {
        backgroundColor: (defaults as any).backgroundColor ?? theme.panelHeaderBackground,
        textColor: (defaults as any).textColor ?? theme.panelText,
        borderColor: (defaults as any).borderColor ?? theme.panelBorder,
        ...(defaults as any),
      };
    case 'cart-widget':
      return {
        backgroundColor: (defaults as any).backgroundColor ?? theme.panelBackground,
        panelColor: (defaults as any).panelColor ?? theme.panelHeaderBackground,
        textColor: (defaults as any).textColor ?? theme.panelText,
        accentColor: (defaults as any).accentColor ?? theme.accentColor,
        borderColor: (defaults as any).borderColor ?? theme.panelBorder,
        ...(defaults as any),
      };
    default:
      return defaults as any;
  }
}

function remapBundleReferences(value: unknown, idMap: Record<string, string>, parentKey?: string): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('$$input.')) {
      const key = value.replace('$$input.', '');
      return idMap[key] ? `$$input.${idMap[key]}` : value;
    }

    if (value.startsWith('$$upload.')) {
      const key = value.replace('$$upload.', '');
      return idMap[key] ? `$$upload.${idMap[key]}` : value;
    }

    if (parentKey === 'targetElementId' && idMap[value]) {
      return idMap[value];
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => remapBundleReferences(item, idMap, parentKey));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        remapBundleReferences(item, idMap, key),
      ]),
    );
  }

  return value;
}

function activatePaletteDrop(item: BuilderPaletteItem) {
  pendingDrop.value = item;
}

function createSingleElement(item: BuilderPaletteItem, x = 80, y = 80, w = item.defaultWidth, h = item.defaultHeight) {
  return {
    id: crypto.randomUUID(),
    type: item.type,
    label: item.label,
    position: {
      x,
      y,
      width: w,
      height: h,
      zIndex: activeElements.value.length + 1,
    },
    ...applyThemeToElementDefaults(item.type, item.defaults),
  } as ElementDef;
}

function createBundleElements(item: BuilderPaletteItem, x = 80, y = 80, w = item.defaultWidth, h = item.defaultHeight) {
  const scaleX = w / item.defaultWidth;
  const scaleY = h / item.defaultHeight;
  const idMap = Object.fromEntries(
    (item.bundleElements ?? []).map((blueprint) => [blueprint.key, crypto.randomUUID()]),
  );

  return (item.bundleElements ?? []).map((blueprint, index) => {
    const themedDefaults = applyThemeToElementDefaults(blueprint.type, blueprint.defaults);
    const resolvedDefaults = remapBundleReferences(themedDefaults, idMap) as Record<string, unknown>;

    return {
      id: idMap[blueprint.key],
      type: blueprint.type,
      label: blueprint.label,
      position: {
        x: Math.round((x + blueprint.position.x * scaleX) / 8) * 8,
        y: Math.round((y + blueprint.position.y * scaleY) / 8) * 8,
        width: Math.max(40, Math.round((blueprint.position.width * scaleX) / 8) * 8),
        height: Math.max(24, Math.round((blueprint.position.height * scaleY) / 8) * 8),
        zIndex: activeElements.value.length + index + 1,
      },
      ...resolvedDefaults,
    } as ElementDef;
  });
}

function dropElement(item: BuilderPaletteItem, x = 80, y = 80, w = item.defaultWidth, h = item.defaultHeight) {
  if (item.bundleElements?.length) {
    addElements(createBundleElements(item, x, y, w, h));
    return;
  }

  addElement(createSingleElement(item, x, y, w, h));
}

function applyBuilderPreset(presetId: string) {
  const preset = BUILDER_PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  if (!confirm('Apply this preset? It will replace the current layout.')) return;
  loadLayout(preset.layout);
  showPresetsPanel.value = false;
}

const dropBox = ref<{ startX: number, startY: number, curX: number, curY: number } | null>(null);

function onCanvasMousedown(e: MouseEvent) {
  if (!pendingDrop.value || !canvasWrapper.value) return;

  // Intercept the click/mousedown so Canvas.vue doesn't pan or select
  e.stopPropagation();
  e.preventDefault();

  const rect = canvasWrapper.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Transform to world coordinates based on camera and zoom
  const worldX = (mouseX - cameraX.value) / zoom.value;
  const worldY = (mouseY - cameraY.value) / zoom.value;

  dropBox.value = {
    startX: worldX,
    startY: worldY,
    curX: worldX,
    curY: worldY,
  };

  window.addEventListener('mousemove', onCanvasMousemove);
  window.addEventListener('mouseup', onCanvasMouseup, { once: true });
}

function onCanvasMousemove(e: MouseEvent) {
  if (!dropBox.value || !canvasWrapper.value) return;

  const rect = canvasWrapper.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  dropBox.value.curX = (mouseX - cameraX.value) / zoom.value;
  dropBox.value.curY = (mouseY - cameraY.value) / zoom.value;
}

function onCanvasMouseup() {
  window.removeEventListener('mousemove', onCanvasMousemove);
  
  if (!dropBox.value || !pendingDrop.value) {
    dropBox.value = null;
    return;
  }

  const snap = (v: number) => Math.round(v / 8) * 8;
  
  const minW = 40;
  const minH = 24;

  const x = Math.min(dropBox.value.startX, dropBox.value.curX);
  const y = Math.min(dropBox.value.startY, dropBox.value.curY);
  
  let w = Math.abs(dropBox.value.curX - dropBox.value.startX);
  let h = Math.abs(dropBox.value.curY - dropBox.value.startY);

  // If it was just a click or very small drag, use default sizes
  if (w < 10 && h < 10) {
    w = pendingDrop.value.defaultWidth;
    h = pendingDrop.value.defaultHeight;
  } else {
    // Enforce minimums if they actually dragged a box
    w = Math.max(minW, snap(w));
    h = Math.max(minH, snap(h));
  }

  dropElement(
    pendingDrop.value,
    snap(x),
    snap(y),
    w,
    h
  );

  pendingDrop.value = null;
  dropBox.value = null;
}

function createModalLayer() {
  addModal(`Modal ${(layout.value.modals?.length ?? 0) + 1}`, 'custom');
}

onMounted(() => {
  loadTerminals();
  window.addEventListener('keydown', handleKeydown);
  canvasWrapper.value?.addEventListener('wheel', handleWheel, { passive: false });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  canvasWrapper.value?.removeEventListener('wheel', handleWheel);
});

watch(() => business.value?.id, loadTerminals);
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-[#f6efe8]">
    <header class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 py-3 shrink-0 bg-[#fdf7f2]" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex items-center gap-4 min-w-0">
        <div class="flex items-center gap-2 text-lg font-semibold" style="color: rgb(var(--shell-sidebar));">
          <div class="w-6 h-6 rounded bg-[rgb(var(--shell-sidebar))] text-[#fdf7f2] flex items-center justify-center text-xs font-bold shadow-sm">U</div>
          Builder
        </div>

        <div class="h-6 w-px" style="background: rgba(61,24,32,0.1);" />

        <select
          :value="selectedTerminal ?? ''"
          class="appearance-none bg-white/60 border px-3 py-1.5 rounded-xl text-sm font-medium transition-all focus:outline-none hover:bg-white"
          style="border-color: rgba(61,24,32,0.15); color: rgb(var(--shell-sidebar));"
          @change="selectTerminal(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Select terminal...</option>
          <option v-for="terminal in terminals" :key="terminal.id" :value="terminal.id">
            {{ terminal.display_name }} ({{ terminal.role }})
          </option>
        </select>

        <select
          v-if="selectedTerminal"
          :value="activeLayerId"
          class="appearance-none bg-white/60 border px-3 py-1.5 rounded-xl text-sm font-medium transition-all focus:outline-none hover:bg-white"
          style="border-color: rgba(61,24,32,0.15); color: rgb(var(--shell-sidebar));"
          @change="setActiveLayer(($event.target as HTMLSelectElement).value)"
        >
          <option value="main">Main Screen</option>
          <option v-for="modal in layout.modals ?? []" :key="modal.id" :value="modal.id">
            {{ modal.name }}
          </option>
        </select>

        <div
          v-if="selectedTerminalRecord"
          class="hidden lg:flex items-center gap-3 rounded-2xl border px-3 py-2 min-w-0"
          style="border-color: rgba(61,24,32,0.1); background: rgba(61,24,32,0.03);"
        >
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-[0.24em]" style="color: rgba(61,24,32,0.35);">
              {{ selectedStationPreset?.label ?? 'Custom Station' }}
            </p>
            <p class="text-xs truncate" style="color: rgba(61,24,32,0.62);">
              {{ selectedStationPreset?.description ?? 'Mixed-authority terminal with custom permissions.' }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span
              v-if="selectedTerminalPermissions.reports.visible"
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
              style="background: rgba(14,165,233,0.1); color: #0ea5e9;"
            >
              Reports
            </span>
            <span
              v-if="selectedTerminalPermissions.audit_log.visible"
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
              style="background: rgba(232,116,138,0.1); color: #e8748a;"
            >
              Audit
            </span>
          </div>
        </div>
      </div>

      <div class="hidden md:flex items-center justify-self-center rounded-xl border bg-white/70 px-1.5 py-1 shadow-sm" style="border-color: rgba(61,24,32,0.12);">
        <button class="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-black/5" style="color: rgba(61,24,32,0.6);" @click="zoom = Math.max(0.3, zoom - 0.1)">-</button>
        <span class="w-14 text-center text-xs font-medium" style="color: rgba(61,24,32,0.78);">{{ Math.round(zoom * 100) }}%</span>
        <button class="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-black/5" style="color: rgba(61,24,32,0.6);" @click="zoom = Math.min(1.5, zoom + 0.1)">+</button>
      </div>

      <div class="flex items-center justify-self-end gap-2 min-w-0">
        <button :disabled="!canUndo" class="text-xs font-medium px-3 py-2 rounded-xl transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5" style="color: rgba(61,24,32,0.7);" @click="undo">
          <Undo2 class="w-4 h-4" /> Undo
        </button>
        <button :disabled="!canRedo" class="text-xs font-medium px-3 py-2 rounded-xl transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5" style="color: rgba(61,24,32,0.7);" @click="redo">
          Redo <Undo2 class="w-4 h-4 scale-x-[-1]" />
        </button>
        <button
          v-if="selectedTerminal"
          class="text-xs font-semibold px-4 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
          style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
          @click="createModalLayer"
        >
          <Plus class="w-3.5 h-3.5" /> New Modal
        </button>
        <button
          class="text-xs font-semibold px-4 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
          style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
          @click="showPresetsPanel = !showPresetsPanel"
        >
          <Sparkles class="w-3.5 h-3.5" /> Presets
        </button>
        <button
          class="text-xs font-semibold px-4 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
          style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
          @click="showStudioPanel = !showStudioPanel"
        >
          <Layers class="w-3.5 h-3.5" /> {{ showStudioPanel ? 'Hide Studio' : 'Studio' }}
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
      <aside class="w-16 shrink-0 bg-white flex flex-col items-center py-4 gap-1 z-10 shadow-sm" style="border-right: 1px solid rgba(61,24,32,0.1);">
        <!-- Pointer / select tool -->
        <button
          class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
          :style="!pendingDrop ? 'background: rgba(232,116,138,0.1);' : 'hover:background: rgba(245,237,228,0.5);'"
          @click="pendingDrop = null"
        >
          <MousePointer2 class="w-5 h-5" :style="!pendingDrop ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.5);'" />
          <div class="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity">
            Select
          </div>
        </button>

        <div class="w-8 border-t my-1" style="border-color: rgba(61,24,32,0.08);" />
        <span class="text-[9px] font-bold uppercase tracking-[0.18em] mt-1 mb-1" style="color: rgba(61,24,32,0.28);">Core</span>

        <button
          v-for="item in recommendedPaletteItems"
          :key="`recommended-${item.type}`"
          class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
          :style="pendingDrop?.id === item.id
            ? 'background: rgba(232,116,138,0.15);'
            : 'background: rgba(61,24,32,0.04);'"
          @click="activatePaletteDrop(item)"
        >
          <component
            :is="item.icon"
            class="w-5 h-5 transition-transform group-hover:scale-110"
            :style="pendingDrop?.id === item.id ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.78);'"
          />
          <div class="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity">
            {{ item.label }} · Recommended
          </div>
        </button>

        <div class="w-8 border-t my-1.5" style="border-color: rgba(61,24,32,0.08);" />
        <span class="text-[9px] font-bold uppercase tracking-[0.18em] mt-1 mb-1" style="color: rgba(61,24,32,0.28);">Objects</span>

        <button
          v-for="item in recommendedStationObjects"
          :key="`object-${item.id}`"
          class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
          :style="pendingDrop?.id === item.id
            ? 'background: rgba(232,116,138,0.15);'
            : 'background: rgba(61,24,32,0.04);'"
          @click="activatePaletteDrop(item)"
        >
          <component
            :is="item.icon"
            class="w-5 h-5 transition-transform group-hover:scale-110"
            :style="pendingDrop?.id === item.id ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.78);'"
          />
          <div class="absolute left-full ml-3 w-52 px-2 py-2 bg-black/85 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-normal z-50 shadow-xl transition-opacity">
            <div class="font-semibold">{{ item.label }}</div>
            <div class="mt-1 text-white/70 leading-relaxed">{{ item.description }}</div>
          </div>
        </button>

        <template v-if="optionalStationObjects.length > 0">
          <div class="w-8 border-t my-1.5" style="border-color: rgba(61,24,32,0.08);" />
          <span class="text-[9px] font-bold uppercase tracking-[0.18em] mt-1 mb-1" style="color: rgba(61,24,32,0.28);">Optional</span>
          <button
            v-for="item in optionalStationObjects"
            :key="`optional-object-${item.id}`"
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
            :style="pendingDrop?.id === item.id
              ? 'background: rgba(232,116,138,0.15);'
              : 'hover:background: rgba(245,237,228,0.5);'"
            @click="activatePaletteDrop(item)"
          >
            <component
              :is="item.icon"
              class="w-5 h-5 transition-transform group-hover:scale-110"
              :style="pendingDrop?.id === item.id ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.7);'"
            />
            <div class="absolute left-full ml-3 w-52 px-2 py-2 bg-black/85 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-normal z-50 shadow-xl transition-opacity">
              <div class="font-semibold">{{ item.label }} · Optional</div>
              <div class="mt-1 text-white/70 leading-relaxed">{{ item.description }}</div>
            </div>
          </button>
        </template>

        <template v-if="extraStationObjects.length > 0">
          <div class="w-8 border-t my-1.5" style="border-color: rgba(61,24,32,0.08);" />
          <span class="text-[9px] font-bold uppercase tracking-[0.18em] mt-1 mb-1" style="color: rgba(61,24,32,0.28);">Shared</span>
          <button
            v-for="item in extraStationObjects"
            :key="`extra-object-${item.id}`"
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
            :style="pendingDrop?.id === item.id
              ? 'background: rgba(232,116,138,0.15);'
              : 'hover:background: rgba(245,237,228,0.5);'"
            @click="activatePaletteDrop(item)"
          >
            <component
              :is="item.icon"
              class="w-5 h-5 transition-transform group-hover:scale-110"
              :style="pendingDrop?.id === item.id ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.58);'"
            />
            <div class="absolute left-full ml-3 w-52 px-2 py-2 bg-black/85 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-normal z-50 shadow-xl transition-opacity">
              <div class="font-semibold">{{ item.label }}</div>
              <div class="mt-1 text-white/70 leading-relaxed">{{ item.description }}</div>
            </div>
          </button>
        </template>

        <template v-if="optionalPaletteItems.length > 0">
          <div class="w-8 border-t my-1.5" style="border-color: rgba(61,24,32,0.08);" />
          <span class="text-[9px] font-bold uppercase tracking-[0.18em] mt-1 mb-1" style="color: rgba(61,24,32,0.28);">Extra</span>
          <button
            v-for="item in optionalPaletteItems"
            :key="`optional-${item.type}`"
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
            :style="pendingDrop?.id === item.id
              ? 'background: rgba(232,116,138,0.15);'
              : 'hover:background: rgba(245,237,228,0.5);'"
            @click="activatePaletteDrop(item)"
          >
            <component
              :is="item.icon"
              class="w-5 h-5 transition-transform group-hover:scale-110"
              :style="pendingDrop?.id === item.id ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.7);'"
            />
            <div class="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity">
              {{ item.label }} · Optional
            </div>
          </button>
        </template>

        <template v-if="extraPaletteItems.length > 0">
          <div class="w-8 border-t my-1.5" style="border-color: rgba(61,24,32,0.08);" />
          <span class="text-[9px] font-bold uppercase tracking-[0.18em] mt-1 mb-1" style="color: rgba(61,24,32,0.28);">More</span>
          <button
            v-for="item in extraPaletteItems"
            :key="`extra-${item.type}`"
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
            :style="pendingDrop?.id === item.id
              ? 'background: rgba(232,116,138,0.15);'
              : 'hover:background: rgba(245,237,228,0.5);'"
            @click="activatePaletteDrop(item)"
          >
            <component
              :is="item.icon"
              class="w-5 h-5 transition-transform group-hover:scale-110"
              :style="pendingDrop?.id === item.id ? 'color: rgb(232,116,138);' : 'color: rgba(61,24,32,0.58);'"
            />
            <div class="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity">
              {{ item.label }}
            </div>
          </button>
        </template>
      </aside>

      <div
        ref="canvasWrapper"
        class="canvas-container flex-1 overflow-hidden relative"
        :style="pendingDrop ? 'cursor: crosshair;' : ''"
        @mousedown.capture="onCanvasMousedown"
      >
        <!-- drop mode hint -->
        <Transition name="v">
          <div
            v-if="pendingDrop"
            class="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div
              class="px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-lg"
              style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
            >
              <MousePointer2 class="w-3.5 h-3.5" />
              Click canvas to place · Esc to cancel
            </div>
          </div>
        </Transition>
        
        <!-- drop mode dragging marquee -->
        <div
          v-if="dropBox"
          class="absolute inset-0 pointer-events-none z-50 overflow-hidden"
        >
          <div
            class="absolute"
            :style="{
              transform: `translate(${cameraX}px, ${cameraY}px) scale(${zoom})`,
              transformOrigin: '0 0'
            }"
          >
            <div
              class="absolute border-2"
              :style="{
                left: `${Math.min(dropBox.startX, dropBox.curX)}px`,
                top: `${Math.min(dropBox.startY, dropBox.curY)}px`,
                width: `${Math.abs(dropBox.curX - dropBox.startX)}px`,
                height: `${Math.abs(dropBox.curY - dropBox.startY)}px`,
                borderColor: '#3d1820',
                backgroundColor: 'rgba(61,24,32,0.1)'
              }"
            />
          </div>
        </div>

        <div class="absolute inset-0 bg-[radial-gradient(#d5cdc4_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none"></div>

        <div v-if="selectedElement" class="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center px-4">
          <div class="pointer-events-auto flex max-w-[min(100%,980px)] flex-wrap items-center gap-3 rounded-[28px] border bg-[#f7efe7] px-4 py-3 shadow-sm" style="border-color: rgba(61,24,32,0.1);">
            <div class="rounded-2xl bg-[#f7f1eb] px-3 py-2 text-xs font-medium" style="color: rgba(61,24,32,0.72);">{{ resolutionLabel }}</div>
            <div class="rounded-2xl bg-[#f7f1eb] px-3 py-2 text-xs font-medium" style="color: rgba(61,24,32,0.72);">{{ layerLabel }}</div>

            <template v-if="selectedElement.type === 'button'">
              <select :value="(selectedElement as any).variant" class="input-warm px-3 py-2 text-xs min-w-28" @change="patchSelected({ variant: ($event.target as HTMLSelectElement).value })">
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="ghost">Ghost</option>
                <option value="danger">Danger</option>
              </select>
            </template>

            <template v-if="selectedElement.type === 'text'">
              <input type="number" :value="(selectedElement as any).fontSize" class="input-warm w-20 px-3 py-2 text-xs" @input="patchSelected({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
            </template>

            <template v-if="selectedElement.type === 'image'">
              <select :value="(selectedElement as any).fit" class="input-warm px-3 py-2 text-xs min-w-24" @change="patchSelected({ fit: ($event.target as HTMLSelectElement).value })">
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </template>

            <template v-if="selectedElement.type === 'table-view'">
              <input :value="(selectedElement as any).tableName" class="input-warm w-40 px-3 py-2 text-xs font-mono" placeholder="Table name" @input="patchSelected({ tableName: ($event.target as HTMLInputElement).value })" />
            </template>

            <button class="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f7f1eb]" style="color: rgba(61,24,32,0.72);" @click="duplicateElement()">
              <Copy class="w-3.5 h-3.5" /> Duplicate
            </button>
            <button class="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium transition-colors hover:bg-red-50" style="color: #b42318;" @click="removeElement(selectedElement.id)">
              <Trash2 class="w-3.5 h-3.5" /> Delete
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

        <Canvas
          v-else
          :business-id="business?.id ?? ''"
          :zoom="zoom"
          :terminal-name="selectedTerminalRecord?.display_name ?? ''"
          :terminal-preset-label="selectedStationPreset?.label ?? 'Custom Station'"
          class="z-10 absolute inset-0"
        />

        <div v-if="showStudioPanel" class="pointer-events-none absolute inset-y-0 right-0 z-40 flex justify-end">
          <div class="pointer-events-auto relative h-full w-[24rem] max-w-[calc(100%-1.5rem)] p-3">
            <div class="h-full rounded-[30px] border bg-white shadow-xl overflow-hidden" style="border-color: rgba(61,24,32,0.1);">
              <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.28em]" style="color: rgba(61,24,32,0.35);">Studio</p>
                  <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ layerLabel }}</p>
                </div>
                <button class="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-black/5" style="color: rgba(61,24,32,0.7);" @click="showStudioPanel = false">
                  Close
                </button>
              </div>
              <PropertiesPanel class="!w-full !border-l-0" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Builder Presets slide-over ───────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="showPresetsPanel"
        class="fixed inset-0 z-50 flex items-stretch justify-end"
        @click.self="showPresetsPanel = false"
      >
        <div
          class="w-[400px] h-full bg-white flex flex-col shadow-2xl overflow-y-auto"
          style="border-left: 1px solid rgba(61,24,32,0.1);"
        >
          <div class="px-6 py-5 flex items-center justify-between shrink-0" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
            <div>
              <h2 class="font-semibold text-base" style="color: rgb(var(--shell-sidebar));">Layout Presets</h2>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">Apply a ready-made layout to get started fast</p>
            </div>
            <button class="text-lg transition-colors" style="color: rgba(61,24,32,0.3);" @click="showPresetsPanel = false">
              <Sparkles class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 space-y-3">
            <div
              v-for="preset in BUILDER_PRESETS"
              :key="preset.id"
              class="rounded-2xl p-4 space-y-2 transition-all"
              style="background: #fdf7f2; border: 1px solid rgba(61,24,32,0.08);"
            >
              <p class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">{{ preset.name }}</p>
              <p class="text-xs" style="color: rgba(61,24,32,0.45);">{{ preset.description }}</p>
              <button
                class="w-full py-2 text-xs rounded-full font-semibold transition-all"
                style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
                @click="applyBuilderPreset(preset.id)"
              >
                Apply Preset
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
