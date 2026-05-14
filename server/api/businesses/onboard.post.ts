/**
 * POST /api/businesses/onboard
 * Creates a new business and provisions feature tables based on selected features.
 * Called once during the first-time admin onboarding flow.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier, buildCreateTableSql } from '~/lib/schemaUtils';
import type { PermissionPresetKey } from '~/lib/permissions';
import type { SchemaDef } from '~/lib/schemaUtils';
import { createManagedTerminal, inferStarterTerminals } from '~/server/utils/managedTerminals';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);

  const body = await readBody<{
    businessName: string;
    businessType: string;
    features: string[];
    schemaDef: SchemaDef;
    logoUrl?: string;
    colorPalette?: any;
    terminalConfigs?: Array<{
      displayName: string;
      presetKey: PermissionPresetKey;
      layoutVariant?: string;
      pin?: string;
      resolution?: string;
    }>;
    override?: boolean;
  }>(event);

  if (!body.businessName?.trim()) return { error: 'Business name is required', business: null };

  const { data: existing } = await db.queryOne<{ id: string; schema_name: string }>(
    'SELECT id, schema_name FROM businesses WHERE admin_user_id = ?',
    [userId],
  );

  let schemaName = '';
  let business = null;

  if (existing) {
    if (!body.override) return { error: 'Admin already has a business. Use override to overwrite.', business: null };
    
    schemaName = existing.schema_name;
    const { error: updateErr } = await db.update('businesses', {
      name: body.businessName.trim(),
      logo_url: body.logoUrl || null,
      color_palette: JSON.stringify(body.colorPalette || {}),
    }, { id: existing.id });

    if (updateErr) return { error: updateErr, business: null };
    
    const { data: b } = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [existing.id]);
    business = b;
  } else {
    schemaName = `biz_${userId.replace(/-/g, '').slice(0, 20)}`;

    try {
      validateIdentifier(schemaName);
    } catch {
      return { error: 'Could not generate a valid schema name', business: null };
    }

    const { data: newBiz, error } = await db.insert('businesses', {
      admin_user_id: userId,
      name: body.businessName.trim(),
      logo_url: body.logoUrl || null,
      color_palette: JSON.stringify(body.colorPalette || {}),
      schema_name: schemaName,
    });

    if (error || !newBiz) return { error: error ?? 'Insert failed', business: null };
    business = newBiz;
  }

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

  if (business?.id) {
    if (body.override) {
      await db.delete('terminals', { business_id: business.id });
    }

    const starterTerminals = body.terminalConfigs?.length
      ? body.terminalConfigs
      : inferStarterTerminals(body.businessType, body.features ?? []);

    for (const terminal of starterTerminals) {
      const created = await createManagedTerminal({
        businessId: business.id,
        businessSchema: schemaName,
        displayName: terminal.displayName,
        presetKey: terminal.presetKey,
        pin: terminal.pin,
        resolution: terminal.resolution,
        layoutVariant: terminal.layoutVariant,
        brandConfig: body.colorPalette ?? {},
      });

      if (created.error) {
        tableErrors.push(`${terminal.displayName}: ${created.error}`);
      }
    }
  }

  return {
    business,
    tableErrors: tableErrors.length ? tableErrors : null,
    error: null,
  };
});
