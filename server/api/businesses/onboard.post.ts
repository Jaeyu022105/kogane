/**
 * POST /api/businesses/onboard
 * Creates a new business and provisions feature tables based on selected features.
 * Called once during the first-time admin onboarding flow.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier, buildCreateTableSql } from '~/lib/schemaUtils';
import type { SchemaDef } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);

  const body = await readBody<{
    businessName: string;
    businessType: string;
    features: string[];
    schemaDef: SchemaDef;
  }>(event);

  if (!body.businessName?.trim()) return { error: 'Business name is required', business: null };

  const { data: existing } = await db.queryOne(
    'SELECT id FROM businesses WHERE admin_user_id = ?',
    [userId],
  );

  if (existing) return { error: 'Admin already has a business', business: null };

  const schemaName = `biz_${userId.replace(/-/g, '').slice(0, 20)}`;

  try {
    validateIdentifier(schemaName);
  } catch {
    return { error: 'Could not generate a valid schema name', business: null };
  }

  const { data: business, error } = await db.insert('businesses', {
    admin_user_id: userId,
    name: body.businessName.trim(),
    color_palette: JSON.stringify({}),
    schema_name: schemaName,
  });

  if (error || !business) return { error: error ?? 'Insert failed', business: null };

  const isDevMode = process.env.DEV_MODE === 'true';
  const dialect   = isDevMode ? 'sqlite' : 'postgres';

  if (!isDevMode) {
    await db.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
  }

  const tableErrors: string[] = [];

  for (const table of body.schemaDef?.tables ?? []) {
    const sql = buildCreateTableSql(table, schemaName, dialect);
    const { error: tableErr } = await db.execute(sql);
    if (tableErr) tableErrors.push(`${table.name}: ${tableErr}`);
  }

  return {
    business,
    tableErrors: tableErrors.length ? tableErrors : null,
    error: null,
  };
});
