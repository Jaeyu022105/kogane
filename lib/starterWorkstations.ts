import type { PermissionPresetKey } from '~/lib/permissions';

export interface ManagedTerminalDefinition {
  displayName: string;
  presetKey: PermissionPresetKey;
  resolution?: string;
  pin?: string;
  layoutVariant?: string;
}

export interface TerminalLayoutVariantOption {
  id: string;
  label: string;
  description: string;
}

export const TERMINAL_LAYOUT_VARIANTS: Record<PermissionPresetKey, TerminalLayoutVariantOption[]> = {
  'cashier-register': [
    {
      id: 'balanced-counter',
      label: 'Balanced Counter',
      description: 'Keeps the cashier register and open orders queue evenly visible.',
    },
    {
      id: 'queue-priority',
      label: 'Queue Priority',
      description: 'Gives more space to active orders when the front counter gets busy.',
    },
  ],
  'catalog-registrar': [
    {
      id: 'entry-first',
      label: 'Entry First',
      description: 'Prioritizes fast product creation with the live catalog alongside it.',
    },
    {
      id: 'catalog-showcase',
      label: 'Catalog Showcase',
      description: 'Highlights the product list more prominently while keeping entry controls compact.',
    },
  ],
  'inventory-manager': [
    {
      id: 'stock-board',
      label: 'Stock Board',
      description: 'A broad stock overview with chart and upload tools on the side.',
    },
    {
      id: 'receiving-desk',
      label: 'Receiving Desk',
      description: 'Gives the receiving and upload tools more space for day-to-day stock intake.',
    },
  ],
  'kitchen-display': [
    {
      id: 'wide-pass',
      label: 'Wide Pass',
      description: 'Shows the full kitchen queue in one clean board.',
    },
    {
      id: 'expedite-focus',
      label: 'Expedite Focus',
      description: 'Splits pending and fulfilled orders into separate kitchen columns.',
    },
  ],
  'reports-viewer': [
    {
      id: 'overview-grid',
      label: 'Overview Grid',
      description: 'Keeps charts and the activity table balanced for quick daily summaries.',
    },
    {
      id: 'audit-focus',
      label: 'Audit Focus',
      description: 'Expands the activity feed while moving charts into a compact lower strip.',
    },
  ],
};

export function layoutVariantsForPreset(presetKey: PermissionPresetKey): TerminalLayoutVariantOption[] {
  return TERMINAL_LAYOUT_VARIANTS[presetKey] ?? [];
}

export function defaultLayoutVariantForPreset(presetKey: PermissionPresetKey) {
  return layoutVariantsForPreset(presetKey)[0]?.id ?? 'default';
}

export function getStationName(businessType: string | null | undefined, presetKey: PermissionPresetKey) {
  const key = `${businessType ?? 'other'}:${presetKey}`;
  const labels: Record<string, string> = {
    'restaurant:cashier-register': 'Front Counter',
    'restaurant:catalog-registrar': 'Menu Catalog',
    'restaurant:inventory-manager': 'Stock Room',
    'restaurant:kitchen-display': 'Kitchen Queue',
    'retail:cashier-register': 'Cashier Register',
    'retail:catalog-registrar': 'Catalog Desk',
    'retail:inventory-manager': 'Stock Room',
    'logistics:inventory-manager': 'Dispatch Inventory',
    'accounting:reports-viewer': 'Finance Console',
    'clinic:reports-viewer': 'Care Desk',
    'services:reports-viewer': 'Service Overview',
    'education:reports-viewer': 'Campus Overview',
  };

  return labels[key]
    ?? {
      'cashier-register': 'Cashier Register',
      'catalog-registrar': 'Catalog Registrar',
      'inventory-manager': 'Inventory Manager',
      'kitchen-display': 'Kitchen Display',
      'reports-viewer': 'Reports Viewer',
    }[presetKey];
}

export function inferStarterTerminals(businessType: string | null | undefined, features: string[]) {
  const picked = new Set<PermissionPresetKey>();
  const terminals: ManagedTerminalDefinition[] = [];

  const add = (presetKey: PermissionPresetKey, displayName?: string) => {
    if (picked.has(presetKey)) return;
    picked.add(presetKey);
    terminals.push({
      presetKey,
      displayName: displayName ?? getStationName(businessType, presetKey),
      layoutVariant: defaultLayoutVariantForPreset(presetKey),
    });
  };

  if (features.includes('orders')) add('cashier-register');
  if (features.includes('inventory')) {
    add('catalog-registrar');
    add('inventory-manager');
  }
  if (businessType === 'restaurant' && features.includes('orders')) {
    add('kitchen-display');
  }

  add('reports-viewer');

  if (terminals.length === 0) {
    add('reports-viewer');
  }

  return terminals;
}
