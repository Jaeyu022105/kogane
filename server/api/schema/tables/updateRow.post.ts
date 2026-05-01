import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { fetchRowById, updateBusinessRow } from '~/server/utils/businessTable';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody(event);
  const { businessId, tableName, rowId, updates } = body;

  if (!businessId || !tableName || rowId === undefined || !updates) {
    return { success: false, error: 'Missing required fields' };
  }

  const { data: business, error: bizError } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (bizError || !business) return { success: false, error: 'Business not found' };
  if (business.admin_user_id !== userId) return { success: false, error: 'Forbidden' };

  try {
    validateIdentifier(tableName);
    const keys = Object.keys(updates);
    if (keys.length === 0) return { success: true };

    for (const key of keys) {
      validateIdentifier(key);
    }

    const before = await fetchRowById(business.schema_name, tableName, rowId);
    const updated = await updateBusinessRow(business.schema_name, tableName, rowId, updates);
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
      targetId: String(rowId),
      payloadBefore: before.data,
      payloadAfter: updated.data,
      metadata: {
        source: 'admin:schema:update-row',
      },
    });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});
