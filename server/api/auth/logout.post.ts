/**
 * POST /api/auth/logout
 * Revokes the active stateful admin session in the database and clears the HttpOnly cookie.
 */

import { defineEventHandler } from 'h3';
import {
  clearAdminSessionCookie,
  decodeAdminSessionToken,
  extractAdminToken,
  revokeSessionById,
} from '~/lib/authUtils';

export default defineEventHandler(async (event) => {
  const token = extractAdminToken(event);
  if (token && token !== 'dev-admin-token') {
    const payload = await decodeAdminSessionToken(token);
    if (payload?.sid) {
      await revokeSessionById(payload.sid, payload.userId);
    }
  }

  clearAdminSessionCookie(event);
  return { success: true };
});
