import { db } from '~/lib/db';
import { BUILDER_PRESETS } from '~/lib/builderPresets';
import { hashPin } from '~/lib/authUtils';
import { presetByKey, type PermissionPresetKey } from '~/lib/permissions';
import { defaultLayoutVariantForPreset, inferStarterTerminals } from '~/lib/starterWorkstations';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';
import { applyBrandingToLayout, type WorkspaceBrandConfig } from '~/lib/workspaceBranding';
import { ensureStarterBusinessTables, starterTableNamesForPreset } from '~/server/utils/starterTables';

export { inferStarterTerminals };

const PRESET_LAYOUT_MAP: Record<PermissionPresetKey, string> = {
  'cashier-register': 'cashier-station',
  'catalog-registrar': 'catalog-station',
  'inventory-manager': 'inventory-station',
  'kitchen-display': 'kitchen-station',
  'reports-viewer': 'reports-station',
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function defaultPin() {
  return '1234';
}

function patchElement(layoutSeed: typeof DEFAULT_LAYOUT, elementId: string, patch: Record<string, unknown>) {
  const target = layoutSeed.elements.find((element) => element.id === elementId);
  if (!target) return;

  Object.assign(target, patch);
}

function applyLayoutVariant(layoutSeed: typeof DEFAULT_LAYOUT, presetKey: PermissionPresetKey, layoutVariant: string) {
  if (presetKey === 'cashier-register' && layoutVariant === 'queue-priority') {
    patchElement(layoutSeed, 'cashier-sale-panel', {
      position: { x: 40, y: 108, width: 720, height: 572, zIndex: 2 },
      title: 'Cashier Queue Desk',
      subtitle: 'Ring up orders while the waiting queue stays larger and easier to scan.',
    });
    patchElement(layoutSeed, 'cashier-open-orders', {
      position: { x: 784, y: 108, width: 456, height: 572, zIndex: 2 },
      title: 'Order Queue',
      subtitle: 'Watch tables waiting for preparation and handoff.',
      pageSize: 16,
    });
  }

  if (presetKey === 'catalog-registrar' && layoutVariant === 'catalog-showcase') {
    patchElement(layoutSeed, 'catalog-products-table', {
      position: { x: 40, y: 356, width: 1200, height: 280, zIndex: 2 },
      title: 'Featured Catalog',
      subtitle: 'Keep the active catalog front and center while you add new items above it.',
    });
    patchElement(layoutSeed, 'catalog-lookup-title', {
      position: { x: 536, y: 116, width: 320, height: 30, zIndex: 2 },
      content: 'Quick Lookup',
    });
    patchElement(layoutSeed, 'catalog-lookup-name', {
      position: { x: 536, y: 156, width: 200, height: 52, zIndex: 2 },
    });
    patchElement(layoutSeed, 'catalog-lookup-button', {
      position: { x: 748, y: 156, width: 220, height: 52, zIndex: 2 },
      text: 'Find Product',
    });
  }

  if (presetKey === 'inventory-manager' && layoutVariant === 'receiving-desk') {
    patchElement(layoutSeed, 'inventory-title', {
      content: 'Receiving Desk',
    });
    patchElement(layoutSeed, 'inventory-table', {
      position: { x: 40, y: 96, width: 680, height: 540, zIndex: 2 },
      title: 'Receiving Overview',
      subtitle: 'Track inbound stock and the most important quantity changes first.',
    });
    patchElement(layoutSeed, 'inventory-chart', {
      position: { x: 744, y: 96, width: 496, height: 236, zIndex: 2 },
      title: 'Inbound Snapshot',
    });
    patchElement(layoutSeed, 'inventory-upload', {
      position: { x: 744, y: 356, width: 496, height: 144, zIndex: 2 },
      buttonLabel: 'Upload Receiving Sheet',
    });
  }

  if (presetKey === 'kitchen-display' && layoutVariant === 'expedite-focus') {
    patchElement(layoutSeed, 'kitchen-orders-board', {
      position: { x: 40, y: 108, width: 760, height: 560, zIndex: 2 },
      title: 'Pending Orders',
      subtitle: 'Focus the kitchen on what still needs preparation.',
      filters: { status: 'pending' },
    });

    layoutSeed.elements.push({
      id: 'kitchen-ready-board',
      type: 'table-view',
      label: 'fulfilled orders',
      position: { x: 824, y: 108, width: 416, height: 560, zIndex: 2 },
      source: 'business-table',
      title: 'Fulfilled Orders',
      subtitle: 'Completed tickets stay visible for final handoff checks.',
      tableName: 'orders',
      columns: ['table_number', 'items', 'status', 'total'],
      pageSize: 14,
      autoRefreshMs: 3000,
      orderBy: 'created_at',
      descending: true,
      striped: true,
      emptyLabel: 'No fulfilled orders yet.',
      filters: { status: 'fulfilled' },
      backgroundColor: '#161116',
      headerBackgroundColor: 'rgba(255,255,255,0.06)',
      textColor: '#f5ede4',
    });
  }

  if (presetKey === 'reports-viewer' && layoutVariant === 'audit-focus') {
    patchElement(layoutSeed, 'reports-table', {
      position: { x: 40, y: 96, width: 1200, height: 316, zIndex: 2 },
      title: 'Audit Feed',
      subtitle: 'Read the latest business activity first, then glance down for trend charts.',
      pageSize: 12,
    });
    patchElement(layoutSeed, 'reports-chart', {
      position: { x: 40, y: 436, width: 580, height: 200, zIndex: 2 },
      title: 'Action Mix',
    });
    patchElement(layoutSeed, 'reports-trend', {
      position: { x: 660, y: 436, width: 580, height: 200, zIndex: 2 },
      title: 'Activity Targets',
    });
  }
}

export async function createManagedTerminal(options: {
  businessId: string;
  businessSchema: string;
  displayName: string;
  presetKey: PermissionPresetKey;
  pin?: string;
  resolution?: string;
  layoutVariant?: string;
  brandConfig?: Partial<WorkspaceBrandConfig> | null;
}) {
  const preset = presetByKey(options.presetKey);
  if (!preset) {
    return { terminal: null, error: 'Unknown terminal preset', pin: null };
  }

  const starterTables = starterTableNamesForPreset(preset.key);
  if (starterTables.length > 0) {
    const starterResult = await ensureStarterBusinessTables(options.businessSchema, starterTables);
    if (starterResult.error) {
      return { terminal: null, error: starterResult.error, pin: null };
    }
  }

  const initialLayoutPreset = BUILDER_PRESETS.find((item) => item.id === PRESET_LAYOUT_MAP[preset.key]);
  const layoutSeed = clone(initialLayoutPreset?.layout ?? DEFAULT_LAYOUT);
  applyLayoutVariant(layoutSeed, preset.key, options.layoutVariant ?? defaultLayoutVariantForPreset(preset.key));
  const layoutData = applyBrandingToLayout(layoutSeed, options.brandConfig);

  if (options.resolution) {
    const [width, height] = options.resolution.split('x').map(Number);
    if (!Number.isNaN(width) && !Number.isNaN(height)) {
      layoutData.resolution = { width, height };
    }
  }

  const pin = options.pin ?? defaultPin();
  const pinHash = await hashPin(pin);

  const { data: terminal, error } = await db.insert('terminals', {
    business_id: options.businessId,
    display_name: options.displayName,
    role: preset.label,
    pin_hash: pinHash,
    pin_code: pin,
    pin_length: pin.length,
    permissions: JSON.stringify(preset.permissions),
    ui_layout: JSON.stringify(layoutData),
  });

  return {
    terminal,
    error,
    pin,
  };
}
