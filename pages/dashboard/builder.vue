<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
  BarChart2,
  Check,
  Copy,
  Database,
  Eye,
  Hexagon,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Plus,
  QrCode,
  RectangleHorizontal,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-vue-next';
import Canvas from '~/components/Canvas.vue';
import ElementRenderer from '~/components/ElementRenderer.vue';
import PropertiesPanel from '~/components/PropertiesPanel.vue';
import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import { cloneLayout, DEFAULT_LAYOUT_THEME, normalizeLayout, type ElementDef, type ElementType, type UiLayout } from '~/lib/uiTypes';
import { ALL_BUILDER_PRESETS } from '~/lib/builderPresets';
import { inferPermissionPreset, normalizePermissions } from '~/lib/permissions';
import { STATION_OBJECTS, type StationObjectElementBlueprint } from '~/lib/stationObjects';
import { applyBrandingToLayout } from '~/lib/workspaceBranding';

definePageMeta({ layout: 'dashboard' });

const router = useRouter();
const { isEnterprise } = useEnterpriseAccess();
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
  moveElement,
  updateLayoutMetadata,
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
  markSaved,
} = useCanvas();

const previewRuntime = useCanvasRuntime();
provide(CANVAS_RUNTIME_KEY, previewRuntime);

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.0;

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 100) / 100));
}

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

const showStudioPanel    = ref(false);
const showPresetsPanel   = ref(false);
const showSavePresetModal = ref(false);
const interactivePreview = ref(false);
const savingPreset       = ref(false);
const syncingPreset      = ref(false);
const builderNotice      = ref<{ kind: 'success' | 'error'; text: string } | null>(null);
const presetForm           = ref({ name: '', description: '' });
const remotePresets        = ref<any[]>([]);
const remoteLatestVersions = ref<Record<string, number>>({});
const canvasWrapper        = ref<HTMLElement | null>(null);
const terminals          = ref<Array<{ id: string; display_name: string; role: string; ui_layout: string; permissions: string | null }>>([]);
const selectedTerminal   = ref<string | null>(null);
const saving             = ref(false);
const zoom               = ref(0.7);

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
  { id: 'table-view', type: 'table-view', label: 'List View', description: 'Flexible list of business information.', icon: Database, defaults: { source: 'business-table', title: 'List', tableName: '', columns: [], pageSize: 20, striped: true } as any, defaultWidth: 520, defaultHeight: 320 },
  { id: 'input-field', type: 'input-field', label: 'Input', description: 'Single form field.', icon: RectangleHorizontal, defaults: { fieldName: 'field', inputType: 'text', radius: 16 } as any, defaultWidth: 260, defaultHeight: 56 },
  { id: 'chart', type: 'chart', label: 'Chart', description: 'A simple chart for business activity.', icon: BarChart2, defaults: { source: 'business-table', title: 'Activity', chartType: 'bar', aggregation: 'sum', tableName: '', labelColumn: '', valueColumn: '' } as any, defaultWidth: 460, defaultHeight: 300 },
  { id: 'upload', type: 'upload', label: 'Upload', description: 'File or asset uploader.', icon: Upload, defaults: { bucket: 'assets', buttonLabel: 'Upload file', radius: 18 } as any, defaultWidth: 260, defaultHeight: 88 },
  { id: 'cart-widget', type: 'cart-widget', label: 'Cart Widget', description: 'Product picker, cart, and order checkout.', icon: ShoppingCart, defaults: { title: 'Cart Register', productTable: 'products', displayColumns: ['name', 'category'], priceColumn: 'price', orderTable: 'orders', submitLabel: 'Submit Order', paymentMethods: ['cash', 'card'], defaultPaymentMethod: 'cash', radius: 24 } as any, defaultWidth: 520, defaultHeight: 420 },
  { id: 'scan-field', type: 'scan-field', label: 'Scan Field', description: 'Hardware barcode or QR scanner input.', icon: QrCode, defaults: { fieldName: 'barcode', placeholder: 'Scan barcode or QR code…', burstThresholdMs: 40, radius: 12 } as any, defaultWidth: 320, defaultHeight: 52 },
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

