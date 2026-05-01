/**
 * Auth utilities — server-side session validation helpers.
 * All protected routes call verifyAdmin() or verifyInpoint() from here.
 */

import { H3Event, getRequestHeader, createError } from 'h3';
import { createClient } from '@supabase/supabase-js';

/** Extract and verify the Supabase JWT from the Authorization header. */
export async function verifyAdmin(event: H3Event): Promise<{ userId: string }> {
  const token = getRequestHeader(event, 'authorization')?.replace('Bearer ', '');

  if (!token) throw createError({ statusCode: 401, message: 'Missing authorization token' });

  // In dev mode, accept a special dev token that bypasses Supabase
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

/** Hash a PIN using Web Crypto (SHA-256) — no native bcrypt in Bun edge. */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}
