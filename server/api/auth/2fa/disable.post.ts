/**
 * POST /api/auth/2fa/disable
 * Disables 2FA after verifying both the admin's password and a valid TOTP/backup code.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { revokeAllUserSessions, verifyAdmin, verifyPasswordSync } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { parseJsonSafe } from '~/lib/mappers';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { decryptSecret, verifyAndConsumeBackupCode, verifyTotpCode } from '~/lib/security';

type Disable2faBody = { password?: string; code?: string };

export default defineEventHandler(async (event) => {
  const { userId, sessionId } = await verifyAdmin(event);
  const body: Disable2faBody = (await readBody<Disable2faBody>(event).catch((): Disable2faBody => ({}))) ?? {};

  const password = body?.password;
  const code = String(body?.code ?? '').trim();

  if (!password || !code) {
    return { disabled: false, error: 'Current password and 2FA code are required.' };
  }

  const rateWindowMs = 10 * 60 * 1000;
  const rate = enforceRateLimit(event, {
    scope: 'admin_2fa_disable',
    identifier: userId,
    maxAttempts: 8,
    windowMs: rateWindowMs,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      disabled: false,
      error: `Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
    };
  }
  const rateKey = `admin_2fa_disable:${getClientIp(event)}:${userId.toLowerCase()}`;

  const { data: user } = await db.queryOne<{
    id: string;
    password_hash: string;
    two_factor_enabled?: number | boolean;
    two_factor_secret: string | null;
    two_factor_backup_codes: string | null;
  }>(
    'SELECT id, password_hash, two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE id = ?',
    [userId],
  );

  if (!user) {
    return { disabled: false, error: 'User account not found.' };
  }

  if (!verifyPasswordSync(password, user.password_hash)) {
    recordRateLimitAttempt(rateKey, rateWindowMs);
    return { disabled: false, error: 'Current password is incorrect.' };
  }

  const secret = decryptSecret(user.two_factor_secret);
  let codeValid = Boolean(secret && verifyTotpCode(secret, code));
  if (!codeValid) {
    const storedHashes = parseJsonSafe<string[]>(user.two_factor_backup_codes, []);
    codeValid = verifyAndConsumeBackupCode(code, storedHashes).matched;
  }

  if (!codeValid) {
    recordRateLimitAttempt(rateKey, rateWindowMs);
    return { disabled: false, error: 'Invalid 2FA or backup code.' };
  }

  clearRateLimit(rateKey);

  const { error: updateErr } = await db.update('users', {
    two_factor_enabled: 0,
    two_factor_secret: null,
    two_factor_backup_codes: null,
    updated_at: new Date().toISOString(),
  }, { id: userId });

  if (updateErr) {
    return { disabled: false, error: 'Failed to disable 2FA.' };
  }

  await revokeAllUserSessions(userId, sessionId);
  return { disabled: true, error: null };
});
