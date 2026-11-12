/**
 * POST /api/auth/2fa/verify
 * Completes a 2FA login challenge using either a 6-digit TOTP code
 * or an 8-character single-use recovery backup code.
 * Upgrades the pending stateful session into a full verified admin session.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import {
  upgradePending2faSession,
  verifyPending2faChallenge,
} from '~/lib/authUtils';
import { db } from '~/lib/db';
import { mapUserRecordToDto, parseJsonSafe } from '~/lib/mappers';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import {
  decryptSecret,
  verifyAndConsumeBackupCode,
  verifyTotpCode,
} from '~/lib/security';

type Verify2faBody = { challengeToken?: string; code?: string };

export default defineEventHandler(async (event) => {
  const body: Verify2faBody = (await readBody<Verify2faBody>(event).catch((): Verify2faBody => ({}))) ?? {};
  const challengeToken = String(body?.challengeToken ?? '').trim();
  const code = String(body?.code ?? '').trim();

  if (!challengeToken || !code) {
    return { session: null, error: 'Challenge token and verification code are required.' };
  }

  const pending = await verifyPending2faChallenge(challengeToken);
  if (!pending) {
    return { session: null, error: '2FA challenge expired or invalid. Please sign in again.' };
  }

  const rate = enforceRateLimit(event, {
    scope: 'admin_2fa',
    identifier: pending.userId,
    maxAttempts: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      session: null,
      error: `Too many 2FA attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
    };
  }
  const rateKey = `admin_2fa:${getClientIp(event)}:${pending.userId}`;

  const { data: user } = await db.queryOne<{
    id: string;
    email: string;
    full_name?: string;
    username?: string;
    profile_photo_url?: string;
    language_preference?: string;
    two_factor_enabled?: number | boolean;
    two_factor_secret: string | null;
    two_factor_backup_codes: string | null;
  }>(
    'SELECT id, email, full_name, username, profile_photo_url, language_preference, two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE id = ?',
    [pending.userId],
  );

  if (!user || !user.two_factor_secret) {
    return { session: null, error: 'Two-factor authentication is not configured for this account.' };
  }

  const secret = decryptSecret(user.two_factor_secret);
  let verified = Boolean(secret && verifyTotpCode(secret, code));
  let usedBackupCode = false;
  let remainingBackupCodes: number | undefined;

  if (!verified) {
    const storedHashes = parseJsonSafe<string[]>(user.two_factor_backup_codes, []);
    const backupCheck = verifyAndConsumeBackupCode(code, storedHashes);
    if (backupCheck.matched) {
      verified = true;
      usedBackupCode = true;
      remainingBackupCodes = backupCheck.remainingHashes.length;
      await db.update('users', {
        two_factor_backup_codes: JSON.stringify(backupCheck.remainingHashes),
        updated_at: new Date().toISOString(),
      }, { id: user.id });
    }
  }

  if (!verified) {
    recordRateLimitAttempt(rateKey, 10 * 60 * 1000);
    return { session: null, error: 'Invalid 2FA code or recovery code.' };
  }

  clearRateLimit(rateKey);

  const upgraded = await upgradePending2faSession(event, pending.sessionId, {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    username: user.username,
  });

  const profile = mapUserRecordToDto(user as unknown as Record<string, unknown>);

  return {
    session: {
      userId: profile.id,
      email: profile.email,
      token: upgraded.token,
      sessionId: upgraded.sessionId,
      fullName: profile.fullName,
      username: profile.username,
      profilePicture: profile.profilePhotoUrl,
      languagePreference: profile.languagePreference,
      has2fa: true,
    },
    usedBackupCode,
    remainingBackupCodes,
    error: null,
  };
});
