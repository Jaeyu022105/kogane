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
  'dispatch-console': [
    {
      id: 'courier-dispatch',
      label: 'Courier Dispatch',
      description: 'Pairs barcode waybill scanning and dispatch intake beside the live delivery board.',
    },
    {
      id: 'route-board',
      label: 'Route Board Focus',
      description: 'Expands the active delivery queue across the top while compacting waybill entry.',
    },
  ],
  'billing-ledger': [
    {
      id: 'ledger-split',
      label: 'Receivables & Expenses Split',
      description: 'Shows invoice issuing and expense logging alongside both live financial ledgers.',
    },
    {
      id: 'expense-audit',
      label: 'Expense & Spend Audit',
      description: 'Prioritizes expense monitoring and spend breakdown charts for bookkeeping.',
    },
  ],
  'appointment-desk': [
    {
      id: 'intake-queue',
      label: 'Intake & Schedule Split',
      description: 'Keeps patient, client, or student booking beside the live check-in queue.',
    },
    {
      id: 'triage-board',
      label: 'Wide Check-In Board',
      description: 'Gives full-width queue visibility for busy clinics, salons, and tutoring desks.',
    },
  ],
  'service-directory': [
    {
      id: 'client-and-roster',
      label: 'Client & Roster Dual View',
      description: 'Manages client, patient, or student profiles alongside the active staff roster.',
    },
    {
      id: 'roster-board',
      label: 'Staff & Operations Board',
      description: 'Highlights team assignments and active roster status at the top of the screen.',
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
    'restaurant:appointment-desk': 'Host & Reservations Desk',
    'restaurant:dispatch-console': 'Catering & Delivery Dispatch',
    'retail:cashier-register': 'Cashier Register',
    'retail:catalog-registrar': 'Catalog Desk',
    'retail:inventory-manager': 'Stock Room',
    'retail:service-directory': 'Clienteling & Loyalty Desk',
    'retail:dispatch-console': 'Local Delivery Desk',
    'retail:reports-viewer': 'Sales Reports',
    'logistics:dispatch-console': 'Dispatch & Delivery Console',
    'logistics:inventory-manager': 'Warehouse & Stock Desk',
    'logistics:service-directory': 'Shipper & Driver Roster',
    'logistics:reports-viewer': 'Fleet & Ops Analytics',
    'accounting:billing-ledger': 'Billing & Bookkeeping Desk',
    'accounting:service-directory': 'Client & Payroll Roster',
    'accounting:reports-viewer': 'Finance Console',
    'clinic:appointment-desk': 'Patient Intake & Triage Desk',
    'clinic:service-directory': 'Patient Records & Staff Desk',
    'clinic:billing-ledger': 'Patient Billing Desk',
    'clinic:inventory-manager': 'Medical Supply Desk',
    'clinic:reports-viewer': 'Care Desk',
    'services:appointment-desk': 'Booking & Job Queue Desk',
    'services:billing-ledger': 'Client Invoicing Desk',
    'services:service-directory': 'Client & Crew Directory',
    'services:dispatch-console': 'Field Dispatch Desk',
    'services:reports-viewer': 'Service Overview',
    'education:appointment-desk': 'Class & Tutoring Schedule Desk',
    'education:service-directory': 'Student & Faculty Registry',
    'education:billing-ledger': 'Tuition & Fee Desk',
    'education:reports-viewer': 'Campus Overview',
    'other:service-directory': 'Workspace Operations Hub',
    'other:appointment-desk': 'Appointments & Requests Desk',
    'other:billing-ledger': 'Billing & Expense Desk',
    'other:dispatch-console': 'Dispatch Console',
  };

  return labels[key]
    ?? {
      'cashier-register': 'Cashier Register',
      'catalog-registrar': 'Catalog Registrar',
      'inventory-manager': 'Inventory Manager',
      'kitchen-display': 'Kitchen Display',
      'reports-viewer': 'Reports Viewer',
      'dispatch-console': 'Dispatch & Delivery Console',
      'billing-ledger': 'Billing & Ledger Desk',
      'appointment-desk': 'Appointments & Intake Desk',
      'service-directory': 'Directory & Roster Desk',
    }[presetKey];
}

