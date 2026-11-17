/**
 * GET /api/schema/tables/rows
 * Returns column definitions and paginated rows for a specific user table.
 */

import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { qualifyBusinessTable } from '~/server/utils/business';
import { getBusinessTableColumns } from '~/server/utils/businessTable';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const { businessId, tableName, page, limit } = getQuery(event) as {
    businessId: string;
    tableName: string;
    page?: string;
    limit?: string;
  };

  if (!businessId || !tableName) {
    return { columns: null, rows: null, total: 0, error: 'Missing businessId or tableName' };
  }

  const { data: business, error: bizErr } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (bizErr || !business) return { columns: null, rows: null, total: 0, error: 'Business not found' };
  if (business.admin_user_id !== userId) return { columns: null, rows: null, total: 0, error: 'Forbidden' };

  try {
    validateIdentifier(tableName);
    validateIdentifier(business.schema_name);
  } catch (err) {
    return { columns: null, rows: null, total: 0, error: (err as Error).message };
  }

  const rawPage = Number.parseInt(String(page ?? '1'), 10);
  const rawLimit = Number.parseInt(String(limit ?? '50'), 10);
  const pageNum = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, rawLimit) : 50;
  const offset = (pageNum - 1) * pageSize;

  const fqTable = qualifyBusinessTable(business.schema_name, tableName);

  const { data: columns } = await getBusinessTableColumns(business.schema_name, tableName);

  const { data: countData } = await db.queryOne<{ c: number | string }>(
    `SELECT COUNT(*) as c FROM ${fqTable}`,
    [],
  );
  const total = Number(countData?.c ?? 0);

  const { data: rowData } = await db.query<Record<string, unknown>>(
    `SELECT * FROM ${fqTable} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );

  return { columns: columns ?? [], rows: rowData ?? [], total, error: null };
});
