/**
 * POST /api/businesses/onboard
 * Creates a new business and provisions feature tables based on selected features.
 * Called once during the first-time admin onboarding flow.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db, getDbProvider } from '~/lib/db';
import { validateIdentifier, buildCreateTableSql } from '~/lib/schemaUtils';
import type { PermissionPresetKey } from '~/lib/permissions';
import type { SchemaDef } from '~/lib/schemaUtils';
import { createManagedTerminal, inferStarterTerminals } from '~/server/utils/managedTerminals';
import { findCountry } from '~/lib/currency';
import { sanitizeImageSrc, sanitizeTextInput, validateAndSanitizeRecord } from '~/lib/securityClient';
import { writeAuditLog } from '~/server/utils/audit';
import { getSqlDialect } from '~/server/utils/business';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);

  const body = await readBody<{
    businessName: string;
    businessType: string;
    features: string[];
    schemaDef: SchemaDef;
    country?: string;
    currency?: string;
    currencySymbol?: string;
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

  const cleanBusinessName = sanitizeTextInput(body.businessName, 120, false).trim();
  if (!cleanBusinessName) return { error: 'Business name is required', business: null };

  const cleanBusinessType = sanitizeTextInput(body.businessType, 64, false).trim();

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

  if (Array.isArray(body.terminalConfigs) && body.terminalConfigs.length > 20) {
    return { error: 'Too many terminal configurations (maximum 20)', business: null };
  }
  if (Array.isArray(body.features) && body.features.length > 50) {
    return { error: 'Too many features specified (maximum 50)', business: null };
  }
  if (Array.isArray(body.schemaDef?.tables) && body.schemaDef.tables.length > 50) {
    return { error: 'Too many tables in schema definition (maximum 50)', business: null };
  }

  const { data: existing } = await db.queryOne<{
    id: string;
    name?: string;
    schema_name: string;
    country?: string | null;
    currency?: string | null;
    currency_symbol?: string | null;
  }>(
    'SELECT id, name, schema_name, country, currency, currency_symbol FROM businesses WHERE admin_user_id = ?',
    [userId],
  );

  const cleanCountryInput = sanitizeTextInput(body.country || cleanPalette?.country, 16, false).trim();
  const resolvedCountry = findCountry(cleanCountryInput);
  const countryCode = sanitizeTextInput(body.country, 16, false).trim() || resolvedCountry.code;
  const currencyCode = sanitizeTextInput(body.currency, 16, false).trim() || resolvedCountry.currency;
  const currencySymbol = sanitizeTextInput(body.currencySymbol, 16, false).trim() || resolvedCountry.symbol;

  const mergedPalette = {
    ...cleanPalette,
    businessType: cleanBusinessType || cleanPalette?.businessType || null,
    country: countryCode,
    currency: currencyCode,
    currencySymbol: currencySymbol,
  };

  const safeLogoUrl = body.logoUrl ? (sanitizeImageSrc(body.logoUrl) || null) : null;

  let schemaName = '';
  let business: ({ id: string } & Record<string, unknown>) | null = null;

  if (existing) {
    if (!body.override) return { error: 'Admin already has a business. Use override to overwrite.', business: null };
    
    schemaName = existing.schema_name;
    const { error: updateErr } = await db.update('businesses', {
      name: cleanBusinessName,
      logo_url: safeLogoUrl,
      color_palette: JSON.stringify(mergedPalette),
      country: countryCode,
      currency: currencyCode,
      currency_symbol: currencySymbol,
    }, { id: existing.id });

    if (updateErr) return { error: updateErr, business: null };
    
    const { data: b } = await db.queryOne<{ id: string } & Record<string, unknown>>(
      'SELECT * FROM businesses WHERE id = ?',
      [existing.id],
    );
    business = b;
  } else {
    const cleanId = userId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    schemaName = `biz_${cleanId.slice(0, 20)}`;

    try {
      validateIdentifier(schemaName);
    } catch {
      return { error: 'Could not generate a valid schema name', business: null };
    }

    const { data: newBiz, error } = await db.insert<{ id: string } & Record<string, unknown>>('businesses', {
      admin_user_id: userId,
      name: cleanBusinessName,
      logo_url: safeLogoUrl,
      color_palette: JSON.stringify(mergedPalette),
      country: countryCode,
      currency: currencyCode,
      currency_symbol: currencySymbol,
      schema_name: schemaName,
    });

    if (error || !newBiz) return { error: error ?? 'Insert failed', business: null };
    business = newBiz;
  }

  const dialect = getSqlDialect();

  if (getDbProvider() === 'supabase') {
    await db.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
  }

  const tableErrors: string[] = [];

  for (const table of body.schemaDef?.tables ?? []) {
    let sql: string;
    try {
      sql = buildCreateTableSql(table, schemaName, dialect);
    } catch (err) {
      tableErrors.push(`${table?.name ?? 'table'}: ${(err as Error).message}`);
      continue;
    }
    const { error: tableErr } = await db.execute(sql);
    if (tableErr) tableErrors.push(`${table.name}: ${tableErr}`);
  }

  if (business?.id) {
    if (body.override) {
      await db.delete('terminals', { business_id: business.id });
    }

    const cleanFeatures = Array.isArray(body.features)
      ? body.features.map((f) => sanitizeTextInput(f, 64, false).trim()).filter(Boolean)
      : [];

    const starterTerminals = body.terminalConfigs?.length
      ? body.terminalConfigs.map((t) => ({
          ...t,
          displayName: sanitizeTextInput(t.displayName, 100, false).trim() || 'Terminal',
          layoutVariant: t.layoutVariant ? sanitizeTextInput(t.layoutVariant, 64, false).trim() : undefined,
          resolution: t.resolution ? sanitizeTextInput(t.resolution, 32, false).trim() : undefined,
          pin: t.pin && /^\d{4,8}$/.test(String(t.pin)) ? String(t.pin) : undefined,
        }))
      : inferStarterTerminals(cleanBusinessType, cleanFeatures);

    const createdTerminals: Array<{ id: string | null; displayName: string; presetKey: string }> = [];

    for (const terminal of starterTerminals) {
      const created = await createManagedTerminal({
        businessId: business.id,
        businessSchema: schemaName,
        displayName: terminal.displayName,
        presetKey: terminal.presetKey,
        pin: terminal.pin,
        resolution: terminal.resolution,
        layoutVariant: terminal.layoutVariant,
        brandConfig: mergedPalette,
      });

      if (created.error) {
        tableErrors.push(`${terminal.displayName}: ${created.error}`);
      } else {
        createdTerminals.push({
          id: (created.terminal as any)?.id ?? null,
          displayName: terminal.displayName,
          presetKey: terminal.presetKey,
        });
      }
    }

    await writeAuditLog({
      businessId: business.id,
      actorId: userId,
      actorType: 'admin',
      actorName: 'Admin',
      actionType: existing ? 'update' : 'insert',
      targetTable: 'business',
      targetId: business.id,
      payloadBefore: existing ? {
        id: existing.id,
        name: existing.name ?? null,
        schema_name: existing.schema_name,
        country: existing.country ?? null,
        currency: existing.currency ?? null,
        currency_symbol: existing.currency_symbol ?? null,
      } : null,
      payloadAfter: {
        id: business.id,
        name: cleanBusinessName,
        business_type: cleanBusinessType || null,
        schema_name: schemaName,
        country: countryCode,
        currency: currencyCode,
        currency_symbol: currencySymbol,
        features: cleanFeatures,
        tables: (body.schemaDef?.tables ?? []).map((t) => t?.name).filter(Boolean),
        terminals: createdTerminals,
      },
      metadata: {
        event: 'business:onboard',
        override: Boolean(existing && body.override),
        business_type: cleanBusinessType || null,
        terminal_count: createdTerminals.length,
        table_errors: tableErrors.length ? tableErrors : null,
      },
    });
  }

  return {
    business,
    tableErrors: tableErrors.length ? tableErrors : null,
    error: null,
  };
});
