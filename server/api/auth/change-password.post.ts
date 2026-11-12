/**
 * POST /api/auth/change-password
 * Changes the authenticated admin user's password.
 * Verifies current password before updating to the new PBKDF2-hashed password
 * and revokes all other active sessions for security.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { db, getDbProvider } from '~/lib/db';
import {
  hashPasswordSync,
  revokeAllUserSessions,
  verifyAdmin,
  verifyPasswordSync,
} from '~/lib/authUtils';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { createClient } from '@supabase/supabase-js';

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default defineEventHandler(async (event) => {
  const { userId, email, sessionId } = await verifyAdmin(event);

  const body: ChangePasswordBody = (await readBody<ChangePasswordBody>(event).catch((): ChangePasswordBody => ({}))) ?? {};

  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;
  const confirmPassword = body?.confirmPassword;

  if (!currentPassword || !newPassword) {
    return { error: 'Current password and new password are required', success: false };
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

  // Cloud Supabase mode
  if (getDbProvider() === 'supabase') {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
      );

      if (email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (signInErr) {
          recordRateLimitAttempt(rateKey, rateWindowMs);
          return { error: 'Current password is incorrect', success: false };
        }
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        return { error: updateErr.message || 'Failed to update password', success: false };
      }

      clearRateLimit(rateKey);
      return { success: true, message: 'Password updated successfully', error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update password', success: false };
    }
  }

  // SQLite & Firebase Firestore mode
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
