import type { ElementType, RuntimeActionDefinition } from '~/lib/uiTypes';

export type TablePermissionKey = 'read' | 'insert' | 'update' | 'delete';
export type CorePermissionPresetKey = 'cashier-register' | 'catalog-registrar' | 'inventory-manager' | 'kitchen-display' | 'reports-viewer';
export type IndustryPermissionPresetKey = 'dispatch-console' | 'billing-ledger' | 'appointment-desk' | 'service-directory';
export type PermissionPresetKey = CorePermissionPresetKey | IndustryPermissionPresetKey;

export interface TablePermissionSet {
  read: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
}

export interface TerminalPermissions {
  tables: Record<string, Partial<TablePermissionSet>>;
  audit_log: {
    visible: boolean;
  };
  reports: {
    visible: boolean;
  };
}

export interface PermissionPreset {
  key: PermissionPresetKey;
  label: string;
  description: string;
  industries?: string[];
  recommendedElements: ElementType[];
  optionalElements: ElementType[];
  permissions: TerminalPermissions;
}

/** PIN given to new terminals; the dashboard checklist nudges admins to change it before opening. */
export const DEFAULT_TERMINAL_PIN = '1234';

export const DENY_ALL_TABLE_PERMISSIONS: TablePermissionSet = {
  read: false,
  insert: false,
  update: false,
  delete: false,
};

export const DEFAULT_TERMINAL_PERMISSIONS: TerminalPermissions = {
  tables: {
    '*': { ...DENY_ALL_TABLE_PERMISSIONS },
  },
  audit_log: { visible: false },
  reports: { visible: false },
};

