import { defineEventHandler, readBody } from 'h3';
import { clearTerminalSession, verifyAdmin, verifyPin, verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const body = ((event as any)._body ?? (await readBody<{ terminalId?: string; pin?: string }>(event).catch(() => ({})))) ?? {};

  // Check if caller is an authenticated business owner/admin
  let isAdmin = false;
  let adminUserId: string | null = null;
  try {
    const admin = await verifyAdmin(event);
    if (admin.userId) {
      isAdmin = true;
      adminUserId = admin.userId;
    }
  } catch {
    isAdmin = false;
  }

  let session: any = null;
  try {
    session = await verifyTerminalSession(event, body.terminalId);
  } catch {
    // If admin is calling, terminal session might be expired or missing
  }

  const targetTerminalId = body.terminalId || session?.terminalId;
  if (!targetTerminalId) {
    clearTerminalSession(event);
    return { success: true, error: null };
  }

  const { data: terminal } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    pin_hash: string;
    pin_code: string | null;
  }>(
    'SELECT id, business_id, display_name, role, pin_hash, pin_code FROM terminals WHERE id = ?',
    [targetTerminalId],
  );

  if (!terminal) {
    clearTerminalSession(event);
    return { success: true, error: null };
  }

  // If not admin, require and verify the terminal PIN
  if (!isAdmin) {
    if (!body.pin) {
      return { success: false, error: 'PIN is required to exit terminal mode' };
    }

    let valid = await verifyPin(body.pin, terminal.pin_hash);
    if (!valid && terminal.pin_code && body.pin === terminal.pin_code) {
      valid = true;
    }

    if (!valid) {
      return { success: false, error: 'Invalid PIN' };
    }
  }

  clearTerminalSession(event);

  await writeAuditLog({
    businessId: terminal.business_id,
    actorType: isAdmin ? 'admin' : 'inpoint',
    actorName: isAdmin ? 'Admin' : (session?.displayName || terminal.display_name),
    actionType: 'logout',
    metadata: {
      terminal_id: terminal.id,
      role: terminal.role,
      exit_mode: isAdmin ? 'admin_passthrough' : 'pin_verified',
    },
  });

  return { success: true, error: null };
});
