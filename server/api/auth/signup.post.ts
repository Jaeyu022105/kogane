/**
 * POST /api/auth/signup
 * Admin user registration endpoint.
 * Validates email, password, and profile fields, stores PBKDF2-hashed password,
 * and issues a stateful authenticated admin session + HttpOnly cookie.
 */

import { randomUUID } from 'node:crypto';
import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { createClient } from '@supabase/supabase-js';
import { db, getDbProvider } from '~/lib/db';
import { hashPasswordSync, issueStatefulAdminSession } from '~/lib/authUtils';
import { normalizeEmail } from '~/lib/mappers';
import { enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { hasUnsafeControlChars, sanitizeImageSrc, sanitizeTextInput } from '~/lib/securityClient';

type SignupBody = {
  email?: string;
  password?: string;
  fullName?: string;
  username?: string;
  profilePhotoUrl?: string;
  languagePreference?: string;
  has2fa?: boolean;
};

export default defineEventHandler(async (event) => {
  const body: SignupBody = (await readBody<SignupBody>(event).catch((): SignupBody => ({}))) ?? {};

  const rawEmail = typeof body?.email === 'string' ? body.email : '';
  if (hasUnsafeControlChars(rawEmail, false) || rawEmail.length > 255) {
    return { error: 'Please enter a valid email address', session: null };
  }

  const email = normalizeEmail(rawEmail);
  const password = typeof body?.password === 'string' ? body.password : '';
  const fullName = sanitizeTextInput(body?.fullName, 100, false).trim();
  const username = sanitizeTextInput(body?.username, 50, false).trim();
  const safeProfilePhotoUrl = body?.profilePhotoUrl ? (sanitizeImageSrc(body.profilePhotoUrl) || null) : null;
  const languagePreference = sanitizeTextInput(body?.languagePreference || 'en', 10, false).trim() || 'en';

  if (!email) {
    return { error: 'Email is required', session: null };
  }

  // Email structure validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address', session: null };
  }

  if (!password || password.trim().length < 6) {
    return { error: 'Password must be at least 6 characters long', session: null };
  }
  if (hasUnsafeControlChars(password, false) || password.length > 255) {
    return { error: 'Password contains invalid characters or exceeds maximum allowed length', session: null };
  }

  const rate = enforceRateLimit(event, {
    scope: 'admin_signup',
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      error: `Too many registration attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
      session: null,
    };
  }
  recordRateLimitAttempt(`admin_signup:${getClientIp(event)}`, 15 * 60 * 1000);

  // Supabase Auth mode
  if (getDbProvider() === 'supabase') {
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
          has2fa: false,
        },
        error: null,
      };
    } catch (err: any) {
      return { error: err?.message || 'Registration failed', session: null };
    }
  }

  // SQLite & Firebase Firestore mode
  const { data: existing } = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = ? COLLATE NOCASE',
    [email],
  );

  if (existing) {
    return { error: 'An account with this email already exists', session: null };
  }

  const userId = `usr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const passwordHash = hashPasswordSync(password);
  const nowIso = new Date().toISOString();

  const { error: insertError } = await db.insert('users', {
    id: userId,
    email,
    password_hash: passwordHash,
    full_name: fullName,
    username,
    profile_photo_url: safeProfilePhotoUrl,
    language_preference: languagePreference,
    two_factor_enabled: 0,
    two_factor_secret: null,
    two_factor_backup_codes: null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (insertError) {
    return { error: 'Failed to create account. Please try again.', session: null };
  }

  const issued = await issueStatefulAdminSession(event, {
    userId,
    email,
    role: 'admin',
    fullName,
    username,
    twoFactorPending: false,
  });

  return {
    session: {
      userId,
      email,
      token: issued.token,
      sessionId: issued.sessionId,
      fullName,
      username,
      profilePicture: body?.profilePhotoUrl,
      languagePreference: body?.languagePreference || 'en',
      has2fa: false,
    },
    error: null,
  };
});
