/**
 * POST /api/auth/signup
 * Admin user registration endpoint.
 * Validates email, password, and profile fields, stores securely hashed password.
 * Issues authenticated admin session token.
 */

import { defineEventHandler, readBody } from 'h3';
import { db } from '~/lib/db';
import { createAdminSessionToken, hashPasswordSync } from '~/lib/authUtils';
import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string;
    password?: string;
    fullName?: string;
    username?: string;
    profilePhotoUrl?: string;
    languagePreference?: string;
    has2fa?: boolean;
  }>(event);

  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const fullName = body?.fullName?.trim() || '';
  const username = body?.username?.trim() || '';

  if (!email) {
    return { error: 'Email is required', session: null };
  }

  // Basic email structure validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address', session: null };
  }

  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long', session: null };
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

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username,
            profile_photo_url: body?.profilePhotoUrl,
          },
        },
      });

      if (error || !data.user) {
        return { error: error?.message || 'Registration failed', session: null };
      }

      const token = data.session?.access_token || 'pending-verification';
      return {
        session: {
          userId: data.user.id,
          email: data.user.email ?? email,
          token,
          fullName,
          username,
        },
        error: null,
      };
    } catch (err: any) {
      return { error: err?.message || 'Registration failed', session: null };
    }
  }

  // Local SQLite mode
  const { data: existing } = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = ? COLLATE NOCASE',
    [email],
  );

  if (existing) {
    return { error: 'An account with this email already exists', session: null };
  }

  const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const passwordHash = hashPasswordSync(password);

  const { error: insertError } = await db.insert('users', {
    id: userId,
    email,
    password_hash: passwordHash,
    full_name: fullName,
    username,
    profile_photo_url: body?.profilePhotoUrl || null,
    language_preference: body?.languagePreference || 'en',
  });

  if (insertError) {
    return { error: 'Failed to create account. Please try again.', session: null };
  }

  const token = await createAdminSessionToken({
    userId,
    email,
    role: 'admin',
    fullName,
    username,
  });

  return {
    session: {
      userId,
      email,
      token,
      fullName,
      username,
      profilePicture: body?.profilePhotoUrl,
      languagePreference: body?.languagePreference || 'en',
      has2fa: body?.has2fa ?? false,
    },
    error: null,
  };
});
