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
import { ensureStarterBusinessTable } from '~/server/utils/starterTables';
import { insertBusinessRow } from '~/server/utils/businessTable';

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

  await ensureStarterBusinessTable(business.schema_name, body.tableName);

  const values = { ...body.values };
  if (body.tableName === 'products') {
    if (values.name != null) {
      values.name = String(values.name).trim();
    }
    if (values.price != null) {
      const rawPrice = String(values.price).trim().replace(/^[$\s]+/, '').replace(/,/g, '').trim();
      const num = Number(rawPrice);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        values.price = num;
      }
    }
    if (values.available === undefined || values.available === null) {
      values.available = 1;
    } else {
      const av = values.available;
      values.available = (av === 1 || av === true || av === '1' || av === 'true') ? 1 : 0;
    }
  }

  const { data, error } = await insertBusinessRow(business.schema_name, body.tableName, values);

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
