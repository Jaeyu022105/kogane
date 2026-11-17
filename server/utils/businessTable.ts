import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { stripUnsafeControlChars, validateAndSanitizeRecord } from '~/lib/securityClient';
import { qualifyBusinessTable } from '~/server/utils/business';

function validateColumns(columns: string[]) {
  for (const column of columns) validateIdentifier(column);
}

function serializeBusinessValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return stripUnsafeControlChars(JSON.stringify(value), true);
  }
  if (typeof value === 'string') return stripUnsafeControlChars(value, true);
  return value;
}

export async function fetchRowById<T = Record<string, unknown>>(schemaName: string, tableName: string, rowId: unknown) {
  validateIdentifier(tableName);
  const cleanRowId = typeof rowId === 'string' ? stripUnsafeControlChars(rowId, false) : rowId;
  const table = qualifyBusinessTable(schemaName, tableName);
  const sql = `SELECT * FROM ${table} WHERE id = ? LIMIT 1`;
  return db.queryOne<T>(sql, [cleanRowId]);
}

export async function insertBusinessRow<T = Record<string, unknown>>(schemaName: string, tableName: string, values: Record<string, unknown>) {
  validateIdentifier(tableName);
  const sanitized = validateAndSanitizeRecord(values);
  const keys = Object.keys(sanitized);
  validateColumns(keys);

  const table = qualifyBusinessTable(schemaName, tableName);
  const columns = keys.map((key) => `"${key}"`).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;

  return db.queryOne<T>(sql, Object.values(sanitized).map(serializeBusinessValue));
}

export async function updateBusinessRow<T = Record<string, unknown>>(schemaName: string, tableName: string, rowId: unknown, values: Record<string, unknown>) {
  validateIdentifier(tableName);
  const sanitized = validateAndSanitizeRecord(values);
  const keys = Object.keys(sanitized);
  validateColumns(keys);
  const cleanRowId = typeof rowId === 'string' ? stripUnsafeControlChars(rowId, false) : rowId;

  const table = qualifyBusinessTable(schemaName, tableName);
  const setClause = keys
    .map((key, index) => `"${key}" = ?`)
    .join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ? RETURNING *`;

  return db.queryOne<T>(sql, [...Object.values(sanitized).map(serializeBusinessValue), cleanRowId]);
}

export async function deleteBusinessRow<T = Record<string, unknown>>(schemaName: string, tableName: string, rowId: unknown) {
  validateIdentifier(tableName);
  const cleanRowId = typeof rowId === 'string' ? stripUnsafeControlChars(rowId, false) : rowId;
  const table = qualifyBusinessTable(schemaName, tableName);
  const sql = `DELETE FROM ${table} WHERE id = ? RETURNING *`;

  return db.queryOne<T>(sql, [cleanRowId]);
}

export async function queryBusinessRows<T = Record<string, unknown>>(
  schemaName: string,
  tableName: string,
  columns: string[],
  options?: {
    where?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    descending?: boolean;
  },
) {
  validateIdentifier(tableName);
  const selectedColumns = columns.length > 0
    ? (columns.includes('*') || columns.includes('id') ? [...columns] : ['id', ...columns])
    : ['*'];
  if (!(selectedColumns.length === 1 && selectedColumns[0] === '*')) {
    validateColumns(selectedColumns);
  }

  const table = qualifyBusinessTable(schemaName, tableName);
  const params: unknown[] = [];

  let whereClause = '';
  if (options?.where && Object.keys(options.where).length > 0) {
    const sanitizedWhere = validateAndSanitizeRecord(options.where, {
      maxDepth: 3,
      maxStringLength: 1000,
      maxObjectKeys: 20,
    });
    validateColumns(Object.keys(sanitizedWhere));
    const conditions = Object.keys(sanitizedWhere).map((key) => {
      params.push(serializeBusinessValue(sanitizedWhere[key]));
      return `"${key}" = ?`;
    });
    whereClause = ` WHERE ${conditions.join(' AND ')}`;
  }

  let orderClause = '';
  if (options?.orderBy) {
    validateIdentifier(options.orderBy);
    orderClause = ` ORDER BY "${options.orderBy}" ${options.descending === false ? 'ASC' : 'DESC'}`;
  }

  let paginationClause = '';
  const parsedLimit = Number(options?.limit);
  const parsedOffset = Number(options?.offset);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 200) : 50;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.floor(parsedOffset) : 0;

  params.push(limit);
  paginationClause += ` LIMIT ?`;
  if (offset > 0) {
    params.push(offset);
    paginationClause += ` OFFSET ?`;
  }

  const columnList = selectedColumns.map((column) => column === '*' ? '*' : `"${column}"`).join(', ');
  const sql = `SELECT ${columnList} FROM ${table}${whereClause}${orderClause}${paginationClause}`;

  return db.query<T>(sql, params);
}

export async function getBusinessTableColumns(schemaName: string, tableName: string) {
  validateIdentifier(tableName);

  const table = qualifyBusinessTable(schemaName, tableName);
  const result = await db.query<{ name: string; type: string }>(`PRAGMA table_info(${table})`);
  return {
    data: (result.data ?? []).map((column) => ({
      name: column.name,
      type: column.type,
    })),
    error: result.error,
  };
}
