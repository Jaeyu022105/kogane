/**
 * POST /api/auth/login
 * Admin user authentication endpoint with rate limiting, PBKDF2 verification,
 * stateful session creation, HttpOnly cookie issuance, and 2FA challenge support.
 */

import { randomUUID } from 'node:crypto';
import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { db } from '~/lib/db';
import {
  hashPasswordSync,
  issueStatefulAdminSession,
  verifyPasswordSync,
} from '~/lib/authUtils';
import { mapUserRecordToDto, normalizeEmail } from '~/lib/mappers';
import {
  checkRateLimit,
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
  recordRateLimitAttempt,
  setRetryAfter,
  type RateLimitResult,
} from '~/lib/rateLimit';
import { hasUnsafeControlChars } from '~/lib/securityClient';

type LoginBody = { email?: string; password?: string };

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const CLIENT_MAX_ATTEMPTS = 10;
const ACCOUNT_MAX_FAILURES = 30;
const IP_MAX_FAILURES = 100;

// A real PBKDF2 hash of a random value, checked when the email is unknown. Built on first use.
let timingDummyHash: string | null = null;
function getTimingDummyHash(): string {
  timingDummyHash ??= hashPasswordSync(randomUUID());
  return timingDummyHash;
}

export default defineEventHandler(async (event) => {
  const body: LoginBody = (await readBody<LoginBody>(event).catch((): LoginBody => ({}))) ?? {};

  const rawEmail = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (
    hasUnsafeControlChars(rawEmail, false) || rawEmail.length > 255 ||
    hasUnsafeControlChars(password, false) || password.length > 255
  ) {
    return { error: 'Invalid email or password', session: null };
  }

  const email = normalizeEmail(rawEmail);

  if (!email || !password) {
    return { error: 'Email and password are required', session: null };
  }

  // Three limits: this IP on this account (counted up front, so parallel requests can't slip
  // past), this account from any IP (credential stuffing), and this IP across all accounts
  // (password spraying). The last two count failures only.
  const ip = getClientIp(event);
  const rateKey = `admin_login:${ip}:${email}`;
  const accountKey = `admin_login_account:${email}`;
  const ipKey = `admin_login_ip:${ip}`;
  let blocked: RateLimitResult | undefined;
  for (const limit of [
    () => checkRateLimit(accountKey, ACCOUNT_MAX_FAILURES, LOGIN_WINDOW_MS),
    () => checkRateLimit(ipKey, IP_MAX_FAILURES, LOGIN_WINDOW_MS),
    () => consumeRateLimit(rateKey, CLIENT_MAX_ATTEMPTS, LOGIN_WINDOW_MS),
  ]) {
    const result = limit();
    if (!result.allowed) {
      blocked = result;
      break;
    }
  }
  if (blocked) {
    setRetryAfter(event, blocked.retryAfterSeconds);
    setResponseStatus(event, 429);
    return {
      error: `Too many login attempts. Try again in ${blocked.retryAfterSeconds} seconds.`,
      session: null,
    };
  }

  const recordFailure = () => {
    recordRateLimitAttempt(accountKey, LOGIN_WINDOW_MS);
    recordRateLimitAttempt(ipKey, LOGIN_WINDOW_MS);
  };

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

  // Unknown accounts still pay for a password hash, so response time doesn't reveal which emails exist.
  const isValid = verifyPasswordSync(password, user?.password_hash ?? getTimingDummyHash());
  if (dbError || !user || !isValid) {
    recordFailure();
    return { error: 'Invalid email or password', session: null };
  }

  clearRateLimit(rateKey);
  clearRateLimit(accountKey);

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
