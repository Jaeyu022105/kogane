/**
 * GET /api/auth/me
 * Returns the currently authenticated admin user's mapped profile (no secret fields).
 */

import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { mapUserRecordToDto } from '~/lib/mappers';

export default defineEventHandler(async (event) => {
  const { userId, email, sessionId } = await verifyAdmin(event);

  const { data: user } = await db.queryOne<Record<string, unknown>>(
    'SELECT id, email, full_name, username, profile_photo_url, language_preference, two_factor_enabled, created_at, updated_at FROM users WHERE id = ?',
    [userId],
  );

  if (user) {
    return {
      user: {
        ...mapUserRecordToDto(user),
        sessionId: sessionId ?? null,
      },
      error: null,
    };
  }

  return {
    user: {
      id: userId,
      email: email || 'admin@kogane.dev',
      fullName: 'Restaurant Manager',
      username: 'admin',
      profilePhotoUrl: undefined,
      languagePreference: 'en',
      has2fa: false,
      sessionId: sessionId ?? null,
    },
    error: null,
  };
});