export function inferStarterTerminals(businessType: string | null | undefined, features: string[]) {
  const type = (businessType ?? 'other').toLowerCase();
  const picked = new Set<PermissionPresetKey>();
  const terminals: ManagedTerminalDefinition[] = [];

  const add = (presetKey: PermissionPresetKey, displayName?: string) => {
    if (picked.has(presetKey)) return;
    picked.add(presetKey);
    terminals.push({
      presetKey,
      displayName: displayName ?? getStationName(type, presetKey),
      layoutVariant: defaultLayoutVariantForPreset(presetKey),
    });
  };

  if (type === 'logistics') {
    if (features.includes('deliveries') || features.includes('orders') || features.length === 0) {
      add('dispatch-console');
    }
    if (features.includes('inventory')) {
      add('inventory-manager');
    }
    if (features.includes('customers') || features.includes('staff')) {
      add('service-directory');
    }
    if (!picked.has('dispatch-console')) add('dispatch-console');
    add('reports-viewer');
    return terminals;
  }

  if (type === 'accounting') {
    if (features.includes('invoices') || features.includes('expenses') || features.length === 0) {
      add('billing-ledger');
    }
    if (features.includes('customers') || features.includes('staff')) {
      add('service-directory');
    }
    if (!picked.has('billing-ledger')) add('billing-ledger');
    add('reports-viewer');
    return terminals;
  }

  if (type === 'clinic') {
    if (features.includes('appointments') || features.length === 0) {
      add('appointment-desk');
    }
    if (features.includes('customers') || features.includes('staff')) {
      add('service-directory');
    }
    if (features.includes('invoices') || features.includes('expenses')) {
      add('billing-ledger');
    }
    if (features.includes('inventory')) {
      add('inventory-manager');
    }
    if (!picked.has('appointment-desk')) add('appointment-desk');
    add('reports-viewer');
    return terminals;
  }

  if (type === 'services') {
    if (features.includes('appointments')) add('appointment-desk');
    if (features.includes('invoices') || features.includes('expenses')) add('billing-ledger');
    if (features.includes('customers') || features.includes('staff')) add('service-directory');
    if (features.includes('deliveries')) add('dispatch-console');
    if (features.includes('orders')) add('cashier-register');
    if (terminals.length === 0) add('service-directory');
    add('reports-viewer');
    return terminals;
  }

  if (type === 'education') {
    if (features.includes('appointments')) add('appointment-desk');
    if (features.includes('customers') || features.includes('staff')) add('service-directory');
    if (features.includes('invoices') || features.includes('expenses')) add('billing-ledger');
    if (terminals.length === 0) add('service-directory');
    add('reports-viewer');
    return terminals;
  }

  if (type === 'retail') {
    if (features.includes('orders')) add('cashier-register');
    if (features.includes('inventory')) {
      add('catalog-registrar');
      add('inventory-manager');
    }
    if (features.includes('customers') || features.includes('staff')) {
      add('service-directory');
    }
    if (features.includes('deliveries')) {
      add('dispatch-console');
    }
    if (terminals.length === 0) add('cashier-register');
    add('reports-viewer');
    return terminals;
  }

  if (type === 'restaurant') {
    if (features.includes('orders')) add('cashier-register');
    if (features.includes('inventory')) {
      add('catalog-registrar');
      add('inventory-manager');
    }
    if (features.includes('orders')) {
      add('kitchen-display');
    }
    if (features.includes('appointments')) {
      add('appointment-desk');
    }
    if (features.includes('deliveries')) {
      add('dispatch-console');
    }
    add('reports-viewer');
    return terminals;
  }

  // 'other' and custom workspaces
  if (features.includes('orders')) add('cashier-register');
  if (features.includes('inventory')) {
    add('catalog-registrar');
    add('inventory-manager');
  }
  if (features.includes('deliveries')) add('dispatch-console');
  if (features.includes('appointments')) add('appointment-desk');
  if (features.includes('invoices') || features.includes('expenses')) add('billing-ledger');
  if (features.includes('customers') || features.includes('staff')) add('service-directory');
  if (terminals.length === 0) add('service-directory');

  add('reports-viewer');
  return terminals;
}