interface NormalizedPresetItem {
  id: string;
  name: string;
  description: string;
  version: number;
  source: 'builtin' | 'custom';
  layout: UiLayout;
}

const allPresets = computed<NormalizedPresetItem[]>(() => {
  const builtins: NormalizedPresetItem[] = ALL_BUILDER_PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    version: Number((preset as any).version ?? (preset.layout as any)?.presetVersion ?? 1),
    source: 'builtin',
    layout: preset.layout,
  }));

  const custom: NormalizedPresetItem[] = remotePresets.value
    .map((item) => {
      let rawLayout: any = item.ui_layout ?? item.uiLayout;
      if (typeof rawLayout === 'string') {
        try {
          rawLayout = JSON.parse(rawLayout);
        } catch {
          rawLayout = null;
        }
      }
      if (!rawLayout || typeof rawLayout !== 'object' || !Array.isArray(rawLayout.elements)) {
        return null;
      }
      return {
        id: String(item.id),
        name: String(item.name ?? 'Custom Preset'),
        description: String(item.description ?? ''),
        version: Number(item.version ?? rawLayout.presetVersion ?? 1),
        source: (item.is_custom === false ? 'builtin' : 'custom') as 'builtin' | 'custom',
        layout: normalizeLayout(rawLayout),
      };
    })
    .filter((entry): entry is NormalizedPresetItem => Boolean(entry));

  const seen = new Set<string>();
  const combined: NormalizedPresetItem[] = [];
  for (const item of [...custom, ...builtins]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    combined.push(item);
  }
  return combined;
});

const matchedPresetForLayout = computed(() => {
  const pid = layout.value.presetId;
  if (!pid) return null;
  return allPresets.value.find((item) => item.id === pid) ?? null;
});

const presetUpdateVersion = computed<number | null>(() => {
  const pid = layout.value.presetId;
  if (!pid) return null;
  const currentVersion = Number(layout.value.presetVersion ?? 1);
  const latestVersion = Math.max(
    Number(matchedPresetForLayout.value?.version ?? 0),
    Number(remoteLatestVersions.value[pid] ?? 0),
  );
  return latestVersion > currentVersion ? latestVersion : null;
});

async function loadPresets() {
  try {
    const res = await $fetch<{ presets?: any[]; latestVersions?: Record<string, number> }>('/api/presets', {
      headers: authHeaders(),
      query: business.value?.id ? { businessId: business.value.id } : undefined,
    });
    remotePresets.value = Array.isArray(res?.presets) ? res.presets : [];
    remoteLatestVersions.value = (res?.latestVersions && typeof res.latestVersions === 'object')
      ? res.latestVersions
      : {};
  } catch {
    // Ignore preset fetch failure
  }
}

watch(() => business.value?.id, (bizId) => {
  if (bizId) loadPresets();
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

async function selectTerminal(id: string) {
  if (interactivePreview.value) {
    exitInteractivePreview();
  }
  if (selectedTerminal.value && isDirty.value) {
    await saveLayout();
  }

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
    const idx = terminals.value.findIndex((item) => item.id === selectedTerminal.value);
    if (idx !== -1) {
      terminals.value[idx] = {
        ...terminals.value[idx],
        ui_layout: JSON.stringify(layout.value),
      };
    }
    markSaved();
  } finally {
    saving.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable
  ) {
    return;
  }

  if (interactivePreview.value) {
    if (event.key === 'Escape') {
      if (previewRuntime.state.value.activeModalId) {
        previewRuntime.emitLocal('modal:close');
      } else {
        exitInteractivePreview();
      }
    }
    return;
  }

  if (event.key === 'Escape') {
    showSavePresetModal.value = false;
    showStudioPanel.value  = false;
    showPresetsPanel.value = false;
    pendingDrop.value      = null;
    return;
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId.value) {
    event.preventDefault();
    removeElement(selectedId.value);
    return;
  }

  if (
    selectedElement.value
    && !event.ctrlKey
    && !event.metaKey
    && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
  ) {
    event.preventDefault();
    const step = event.shiftKey ? 16 : 4;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    moveElement(
      selectedElement.value.id,
      {
        x: selectedElement.value.position.x + dx,
        y: selectedElement.value.position.y + dy,
      },
      { recordHistory: !event.repeat },
    );
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === 'c') copyElement();
    if (key === 'x') cutElement();
    if (key === 'v') pasteElement();
    if (key === 'd') {
      event.preventDefault();
      duplicateElement();
    }
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if (key === 'y') {
      event.preventDefault();
      redo();
    }
  }
}

