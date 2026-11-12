/**
 * POST /api/auth/login
 * Admin user authentication endpoint with rate limiting, PBKDF2 verification,
 * stateful session creation, HttpOnly cookie issuance, and 2FA challenge support.
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { createClient } from '@supabase/supabase-js';
import { db, getDbProvider } from '~/lib/db';
import {
  issueStatefulAdminSession,
  verifyPasswordSync,
} from '~/lib/authUtils';
import { mapUserRecordToDto, normalizeEmail } from '~/lib/mappers';
import { clearRateLimit, enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';

type LoginBody = { email?: string; password?: string };

export default defineEventHandler(async (event) => {
  const body: LoginBody = (await readBody<LoginBody>(event).catch((): LoginBody => ({}))) ?? {};

  const email = normalizeEmail(body?.email);
  const password = body?.password;

  if (!email || !password) {
    return { error: 'Email and password are required', session: null };
  }

  const rate = enforceRateLimit(event, {
    scope: 'admin_login',
    identifier: email,
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    setResponseStatus(event, 429);
    return {
      error: `Too many login attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
      session: null,
    };
  }

  const rateKey = `admin_login:${getClientIp(event)}:${email}`;

  // Supabase Auth mode (only when DB_PROVIDER is supabase)
  if (getDbProvider() === 'supabase') {
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
        recordRateLimitAttempt(rateKey, 15 * 60 * 1000);
        return { error: error?.message || 'Invalid email or password', session: null };
      }

      clearRateLimit(rateKey);
      return {
        requires2fa: false,
        session: {
          userId: data.user.id,
          email: data.user.email ?? email,
          token: data.session.access_token,
          fullName: data.user.user_metadata?.full_name,
          username: data.user.user_metadata?.username,
          has2fa: false,
        },
        error: null,
      };
    } catch (err: any) {
      return { error: err?.message || 'Login failed', session: null };
    }
  }

  // SQLite & Firebase Firestore mode
  const { data: user, error: dbError } = await db.queryOne<{
    id: string;
    email: string;
    password_hash: string;
    full_name?: string;
    username?: string;
    profile_photo_url?: string;
    language_preference?: string;
    two_factor_enabled?: number | boolean;
    two_factor_secret?: string | null;
  }>(
    'SELECT id, email, password_hash, full_name, username, profile_photo_url, language_preference, two_factor_enabled, two_factor_secret FROM users WHERE email = ? COLLATE NOCASE',
    [email],
  );

  if (dbError || !user) {
    recordRateLimitAttempt(rateKey, 15 * 60 * 1000);
    return { error: 'Invalid email or password', session: null };
  }

  const isValid = verifyPasswordSync(password, user.password_hash);
  if (!isValid) {
    recordRateLimitAttempt(rateKey, 15 * 60 * 1000);
    return { error: 'Invalid email or password', session: null };
  }

  clearRateLimit(rateKey);

  const has2fa = Boolean(
    (user.two_factor_enabled === 1 || user.two_factor_enabled === true)
    && user.two_factor_secret,
  );

  // If 2FA is enabled, create a pending stateful session and return challengeToken
  if (has2fa) {
    const pending = await issueStatefulAdminSession(event, {
      userId: user.id,
      email: user.email,
      role: 'admin',
      fullName: user.full_name,
      username: user.username,
      twoFactorPending: true,
    });

    return {
      requires2fa: true,
      challengeToken: pending.token,
      session: null,
      error: null,
    };
  }

  // Issue verified stateful session + HttpOnly cookie
  const issued = await issueStatefulAdminSession(event, {
    userId: user.id,
    email: user.email,
    role: 'admin',
    fullName: user.full_name,
    username: user.username,
    twoFactorPending: false,
  });

  const profile = mapUserRecordToDto(user as unknown as Record<string, unknown>);

  return {
    requires2fa: false,
    session: {
      userId: profile.id,
      email: profile.email,
      token: issued.token,
      sessionId: issued.sessionId,
      fullName: profile.fullName,
      username: profile.username,
      profilePicture: profile.profilePhotoUrl,
      languagePreference: profile.languagePreference,
      has2fa: profile.has2fa,
    },
    error: null,
  };
});
