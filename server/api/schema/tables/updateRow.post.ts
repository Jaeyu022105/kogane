import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { stripUnsafeControlChars, validateAndSanitizeRecord } from '~/lib/securityClient';
import { fetchRowById, updateBusinessRow } from '~/server/utils/businessTable';
import { writeAuditLog } from '~/server/utils/audit';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody(event);
  const { businessId, tableName, rowId, updates } = body;

  if (!businessId || !tableName || rowId === undefined || !updates) {
    return { success: false, error: 'Missing required fields' };
  }

  const cleanRowId = typeof rowId === 'string'
    ? stripUnsafeControlChars(rowId, false).slice(0, 128)
    : rowId;

  const { data: business, error: bizError } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (bizError || !business) return { success: false, error: 'Business not found' };
  if (business.admin_user_id !== userId) return { success: false, error: 'Forbidden' };

  try {
    validateIdentifier(tableName);
    const sanitizedUpdates = validateAndSanitizeRecord(updates);
    const keys = Object.keys(sanitizedUpdates);
    if (keys.length === 0) return { success: true };

    for (const key of keys) {
      validateIdentifier(key);
    }

    const before = await fetchRowById(business.schema_name, tableName, cleanRowId);
    const updated = await updateBusinessRow(business.schema_name, tableName, cleanRowId, sanitizedUpdates);
    if (updated.error) {
      return { success: false, error: updated.error };
    }

    await writeAuditLog({
      businessId,
      actorId: userId,
      actorType: 'admin',
      actorName: 'Admin',
      actionType: 'update',
      targetTable: tableName,
      targetId: String(cleanRowId),
      payloadBefore: before.data,
      payloadAfter: updated.data,
      metadata: {
        source: 'admin:schema:update-row',
      },
    });

    realtimeHub.publish(businessId, {
      table: tableName,
      action: 'update',
      recordId: String(cleanRowId),
      data: updated.data as Record<string, unknown>,
    });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});
