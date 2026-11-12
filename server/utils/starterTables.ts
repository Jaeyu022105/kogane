import { db } from '~/lib/db';
import { buildAddColumnSql, buildCreateTableSql, type TableDef } from '~/lib/schemaUtils';
import { getSqlDialect, listBusinessTables } from '~/server/utils/business';
import { getBusinessTableColumns } from '~/server/utils/businessTable';

export const STARTER_BUSINESS_TABLES: Record<string, TableDef> = {
  products: {
    name: 'products',
    columns: [
      { name: 'name', type: 'text', nullable: false },
      { name: 'description', type: 'text', nullable: true },
      { name: 'price', type: 'numeric', nullable: false },
      { name: 'category', type: 'text', nullable: true },
      { name: 'available', type: 'boolean', nullable: false, default: '1' },
    ],
  },
  orders: {
    name: 'orders',
    columns: [
      { name: 'items', type: 'text', nullable: false },
      { name: 'line_items', type: 'text', nullable: true },
      { name: 'subtotal', type: 'numeric', nullable: true },
      { name: 'discount_type', type: 'text', nullable: true },
      { name: 'discount_amount', type: 'numeric', nullable: true },
      { name: 'discount_label', type: 'text', nullable: true },
      { name: 'discount_reference', type: 'text', nullable: true },
      { name: 'total', type: 'numeric', nullable: false },
      { name: 'status', type: 'text', nullable: false, default: "'pending'" },
      { name: 'table_number', type: 'text', nullable: true },
      { name: 'staff_name', type: 'text', nullable: true },
      { name: 'payment_method', type: 'text', nullable: true },
      { name: 'payment_status', type: 'text', nullable: true },
      { name: 'payment_reference', type: 'text', nullable: true },
      { name: 'receipt_number', type: 'text', nullable: true },
      { name: 'metadata', type: 'text', nullable: true },
    ],
  },
  inventory: {
    name: 'inventory',
    columns: [
      { name: 'item_name', type: 'text', nullable: false },
      { name: 'quantity', type: 'integer', nullable: false, default: '0' },
      { name: 'unit', type: 'text', nullable: true },
      { name: 'reorder_at', type: 'integer', nullable: true },
    ],
  },
  customers: {
    name: 'customers',
    columns: [
      { name: 'full_name', type: 'text', nullable: false },
      { name: 'email', type: 'text', nullable: true, unique: true },
      { name: 'phone', type: 'text', nullable: true },
      { name: 'address', type: 'text', nullable: true },
      { name: 'notes', type: 'text', nullable: true },
    ],
  },
  staff: {
    name: 'staff',
    columns: [
      { name: 'full_name', type: 'text', nullable: false },
      { name: 'role', type: 'text', nullable: false },
      { name: 'email', type: 'text', nullable: true },
      { name: 'phone', type: 'text', nullable: true },
      { name: 'active', type: 'boolean', nullable: false, default: '1' },
    ],
  },
  appointments: {
    name: 'appointments',
    columns: [
      { name: 'customer_name', type: 'text', nullable: false },
      { name: 'staff_id', type: 'text', nullable: true },
      { name: 'scheduled_at', type: 'timestamptz', nullable: false },
      { name: 'duration_min', type: 'integer', nullable: true },
      { name: 'status', type: 'text', nullable: false, default: "'scheduled'" },
      { name: 'notes', type: 'text', nullable: true },
    ],
  },
  invoices: {
    name: 'invoices',
    columns: [
      { name: 'invoice_number', type: 'text', nullable: false, unique: true },
      { name: 'client_name', type: 'text', nullable: false },
      { name: 'issue_date', type: 'date', nullable: false },
      { name: 'due_date', type: 'date', nullable: true },
      { name: 'total_amount', type: 'numeric', nullable: false },
      { name: 'paid', type: 'boolean', nullable: false, default: '0' },
    ],
  },
  expenses: {
    name: 'expenses',
    columns: [
      { name: 'description', type: 'text', nullable: false },
      { name: 'category', type: 'text', nullable: true },
      { name: 'amount', type: 'numeric', nullable: false },
      { name: 'expense_date', type: 'date', nullable: false },
      { name: 'receipt_url', type: 'text', nullable: true },
    ],
  },
  deliveries: {
    name: 'deliveries',
    columns: [
      { name: 'tracking_code', type: 'text', nullable: false, unique: true },
      { name: 'origin', type: 'text', nullable: true },
      { name: 'destination', type: 'text', nullable: false },
      { name: 'status', type: 'text', nullable: false, default: "'pending'" },
      { name: 'driver_name', type: 'text', nullable: true },
      { name: 'delivered_at', type: 'timestamptz', nullable: true },
    ],
  },
};

export function starterTableNamesForPreset(presetKey?: string | null): string[] {
  switch (presetKey) {
    case 'cashier-register':
      return ['products', 'orders'];
    case 'catalog-registrar':
      return ['products'];
    case 'inventory-manager':
      return ['inventory'];
    case 'kitchen-display':
      return ['orders'];
    case 'dispatch-console':
      return ['deliveries'];
    case 'billing-ledger':
      return ['invoices', 'expenses'];
    case 'appointment-desk':
      return ['appointments', 'customers'];
    case 'service-directory':
      return ['customers', 'staff'];
    default:
      return [];
  }
}

export async function ensureStarterBusinessTable(schemaName: string, tableName: string) {
  const starterTable = STARTER_BUSINESS_TABLES[tableName];
  if (!starterTable) {
    return { ensured: false, error: null };
  }

  const existingTables = await listBusinessTables(schemaName);
  if (existingTables.error) {
    return { ensured: false, error: existingTables.error };
  }

  let ensured = false;

  if (!(existingTables.data ?? []).includes(tableName)) {
    const sql = buildCreateTableSql(
      starterTable,
      schemaName,
      getSqlDialect(),
    );

    const result = await db.execute(sql);
    return {
      ensured: !result.error,
      error: result.error,
    };
  }

  const existingColumns = await getBusinessTableColumns(schemaName, tableName);
  if (existingColumns.error) {
    return { ensured: false, error: existingColumns.error };
  }

  const currentColumnNames = new Set((existingColumns.data ?? []).map((column) => column.name));

  for (const column of starterTable.columns) {
    if (currentColumnNames.has(column.name)) continue;

    const sql = buildAddColumnSql(
      starterTable.name,
      column,
      schemaName,
      getSqlDialect(),
    );

    const result = await db.execute(sql);
    if (result.error) {
      return { ensured, error: result.error };
    }

    ensured = true;
  }

  return { ensured, error: null };
}

export async function ensureStarterBusinessTables(schemaName: string, tableNames: string[]) {
  for (const tableName of tableNames) {
    const result = await ensureStarterBusinessTable(schemaName, tableName);
    if (result.error) return result;
  }

  return { ensured: true, error: null };
}
