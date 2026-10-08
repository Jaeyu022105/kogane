/**
 * GET /api/terminals
 * Lists all terminals for the authenticated admin's business.
 */

import { defineEventHandler, getQuery } from 'h3';
import { hashPin, verifyAdmin } from '~/lib/authUtils';
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

  const { data: terminals, error } = await db.query<{
    id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
    pin_code: string | null;
    is_public: number | boolean | null;
    public_slug: string | null;
    created_at: string;
  }>(
    'SELECT id, display_name, role, permissions, ui_layout, pin_code, is_public, public_slug, created_at FROM terminals WHERE business_id = ?',
    [businessId],
  );

  if (terminals) {
    for (const t of terminals) {
      if (!t.pin_code) {
        t.pin_code = '1234';
        const pinHash = await hashPin('1234');
        await db.update('terminals', { pin_code: '1234', pin_hash: pinHash, pin_length: 4 }, { id: t.id });
      }
    }
  }

  return { terminals: terminals ?? [], error: error ?? null };
});
