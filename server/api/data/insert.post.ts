/**
 * POST /api/data/insert
 * Inserts a record into a user-defined table.
 * Used by CartWidgetEl and any form-based element actions.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { writeAuditLog } from '~/server/utils/audit';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    businessId: string;
    tableName: string;
    values: Record<string, unknown>;
  }>(event);

  if (!body.businessId || !body.tableName || !body.values) {
    return { data: null, error: 'Missing required fields' };
  }

  try {
    validateIdentifier(body.tableName);
    for (const key of Object.keys(body.values)) validateIdentifier(key);
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }

  const { data: business, error: bizErr } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [body.businessId],
  );

  if (bizErr || !business) return { data: null, error: 'Business not found' };
  if (business.admin_user_id !== userId) return { data: null, error: 'Forbidden' };

  const isDevMode = process.env.DEV_MODE === 'true';

  // In dev mode, pass the full prefixed table name via the schema parameter
  const { data, error } = isDevMode
    ? await db.insert(body.tableName, body.values, business.schema_name)
    : await db.insert(body.tableName, body.values, business.schema_name);

  if (!error && data) {
    await writeAuditLog({
      businessId: body.businessId,
      actorId: userId,
      actorType: 'admin',
      actorName: 'Admin',
      actionType: 'insert',
      targetTable: body.tableName,
      targetId: (data as any).id ?? null,
      payloadAfter: data,
      metadata: {
        source: 'admin:data:insert',
      },
    });

    realtimeHub.publish(body.businessId, {
      table: body.tableName,
      action: 'insert',
      recordId: (data as any)?.id ?? null,
      data: data as Record<string, unknown>,
    });
  }

  return { data: data ?? null, error: error ?? null };
});
