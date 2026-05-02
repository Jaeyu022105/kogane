import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const terminalId = event.context.params?.id;

  if (!terminalId) {
    return { success: false, error: 'Missing terminal id' };
  }

  const { data: terminal, error } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
    created_at: string;
  }>(
    'SELECT id, business_id, display_name, role, permissions, ui_layout, created_at FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (error || !terminal) {
    return { success: false, error: error ?? 'Terminal not found' };
  }

  const { data: business } = await getBusinessForAdmin(userId, terminal.business_id);
  if (!business) {
    return { success: false, error: 'Forbidden' };
  }

  const deleted = await db.delete('terminals', { id: terminalId });
  if (deleted.error) {
    return { success: false, error: deleted.error };
  }

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'delete',
    targetTable: 'terminals',
    targetId: terminal.id,
    payloadBefore: terminal,
    metadata: {
      event: 'terminal:delete',
    },
  });

  return { success: true, error: null };
});
