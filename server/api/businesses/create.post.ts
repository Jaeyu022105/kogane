/**
 * POST /api/businesses/create
 * Creates a new business record and provisions its schema namespace.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { findCountry } from '~/lib/currency';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    name: string;
    country?: string;
    currency?: string;
    currencySymbol?: string;
    colorPalette?: Record<string, any>;
  }>(event);

  if (!body.name?.trim()) return { error: 'Business name is required', business: null };

  // Check this admin doesn't already have a business
  const { data: existing } = await db.queryOne(
    'SELECT id FROM businesses WHERE admin_user_id = ?',
    [userId],
  );
  if (existing) return { error: 'Admin already has a business', business: null };

  // Generate a schema name from the user ID — strip dashes to make it a valid identifier
  const schemaName = `biz_${userId.replace(/-/g, '').slice(0, 20)}`;

  try {
    validateIdentifier(schemaName);
  } catch {
    return { error: 'Could not generate a valid schema name', business: null };
  }

  const resolved = findCountry(body.country || body.colorPalette?.country);
  const countryCode = body.country || resolved.code;
  const currencyCode = body.currency || resolved.currency;
  const currencySymbol = body.currencySymbol || resolved.symbol;

  const mergedPalette = {
    ...(body.colorPalette || {}),
    country: countryCode,
    currency: currencyCode,
    currencySymbol,
  };

  const { data: business, error } = await db.insert('businesses', {
    admin_user_id: userId,
    name: body.name.trim(),
    color_palette: JSON.stringify(mergedPalette),
    country: countryCode,
    currency: currencyCode,
    currency_symbol: currencySymbol,
    schema_name: schemaName,
  });

  if (error || !business) return { error: error ?? 'Insert failed', business: null };

  // Provision the schema namespace (no-op in SQLite — prefixing handles it)
  const isDevMode = process.env.DEV_MODE === 'true' || (!process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY);
  if (!isDevMode) {
    await db.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
  }

  return { business, error: null };
});
