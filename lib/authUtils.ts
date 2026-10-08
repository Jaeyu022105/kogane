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

const TERMINAL_SESSION_COOKIE = 'kogane_terminal_session';
const TERMINAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

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
  const secret = process.env.SESSION_SECRET || 'kogane-dev-secret';
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

export async function decodeTerminalSessionToken(token: string): Promise<TerminalSessionPayload | null> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;
  const expectedSignature = await signValue(encodedPayload);
  if (signature !== expectedSignature) return null;
  try {
    return JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
}

export async function issueTerminalSession(event: H3Event, payload: Omit<TerminalSessionPayload, 'expiresAt'> & { expiresAt?: string }) {
  const token = await createTerminalSessionToken(payload);

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TERMINAL_SESSION_TTL_MS / 1000,
  };

  // Set default terminal cookie
  setCookie(event, TERMINAL_SESSION_COOKIE, token, cookieOptions);

  // Also set terminal-specific cookie to avoid multi-terminal overwrites
  if (payload.terminalId) {
    setCookie(event, `kogane_term_${payload.terminalId}`, token, cookieOptions);
  }

  return token;
}

export function clearTerminalSession(event: H3Event, terminalId?: string) {
  deleteCookie(event, TERMINAL_SESSION_COOKIE, { path: '/' });
  if (terminalId) {
    deleteCookie(event, `kogane_term_${terminalId}`, { path: '/' });
  }
}

export async function verifyTerminalSession(event: H3Event, expectedTerminalId?: string): Promise<TerminalSessionPayload> {
  const headerToken = getRequestHeader(event, 'x-terminal-session');
  const termSpecificCookie = expectedTerminalId ? getCookie(event, `kogane_term_${expectedTerminalId}`) : null;
  const genericCookie = getCookie(event, TERMINAL_SESSION_COOKIE);
  const token = headerToken || termSpecificCookie || genericCookie;

  if (token) {
    const payload = await decodeTerminalSessionToken(token);
    if (payload) {
      let isTargetMatch = !expectedTerminalId || payload.terminalId === expectedTerminalId;

      // If terminal IDs differ, check if target terminal belongs to the same business
      if (!isTargetMatch && expectedTerminalId) {
        try {
          const { db } = await import('~/lib/db');
          const { data: expectedTerm } = await db.queryOne<{ id: string; business_id: string; display_name: string; role: string }>(
            'SELECT id, business_id, display_name, role FROM terminals WHERE id = ?',
            [expectedTerminalId],
          );
          if (expectedTerm && expectedTerm.business_id === payload.businessId) {
            // Same business: auto-adapt session to expected terminal
            payload.terminalId = expectedTerm.id;
            payload.displayName = expectedTerm.display_name;
            payload.role = expectedTerm.role;
            isTargetMatch = true;
          }
        } catch {
          // Ignore db lookup error
        }
      }

      if (isTargetMatch) {
        const expiresMs = new Date(payload.expiresAt).getTime();
        const now = Date.now();
        const GRACE_PERIOD_MS = 1000 * 60 * 60 * 24 * 90; // 90-day grace

        // Session valid or within grace period: auto-renew
        if (expiresMs > now) {
          if (expiresMs - now < TERMINAL_SESSION_TTL_MS / 2) {
            payload.expiresAt = new Date(now + TERMINAL_SESSION_TTL_MS).toISOString();
            await issueTerminalSession(event, payload);
          }
          return payload;
        } else if (now - expiresMs < GRACE_PERIOD_MS) {
          payload.expiresAt = new Date(now + TERMINAL_SESSION_TTL_MS).toISOString();
          await issueTerminalSession(event, payload);
          return payload;
        }
      }
    }
  }

  // Admin Session Passthrough: grant terminal session if authorized admin
  try {
    const { userId } = await verifyAdmin(event);
    if (userId) {
      const targetTerminalId = expectedTerminalId || getRequestHeader(event, 'x-terminal-id');
      const { db } = await import('~/lib/db');
      
      let terminalRow: { id: string; business_id: string; display_name: string; role: string } | null = null;
      if (targetTerminalId) {
        const { data } = await db.queryOne<{ id: string; business_id: string; display_name: string; role: string }>(
          `SELECT t.id, t.business_id, t.display_name, t.role 
            FROM terminals t 
            JOIN businesses b ON b.id = t.business_id 
            WHERE t.id = ? AND b.admin_user_id = ?`,
          [targetTerminalId, userId],
        );
        terminalRow = data;
      }

      if (!terminalRow) {
        const { data } = await db.queryOne<{ id: string; business_id: string; display_name: string; role: string }>(
          `SELECT t.id, t.business_id, t.display_name, t.role 
            FROM terminals t 
            JOIN businesses b ON b.id = t.business_id 
            WHERE b.admin_user_id = ? 
            ORDER BY t.created_at ASC LIMIT 1`,
          [userId],
        );
        terminalRow = data;
      }

      if (terminalRow) {
        const adminPayload: TerminalSessionPayload = {
          terminalId: terminalRow.id,
          businessId: terminalRow.business_id,
          displayName: terminalRow.display_name,
          role: terminalRow.role,
          expiresAt: new Date(Date.now() + TERMINAL_SESSION_TTL_MS).toISOString(),
        };
        await issueTerminalSession(event, adminPayload);
        return adminPayload;
      }
    }
  } catch {
    // Admin verification failed; proceed to normal errors
  }

  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing terminal session' });
  }

  throw createError({ statusCode: 401, message: 'Terminal session expired' });
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
