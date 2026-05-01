/**
 * GET /api/terminals/[id]/meta
 * Returns lightweight metadata for an terminal (businessId, display name).
 * Used by the terminal login page to resolve which business the terminal belongs to.
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';
import { normalizePermissions } from '~/lib/permissions';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) return { error: 'Missing id', businessId: null };

  const { data } = await db.queryOne<{
    business_id: string;
    display_name: string;
    pin_length: number;
    permissions: string | null;
  }>(
    'SELECT business_id, display_name, pin_length, permissions FROM terminals WHERE id = ?',
    [id],
  );

  if (!data) return { error: 'Not found', businessId: null };

  return {
    businessId: data.business_id,
    displayName: data.display_name,
    pinLength: data.pin_length,
    permissions: normalizePermissions(data.permissions),
    error: null,
  };
});
