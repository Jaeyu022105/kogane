/**
 * POST /api/businesses/create
 * Creates a new business record and provisions its schema namespace.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ name: string; colorPalette?: Record<string, string> }>(event);

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

  const { data: business, error } = await db.insert('businesses', {
    admin_user_id: userId,
    name: body.name.trim(),
    color_palette: JSON.stringify(body.colorPalette ?? {}),
    schema_name: schemaName,
  });

  if (error || !business) return { error: error ?? 'Insert failed', business: null };

  // Provision the schema namespace (no-op in SQLite — prefixing handles it)
  const isDevMode = process.env.DEV_MODE === 'true';
  if (!isDevMode) {
    await db.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
  }

  return { business, error: null };
});
