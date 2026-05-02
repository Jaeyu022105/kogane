import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import {
  isDevDb,
  qualifyBusinessTable,
  replacePlaceholdersForDialect,
  sqlPlaceholder,
  sqlPlaceholders,
} from '~/server/utils/business';

function validateColumns(columns: string[]) {
  for (const column of columns) validateIdentifier(column);
}

function serializeBusinessValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

export async function fetchRowById<T = Record<string, unknown>>(schemaName: string, tableName: string, rowId: unknown) {
  validateIdentifier(tableName);
  const table = qualifyBusinessTable(schemaName, tableName);
  const sql = replacePlaceholdersForDialect(`SELECT * FROM ${table} WHERE id = ${sqlPlaceholder(1)} LIMIT 1`);
  return db.queryOne<T>(sql, [rowId]);
}

export async function insertBusinessRow<T = Record<string, unknown>>(schemaName: string, tableName: string, values: Record<string, unknown>) {
  validateIdentifier(tableName);
  const keys = Object.keys(values);
  validateColumns(keys);

  const table = qualifyBusinessTable(schemaName, tableName);
  const columns = keys.map((key) => `"${key}"`).join(', ');
  const placeholders = sqlPlaceholders(keys.length).join(', ');
  const sql = replacePlaceholdersForDialect(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
  );

  return db.queryOne<T>(sql, Object.values(values).map(serializeBusinessValue));
}

export async function updateBusinessRow<T = Record<string, unknown>>(schemaName: string, tableName: string, rowId: unknown, values: Record<string, unknown>) {
  validateIdentifier(tableName);
  const keys = Object.keys(values);
  validateColumns(keys);

  const table = qualifyBusinessTable(schemaName, tableName);
  const setClause = keys
    .map((key, index) => `"${key}" = ${sqlPlaceholder(index + 1)}`)
    .join(', ');
  const sql = replacePlaceholdersForDialect(
    `UPDATE ${table} SET ${setClause} WHERE id = ${sqlPlaceholder(keys.length + 1)} RETURNING *`,
  );

  return db.queryOne<T>(sql, [...Object.values(values).map(serializeBusinessValue), rowId]);
}

export async function deleteBusinessRow<T = Record<string, unknown>>(schemaName: string, tableName: string, rowId: unknown) {
  validateIdentifier(tableName);
  const table = qualifyBusinessTable(schemaName, tableName);
  const sql = replacePlaceholdersForDialect(
    `DELETE FROM ${table} WHERE id = ${sqlPlaceholder(1)} RETURNING *`,
  );

  return db.queryOne<T>(sql, [rowId]);
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
  const selectedColumns = columns.length > 0 ? columns : ['*'];
  if (!(selectedColumns.length === 1 && selectedColumns[0] === '*')) {
    validateColumns(selectedColumns);
  }

  const table = qualifyBusinessTable(schemaName, tableName);
  const params: unknown[] = [];

  let whereClause = '';
  if (options?.where && Object.keys(options.where).length > 0) {
    validateColumns(Object.keys(options.where));
    const conditions = Object.keys(options.where).map((key) => {
      params.push(options.where?.[key]);
      return `"${key}" = ${sqlPlaceholder(params.length)}`;
    });
    whereClause = ` WHERE ${conditions.join(' AND ')}`;
  }

  let orderClause = '';
  if (options?.orderBy) {
    validateIdentifier(options.orderBy);
    orderClause = ` ORDER BY "${options.orderBy}" ${options.descending === false ? 'ASC' : 'DESC'}`;
  }

  let paginationClause = '';
  if (options?.limit != null) {
    params.push(options.limit);
    paginationClause += ` LIMIT ${sqlPlaceholder(params.length)}`;
  }
  if (options?.offset != null) {
    params.push(options.offset);
    paginationClause += ` OFFSET ${sqlPlaceholder(params.length)}`;
  }

  const sql = replacePlaceholdersForDialect(
    `SELECT ${selectedColumns.map((column) => column === '*' ? '*' : `"${column}"`).join(', ')} FROM ${table}${whereClause}${orderClause}${paginationClause}`,
  );

  return db.query<T>(sql, params);
}

export async function getBusinessTableColumns(schemaName: string, tableName: string) {
  validateIdentifier(tableName);

  if (isDevDb) {
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

  const result = await db.query<{ column_name: string; data_type: string }>(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
    [schemaName, tableName],
  );

  return {
    data: (result.data ?? []).map((column) => ({
      name: column.column_name,
      type: column.data_type,
    })),
    error: result.error,
  };
}
