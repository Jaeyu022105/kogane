/**
 * POST /api/terminals/login
 * Authenticates an terminal user via display name + PIN.
 * Returns a session token for the terminal session.
 */

import { defineEventHandler, readBody } from 'h3';
import { issueTerminalSession, verifyPin } from '~/lib/authUtils';
import { normalizeLayout } from '~/lib/uiTypes';
import { normalizePermissions } from '~/lib/permissions';
import { db } from '~/lib/db';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ businessId: string; displayName: string; pin: string }>(event);

  if (!body.businessId || !body.displayName || !body.pin) {
    return { error: 'Missing credentials', session: null };
  }

  const { data: terminal } = await db.queryOne<{
    id: string;
    pin_hash: string;
    role: string;
    permissions: string;
    ui_layout: string;
    display_name: string;
  }>(
    'SELECT id, pin_hash, role, permissions, ui_layout, display_name FROM terminals WHERE business_id = ? AND display_name = ?',
    [body.businessId, body.displayName],
  );

  if (!terminal) return { error: 'Invalid credentials', session: null };

  const valid = await verifyPin(body.pin, terminal.pin_hash);
  if (!valid) return { error: 'Invalid credentials', session: null };

  // Parse UI layout from stored JSON
  let uiLayout;
  try {
    uiLayout = normalizeLayout(
      typeof terminal.ui_layout === 'string'
        ? JSON.parse(terminal.ui_layout)
        : terminal.ui_layout,
    );
  } catch {
    uiLayout = normalizeLayout();
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString();

  await issueTerminalSession(event, {
    terminalId: terminal.id,
    businessId: body.businessId,
    displayName: terminal.display_name,
    role: terminal.role,
    expiresAt,
  });

  await writeAuditLog({
    businessId: body.businessId,
    actorType: 'inpoint',
    actorName: terminal.display_name,
    actionType: 'login',
    metadata: {
      terminal_id: terminal.id,
      role: terminal.role,
    },
  });

  return {
    session: {
      terminalId: terminal.id,
      displayName: terminal.display_name,
      role: terminal.role,
      permissions: normalizePermissions(terminal.permissions),
      uiLayout,
      expiresAt,
    },
    error: null,
  };
});
