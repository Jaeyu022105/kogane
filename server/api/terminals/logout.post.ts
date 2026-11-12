import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { clearTerminalSession, verifyAdmin, verifyPin, verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { writeAuditLog } from '~/server/utils/audit';

type TerminalLogoutBody = { terminalId?: string; pin?: string };

export default defineEventHandler(async (event) => {
  const body: TerminalLogoutBody =
    ((event as any)._body ?? (await readBody<TerminalLogoutBody>(event).catch((): TerminalLogoutBody => ({})))) ?? {};

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
    await clearTerminalSession(event);
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
    await clearTerminalSession(event, targetTerminalId);
    return { success: true, error: null };
  }

  // If not the owning business admin, require and verify the terminal PIN
  let isOwningAdmin = false;
  if (isAdmin && adminUserId) {
    const { data: ownedBiz } = await db.queryOne<{ id: string }>(
      'SELECT id FROM businesses WHERE id = ? AND admin_user_id = ?',
      [terminal.business_id, adminUserId],
    );
    isOwningAdmin = Boolean(ownedBiz);
  }

  if (!isOwningAdmin) {
    const pinInput = typeof body.pin === 'string' ? body.pin : '';
    if (!pinInput) {
      return { success: false, error: 'PIN is required to exit terminal mode' };
    }

    const rateWindowMs = 5 * 60 * 1000;
    const rateLimit = enforceRateLimit(event, {
      scope: 'terminal_pin',
      identifier: terminal.id,
      maxAttempts: 10,
      windowMs: rateWindowMs,
    });
    if (!rateLimit.allowed) {
      setResponseStatus(event, 429);
      return {
        success: false,
        error: `Too many PIN attempts. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
      };
    }
    const rateKey = `terminal_pin:${getClientIp(event)}:${terminal.id.toLowerCase()}`;

    let valid = await verifyPin(pinInput, terminal.pin_hash);
    if (!valid && terminal.pin_code && pinInput === terminal.pin_code) {
      valid = true;
    }

    if (!valid) {
      recordRateLimitAttempt(rateKey, rateWindowMs);
      return { success: false, error: 'Invalid PIN' };
    }

    clearRateLimit(rateKey);
  }

  await clearTerminalSession(event, targetTerminalId);

  await writeAuditLog({
    businessId: terminal.business_id,
    actorType: isOwningAdmin ? 'admin' : 'inpoint',
    actorName: isOwningAdmin ? 'Admin' : (session?.displayName || terminal.display_name),
    actionType: 'logout',
    metadata: {
      terminal_id: terminal.id,
      role: terminal.role,
      exit_mode: isOwningAdmin ? 'admin_passthrough' : 'pin_verified',
    },
  });

  return { success: true, error: null };
});
