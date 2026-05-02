import { defineEventHandler, readBody } from 'h3';
import { clearTerminalSession, verifyPin, verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const body = (await readBody<{ terminalId?: string; pin?: string }>(event)) ?? {};
  const session = await verifyTerminalSession(event, body.terminalId);

  if (!body.pin) {
    return { success: false, error: 'PIN is required to exit terminal mode' };
  }

  const { data: terminal } = await db.queryOne<{ pin_hash: string }>(
    'SELECT pin_hash FROM terminals WHERE id = ?',
    [session.terminalId],
  );

  if (!terminal) {
    return { success: false, error: 'Terminal not found' };
  }

  const valid = await verifyPin(body.pin, terminal.pin_hash);
  if (!valid) {
    return { success: false, error: 'Invalid PIN' };
  }

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
