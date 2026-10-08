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

export const isDevDb = process.env.DEV_MODE === 'true';

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

export async function listBusinessTables(schemaName: string) {
  if (isDevDb) {
    const result = await db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name`,
      [`${schemaName}_%`],
    );
    return {
      data: (result.data ?? []).map((row) => row.name.replace(`${schemaName}_`, '')),
      error: result.error,
    };
  }

  const result = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
    [schemaName],
  );
  return {
    data: (result.data ?? []).map((row) => row.table_name),
    error: result.error,
  };
}

export function qualifyBusinessTable(schemaName: string, tableName: string): string {
  validateIdentifier(schemaName);
  const cleanTableName = isDevDb && tableName.startsWith(`${schemaName}_`)
    ? tableName.slice(schemaName.length + 1)
    : tableName;
  validateIdentifier(cleanTableName);
  return isDevDb
    ? `${schemaName}_${cleanTableName}`
    : `"${schemaName}"."${cleanTableName}"`;
}

export function sqlPlaceholder(index: number): string {
  return isDevDb ? '?' : `$${index}`;
}

export function sqlPlaceholders(count: number, startAt = 1): string[] {
  return Array.from({ length: count }, (_, offset) => sqlPlaceholder(startAt + offset));
}

export function replacePlaceholdersForDialect(sql: string): string {
  if (!isDevDb) return sql;
  return sql.replace(/\$[0-9]+/g, '?');
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
