/**
 * GET /api/inpoints/[id]/meta
 * Returns lightweight metadata for an in-point (businessId, display name).
 * Used by the terminal login page to resolve which business the inpoint belongs to.
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) return { error: 'Missing id', businessId: null };

  const { data } = await db.queryOne<{ business_id: string; display_name: string; pin_length: number }>(
    'SELECT business_id, display_name, pin_length FROM inpoints WHERE id = ?',
    [id],
  );

  if (!data) return { error: 'Not found', businessId: null };

  return { businessId: data.business_id, displayName: data.display_name, pinLength: data.pin_length, error: null };
});
