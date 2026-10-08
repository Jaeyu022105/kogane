/**
 * GET /api/terminals/[id]/meta
 * Returns lightweight metadata for a terminal (businessId, display name, currency).
 * Used by the terminal login page to resolve which business the terminal belongs to.
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';
import { normalizePermissions } from '~/lib/permissions';
import { normalizeLayout } from '~/lib/uiTypes';
import { findCountry } from '~/lib/currency';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) return { error: 'Missing id', businessId: null };

  const { data } = await db.queryOne<{
    business_id: string;
    business_name: string;
    display_name: string;
    role: string;
    pin_length: number;
    permissions: string | null;
    ui_layout: string | null;
    business_country?: string | null;
    business_currency?: string | null;
    business_currency_symbol?: string | null;
    business_color_palette?: string | null;
  }>(
    `
      SELECT
        t.business_id,
        b.name as business_name,
        t.display_name,
        t.role,
        t.pin_length,
        t.permissions,
        t.ui_layout,
        b.country as business_country,
        b.currency as business_currency,
        b.currency_symbol as business_currency_symbol,
        b.color_palette as business_color_palette
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
    businessId: data.business_id,
    businessName: data.business_name,
    displayName: data.display_name,
    role: data.role,
    pinLength: data.pin_length,
    country,
    currency,
    currencySymbol,
    theme: normalizeLayout(parsedLayout).theme,
    permissions: normalizePermissions(data.permissions, data.role),
    error: null,
  };
});
