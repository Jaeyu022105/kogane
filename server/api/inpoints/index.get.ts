/**
 * GET /api/inpoints
 * Lists all in-points for the authenticated admin's business.
 */

import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const { businessId } = getQuery(event) as { businessId: string };

  if (!businessId) return { error: 'Missing businessId', inpoints: null };

  const { data: business } = await db.queryOne<{ admin_user_id: string }>(
    'SELECT admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (!business || business.admin_user_id !== userId) return { error: 'Forbidden', inpoints: null };

  const { data: inpoints, error } = await db.query(
    'SELECT id, display_name, role, ui_layout, created_at FROM inpoints WHERE business_id = ?',
    [businessId],
  );

  return { inpoints: inpoints ?? [], error: error ?? null };
});
