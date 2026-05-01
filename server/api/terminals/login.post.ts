/**
 * POST /api/terminals/login
 * Authenticates an terminal user via display name + PIN.
 * Returns a session token for the terminal session.
 */

import { defineEventHandler, readBody } from 'h3';
import { db } from '~/lib/db';
import { verifyPin } from '~/lib/authUtils';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ businessId: string; displayName: string; pin: string }>(event);

  if (!body.businessId || !body.displayName || !body.pin) {
    return { error: 'Missing credentials', session: null };
  }

  const { data: terminal } = await db.queryOne<{
    id: string;
    pin_hash: string;
    role: string;
    ui_layout: string;
    display_name: string;
  }>(
    'SELECT id, pin_hash, role, ui_layout, display_name FROM terminals WHERE business_id = ? AND display_name = ?',
    [body.businessId, body.displayName],
  );

  if (!terminal) return { error: 'Invalid credentials', session: null };

  const valid = await verifyPin(body.pin, terminal.pin_hash);
  if (!valid) return { error: 'Invalid credentials', session: null };

  // Parse UI layout from stored JSON
  let uiLayout;
  try {
    uiLayout = typeof terminal.ui_layout === 'string'
      ? JSON.parse(terminal.ui_layout)
      : terminal.ui_layout;
  } catch {
    uiLayout = {};
  }

  return {
    session: {
      terminalId: terminal.id,
      displayName: terminal.display_name,
      role: terminal.role,
      uiLayout,
    },
    error: null,
  };
});
