import { db } from '~/lib/db';
import { buildAddColumnSql, buildCreateTableSql, type TableDef } from '~/lib/schemaUtils';
import { isDevDb, listBusinessTables } from '~/server/utils/business';
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
      { name: 'total', type: 'numeric', nullable: false },
      { name: 'status', type: 'text', nullable: false, default: "'pending'" },
      { name: 'table_number', type: 'text', nullable: true },
      { name: 'staff_name', type: 'text', nullable: true },
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
      isDevDb ? 'sqlite' : 'postgres',
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
      isDevDb ? 'sqlite' : 'postgres',
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
