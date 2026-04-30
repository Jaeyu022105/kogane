/**
 * POST /api/auth/login
 * Dev-mode admin login — issues a mock session.
 * In production this is handled entirely by Supabase Auth on the client.
 */

import { defineEventHandler, readBody } from 'h3';

export default defineEventHandler(async (event) => {
  if (process.env.DEV_MODE !== 'true') {
    return { error: 'This endpoint is only available in dev mode', session: null };
  }

  const body = await readBody<{ email: string; password: string }>(event);

  // Dev mode accepts any credentials — production auth is Supabase-side
  if (!body.email) return { error: 'Email required', session: null };

  return {
    session: {
      userId: 'dev-admin',
      email:  body.email,
      token:  'dev-admin-token',
    },
    error: null,
  };
});
