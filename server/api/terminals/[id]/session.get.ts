import { defineEventHandler } from 'h3';
import { issueTerminalSession, verifyAdmin, verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { normalizeLayout } from '~/lib/uiTypes';
import { normalizePermissions } from '~/lib/permissions';
import { resolveTerminalBusiness, TERMINAL_BUSINESS_COLUMNS, type TerminalBusinessRow } from '~/server/utils/terminalBrand';

export default defineEventHandler(async (event) => {
  const terminalId = event.context.params?.id;
  if (!terminalId) {
    return { session: null, token: null, error: 'Missing terminal ID' };
  }

  // 1. Check existing terminal session cookie or header
  let sessionPayload: any = null;
  try {
    sessionPayload = await verifyTerminalSession(event, terminalId);
  } catch {
    // No valid terminal session cookie
  }

  // 2. Query terminal details
  const { data: terminal } = await db.queryOne<TerminalBusinessRow & {
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
    admin_user_id: string;
  }>(
    `SELECT
       t.id,
       t.business_id,
       t.display_name,
       t.role,
       t.permissions,
       t.ui_layout,
       b.admin_user_id,
       ${TERMINAL_BUSINESS_COLUMNS}
     FROM terminals t
     JOIN businesses b ON b.id = t.business_id
     WHERE t.id = ?`,
    [terminalId],
  );

  if (!terminal) {
    return { session: null, token: null, error: 'Terminal not found' };
  }

  // 3. If no session cookie, check for admin session passthrough
  if (!sessionPayload) {
    try {
      const { userId } = await verifyAdmin(event);
      if (userId && terminal.admin_user_id === userId) {
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        sessionPayload = {
          terminalId: terminal.id,
          businessId: terminal.business_id,
          displayName: terminal.display_name,
          role: terminal.role,
          expiresAt,
        };
      }
    } catch {
      // Not admin
    }
  }

  if (!sessionPayload) {
    return { session: null, token: null, error: null };
  }

  const token = await issueTerminalSession(event, sessionPayload);

  let parsedLayout;
  try {
    parsedLayout = terminal.ui_layout
      ? JSON.parse(terminal.ui_layout)
      : null;
  } catch {
    parsedLayout = null;
  }

  const business = resolveTerminalBusiness(terminal);

  return {
    token,
    session: {
      terminalId: terminal.id,
      businessId: terminal.business_id,
      displayName: terminal.display_name,
      businessName: business.businessName,
      country: business.country,
      currency: business.currency,
      currencySymbol: business.currencySymbol,
      brand: business.brand,
      role: terminal.role,
      permissions: normalizePermissions(terminal.permissions, terminal.role),
      uiLayout: normalizeLayout(parsedLayout),
      expiresAt: sessionPayload.expiresAt,
    },
    error: null,
  };
});
