/**
 * POST /api/businesses/create
 * Creates a new business record and provisions its schema namespace.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { findCountry } from '~/lib/currency';
import { sanitizeTextInput, validateAndSanitizeRecord } from '~/lib/securityClient';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    name: string;
    country?: string;
    currency?: string;
    currencySymbol?: string;
    colorPalette?: Record<string, any>;
  }>(event);

  const cleanName = sanitizeTextInput(body.name, 120, false).trim();
  if (!cleanName) return { error: 'Business name is required', business: null };

  let cleanPalette: Record<string, any> = {};
  if (body.colorPalette !== undefined && body.colorPalette !== null) {
    try {
      cleanPalette = validateAndSanitizeRecord(body.colorPalette, {
        maxDepth: 6,
        maxStringLength: 1000,
        maxArrayLength: 50,
        maxObjectKeys: 100,
        allowMultiline: false,
      });
    } catch (err) {
      return { error: (err as Error).message, business: null };
    }
  }

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

  const cleanCountryInput = sanitizeTextInput(body.country || cleanPalette?.country, 16, false).trim();
  const resolved = findCountry(cleanCountryInput);
  const countryCode = sanitizeTextInput(body.country, 16, false).trim() || resolved.code;
  const currencyCode = sanitizeTextInput(body.currency, 16, false).trim() || resolved.currency;
  const currencySymbol = sanitizeTextInput(body.currencySymbol, 16, false).trim() || resolved.symbol;

  const mergedPalette = {
    ...cleanPalette,
    country: countryCode,
    currency: currencyCode,
    currencySymbol,
  };

  const { data: business, error } = await db.insert('businesses', {
    admin_user_id: userId,
    name: cleanName,
    color_palette: JSON.stringify(mergedPalette),
    country: countryCode,
    currency: currencyCode,
    currency_symbol: currencySymbol,
    schema_name: schemaName,
  });

  if (error || !business) return { error: error ?? 'Insert failed', business: null };

  return { business, error: null };
});
