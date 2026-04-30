/**
 * GET /api/businesses/me
 * Returns the business owned by the authenticated admin.
 */

import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);

  const { data: business, error } = await db.queryOne(
    'SELECT * FROM businesses WHERE admin_user_id = ?',
    [userId],
  );

  if (error) return { error, business: null };
  if (!business) return { error: null, business: null };

  return { business, error: null };
});
