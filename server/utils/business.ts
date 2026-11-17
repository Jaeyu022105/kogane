import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';

export interface BusinessRecord {
  id: string;
  admin_user_id: string;
  name: string;
  schema_name: string;
  logo_url?: string | null;
  country?: string | null;
  currency?: string | null;
  currency_symbol?: string | null;
  color_palette?: string | null;
}

export interface TerminalContext {
  terminalId: string;
  businessId: string;
  displayName: string;
  role: string;
  permissions: string | null;
  schemaName: string;
  businessName: string;
}

export async function getBusinessById(businessId: string) {
  return db.queryOne<BusinessRecord>(
    'SELECT id, admin_user_id, name, schema_name, logo_url, country, currency, currency_symbol, color_palette FROM businesses WHERE id = ?',
    [businessId],
  );
}

export async function getBusinessForAdmin(userId: string, businessId: string) {
  const result = await getBusinessById(businessId);
  if (result.error || !result.data) return { ...result, data: null };
  if (result.data.admin_user_id !== userId) {
    return { data: null, error: 'Forbidden' };
  }
  return result;
}

export async function getBusinessForAdminUser(userId: string) {
  return db.queryOne<BusinessRecord>(
    'SELECT id, admin_user_id, name, schema_name, logo_url, country, currency, currency_symbol, color_palette FROM businesses WHERE admin_user_id = ?',
    [userId],
  );
}

export async function getTerminalContext(terminalId: string) {
  return db.queryOne<TerminalContext>(
    `
      SELECT
        t.id as terminalId,
        t.business_id as businessId,
        t.display_name as displayName,
        t.role as role,
        t.permissions as permissions,
        b.schema_name as schemaName,
        b.name as businessName
      FROM terminals t
      JOIN businesses b ON b.id = t.business_id
      WHERE t.id = ?
    `,
    [terminalId],
  );
}

/** Lists a business's own tables (stored as `<schema>_<table>`), without the prefix. */
export async function listBusinessTables(schemaName: string) {
  const result = await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name`,
    [`${schemaName}_%`],
  );
  return {
    data: (result.data ?? []).map((row) => row.name.replace(`${schemaName}_`, '')),
    error: result.error,
  };
}

/** Physical table name for a business table: `<schema>_<table>`. Accepts the name with or without the prefix. */
export function qualifyBusinessTable(schemaName: string, tableName: string): string {
  validateIdentifier(schemaName);
  const cleanTableName = tableName.startsWith(`${schemaName}_`)
    ? tableName.slice(schemaName.length + 1)
    : tableName;
  validateIdentifier(cleanTableName);
  return `${schemaName}_${cleanTableName}`;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
