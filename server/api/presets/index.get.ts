/**
 * GET /api/presets
 * Returns built-in system presets plus custom presets owned by the authenticated admin's business.
 */

import { createError, defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import {
  ALL_BUILDER_PRESETS,
  formatBuiltInPresetRecord,
  normalizeDbPresetRow,
  terminalMatchesPreset,
  type ApiPresetRecord,
} from '~/lib/builderPresets';
import { db } from '~/lib/db';
import { getBusinessForAdmin, getBusinessForAdminUser } from '~/server/utils/business';
import { STARTER_BUSINESS_TABLES, starterTableNamesForPreset } from '~/server/utils/starterTables';

interface RawPresetRow {
  id: string;
  business_id?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  preset_key?: string | null;
  schema_definition?: string | null;
  ui_layout?: string | null;
  permissions?: string | null;
  version?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const query = getQuery(event);
  const requestedBusinessId = typeof query.businessId === 'string' && query.businessId.trim()
    ? query.businessId.trim()
    : null;

  const businessResult = requestedBusinessId
    ? await getBusinessForAdmin(userId, requestedBusinessId)
    : await getBusinessForAdminUser(userId);

  if (requestedBusinessId && (businessResult.error || !businessResult.data)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  if (!businessResult.data) {
    throw createError({ statusCode: 404, statusMessage: businessResult.error ?? 'Business not found' });
  }

  const business = businessResult.data;

  // Separate queries preserve FirestoreAdapter compatibility (no SQL OR in WHERE clauses).
  const [terminalsRes, globalPresetsRes, customPresetsRes] = await Promise.all([
    db.query<{ id: string; role: string; ui_layout: string | null }>(
      'SELECT id, role, ui_layout FROM terminals WHERE business_id = ?',
      [business.id],
    ),
    db.query<RawPresetRow>(
      'SELECT id, business_id, name, description, category, preset_key, schema_definition, ui_layout, permissions, version, updated_at, created_at FROM presets WHERE business_id IS NULL ORDER BY created_at ASC',
      [],
    ),
    db.query<RawPresetRow>(
      'SELECT id, business_id, name, description, category, preset_key, schema_definition, ui_layout, permissions, version, updated_at, created_at FROM presets WHERE business_id = ? ORDER BY updated_at DESC, created_at DESC',
      [business.id],
    ),
  ]);

  if (globalPresetsRes.error || customPresetsRes.error) {
    throw createError({
      statusCode: 500,
      statusMessage: globalPresetsRes.error ?? customPresetsRes.error ?? 'Failed to load presets',
    });
  }

  const businessTerminals = terminalsRes.data ?? [];
  const countLinked = (presetId: string, presetKey?: string | null) =>
    businessTerminals.filter((term) => terminalMatchesPreset(term, presetId, presetKey)).length;

  const customPresets: ApiPresetRecord[] = (customPresetsRes.data ?? []).map((row) =>
    normalizeDbPresetRow(row as unknown as Record<string, unknown>, countLinked(row.id, null)),
  );

  const builtInSystemPresets: ApiPresetRecord[] = ALL_BUILDER_PRESETS.map((preset) => {
    const tableNames = starterTableNamesForPreset(preset.presetKey);
    const tables = tableNames
      .map((tableName) => STARTER_BUSINESS_TABLES[tableName])
      .filter((tableDef): tableDef is NonNullable<typeof tableDef> => Boolean(tableDef));

    return formatBuiltInPresetRecord(preset, {
      schemaDefinition: tables.length ? { tables } : {},
      linkedTerminalCount: countLinked(preset.id, preset.presetKey),
    });
  });

  const builtInIdSet = new Set(builtInSystemPresets.map((item) => item.id));
  const extraGlobalPresets: ApiPresetRecord[] = (globalPresetsRes.data ?? [])
    .filter((row) => !builtInIdSet.has(row.id))
    .map((row) =>
      normalizeDbPresetRow(row as unknown as Record<string, unknown>, countLinked(row.id, row.preset_key)),
    );

  const systemPresets = [...builtInSystemPresets, ...extraGlobalPresets];
  const presets = [...customPresets, ...systemPresets];

  const latestVersions: Record<string, number> = {};
  for (const item of presets) {
    latestVersions[item.id] = item.version;
    if (!item.is_custom && item.preset_key) {
      latestVersions[item.preset_key] = item.version;
    }
  }

  return {
    success: true,
    businessId: business.id,
    presets,
    customPresets,
    systemPresets,
    latestVersions,
    error: null,
  };
});
