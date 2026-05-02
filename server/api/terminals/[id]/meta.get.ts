/**
 * GET /api/terminals/[id]/meta
 * Returns lightweight metadata for an terminal (businessId, display name).
 * Used by the terminal login page to resolve which business the terminal belongs to.
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';
import { normalizePermissions } from '~/lib/permissions';
import { normalizeLayout } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) return { error: 'Missing id', businessId: null };

  const { data } = await db.queryOne<{
    business_id: string;
    display_name: string;
    pin_length: number;
    permissions: string | null;
    ui_layout: string | null;
  }>(
    'SELECT business_id, display_name, pin_length, permissions, ui_layout FROM terminals WHERE id = ?',
    [id],
  );

  if (!data) return { error: 'Not found', businessId: null };

  let parsedLayout = null;
  try {
    parsedLayout = data.ui_layout
      ? JSON.parse(data.ui_layout)
      : null;
  } catch {
    parsedLayout = null;
  }

  return {
    businessId: data.business_id,
    displayName: data.display_name,
    pinLength: data.pin_length,
    theme: normalizeLayout(parsedLayout).theme,
    permissions: normalizePermissions(data.permissions),
    error: null,
  };
});
