/**
 * PATCH /api/businesses/theme
 * Updates the color palette, logo, country, and currency for the authenticated admin's business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { findCountry } from '~/lib/currency';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    logoUrl?: string;
    colorPalette?: Record<string, any>;
    country?: string;
    currency?: string;
    currencySymbol?: string;
    name?: string;
  }>(event);

  const updates: Record<string, unknown> = {};
  if (body.logoUrl !== undefined) updates.logo_url = body.logoUrl;
  if (body.name !== undefined && body.name.trim()) updates.name = body.name.trim();

  // If country is provided, resolve corresponding currency and currency symbol if not explicitly given
  if (body.country !== undefined) {
    const resolved = findCountry(body.country);
    updates.country = resolved.code;
    updates.currency = body.currency || resolved.currency;
    updates.currency_symbol = body.currencySymbol || resolved.symbol;
  } else {
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.currencySymbol !== undefined) updates.currency_symbol = body.currencySymbol;
  }

  if (body.colorPalette !== undefined) {
    const paletteWithCurrency = {
      ...body.colorPalette,
      ...(updates.country ? { country: updates.country } : {}),
      ...(updates.currency ? { currency: updates.currency } : {}),
      ...(updates.currency_symbol ? { currencySymbol: updates.currency_symbol } : {}),
    };
    updates.color_palette = JSON.stringify(paletteWithCurrency);
  } else if (updates.country || updates.currency || updates.currency_symbol) {
    // Keep color_palette JSON synchronized with country / currency
    const { data: existing } = await db.queryOne<{ color_palette: string | null }>(
      'SELECT color_palette FROM businesses WHERE admin_user_id = ?',
      [userId],
    );
    let parsed: Record<string, any> = {};
    try {
      parsed = existing?.color_palette ? JSON.parse(existing.color_palette) : {};
    } catch {
      parsed = {};
    }
    if (updates.country) parsed.country = updates.country;
    if (updates.currency) parsed.currency = updates.currency;
    if (updates.currency_symbol) parsed.currencySymbol = updates.currency_symbol;
    updates.color_palette = JSON.stringify(parsed);
  }

  if (!Object.keys(updates).length) return { error: 'No updates provided', success: false };

  const { error } = await db.update('businesses', updates, { admin_user_id: userId });

  if (error) return { error, success: false };

  return { success: true, error: null };
});
