import type { ElementType, RuntimeActionDefinition } from '~/lib/uiTypes';

export type TablePermissionKey = 'read' | 'insert' | 'update' | 'delete';
export type PermissionPresetKey = 'cashier-register' | 'catalog-registrar' | 'inventory-manager' | 'kitchen-display' | 'reports-viewer';

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
  recommendedElements: ElementType[];
  optionalElements: ElementType[];
  permissions: TerminalPermissions;
}

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
    description: 'Read-only production queue for the back-of-house to watch incoming orders live.',
    recommendedElements: ['text', 'table-view'],
    optionalElements: ['button', 'chart', 'image'],
    permissions: {
      tables: {
        '*': { read: true, insert: false, update: false, delete: false },
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

export function normalizePermissions(value?: Partial<TerminalPermissions> | string | null): TerminalPermissions {
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

  const tables: Record<string, Partial<TablePermissionSet>> = {};
  for (const [tableName, permissionSet] of Object.entries(parsed?.tables ?? {})) {
    tables[tableName] = normalizeTablePermissionSet(permissionSet);
  }

  if (!tables['*']) {
    tables['*'] = clone(DEFAULT_TERMINAL_PERMISSIONS.tables['*']);
  }

  return {
    tables,
    audit_log: {
      visible: Boolean(parsed?.audit_log?.visible),
    },
    reports: {
      visible: Boolean(parsed?.reports?.visible),
    },
  };
}

export function resolveTablePermissions(permissions: TerminalPermissions | string | null | undefined, tableName: string): TablePermissionSet {
  const normalized = normalizePermissions(permissions);
  const wildcard   = normalizeTablePermissionSet(normalized.tables['*']);
  const specific   = normalized.tables[tableName];

  if (!specific) return wildcard;

  const set = normalizeTablePermissionSet(specific);

  return {
    read:   set.read,
    insert: set.insert,
    update: set.update,
    delete: set.delete,
  };
}

export function isActionAllowed(permissions: TerminalPermissions | string | null | undefined, action: RuntimeActionDefinition): boolean {
  if (action.source === 'audit-log') {
    return action.type === 'query' && normalizePermissions(permissions).audit_log.visible;
  }

  if (!action.table) {
    return action.type !== 'query' || action.type === 'query';
  }

  const tablePermissions = resolveTablePermissions(permissions, action.table);

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
  return TERMINAL_PERMISSION_PRESETS.find((preset) => preset.key === key) ?? null;
}

export function inferPermissionPreset(permissions: TerminalPermissions | string | null | undefined): PermissionPreset | null {
  const normalized = normalizePermissions(permissions);
  const wildcard = normalizeTablePermissionSet(normalized.tables['*']);

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
