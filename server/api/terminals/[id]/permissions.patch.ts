import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { normalizePermissions, type TerminalPermissions } from '~/lib/permissions';
import { db } from '~/lib/db';
import { getBusinessForAdmin } from '~/server/utils/business';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const terminalId = event.context.params?.id;
  const body = await readBody<{ businessId: string; permissions: TerminalPermissions }>(event);

  if (!terminalId || !body.businessId || !body.permissions) {
    return { success: false, error: 'Missing required fields' };
  }

  const { data: business } = await getBusinessForAdmin(userId, body.businessId);
  if (!business) return { success: false, error: 'Forbidden' };

  const normalized = normalizePermissions(body.permissions);

  const { data: existing } = await db.queryOne<Record<string, unknown>>(
    'SELECT id, permissions FROM terminals WHERE id = ? AND business_id = ?',
    [terminalId, body.businessId],
  );

  if (!existing) return { success: false, error: 'Terminal not found' };

  const { error } = await db.update('terminals', {
    permissions: JSON.stringify(normalized),
  }, {
    id: terminalId,
  });

  if (error) return { success: false, error };

  await writeAuditLog({
    businessId: body.businessId,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'update',
    targetTable: 'terminals',
    targetId: terminalId,
    payloadBefore: existing,
    payloadAfter: normalized,
    metadata: {
      event: 'terminal:permissions:update',
    },
  });

  return { success: true, error: null };
});
