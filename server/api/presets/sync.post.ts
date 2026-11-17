/**
 * POST /api/presets/sync
 * Compares a terminal's linked preset version against the latest built-in or business preset
 * version and applies the upstream layout, permissions, and starter tables while preserving
 * each terminal's branding, stationConfig, and resolution.
 */

import { createError, defineEventHandler, readBody } from 'h3';
import type { AuditActionType } from '~/lib/audit';
import { verifyAdmin } from '~/lib/authUtils';
import {
  buildBrandedTerminalLayoutForPreset,
  extractPresetMetaFromLayout,
  findBuiltInBuilderPreset,
  parseJsonObject,
  resolvePresetVersionNumber,
  sanitizePresetSchemaDefinition,
} from '~/lib/builderPresets';
import { db } from '~/lib/db';
import {
  inferPermissionPreset,
  normalizePermissions,
  type TerminalPermissions,
} from '~/lib/permissions';
import { buildCreateTableSql } from '~/lib/schemaUtils';
import { sanitizeTextInput } from '~/lib/securityClient';
import type { UiLayout } from '~/lib/uiTypes';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';
import { ensureStarterBusinessTables, starterTableNamesForPreset } from '~/server/utils/starterTables';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    terminalId?: string;
    businessId?: string;
    presetId?: string;
    force?: boolean;
  }>(event);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const terminalId = typeof body.terminalId === 'string'
    ? sanitizeTextInput(body.terminalId, 128, false).trim()
    : '';
  if (!terminalId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing terminalId' });
  }

  const { data: terminal, error: termErr } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
  }>(
    'SELECT id, business_id, display_name, role, permissions, ui_layout FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (termErr || !terminal) {
    throw createError({ statusCode: 404, statusMessage: 'Terminal not found' });
  }

  const { data: business } = await getBusinessForAdmin(userId, terminal.business_id);
  if (!business || (body.businessId && body.businessId !== terminal.business_id)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const currentMeta = extractPresetMetaFromLayout(terminal.ui_layout);
  const requestedPresetId = typeof body.presetId === 'string' && body.presetId.trim()
    ? sanitizeTextInput(body.presetId, 128, false).trim()
    : null;

  const inferredBuiltIn =
    findBuiltInBuilderPreset(terminal.role) ??
    findBuiltInBuilderPreset(inferPermissionPreset(terminal.permissions)?.key);

  const candidatePresetId = requestedPresetId || currentMeta.presetId || inferredBuiltIn?.id || null;
  if (!candidatePresetId) {
    throw createError({ statusCode: 400, statusMessage: 'Terminal is not linked to a known preset' });
  }

  const { data: dbPreset, error: presetErr } = await db.queryOne<Record<string, unknown>>(
    'SELECT id, business_id, name, preset_key, schema_definition, ui_layout, permissions, version FROM presets WHERE id = ?',
    [candidatePresetId],
  );

  if (presetErr) {
    throw createError({ statusCode: 500, statusMessage: presetErr });
  }

  if (dbPreset?.business_id && String(dbPreset.business_id) !== business.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const builtInPreset = dbPreset ? null : findBuiltInBuilderPreset(candidatePresetId);
  if (!dbPreset && !builtInPreset) {
    throw createError({ statusCode: 404, statusMessage: 'Upstream preset not found' });
  }

  const resolvedPresetId = dbPreset ? String(dbPreset.id) : builtInPreset!.id;
  const resolvedPresetName = dbPreset ? String(dbPreset.name) : builtInPreset!.name;
  const resolvedPresetKey = dbPreset
    ? (typeof dbPreset.preset_key === 'string' && dbPreset.preset_key.trim() ? dbPreset.preset_key.trim() : null)
    : builtInPreset!.presetKey;
  const targetVersion = dbPreset
    ? resolvePresetVersionNumber(dbPreset.version, 1)
    : builtInPreset!.presetVersion;

  const rawLayoutObj = dbPreset
    ? parseJsonObject(dbPreset.ui_layout)
    : (builtInPreset!.layout as unknown as Record<string, unknown>);
  if (!rawLayoutObj || !Array.isArray(rawLayoutObj.elements)) {
    throw createError({ statusCode: 400, statusMessage: 'Upstream preset does not contain a UI layout' });
  }

  const currentVersion = currentMeta.presetVersion ?? 0;
  if (!body.force && currentMeta.presetId === resolvedPresetId && currentVersion >= targetVersion) {
    return {
      success: true,
      updated: false,
      alreadyCurrent: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      presetId: resolvedPresetId,
      presetName: resolvedPresetName,
      terminal: {
        id: terminal.id,
        display_name: terminal.display_name,
        role: terminal.role,
        ui_layout: parseJsonObject(terminal.ui_layout) ?? {},
        permissions: normalizePermissions(terminal.permissions, terminal.role),
      },
      error: null,
    };
  }

  let nextPermissions: TerminalPermissions | null = null;
  if (dbPreset) {
    const rawPerms = parseJsonObject(dbPreset.permissions);
    if (rawPerms && Object.keys(rawPerms).length > 0) {
      nextPermissions = normalizePermissions(rawPerms as Partial<TerminalPermissions>, resolvedPresetKey);
    } else if (resolvedPresetKey) {
      nextPermissions = normalizePermissions({}, resolvedPresetKey);
    }
  } else if (builtInPreset) {
    nextPermissions = normalizePermissions({}, builtInPreset.presetKey);
  }

  const upgradedLayout = buildBrandedTerminalLayoutForPreset({
    templateLayout: rawLayoutObj as unknown as UiLayout,
    presetId: resolvedPresetId,
    presetVersion: targetVersion,
    presetName: resolvedPresetName,
    businessPaletteRaw: business.color_palette,
    existingTerminalLayout: terminal.ui_layout,
  });

  const terminalUpdates: Record<string, unknown> = {
    ui_layout: JSON.stringify(upgradedLayout),
  };
  if (nextPermissions) {
    terminalUpdates.permissions = JSON.stringify(nextPermissions);
  }

  const { error: updateErr } = await db.update('terminals', terminalUpdates, { id: terminal.id });
  if (updateErr) {
    throw createError({ statusCode: 500, statusMessage: updateErr });
  }

  // Ensure any required starter or custom preset tables exist in the business schema.
  if (dbPreset) {
    const cleanSchema = sanitizePresetSchemaDefinition(dbPreset.schema_definition);
    if (cleanSchema?.tables.length) {
      for (const tableDef of cleanSchema.tables) {
        const sql = buildCreateTableSql(tableDef, business.schema_name);
        await db.execute(sql);
      }
    }
  }
  if (resolvedPresetKey) {
    const starterTables = starterTableNamesForPreset(resolvedPresetKey);
    if (starterTables.length > 0) {
      await ensureStarterBusinessTables(business.schema_name, starterTables);
    }
  }

  const finalPermissions = nextPermissions ?? normalizePermissions(terminal.permissions, terminal.role);

  realtimeHub.publish(business.id, {
    table: 'terminals',
    action: 'update',
    recordId: terminal.id,
    data: {
      id: terminal.id,
      ui_layout: upgradedLayout,
      permissions: finalPermissions,
      presetId: resolvedPresetId,
      presetVersion: targetVersion,
    },
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'preset:sync' as AuditActionType,
    targetTable: 'terminals',
    targetId: terminal.id,
    payloadBefore: {
      presetId: currentMeta.presetId,
      presetVersion: currentVersion,
    },
    payloadAfter: {
      presetId: resolvedPresetId,
      presetVersion: targetVersion,
      presetName: resolvedPresetName,
    },
    metadata: {
      event: 'preset:sync',
      presetId: resolvedPresetId,
      fromVersion: currentVersion,
      toVersion: targetVersion,
    },
  });

  return {
    success: true,
    updated: true,
    alreadyCurrent: false,
    fromVersion: currentVersion,
    toVersion: targetVersion,
    presetId: resolvedPresetId,
    presetName: resolvedPresetName,
    terminal: {
      id: terminal.id,
      display_name: terminal.display_name,
      role: terminal.role,
      ui_layout: upgradedLayout,
      permissions: finalPermissions,
    },
    error: null,
  };
});
