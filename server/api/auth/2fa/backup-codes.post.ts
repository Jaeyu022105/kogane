/**
 * POST /api/auth/2fa/backup-codes
 * Regenerates 8 fresh hashed backup recovery codes after verifying current password.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { verifyAdmin, verifyPasswordSync } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { generateBackupCodes } from '~/lib/security';

type BackupCodesBody = { password?: string };

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body: BackupCodesBody = (await readBody<BackupCodesBody>(event).catch((): BackupCodesBody => ({}))) ?? {};

  if (!body?.password) {
    return { backupCodes: [], error: 'Current password is required to regenerate backup codes.' };
  }

  const rateWindowMs = 10 * 60 * 1000;
  const rate = enforceRateLimit(event, {
    scope: 'admin_2fa_backup_codes',
    identifier: userId,
    maxAttempts: 8,
    windowMs: rateWindowMs,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      backupCodes: [],
      error: `Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
    };
  }
  const rateKey = `admin_2fa_backup_codes:${getClientIp(event)}:${userId.toLowerCase()}`;

  const { data: user } = await db.queryOne<{
    id: string;
    password_hash: string;
    two_factor_enabled?: number | boolean;
  }>(
    'SELECT id, password_hash, two_factor_enabled FROM users WHERE id = ?',
    [userId],
  );

  if (!user) {
    return { backupCodes: [], error: 'User account not found.' };
  }

  if (!(user.two_factor_enabled === 1 || user.two_factor_enabled === true)) {
    return { backupCodes: [], error: 'Enable 2FA before generating backup codes.' };
  }

  if (!verifyPasswordSync(body.password, user.password_hash)) {
    recordRateLimitAttempt(rateKey, rateWindowMs);
    return { backupCodes: [], error: 'Current password is incorrect.' };
  }

  clearRateLimit(rateKey);

  const { plainCodes, hashedCodes } = generateBackupCodes(8);
  const { error: updateErr } = await db.update('users', {
    two_factor_backup_codes: JSON.stringify(hashedCodes),
    updated_at: new Date().toISOString(),
  }, { id: userId });

  if (updateErr) {
    return { backupCodes: [], error: 'Failed to regenerate backup codes.' };
  }

  return { backupCodes: plainCodes, error: null };
});
