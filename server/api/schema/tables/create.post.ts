/**
 * POST /api/schema/tables/create
 * Creates a new user-defined table inside the business schema.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { buildCreateTableSql, validateTableDef } from '~/lib/schemaUtils';
import type { TableDef } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ businessId: string; table: TableDef }>(event);

  if (!body.businessId || !body.table) {
    return { error: 'Missing businessId or table definition', success: false };
  }

  // Validate all identifiers before touching the DB
  try {
    validateTableDef(body.table);
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
  const sql       = buildCreateTableSql(body.table, business.schema_name, dialect);

  const { error } = await db.execute(sql);

  if (error) return { error, success: false };

  return { success: true, error: null };
});
