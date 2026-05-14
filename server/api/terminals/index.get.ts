/**
 * GET /api/terminals
 * Lists all terminals for the authenticated admin's business.
 */

import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const { businessId } = getQuery(event) as { businessId: string };

  if (!businessId) return { error: 'Missing businessId', terminals: null };

  const { data: business } = await db.queryOne<{ admin_user_id: string }>(
    'SELECT admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (!business || business.admin_user_id !== userId) return { error: 'Forbidden', terminals: null };

  const { data: terminals, error } = await db.query(
    'SELECT id, display_name, role, permissions, ui_layout, pin_code, is_public, public_slug, created_at FROM terminals WHERE business_id = ?',
    [businessId],
  );

  return { terminals: terminals ?? [], error: error ?? null };
});
