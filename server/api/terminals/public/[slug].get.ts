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
import { resolveTerminalBusiness, TERMINAL_BUSINESS_COLUMNS, type TerminalBusinessRow } from '~/server/utils/terminalBrand';

export default defineEventHandler(async (event) => {
  const slug = event.context.params?.slug;
  if (!slug) return { error: 'Missing slug', session: null };

  const { data } = await db.queryOne<TerminalBusinessRow & {
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    pin_length: number;
    permissions: string | null;
    ui_layout: string | null;
    is_public: number;
  }>(
    `
      SELECT
        t.id,
        t.business_id,
        t.display_name,
        t.role,
        t.pin_length,
        t.permissions,
        t.ui_layout,
        t.is_public,
        ${TERMINAL_BUSINESS_COLUMNS}
      FROM terminals t
      JOIN businesses b ON b.id = t.business_id
      WHERE t.public_slug = ?
    `,
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
  const effectiveRole = data.role || 'guest';

  const token = await issueTerminalSession(event, {
    terminalId: data.id,
    businessId: data.business_id,
    displayName: data.display_name,
    role: effectiveRole,
    expiresAt,
  });

  const business = resolveTerminalBusiness(data);

  return {
    session: {
      terminalId: data.id,
      displayName: data.display_name,
      businessName: business.businessName,
      businessId: data.business_id,
      country: business.country,
      currency: business.currency,
      currencySymbol: business.currencySymbol,
      brand: business.brand,
      role: effectiveRole,
      permissions: normalizePermissions(data.permissions, effectiveRole),
      uiLayout,
      expiresAt,
    },
    token,
    error: null,
  };
});
