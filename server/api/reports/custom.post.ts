import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { limitSqlRows, validateReadOnlySql } from '~/lib/sql';
import { getBusinessForAdminUser, isDevDb, listBusinessTables } from '~/server/utils/business';

function qualifySqlTables(sql: string, schemaName: string, tables: string[]): string {
  return tables.reduce((currentSql, table) => {
    const qualified = isDevDb
      ? `${schemaName}_${table}`
      : `"${schemaName}"."${table}"`;
    return currentSql.replace(new RegExp(`\\b${table}\\b`, 'g'), qualified);
  }, sql);
}

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return { columns: [], rows: [], error: 'Business not found' };
  }

  const body = await readBody<{ sql: string }>(event);
  const validated = validateReadOnlySql(body.sql);
  const tablesResult = await listBusinessTables(businessResult.data.schema_name);
  const qualifiedSql = qualifySqlTables(validated, businessResult.data.schema_name, tablesResult.data ?? []);
  const limitedSql = limitSqlRows(qualifiedSql, 1000);
  const result = await db.query<Record<string, unknown>>(limitedSql);
  const rows = result.data ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    columns,
    rows,
    error: result.error ?? null,
  };
});
