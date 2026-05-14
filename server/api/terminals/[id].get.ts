import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { normalizeLayout } from '~/lib/uiTypes';
import { normalizePermissions } from '~/lib/permissions';
import { getBusinessForAdmin, getTerminalContext } from '~/server/utils/business';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const terminalId = event.context.params?.id;

  if (!terminalId) {
    return { terminal: null, error: 'Missing terminal id' };
  }

  const { data: terminal, error } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    pin_code: string | null;
    permissions: string | null;
    ui_layout: string | null;
    is_public: number | boolean | null;
    public_slug: string | null;
    created_at: string;
  }>(
    'SELECT id, business_id, display_name, role, pin_code, permissions, ui_layout, is_public, public_slug, created_at FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (error || !terminal) {
    return { terminal: null, error: error ?? 'Terminal not found' };
  }

  const { data: business } = await getBusinessForAdmin(userId, terminal.business_id);
  if (!business) {
    return { terminal: null, error: 'Forbidden' };
  }

  return {
    terminal: {
      ...terminal,
      permissions: normalizePermissions(terminal.permissions),
      ui_layout: normalizeLayout(
        terminal.ui_layout
          ? JSON.parse(terminal.ui_layout)
          : null,
      ),
    },
    error: null,
  };
});
