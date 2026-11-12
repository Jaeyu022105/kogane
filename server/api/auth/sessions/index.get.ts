/**
 * GET /api/auth/sessions
 * Lists active (non-revoked, non-expired) stateful sessions for the authenticated admin.
 */

import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { mapSessionRecordToDto } from '~/lib/mappers';

export default defineEventHandler(async (event) => {
  const { userId, sessionId } = await verifyAdmin(event);

  const { data: rows, error } = await db.query<Record<string, unknown>>(
    'SELECT id, session_type, terminal_id, business_id, two_factor_verified, ip_address, user_agent, last_active_at, expires_at, created_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_active_at DESC',
    [userId],
  );

  if (error) {
    return { sessions: [], error };
  }

  const now = Date.now();
  const active = (rows ?? [])
    .filter((row) => {
      const exp = new Date(String(row.expires_at ?? '')).getTime();
      return !Number.isNaN(exp) && exp > now;
    })
    .map((row) => mapSessionRecordToDto(row, sessionId));

  return { sessions: active, error: null };
});
