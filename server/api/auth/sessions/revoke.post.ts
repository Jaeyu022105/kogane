/**
 * POST /api/auth/sessions/revoke
 * Revokes either a specific session by ID or all other active sessions.
 */

import { defineEventHandler, readBody } from 'h3';
import {
  clearAdminSessionCookie,
  revokeAllUserSessions,
  revokeSessionById,
  verifyAdmin,
} from '~/lib/authUtils';
import { hasUnsafeControlChars } from '~/lib/securityClient';

type RevokeSessionBody = { sessionId?: string; allOthers?: boolean };

export default defineEventHandler(async (event) => {
  const { userId, sessionId } = await verifyAdmin(event);
  const body: RevokeSessionBody = (await readBody<RevokeSessionBody>(event).catch((): RevokeSessionBody => ({}))) ?? {};

  if (body.allOthers) {
    await revokeAllUserSessions(userId, sessionId);
    return { success: true, revokedCurrent: false, error: null };
  }

  if (!body.sessionId || typeof body.sessionId !== 'string' || hasUnsafeControlChars(body.sessionId, false) || body.sessionId.length > 128) {
    return { success: false, revokedCurrent: false, error: 'Missing sessionId' };
  }

  const ok = await revokeSessionById(body.sessionId, userId);
  const revokedCurrent = Boolean(sessionId && body.sessionId === sessionId);
  if (revokedCurrent) {
    clearAdminSessionCookie(event);
  }

  return {
    success: ok,
    revokedCurrent,
    error: ok ? null : 'Failed to revoke session',
  };
});