export const TERMINAL_PERMISSION_PRESETS: PermissionPreset[] = [
  {
    key: 'cashier-register',
    label: 'Cashier Register',
    description: 'Fast selling station focused on line speed, simple inputs, and locked-down mutations.',
    recommendedElements: ['text', 'button', 'input-field', 'table-view'],
    optionalElements: ['image', 'upload'],
    permissions: {
      tables: {
        '*': { read: true, insert: true, update: false, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: false },
    },
  },
  {
    key: 'catalog-registrar',
    label: 'Catalog Registrar',
    description: 'Product-entry station for building the sellable catalog and reviewing item details before they reach the cashier.',
    recommendedElements: ['text', 'table-view', 'input-field', 'button', 'image'],
    optionalElements: ['chart', 'upload'],
    permissions: {
      tables: {
        '*': { read: true, insert: true, update: true, delete: false },
        products: { read: true, insert: true, update: true, delete: true },
      },
      audit_log: { visible: false },
      reports: { visible: false },
    },
  },
  {
    key: 'inventory-manager',
    label: 'Inventory Manager',
    description: 'Operations terminal for stock movement, receiving, and day-to-day data maintenance.',
    recommendedElements: ['text', 'table-view', 'input-field', 'button', 'chart', 'upload'],
    optionalElements: ['image'],
    permissions: {
      tables: {
        '*': { read: true, insert: true, update: true, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: true },
    },
  },
  {
    key: 'kitchen-display',
    label: 'Kitchen Display',
    description: 'Order queue and preparation tracking station for kitchen staff.',
    recommendedElements: ['text', 'table-view', 'button'],
    optionalElements: ['chart', 'image'],
    permissions: {
      tables: {
        '*': { read: true, insert: false, update: false, delete: false },
        orders: { read: true, insert: false, update: true, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: false },
    },
  },
  {
    key: 'reports-viewer',
    label: 'Reports Viewer',
    description: 'Read-only analytics station for activity monitoring, audit review, and trend charts.',
    recommendedElements: ['text', 'chart', 'table-view', 'image'],
    optionalElements: ['button', 'upload'],
    permissions: {
      tables: {
        '*': { read: true, insert: false, update: false, delete: false },
      },
      audit_log: { visible: true },
      reports: { visible: true },
    },
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTablePermissionSet(value?: Partial<TablePermissionSet>): TablePermissionSet {
  return {
    read: Boolean(value?.read),
    insert: Boolean(value?.insert),
    update: Boolean(value?.update),
    delete: Boolean(value?.delete),
  };
}

/**
 * Specialized terminal permission presets tailored to non-restaurant industries
 * (Logistics, Accounting, Retail, Clinic, Services, Education, and Custom Operations).
 */
export const INDUSTRY_PERMISSION_PRESETS: PermissionPreset[] = [
  {
    key: 'dispatch-console',
    label: 'Dispatch & Delivery Console',
    description: 'Create waybills, scan tracking codes, assign drivers, and update delivery statuses.',
    industries: ['logistics', 'retail', 'restaurant', 'other'],
    recommendedElements: ['text', 'scan-field', 'input-field', 'button', 'table-view'],
    optionalElements: ['chart', 'upload'],
    permissions: {
      tables: {
        '*': { ...DENY_ALL_TABLE_PERMISSIONS },
        deliveries: { read: true, insert: true, update: true, delete: false },
        customers: { read: true, insert: true, update: false, delete: false },
        staff: { read: true, insert: false, update: false, delete: false },
        inventory: { read: true, insert: false, update: true, delete: false },
        orders: { read: true, insert: false, update: true, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: false },
    },
  },
  {
    key: 'billing-ledger',
    label: 'Billing & Ledger Desk',
    description: 'Issue invoices, track payment status, log operating expenses, and monitor cashflow.',
    industries: ['accounting', 'clinic', 'services', 'education', 'other'],
    recommendedElements: ['text', 'input-field', 'button', 'table-view', 'chart'],
    optionalElements: ['upload', 'image'],
    permissions: {
      tables: {
        '*': { ...DENY_ALL_TABLE_PERMISSIONS },
        invoices: { read: true, insert: true, update: true, delete: false },
        expenses: { read: true, insert: true, update: true, delete: false },
        customers: { read: true, insert: true, update: false, delete: false },
        staff: { read: true, insert: false, update: false, delete: false },
        orders: { read: true, insert: false, update: false, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: true },
    },
  },
  {
    key: 'appointment-desk',
    label: 'Appointments & Intake Desk',
    description: 'Schedule visits, check in patients, clients, or students, and manage active session queues.',
    industries: ['clinic', 'services', 'education', 'restaurant', 'other'],
    recommendedElements: ['text', 'input-field', 'button', 'table-view'],
    optionalElements: ['chart', 'upload'],
    permissions: {
      tables: {
        '*': { ...DENY_ALL_TABLE_PERMISSIONS },
        appointments: { read: true, insert: true, update: true, delete: false },
        customers: { read: true, insert: true, update: true, delete: false },
        staff: { read: true, insert: false, update: false, delete: false },
        invoices: { read: true, insert: false, update: false, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: false },
    },
  },
  {
    key: 'service-directory',
    label: 'Directory & Roster Desk',
    description: 'Register clients, patients, students, or loyalty members and manage staff shifts and assignments.',
    industries: ['retail', 'clinic', 'education', 'services', 'accounting', 'logistics', 'other'],
    recommendedElements: ['text', 'input-field', 'button', 'table-view'],
    optionalElements: ['chart', 'image', 'upload'],
    permissions: {
      tables: {
        '*': { ...DENY_ALL_TABLE_PERMISSIONS },
        customers: { read: true, insert: true, update: true, delete: false },
        staff: { read: true, insert: true, update: true, delete: false },
        appointments: { read: true, insert: false, update: false, delete: false },
        invoices: { read: true, insert: false, update: false, delete: false },
        deliveries: { read: true, insert: false, update: false, delete: false },
        expenses: { read: true, insert: false, update: false, delete: false },
        orders: { read: true, insert: false, update: false, delete: false },
      },
      audit_log: { visible: false },
      reports: { visible: false },
    },
  },
];

export const ALL_TERMINAL_PERMISSION_PRESETS: PermissionPreset[] = [
  ...TERMINAL_PERMISSION_PRESETS,
  ...INDUSTRY_PERMISSION_PRESETS,
];

const ROLE_PRESET_ALIASES: Record<string, PermissionPresetKey> = {
  'menu-catalog': 'catalog-registrar',
  'catalog-desk': 'catalog-registrar',
  'catalog': 'catalog-registrar',
  'catalog-station': 'catalog-registrar',
  'front-counter': 'cashier-register',
  'cashier': 'cashier-register',
  'cashier-station': 'cashier-register',
  'stock-room': 'inventory-manager',
  'warehouse-desk': 'inventory-manager',
  'warehouse': 'inventory-manager',
  'inventory': 'inventory-manager',
  'inventory-station': 'inventory-manager',
  'kitchen-queue': 'kitchen-display',
  'kitchen': 'kitchen-display',
  'kitchen-display': 'kitchen-display',
  'kitchen-station': 'kitchen-display',
  'dispatch': 'dispatch-console',
  'courier': 'dispatch-console',
  'delivery-desk': 'dispatch-console',
  'dispatch-console': 'dispatch-console',
  'dispatch-station': 'dispatch-console',
  'billing': 'billing-ledger',
  'ledger': 'billing-ledger',
  'bookkeeping': 'billing-ledger',
  'finance-console': 'billing-ledger',
  'billing-ledger': 'billing-ledger',
  'billing-station': 'billing-ledger',
  'appointments': 'appointment-desk',
  'triage': 'appointment-desk',
  'intake': 'appointment-desk',
  'care-desk': 'appointment-desk',
  'campus-overview': 'appointment-desk',
  'appointment-desk': 'appointment-desk',
  'appointment-station': 'appointment-desk',
  'directory': 'service-directory',
  'clienteling': 'service-directory',
  'roster': 'service-directory',
  'service-overview': 'service-directory',
  'service-directory': 'service-directory',
  'directory-station': 'service-directory',
  'reports': 'reports-viewer',
  'reports-station': 'reports-viewer',
};

export function presetByRoleOrKey(identifier?: string | null): PermissionPreset | null {
  if (!identifier) return null;
  const lower = identifier.toLowerCase().trim().replace(/[-_\s]+/g, '-');

  if (ROLE_PRESET_ALIASES[lower]) {
    return presetByKey(ROLE_PRESET_ALIASES[lower]);
  }

  for (const [alias, key] of Object.entries(ROLE_PRESET_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return presetByKey(key);
    }
  }

  return (
    ALL_TERMINAL_PERMISSION_PRESETS.find(
      (p) =>
        p.key.toLowerCase() === lower ||
        p.label.toLowerCase().replace(/[-_\s]+/g, '-') === lower ||
        p.key.toLowerCase().includes(lower) ||
        lower.includes(p.key.toLowerCase()),
    ) ?? null
  );
}

export function normalizePermissions(
  value?: Partial<TerminalPermissions> | string | null,
  roleOrKey?: string | null,
): TerminalPermissions {
  let parsed: Partial<TerminalPermissions> | null = null;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  } else if (value && typeof value === 'object') {
    parsed = value;
  }

  const fallbackPreset = presetByRoleOrKey(roleOrKey);
  const tables: Record<string, Partial<TablePermissionSet>> = {};
  for (const [tableName, permissionSet] of Object.entries(parsed?.tables ?? {})) {
    tables[tableName] = normalizeTablePermissionSet(permissionSet);
  }

  if (fallbackPreset) {
    for (const [tableName, permissionSet] of Object.entries(fallbackPreset.permissions.tables)) {
      if (!tables[tableName]) {
        tables[tableName] = clone(permissionSet);
      }
    }
  }

  if (!tables['*']) {
    if (fallbackPreset?.permissions.tables['*']) {
      tables['*'] = clone(fallbackPreset.permissions.tables['*']);
    } else {
      tables['*'] = clone(DEFAULT_TERMINAL_PERMISSIONS.tables['*']);
    }
  }

  if (fallbackPreset?.key === 'catalog-registrar') {
    tables.products = {
      read: true,
      insert: true,
      ...(tables.products ?? {}),
      update: true,
      delete: true,
    };
  }

  if (fallbackPreset?.key === 'kitchen-display' || (roleOrKey && /kitchen/i.test(roleOrKey))) {
    tables.orders = {
      read: true,
      insert: false,
      ...(tables.orders ?? {}),
      update: true,
    };
  }

  return {
    tables,
    audit_log: {
      visible: Boolean(parsed?.audit_log?.visible ?? fallbackPreset?.permissions.audit_log.visible),
    },
    reports: {
      visible: Boolean(parsed?.reports?.visible ?? fallbackPreset?.permissions.reports.visible),
    },
  };
}

export function resolveTablePermissions(
  permissions: TerminalPermissions | string | null | undefined,
  tableName: string,
  roleOrKey?: string | null,
): TablePermissionSet {
  const normalized = normalizePermissions(permissions, roleOrKey);
  const wildcard   = normalizeTablePermissionSet(normalized.tables['*']);
  const specific   = normalized.tables[tableName]
    ?? (tableName.endsWith('_products') || tableName === 'products' ? normalized.tables.products : undefined)
    ?? (tableName.endsWith('_orders') || tableName === 'orders' ? normalized.tables.orders : undefined);

  if (!specific) {
    if ((tableName === 'orders' || tableName.endsWith('_orders')) && roleOrKey && /kitchen/i.test(roleOrKey)) {
      return { read: true, insert: false, update: true, delete: false };
    }
    return wildcard;
  }

  const set = normalizeTablePermissionSet(specific);

  return {
    read:   set.read,
    insert: set.insert,
    update: set.update,
    delete: set.delete,
  };
}

export function isActionAllowed(
  permissions: TerminalPermissions | string | null | undefined,
  action: RuntimeActionDefinition,
  roleOrKey?: string | null,
): boolean {
  if (action.source === 'audit-log') {
    return action.type === 'query' && normalizePermissions(permissions, roleOrKey).audit_log.visible;
  }

  if (!action.table) {
    return action.type !== 'query' || action.type === 'query';
  }

  const tablePermissions = resolveTablePermissions(permissions, action.table, roleOrKey);

  switch (action.type) {
    case 'insert':
      return tablePermissions.insert;
    case 'update':
      return tablePermissions.update;
    case 'delete':
      return tablePermissions.delete;
    case 'query':
      return tablePermissions.read;
    case 'emit':
    case 'navigate':
    case 'upload':
      return true;
    default:
      return false;
  }
}

export function presetByKey(key: string | null | undefined): PermissionPreset | null {
  return ALL_TERMINAL_PERMISSION_PRESETS.find((preset) => preset.key === key) ?? null;
}

export function presetsForIndustry(businessType?: string | null): PermissionPreset[] {
  const normalized = (businessType ?? '').toLowerCase().trim();
  const preferred: Record<string, PermissionPresetKey[]> = {
    restaurant: ['cashier-register', 'kitchen-display', 'catalog-registrar', 'inventory-manager', 'appointment-desk', 'reports-viewer'],
    logistics: ['dispatch-console', 'inventory-manager', 'service-directory', 'reports-viewer'],
    accounting: ['billing-ledger', 'service-directory', 'reports-viewer'],
    retail: ['cashier-register', 'catalog-registrar', 'inventory-manager', 'service-directory', 'dispatch-console', 'reports-viewer'],
    clinic: ['appointment-desk', 'service-directory', 'billing-ledger', 'inventory-manager', 'reports-viewer'],
    services: ['appointment-desk', 'service-directory', 'billing-ledger', 'reports-viewer'],
    education: ['appointment-desk', 'service-directory', 'billing-ledger', 'reports-viewer'],
    other: ['service-directory', 'appointment-desk', 'billing-ledger', 'dispatch-console', 'cashier-register', 'inventory-manager', 'reports-viewer'],
  };
  const order = preferred[normalized];
  if (!order) return ALL_TERMINAL_PERMISSION_PRESETS;

  const picked = order
    .map((key) => presetByKey(key))
    .filter((preset): preset is PermissionPreset => Boolean(preset));
  const pickedKeys = new Set(picked.map((p) => p.key));
  const remaining = ALL_TERMINAL_PERMISSION_PRESETS.filter((p) => !pickedKeys.has(p.key));
  return [...picked, ...remaining];
}

export function inferPermissionPreset(permissions: TerminalPermissions | string | null | undefined): PermissionPreset | null {
  const normalized = normalizePermissions(permissions);
  const wildcard = normalizeTablePermissionSet(normalized.tables['*']);

  if (normalized.tables.deliveries?.insert && normalized.tables.deliveries?.update) {
    return presetByKey('dispatch-console');
  }

  if (normalized.tables.invoices?.insert && normalized.tables.expenses?.insert) {
    return presetByKey('billing-ledger');
  }

  if (normalized.tables.appointments?.insert && normalized.tables.appointments?.update) {
    return presetByKey('appointment-desk');
  }

  if (normalized.tables.customers?.insert && normalized.tables.staff?.insert) {
    return presetByKey('service-directory');
  }

  if (
    wildcard.read &&
    wildcard.insert &&
    !wildcard.update &&
    !wildcard.delete &&
    !normalized.audit_log.visible &&
    !normalized.reports.visible
  ) {
    return presetByKey('cashier-register');
  }

  if (
    wildcard.read &&
    wildcard.insert &&
    wildcard.update &&
    !wildcard.delete &&
    !normalized.audit_log.visible &&
    !normalized.reports.visible
  ) {
    return presetByKey('catalog-registrar');
  }

  if (
    wildcard.read &&
    wildcard.insert &&
    wildcard.update &&
    !wildcard.delete &&
    !normalized.audit_log.visible &&
    normalized.reports.visible
  ) {
    return presetByKey('inventory-manager');
  }

  if (
    wildcard.read &&
    !wildcard.insert &&
    !wildcard.update &&
    !wildcard.delete &&
    !normalized.audit_log.visible &&
    !normalized.reports.visible
  ) {
    return presetByKey('kitchen-display');
  }

  if (
    wildcard.read &&
    !wildcard.insert &&
    !wildcard.update &&
    !wildcard.delete &&
    normalized.audit_log.visible &&
    normalized.reports.visible
  ) {
    return presetByKey('reports-viewer');
  }

  return null;
}
