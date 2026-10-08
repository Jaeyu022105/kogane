/**
 * POST /api/auth/logout
 * Logs out the admin user.
 */

import { defineEventHandler } from 'h3';

export default defineEventHandler(async () => {
  return { success: true };
});
