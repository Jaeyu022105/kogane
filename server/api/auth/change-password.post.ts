/**
 * POST /api/auth/change-password
 * Changes the authenticated admin user's password.
 * Verifies current password before updating to the new hashed password.
 */

import { defineEventHandler, readBody } from 'h3';
import { db } from '~/lib/db';
import { hashPasswordSync, verifyAdmin, verifyPasswordSync } from '~/lib/authUtils';
import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const { userId, email } = await verifyAdmin(event);

  const body = await readBody<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>(event);

  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;
  const confirmPassword = body?.confirmPassword;

  if (!currentPassword || !newPassword) {
    return { error: 'Current password and new password are required', success: false };
  }

  if (newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters long', success: false };
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return { error: 'New passwords do not match', success: false };
  }

  const isDevMode = process.env.DEV_MODE === 'true';
  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  // Cloud Supabase mode
  if (!isDevMode && hasSupabase) {
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
          return { error: 'Current password is incorrect', success: false };
        }
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        return { error: updateErr.message || 'Failed to update password', success: false };
      }

      return { success: true, message: 'Password updated successfully', error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update password', success: false };
    }
  }

  // Local SQLite mode
  const { data: user, error: userErr } = await db.queryOne<{
    id: string;
    password_hash: string;
  }>('SELECT id, password_hash FROM users WHERE id = ?', [userId]);

  if (userErr || !user) {
    return { error: 'User account not found', success: false };
  }

  const isMatch = verifyPasswordSync(currentPassword, user.password_hash);
  if (!isMatch) {
    return { error: 'Current password is incorrect', success: false };
  }

  const newHash = hashPasswordSync(newPassword);
  const { error: updateErr } = await db.update('users', {
    password_hash: newHash,
    updated_at: new Date().toISOString(),
  }, { id: userId });

  if (updateErr) {
    return { error: 'Failed to update password. Please try again.', success: false };
  }

  return { success: true, message: 'Password updated successfully', error: null };
});