function handleWheel(event: WheelEvent) {
  if (interactivePreview.value) return;
  event.preventDefault();

  const oldZoom = zoom.value;
  const nextZoom = clampZoom(oldZoom + (event.deltaY > 0 ? -0.05 : 0.05));
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

function flashNotice(kind: 'success' | 'error', text: string) {
  builderNotice.value = { kind, text };
  setTimeout(() => {
    if (builderNotice.value?.text === text) {
      builderNotice.value = null;
    }
  }, 4500);
}

async function applyBuilderPreset(presetId: string) {
  const preset = allPresets.value.find((p) => p.id === presetId);
  if (!preset) return;
  if (!confirm('Apply this preset? It will replace the current layout.')) return;

  const branded = applyBrandingToLayout(preset.layout, business.value?.colorPalette);
  branded.presetId = preset.id;
  branded.presetVersion = preset.version;
  loadLayout(branded);
  updateLayoutMetadata({ presetId: preset.id, presetVersion: preset.version }, { markDirty: true });

  if (business.value?.id && selectedTerminal.value) {
    try {
      const applyRes = await $fetch<{
        success?: boolean;
        permissions?: unknown;
        terminal?: any;
      }>('/api/presets/apply', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: {
          businessId: business.value.id,
          terminalId: selectedTerminal.value,
          presetId: preset.id,
          applySchema: true,
          applyLayout: false,
          applyPermissions: true,
        },
      });
      const updatedPerms = applyRes?.terminal?.permissions ?? applyRes?.permissions;
      if (updatedPerms && selectedTerminal.value) {
        const idx = terminals.value.findIndex((t) => t.id === selectedTerminal.value);
        if (idx !== -1) {
          terminals.value[idx] = {
            ...terminals.value[idx],
            permissions: typeof updatedPerms === 'string'
              ? updatedPerms
              : JSON.stringify(updatedPerms),
          };
        }
      }
    } catch {
      // Keep local branded preset layout cleanly even if server apply helper skips
    }
  }

  showPresetsPanel.value = false;
  flashNotice('success', `Applied "${preset.name}". Click Publish Changes to push to staff terminals.`);
}

function openSavePresetModal() {
  if (!selectedTerminal.value) return;
  presetForm.value = {
    name: `${selectedTerminalRecord.value?.display_name || 'Terminal'} Preset`,
    description: '',
  };
  showSavePresetModal.value = true;
}

async function submitSaveAsPreset() {
  if (!selectedTerminal.value || !presetForm.value.name.trim()) return;
  savingPreset.value = true;
  try {
    const res = await $fetch<{ preset?: any; error?: string | null }>('/api/presets/create', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessId: business.value?.id,
        name: presetForm.value.name.trim(),
        description: presetForm.value.description.trim(),
        terminalId: selectedTerminal.value,
        uiLayout: layout.value,
        permissions: selectedTerminalPermissions.value,
        linkTerminal: true,
      },
    });
    if (res?.error || !res?.preset) {
      flashNotice('error', res?.error || 'Could not save preset.');
      return;
    }
    updateLayoutMetadata({
      presetId: String(res.preset.id),
      presetVersion: Number(res.preset.version ?? 1),
    }, { markDirty: true });
    await loadPresets();
    showSavePresetModal.value = false;
    flashNotice('success', `Saved preset "${res.preset.name}".`);
  } catch (err: any) {
    flashNotice('error', err?.data?.error || err?.message || 'Could not save preset.');
  } finally {
    savingPreset.value = false;
  }
}

