/**
 * POST /api/presets/apply
 * Applies a preset's schema_definition to a business schema.
 * Creates all tables defined in the preset in one operation.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { buildCreateTableSql } from '~/lib/schemaUtils';
import type { SchemaDef } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ businessId: string; presetId: string }>(event);

  if (!body.businessId || !body.presetId) {
    return { error: 'Missing businessId or presetId', success: false };
  }

  const { data: business, error: bizErr } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [body.businessId],
  );

  if (bizErr || !business) return { error: 'Business not found', success: false };
  if (business.admin_user_id !== userId) return { error: 'Forbidden', success: false };

  const { data: preset } = await db.queryOne<{ schema_definition: string }>(
    'SELECT schema_definition FROM presets WHERE id = ?',
    [body.presetId],
  );

  if (!preset) return { error: 'Preset not found', success: false };

  let schemaDef: SchemaDef;
  try {
    schemaDef = typeof preset.schema_definition === 'string'
      ? JSON.parse(preset.schema_definition)
      : preset.schema_definition;
  } catch {
    return { error: 'Invalid preset schema definition', success: false };
  }

  const isDevMode = process.env.DEV_MODE === 'true';
  const dialect = isDevMode ? 'sqlite' : 'postgres';
  const errors: string[] = [];

  for (const table of schemaDef.tables ?? []) {
    const sql = buildCreateTableSql(table, business.schema_name, dialect);
    const { error } = await db.execute(sql);
    if (error) errors.push(`${table.name}: ${error}`);
  }

  if (errors.length) return { error: errors.join('; '), success: false };

  return { success: true, error: null };
});
