/**
 * DELETE /api/schema/tables/delete
 * Drops a user-defined table from the business schema.
 * Requires explicit confirmation in the body to prevent accidents.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { buildDropTableSql, validateIdentifier } from '~/lib/schemaUtils';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ businessId: string; tableName: string; confirm: boolean }>(event);

  if (!body.businessId || !body.tableName || !body.confirm) {
    return { error: 'Missing required fields or confirmation', success: false };
  }

  try {
    validateIdentifier(body.tableName);
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
  const dialect = isDevMode ? 'sqlite' : 'postgres';
  const sql = buildDropTableSql(body.tableName, business.schema_name, dialect);

  const { error } = await db.execute(sql);

  if (error) return { error, success: false };

  await writeAuditLog({
    businessId: body.businessId,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'schema:drop',
    targetTable: body.tableName,
    metadata: {
      tableName: body.tableName,
    },
  });

  return { success: true, error: null };
});
