/**
 * POST /api/schema/tables/update
 * Adds columns to an existing user-defined table (ALTER TABLE ADD COLUMN).
 * Column removal is intentionally not supported to prevent data loss.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { buildAddColumnSql, validateIdentifier } from '~/lib/schemaUtils';
import type { ColumnDef } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ businessId: string; tableName: string; addColumns: ColumnDef[] }>(event);

  if (!body.businessId || !body.tableName || !body.addColumns?.length) {
    return { error: 'Missing required fields', success: false };
  }

  try {
    validateIdentifier(body.tableName);
    for (const col of body.addColumns) validateIdentifier(col.name);
  } catch (err) {
    return { error: (err as Error).message, success: false };
  }

  const { data: business, error: bizErr } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [body.businessId],
  );

  if (bizErr || !business) return { error: 'Business not found', success: false };
  if (business.admin_user_id !== userId) return { error: 'Forbidden', success: false };

  const isDevMode = process.env.DEV_MODE === 'true';
  const dialect   = isDevMode ? 'sqlite' : 'postgres';

  for (const col of body.addColumns) {
    const sql     = buildAddColumnSql(body.tableName, col, business.schema_name, dialect);
    const { error } = await db.execute(sql);
    if (error) return { error: `Failed to add column "${col.name}": ${error}`, success: false };
  }

  return { success: true, error: null };
});
