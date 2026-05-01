/**
 * Auth utilities for admin and terminal session validation.
 */

import { Buffer } from 'node:buffer';
import {
  createError,
  deleteCookie,
  getCookie,
  getRequestHeader,
  type H3Event,
  setCookie,
} from 'h3';
import { createClient } from '@supabase/supabase-js';

const TERMINAL_SESSION_COOKIE = 'postfolio_terminal_session';
const TERMINAL_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export interface TerminalSessionPayload {
  terminalId: string;
  businessId: string;
  displayName: string;
  role: string;
  expiresAt: string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

async function signValue(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || 'postfolio-dev-secret';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString('base64url');
}

/** Extract and verify the Supabase JWT from the Authorization header. */
export async function verifyAdmin(event: H3Event): Promise<{ userId: string }> {
  const token = getRequestHeader(event, 'authorization')?.replace('Bearer ', '');

  if (!token) throw createError({ statusCode: 401, message: 'Missing authorization token' });

  if (process.env.DEV_MODE === 'true') {
    if (token === 'dev-admin-token') return { userId: 'dev-admin' };
    throw createError({ statusCode: 401, message: 'Invalid dev token' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw createError({ statusCode: 401, message: 'Invalid or expired token' });
  }

  return { userId: data.user.id };
}

export async function createTerminalSessionToken(payload: Omit<TerminalSessionPayload, 'expiresAt'> & { expiresAt?: string }) {
  const sessionPayload: TerminalSessionPayload = {
    ...payload,
    expiresAt: payload.expiresAt ?? new Date(Date.now() + TERMINAL_SESSION_TTL_MS).toISOString(),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(sessionPayload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function issueTerminalSession(event: H3Event, payload: Omit<TerminalSessionPayload, 'expiresAt'> & { expiresAt?: string }) {
  const token = await createTerminalSessionToken(payload);

  setCookie(event, TERMINAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TERMINAL_SESSION_TTL_MS / 1000,
  });

  return token;
}

export function clearTerminalSession(event: H3Event) {
  deleteCookie(event, TERMINAL_SESSION_COOKIE, { path: '/' });
}

export async function verifyTerminalSession(event: H3Event, expectedTerminalId?: string): Promise<TerminalSessionPayload> {
  const token = getCookie(event, TERMINAL_SESSION_COOKIE);
  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing terminal session' });
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw createError({ statusCode: 401, message: 'Malformed terminal session' });
  }

  const expectedSignature = await signValue(encodedPayload);
  if (signature !== expectedSignature) {
    throw createError({ statusCode: 401, message: 'Invalid terminal session' });
  }

  let payload: TerminalSessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw createError({ statusCode: 401, message: 'Unreadable terminal session' });
  }

  if (expectedTerminalId && payload.terminalId !== expectedTerminalId) {
    throw createError({ statusCode: 403, message: 'Terminal session does not match request' });
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw createError({ statusCode: 401, message: 'Terminal session expired' });
  }

  return payload;
}

/** Hash a PIN using Web Crypto (SHA-256). */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}
