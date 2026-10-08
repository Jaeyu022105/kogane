/**
 * GET /api/auth/me
 * Returns the currently authenticated admin user's profile.
 */

import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId, email } = await verifyAdmin(event);

  const { data: user } = await db.queryOne<{
    id: string;
    email: string;
    full_name?: string;
    username?: string;
    profile_photo_url?: string;
    language_preference?: string;
  }>('SELECT id, email, full_name, username, profile_photo_url, language_preference FROM users WHERE id = ?', [userId]);

  if (user) {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || (userId === 'dev-admin' ? 'Restaurant Manager' : 'Admin User'),
        username: user.username || 'admin',
        profilePhotoUrl: user.profile_photo_url,
        languagePreference: user.language_preference || 'en',
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
    },
    error: null,
  };
});
