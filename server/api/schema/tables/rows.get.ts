/**
 * GET /api/schema/tables/rows
 * Returns column definitions and paginated rows for a specific user table.
 */

import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const { businessId, tableName, page, limit } = getQuery(event) as {
    businessId: string;
    tableName:  string;
    page?:      string;
    limit?:     string;
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

  const isDevMode = process.env.DEV_MODE === 'true';
  const pageNum   = Math.max(1, parseInt(page ?? '1', 10));
  const pageSize  = Math.min(200, parseInt(limit ?? '50', 10));
  const offset    = (pageNum - 1) * pageSize;

  let columns: { name: string; type: string }[] = [];
  let rows:    Record<string, unknown>[]         = [];
  let total    = 0;

  if (isDevMode) {
    const fqTable = `${business.schema_name}_${tableName}`;

    const { data: colData } = await db.query<{ name: string; type: string }>(
      `PRAGMA table_info(${fqTable})`,
      [],
    );
    columns = (colData ?? []).map(c => ({ name: c.name, type: c.type }));

    const { data: countData } = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) as c FROM ${fqTable}`,
      [],
    );
    total = countData?.c ?? 0;

    const { data: rowData } = await db.query<Record<string, unknown>>(
      `SELECT * FROM ${fqTable} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );
    rows = rowData ?? [];
  } else {
    const schema  = business.schema_name;
    const fqTable = `"${schema}"."${tableName}"`;

    const { data: colData } = await db.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, tableName],
    );
    columns = (colData ?? []).map(c => ({ name: c.column_name, type: c.data_type }));

    const { data: countData } = await db.queryOne<{ c: string }>(
      `SELECT COUNT(*) as c FROM ${fqTable}`,
      [],
    );
    total = parseInt(countData?.c ?? '0', 10);

    const { data: rowData } = await db.query<Record<string, unknown>>(
      `SELECT * FROM ${fqTable} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    rows = rowData ?? [];
  }

  return { columns, rows, total, error: null };
});
