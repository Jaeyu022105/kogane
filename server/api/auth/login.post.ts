/**
 * POST /api/auth/login
 * Admin user authentication endpoint.
 * Validates email and password, verifying stored password hash.
 * Supports both standalone local SQLite and cloud Supabase mode.
 */

import { defineEventHandler, readBody } from 'h3';
import { db } from '~/lib/db';
import { createAdminSessionToken, verifyPasswordSync } from '~/lib/authUtils';
import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event);

  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !password) {
    return { error: 'Email and password are required', session: null };
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        return { error: error?.message || 'Invalid email or password', session: null };
      }

      return {
        session: {
          userId: data.user.id,
          email: data.user.email ?? email,
          token: data.session.access_token,
          fullName: data.user.user_metadata?.full_name,
          username: data.user.user_metadata?.username,
        },
        error: null,
      };
    } catch (err: any) {
      return { error: err?.message || 'Login failed', session: null };
    }
  }

  // Local SQLite mode
  const { data: user, error: dbError } = await db.queryOne<{
    id: string;
    email: string;
    password_hash: string;
    full_name?: string;
    username?: string;
    profile_photo_url?: string;
    language_preference?: string;
  }>('SELECT id, email, password_hash, full_name, username, profile_photo_url, language_preference FROM users WHERE email = ? COLLATE NOCASE', [email]);

  if (dbError || !user) {
    return { error: 'Invalid email or password', session: null };
  }

  const isValid = verifyPasswordSync(password, user.password_hash);
  if (!isValid) {
    return { error: 'Invalid email or password', session: null };
  }

  const token = await createAdminSessionToken({
    userId: user.id,
    email: user.email,
    role: 'admin',
    fullName: user.full_name,
    username: user.username,
  });

  return {
    session: {
      userId: user.id,
      email: user.email,
      token,
      fullName: user.full_name,
      username: user.username,
      profilePicture: user.profile_photo_url,
      languagePreference: user.language_preference,
    },
    error: null,
  };
});
