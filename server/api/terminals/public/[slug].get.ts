/**
 * GET /api/terminals/public/[slug]
 * Loads a public terminal by its slug without requiring a PIN.
 * Issues a read-scoped terminal session tied to the terminal's permissions.
 * Only works when the terminal has is_public = 1.
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';
import { issueTerminalSession } from '~/lib/authUtils';
import { normalizePermissions } from '~/lib/permissions';
import { normalizeLayout } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  const slug = event.context.params?.slug;
  if (!slug) return { error: 'Missing slug', session: null };

  const { data } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    pin_length: number;
    permissions: string | null;
    ui_layout: string | null;
    is_public: number;
  }>(
    'SELECT id, business_id, display_name, pin_length, permissions, ui_layout, is_public FROM terminals WHERE public_slug = ?',
    [slug],
  );

  if (!data || !data.is_public) {
    return { error: 'Not found', session: null };
  }

  let uiLayout;
  try {
    uiLayout = normalizeLayout(
      typeof data.ui_layout === 'string' ? JSON.parse(data.ui_layout) : data.ui_layout,
    );
  } catch {
    uiLayout = normalizeLayout();
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  await issueTerminalSession(event, {
    terminalId: data.id,
    businessId: data.business_id,
    displayName: data.display_name,
    role: 'guest',
    expiresAt,
  });

  return {
    session: {
      terminalId: data.id,
      displayName: data.display_name,
      businessId: data.business_id,
      role: 'guest',
      permissions: normalizePermissions(data.permissions),
      uiLayout,
      expiresAt,
    },
    error: null,
  };
});
