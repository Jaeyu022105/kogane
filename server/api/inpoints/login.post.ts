/**
 * POST /api/inpoints/login
 * Authenticates an in-point user via display name + PIN.
 * Returns a session token for the in-point session.
 */

import { defineEventHandler, readBody } from 'h3';
import { db } from '~/lib/db';
import { verifyPin } from '~/lib/authUtils';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ businessId: string; displayName: string; pin: string }>(event);

  if (!body.businessId || !body.displayName || !body.pin) {
    return { error: 'Missing credentials', session: null };
  }

  const { data: inpoint } = await db.queryOne<{
    id: string;
    pin_hash: string;
    role: string;
    ui_layout: string;
    display_name: string;
  }>(
    'SELECT id, pin_hash, role, ui_layout, display_name FROM inpoints WHERE business_id = ? AND display_name = ?',
    [body.businessId, body.displayName],
  );

  if (!inpoint) return { error: 'Invalid credentials', session: null };

  const valid = await verifyPin(body.pin, inpoint.pin_hash);
  if (!valid) return { error: 'Invalid credentials', session: null };

  // Parse UI layout from stored JSON
  let uiLayout;
  try {
    uiLayout = typeof inpoint.ui_layout === 'string'
      ? JSON.parse(inpoint.ui_layout)
      : inpoint.ui_layout;
  } catch {
    uiLayout = {};
  }

  return {
    session: {
      inpointId: inpoint.id,
      displayName: inpoint.display_name,
      role: inpoint.role,
      uiLayout,
    },
    error: null,
  };
});
