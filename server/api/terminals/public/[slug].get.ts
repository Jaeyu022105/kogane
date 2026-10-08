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
import { findCountry } from '~/lib/currency';

export default defineEventHandler(async (event) => {
  const slug = event.context.params?.slug;
  if (!slug) return { error: 'Missing slug', session: null };

  const { data } = await db.queryOne<{
    id: string;
    business_id: string;
    business_name: string;
    display_name: string;
    role: string;
    pin_length: number;
    permissions: string | null;
    ui_layout: string | null;
    is_public: number;
    business_country?: string | null;
    business_currency?: string | null;
    business_currency_symbol?: string | null;
    business_color_palette?: string | null;
  }>(
    `
      SELECT
        t.id,
        t.business_id,
        b.name as business_name,
        t.display_name,
        t.role,
        t.pin_length,
        t.permissions,
        t.ui_layout,
        t.is_public,
        b.country as business_country,
        b.currency as business_currency,
        b.currency_symbol as business_currency_symbol,
        b.color_palette as business_color_palette
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

  let paletteCountry: string | undefined;
  let paletteCurrency: string | undefined;
  let paletteSymbol: string | undefined;
  try {
    const pal = JSON.parse(data.business_color_palette || '{}');
    paletteCountry = pal.country;
    paletteCurrency = pal.currency;
    paletteSymbol = pal.currencySymbol;
  } catch {
    // Ignore invalid JSON
  }

  const resolvedCountry = findCountry(data.business_country || paletteCountry || 'US');
  const country = data.business_country || paletteCountry || resolvedCountry.code;
  const currency = data.business_currency || paletteCurrency || resolvedCountry.currency;
  const currencySymbol = data.business_currency_symbol || paletteSymbol || resolvedCountry.symbol;

  return {
    session: {
      terminalId: data.id,
      displayName: data.display_name,
      businessName: data.business_name,
      businessId: data.business_id,
      country,
      currency,
      currencySymbol,
      role: effectiveRole,
      permissions: normalizePermissions(data.permissions, effectiveRole),
      uiLayout,
      expiresAt,
    },
    token,
    error: null,
  };
});
