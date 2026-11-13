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

  const { data: existing } = await db.queryOne<{
    id: string;
    display_name?: string | null;
    role?: string | null;
    permissions: string | null;
  }>(
    'SELECT id, display_name, role, permissions FROM terminals WHERE id = ? AND business_id = ?',
    [terminalId, body.businessId],
  );

  if (!existing) return { success: false, error: 'Terminal not found' };

  const hasStoredPermissions = Boolean(existing.permissions && existing.permissions !== '{}');
  const permissionsBefore = normalizePermissions(
    existing.permissions,
    hasStoredPermissions ? undefined : existing.role,
  );

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
    payloadBefore: permissionsBefore,
    payloadAfter: normalized,
    metadata: {
      event: 'terminal:permissions:update',
      terminal_name: existing.display_name ?? null,
    },
  });

  return { success: true, error: null };
});
