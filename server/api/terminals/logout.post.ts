import { defineEventHandler } from 'h3';
import { clearTerminalSession, verifyTerminalSession } from '~/lib/authUtils';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const session = await verifyTerminalSession(event);

  clearTerminalSession(event);

  await writeAuditLog({
    businessId: session.businessId,
    actorType: 'inpoint',
    actorName: session.displayName,
    actionType: 'logout',
    metadata: {
      terminal_id: session.terminalId,
      role: session.role,
    },
  });

  return { success: true, error: null };
});