async function syncPresetUpdate() {
  if (!selectedTerminal.value || !layout.value.presetId) return;
  syncingPreset.value = true;
  try {
    const res = await $fetch<{
      success?: boolean;
      uiLayout?: UiLayout;
      layout?: UiLayout;
      terminal?: any;
      error?: string | null;
    }>('/api/presets/sync', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessId: business.value?.id,
        terminalId: selectedTerminal.value,
        presetId: layout.value.presetId,
      },
    });

    if (res?.error) {
      flashNotice('error', res.error);
      return;
    }

    const nextRaw = res?.uiLayout ?? res?.layout ?? res?.terminal?.ui_layout;
    const parsedNext = typeof nextRaw === 'string' ? JSON.parse(nextRaw) : nextRaw;
    if (parsedNext) {
      const normalized = normalizeLayout(parsedNext);
      loadLayout(normalized);
      const idx = terminals.value.findIndex((t) => t.id === selectedTerminal.value);
      if (idx !== -1) {
        terminals.value[idx] = {
          ...terminals.value[idx],
          ui_layout: JSON.stringify(normalized),
          ...(res?.terminal?.permissions ? { permissions: res.terminal.permissions } : {}),
        };
      }
      markSaved();
      flashNotice('success', 'Preset update synced to terminal layout.');
    }
  } catch (err: any) {
    flashNotice('error', err?.data?.error || err?.message || 'Preset sync is unavailable yet.');
  } finally {
    syncingPreset.value = false;
  }
}

const previewActiveModal = computed(() =>
  layout.value.modals?.find((m) => m.id === previewRuntime.state.value.activeModalId) ?? null,
);

const previewScale = computed(() => {
  if (!canvasWrapper.value) return 0.7;
  const rect = canvasWrapper.value.getBoundingClientRect();
  const resW = layout.value.resolution.width || 1280;
  const resH = layout.value.resolution.height || 720;
  return Math.max(0.25, Math.min(1, (rect.width - 48) / resW, (rect.height - 64) / resH));
});

function enterInteractivePreview() {
  if (!selectedTerminal.value) return;
  showStudioPanel.value = false;
  showPresetsPanel.value = false;
  pendingDrop.value = null;
  previewRuntime.configure({
    terminalId: selectedTerminal.value,
    businessId: business.value?.id ?? '',
    layout: normalizeLayout(cloneLayout(layout.value)),
    permissions: selectedTerminalPermissions.value,
    sessionVars: {
      businessName: business.value?.name,
      terminalName: selectedTerminalRecord.value?.display_name ?? 'Preview',
      terminalRole: selectedTerminalRecord.value?.role ?? '',
      country: business.value?.country ?? 'US',
      currency: business.value?.currency ?? 'USD',
      currencySymbol: business.value?.currencySymbol ?? '$',
    },
  });
  interactivePreview.value = true;
}

function exitInteractivePreview() {
  interactivePreview.value = false;
  previewRuntime.reset();
}

function resetInteractivePreview() {
  if (!interactivePreview.value) return;
  previewRuntime.reset();
  enterInteractivePreview();
}

const dropBox = ref<{ startX: number, startY: number, curX: number, curY: number } | null>(null);

const BOARD_OFFSET_X = 17;
const BOARD_OFFSET_Y = 65;

function onCanvasMousedown(e: MouseEvent) {
  if (!pendingDrop.value || !canvasWrapper.value) return;

  // Intercept the click/mousedown so Canvas.vue doesn't pan or select
  e.stopPropagation();
  e.preventDefault();

  const rect = canvasWrapper.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Transform to world coordinates based on camera and zoom, adjusting for board offset
  const worldX = (mouseX - cameraX.value) / zoom.value - BOARD_OFFSET_X;
  const worldY = (mouseY - cameraY.value) / zoom.value - BOARD_OFFSET_Y;

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

  dropBox.value.curX = (mouseX - cameraX.value) / zoom.value - BOARD_OFFSET_X;
  dropBox.value.curY = (mouseY - cameraY.value) / zoom.value - BOARD_OFFSET_Y;
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

watch(() => business.value?.id, loadTerminals);

// Auto-save logic
let autoSaveTimeout: any = null;

watch(layout, () => {
  if (!isDirty.value || !selectedTerminal.value) return;

  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    if (isDirty.value && selectedTerminal.value && !saving.value) {
      saveLayout();
    }
  }, 3000);
}, { deep: true });

