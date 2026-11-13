/**
 * POST /api/auth/2fa/enable
 * Verifies a 6-digit TOTP code against the user's pending encrypted secret,
 * activates 2FA, and issues 8 single-use hashed backup recovery codes.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import {
  decryptSecret,
  generateBackupCodes,
  verifyTotpCode,
} from '~/lib/security';
import { hasUnsafeControlChars } from '~/lib/securityClient';

type Enable2faBody = { code?: string };

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body: Enable2faBody = (await readBody<Enable2faBody>(event).catch((): Enable2faBody => ({}))) ?? {};
  const rawCode = typeof body?.code === 'string' ? body.code : '';
  if (hasUnsafeControlChars(rawCode, false) || rawCode.length > 64) {
    return { enabled: false, backupCodes: [], error: 'Please enter a valid 6-digit verification code.' };
  }
  const code = rawCode.trim();

  if (!/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
    return { enabled: false, backupCodes: [], error: 'Please enter a valid 6-digit verification code.' };
  }

  const rateWindowMs = 10 * 60 * 1000;
  const rate = enforceRateLimit(event, {
    scope: 'admin_2fa_enable',
    identifier: userId,
    maxAttempts: 8,
    windowMs: rateWindowMs,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      enabled: false,
      backupCodes: [],
      error: `Too many verification attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
    };
  }
  const rateKey = `admin_2fa_enable:${getClientIp(event)}:${userId.toLowerCase()}`;

  const { data: user } = await db.queryOne<{
    id: string;
    two_factor_secret: string | null;
    two_factor_enabled?: number | boolean;
  }>(
    'SELECT id, two_factor_secret, two_factor_enabled FROM users WHERE id = ?',
    [userId],
  );

  if (!user || !user.two_factor_secret) {
    return { enabled: false, backupCodes: [], error: 'No 2FA setup is in progress. Generate a QR code first.' };
  }

  const secret = decryptSecret(user.two_factor_secret);
  if (!secret || !verifyTotpCode(secret, code)) {
    recordRateLimitAttempt(rateKey, rateWindowMs);
    return { enabled: false, backupCodes: [], error: 'Invalid verification code. Check your authenticator clock and try again.' };
  }

  clearRateLimit(rateKey);

  const { plainCodes, hashedCodes } = generateBackupCodes(8);
  const nowIso = new Date().toISOString();

  const { error: updateErr } = await db.update('users', {
    two_factor_enabled: 1,
    two_factor_backup_codes: JSON.stringify(hashedCodes),
    two_factor_verified_at: nowIso,
    updated_at: nowIso,
  }, { id: userId });

  if (updateErr) {
    return { enabled: false, backupCodes: [], error: 'Failed to enable 2FA.' };
  }

  return {
    enabled: true,
    backupCodes: plainCodes,
    error: null,
  };
});
