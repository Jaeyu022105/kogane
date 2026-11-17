/**
 * GET /api/terminals/[id]/meta
 * Returns lightweight metadata for a terminal (businessId, display name, currency, brand).
 * Used by the terminal login page to resolve which business the terminal belongs to.
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';
import { normalizePermissions } from '~/lib/permissions';
import { normalizeLayout } from '~/lib/uiTypes';
import { resolveTerminalBusiness, TERMINAL_BUSINESS_COLUMNS, type TerminalBusinessRow } from '~/server/utils/terminalBrand';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) return { error: 'Missing id', businessId: null };

  const { data } = await db.queryOne<TerminalBusinessRow & {
    business_id: string;
    display_name: string;
    role: string;
    pin_length: number;
    permissions: string | null;
    ui_layout: string | null;
  }>(
    `
      SELECT
        t.business_id,
        t.display_name,
        t.role,
        t.pin_length,
        t.permissions,
        t.ui_layout,
        ${TERMINAL_BUSINESS_COLUMNS}
      FROM terminals t
      JOIN businesses b ON b.id = t.business_id
      WHERE t.id = ?
    `,
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

  const business = resolveTerminalBusiness(data);

  return {
    businessId: data.business_id,
    businessName: business.businessName,
    displayName: data.display_name,
    role: data.role,
    pinLength: data.pin_length,
    country: business.country,
    currency: business.currency,
    currencySymbol: business.currencySymbol,
    brand: business.brand,
    theme: normalizeLayout(parsedLayout).theme,
    permissions: normalizePermissions(data.permissions, data.role),
    error: null,
  };
});