onBeforeRouteLeave((to, from, next) => {
  if (isDirty.value) {
    const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?');
    if (confirmLeave) {
      next();
    } else {
      next(false);
    }
  } else {
    next();
  }
});

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(() => {
  loadTerminals();
  loadPresets();
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', handleBeforeUnload);
  canvasWrapper.value?.addEventListener('wheel', handleWheel, { passive: false });
});

onUnmounted(() => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  previewRuntime.reset();
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  canvasWrapper.value?.removeEventListener('wheel', handleWheel);
});
</script>

<template>
  <div class="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#f6efe8]">
    <header class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 py-3 shrink-0 bg-[#fdf7f2]" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex items-center gap-4 min-w-0">
        <div class="flex items-center gap-2 text-lg font-semibold" style="color: rgb(var(--shell-sidebar));">
          <div class="w-6 h-6 rounded bg-[rgb(var(--shell-sidebar))] text-[#fdf7f2] flex items-center justify-center text-xs font-bold shadow-sm">U</div>
          Builder
        </div>

        <div class="h-6 w-px" style="background: rgba(61,24,32,0.1);" />

        <select
          :value="selectedTerminal ?? ''"
          aria-label="Select terminal"
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
          aria-label="Select workspace screen"
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
        <button class="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-black/5" style="color: rgba(61,24,32,0.6);" @click="zoom = clampZoom(zoom - 0.1)">-</button>
        <span class="w-14 text-center text-xs font-medium" style="color: rgba(61,24,32,0.78);">{{ Math.round(zoom * 100) }}%</span>
        <button class="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-black/5" style="color: rgba(61,24,32,0.6);" @click="zoom = clampZoom(zoom + 0.1)">+</button>
      </div>

      <div class="flex items-center justify-self-end gap-2 min-w-0 flex-wrap">
        <template v-if="!interactivePreview">
          <button :disabled="!canUndo" class="text-xs font-medium px-3 py-2 rounded-xl transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5" style="color: rgba(61,24,32,0.7);" @click="undo">
            <Undo2 class="w-4 h-4" /> Undo
          </button>
          <button :disabled="!canRedo" class="text-xs font-medium px-3 py-2 rounded-xl transition-all disabled:opacity-30 hover:bg-black/5 flex items-center gap-1.5" style="color: rgba(61,24,32,0.7);" @click="redo">
            Redo <Undo2 class="w-4 h-4 scale-x-[-1]" />
          </button>
          <button
            v-if="selectedTerminal"
            class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
            style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
            @click="createModalLayer"
          >
            <Plus class="w-3.5 h-3.5" /> New Modal
          </button>
          <button
            v-if="selectedTerminal && presetUpdateVersion"
            :disabled="syncingPreset"
            class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 inline-flex items-center gap-1.5 disabled:opacity-50"
            title="A newer version of this preset is available"
            @click="syncPresetUpdate"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': syncingPreset }" />
            Sync Update v{{ presetUpdateVersion }}
          </button>
          <button
            class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
            style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
            @click="showPresetsPanel = !showPresetsPanel; if (showPresetsPanel) loadPresets();"
          >
            <Sparkles class="w-3.5 h-3.5" /> Presets
          </button>
          <button
            v-if="selectedTerminal"
            class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
            style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
            @click="openSavePresetModal"
          >
            <Plus class="w-3.5 h-3.5" /> Save Preset
          </button>
          <button
            v-if="selectedTerminal"
            class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
            style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
            @click="enterInteractivePreview"
          >
            <Eye class="w-3.5 h-3.5" /> Preview
          </button>
          <button
            class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border bg-white/70 hover:bg-white inline-flex items-center gap-1.5"
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
        </template>
        <template v-else>
          <button
            class="text-xs font-semibold px-3.5 py-2 rounded-xl transition-all border bg-white/80 hover:bg-white inline-flex items-center gap-1.5"
            style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
            @click="resetInteractivePreview"
          >
            <RefreshCw class="w-3.5 h-3.5" /> Reset State
          </button>
          <button
            class="text-xs font-semibold px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5"
            style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
            @click="exitInteractivePreview"
          >
            <X class="w-3.5 h-3.5" /> Exit Preview
          </button>
        </template>
      </div>
    </header>

    <div class="relative flex-1 min-h-0 flex overflow-hidden bg-[#e5dfd8]">
      <aside class="w-16 shrink-0 min-h-0 bg-white flex flex-col items-center py-4 gap-1 z-10 shadow-sm" style="border-right: 1px solid rgba(61,24,32,0.1);">
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
                left: `${Math.min(dropBox.startX, dropBox.curX) + BOARD_OFFSET_X}px`,
                top: `${Math.min(dropBox.startY, dropBox.curY) + BOARD_OFFSET_Y}px`,
                width: `${Math.abs(dropBox.curX - dropBox.startX)}px`,
                height: `${Math.abs(dropBox.curY - dropBox.startY)}px`,
                borderColor: '#3d1820',
                backgroundColor: 'rgba(61,24,32,0.1)'
              }"
            />
          </div>
        </div>

        <div class="absolute inset-0 bg-[radial-gradient(#d5cdc4_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none"></div>

        <div v-if="builderNotice" class="pointer-events-auto absolute top-4 right-4 z-50 flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-medium shadow-lg" :class="builderNotice.kind === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'">
          <Check v-if="builderNotice.kind === 'success'" class="w-3.5 h-3.5 shrink-0" />
          <span>{{ builderNotice.text }}</span>
          <button type="button" class="opacity-60 hover:opacity-100" @click="builderNotice = null">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <div v-if="selectedElement && !interactivePreview" class="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center px-4">
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

        <div
          v-else-if="interactivePreview"
          class="z-20 absolute inset-0 flex flex-col items-center justify-center p-6 overflow-auto"
          :style="{ background: currentTheme.frameBackground }"
        >
          <div
            v-if="previewRuntime.state.value.lastError"
            class="mb-3 flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/90 px-4 py-2 text-xs text-rose-100 shadow-lg"
          >
            <span class="font-semibold">{{ previewRuntime.state.value.lastError.title }}:</span>
            <span>{{ previewRuntime.state.value.lastError.description }}</span>
            <button type="button" class="opacity-70 hover:opacity-100" @click="previewRuntime.clearError">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            class="relative shrink-0 shadow-2xl overflow-hidden border"
            :style="{
              width: `${Math.round(layout.resolution.width * previewScale)}px`,
              height: `${Math.round(layout.resolution.height * previewScale)}px`,
              borderColor: currentTheme.panelBorder,
              borderRadius: currentTheme.surfaceStyle === 'square' ? '18px' : '28px',
            }"
          >
            <div
              class="absolute top-0 left-0 overflow-hidden"
              :style="{
                width: `${layout.resolution.width}px`,
                height: `${layout.resolution.height}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
                background: currentTheme.canvasBackground,
                color: currentTheme.panelText,
              }"
            >
              <ElementRenderer
                v-for="el in layout.elements"
                :key="el.id"
                :element="el"
                :business-id="business?.id ?? ''"
                :builder-mode="false"
              />

              <div
                v-if="previewActiveModal"
                class="absolute inset-0 z-[60] flex items-center justify-center bg-black/45"
                @click.self="previewRuntime.emitLocal('modal:close')"
              >
                <div
                  class="relative overflow-hidden border shadow-2xl"
                  :style="previewActiveModal.presentation === 'fullscreen'
                    ? `width: ${layout.resolution.width}px; height: ${layout.resolution.height}px; background: ${currentTheme.panelBackground}; border-color: ${currentTheme.panelBorder};`
                    : previewActiveModal.presentation === 'drawer'
                      ? `width: ${Math.min(460, layout.resolution.width)}px; height: ${layout.resolution.height - 80}px; margin-left: auto; background: ${currentTheme.panelBackground}; border-color: ${currentTheme.panelBorder};`
                      : `width: ${previewActiveModal.width ?? 640}px; max-width: calc(100% - 48px); height: ${previewActiveModal.height ?? 420}px; max-height: calc(100% - 48px); background: ${currentTheme.panelBackground}; border-color: ${currentTheme.panelBorder}; border-radius: 24px;`"
                >
                  <ElementRenderer
                    v-for="el in previewActiveModal.elements"
                    :key="el.id"
                    :element="el"
                    :business-id="business?.id ?? ''"
                    :builder-mode="false"
                  />
                </div>
              </div>
            </div>
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

        <div v-if="showStudioPanel && !interactivePreview" class="pointer-events-none absolute inset-y-0 right-0 z-40 flex justify-end">
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
          class="w-[400px] h-full min-h-0 bg-white flex flex-col shadow-2xl overflow-y-auto overscroll-contain"
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
            <div v-if="selectedTerminal && layout.presetId" class="rounded-2xl p-3 border flex items-center justify-between gap-2 bg-amber-50/70 border-amber-200">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-amber-900 truncate">
                  Linked Preset: {{ matchedPresetForLayout?.name ?? layout.presetId }}
                </p>
                <p class="text-[11px] text-amber-700">
                  Version v{{ layout.presetVersion ?? 1 }}{{ presetUpdateVersion ? ` · v${presetUpdateVersion} available` : '' }}
                </p>
              </div>
              <button
                type="button"
                :disabled="syncingPreset"
                class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-900 text-white hover:bg-amber-800 disabled:opacity-50"
                @click="syncPresetUpdate"
              >
                {{ syncingPreset ? 'Syncing…' : 'Sync Update' }}
              </button>
            </div>

            <div
              v-for="preset in allPresets"
              :key="preset.id"
              class="rounded-2xl p-4 space-y-2 transition-all"
              style="background: #fdf7f2; border: 1px solid rgba(61,24,32,0.08);"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-semibold text-sm truncate" style="color: rgb(var(--shell-sidebar));">{{ preset.name }}</p>
                <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5">
                  {{ preset.source === 'custom' ? 'Custom' : 'Official' }} v{{ preset.version }}
                </span>
              </div>
              <p class="text-xs" style="color: rgba(61,24,32,0.45);">{{ preset.description || 'Reusable terminal layout preset.' }}</p>
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

    <!-- ── Save as Preset Modal ───────────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="showSavePresetModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showSavePresetModal = false"
      >
        <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 border" style="border-color: rgba(61,24,32,0.1);">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold text-base" style="color: rgb(var(--shell-sidebar));">Save Terminal as Preset</h2>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.5);">Reuse this layout and permissions across terminals</p>
            </div>
            <button type="button" class="p-1 rounded-lg hover:bg-black/5" @click="showSavePresetModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-[11px] font-semibold block mb-1" style="color: rgba(61,24,32,0.6);">Preset Name</label>
              <input v-model="presetForm.name" type="text" class="input-warm w-full px-3 py-2 text-sm" placeholder="e.g. Weekend Counter Layout" />
            </div>
            <div>
              <label class="text-[11px] font-semibold block mb-1" style="color: rgba(61,24,32,0.6);">Description</label>
              <textarea v-model="presetForm.description" rows="2" class="input-warm w-full px-3 py-2 text-sm resize-none" placeholder="What this station layout is optimized for..." />
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" class="px-4 py-2 rounded-full text-xs font-medium hover:bg-black/5" @click="showSavePresetModal = false">
              Cancel
            </button>
            <button
              type="button"
              :disabled="savingPreset || !presetForm.name.trim()"
              class="px-5 py-2 rounded-full text-xs font-semibold disabled:opacity-40"
              style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
              @click="submitSaveAsPreset"
            >
              {{ savingPreset ? 'Saving...' : 'Save Preset' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
