/**
 * POST /api/auth/change-password
 * Changes the authenticated admin user's password.
 * Verifies current password before updating to the new PBKDF2-hashed password
 * and revokes all other active sessions for security.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { db } from '~/lib/db';
import {
  hashPasswordSync,
  revokeAllUserSessions,
  verifyAdmin,
  verifyPasswordSync,
} from '~/lib/authUtils';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { hasUnsafeControlChars } from '~/lib/securityClient';

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default defineEventHandler(async (event) => {
  const { userId, email, sessionId } = await verifyAdmin(event);

  const body: ChangePasswordBody = (await readBody<ChangePasswordBody>(event).catch((): ChangePasswordBody => ({}))) ?? {};

  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword || !newPassword) {
    return { error: 'Current password and new password are required', success: false };
  }

  if (
    hasUnsafeControlChars(currentPassword, false) || currentPassword.length > 255 ||
    hasUnsafeControlChars(newPassword, false) || newPassword.length > 255 ||
    hasUnsafeControlChars(confirmPassword, false) || confirmPassword.length > 255
  ) {
    return { error: 'Password contains invalid characters or exceeds maximum length', success: false };
  }

  if (newPassword.trim().length < 6) {
    return { error: 'New password must be at least 6 characters long', success: false };
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return { error: 'New passwords do not match', success: false };
  }

  const rateWindowMs = 10 * 60 * 1000;
  const rate = enforceRateLimit(event, {
    scope: 'admin_change_password',
    identifier: userId,
    maxAttempts: 8,
    windowMs: rateWindowMs,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      error: `Too many password change attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
      success: false,
    };
  }
  const rateKey = `admin_change_password:${getClientIp(event)}:${userId.toLowerCase()}`;

  const { data: user, error: userErr } = await db.queryOne<{
    id: string;
    password_hash: string;
  }>('SELECT id, password_hash FROM users WHERE id = ?', [userId]);

  if (userErr || !user) {
    return { error: 'User account not found', success: false };
  }

  const isMatch = verifyPasswordSync(currentPassword, user.password_hash);
  if (!isMatch) {
    recordRateLimitAttempt(rateKey, rateWindowMs);
    return { error: 'Current password is incorrect', success: false };
  }

  clearRateLimit(rateKey);

  const newHash = hashPasswordSync(newPassword);
  const { error: updateErr } = await db.update('users', {
    password_hash: newHash,
    updated_at: new Date().toISOString(),
  }, { id: userId });

  if (updateErr) {
    return { error: 'Failed to update password. Please try again.', success: false };
  }

  // Revoke all other sessions on password change
  await revokeAllUserSessions(userId, sessionId);

  return { success: true, message: 'Password updated successfully', error: null };
});
