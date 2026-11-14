/**
 * PATCH /api/presets/:id
 * Updates a business-owned custom preset, increments its version, and optionally propagates
 * the updated UI layout and permissions to all linked terminals while preserving terminal branding.
 */

import { createError, defineEventHandler, readBody } from 'h3';
import type { AuditActionType } from '~/lib/audit';
import { verifyAdmin } from '~/lib/authUtils';
import {
  buildBrandedTerminalLayoutForPreset,
  findBuiltInBuilderPreset,
  normalizeDbPresetRow,
  normalizePresetPermissionsInput,
  parseJsonObject,
  resolvePresetVersionNumber,
  sanitizePresetLayoutInput,
  sanitizePresetSchemaDefinition,
  terminalMatchesPreset,
} from '~/lib/builderPresets';
import { db } from '~/lib/db';
import { normalizePermissions, type TerminalPermissions } from '~/lib/permissions';
import { buildCreateTableSql } from '~/lib/schemaUtils';
import { sanitizeTextInput } from '~/lib/securityClient';
import type { UiLayout } from '~/lib/uiTypes';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin, getSqlDialect } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const presetId = event.context.params?.id;

  if (!presetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing preset id' });
  }

  const { data: existing, error: fetchErr } = await db.queryOne<Record<string, unknown>>(
    'SELECT id, business_id, name, description, category, preset_key, schema_definition, ui_layout, permissions, version, updated_at, created_at FROM presets WHERE id = ?',
    [presetId],
  );

  if (fetchErr) {
    throw createError({ statusCode: 500, statusMessage: fetchErr });
  }

  if (!existing) {
    if (findBuiltInBuilderPreset(presetId)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Built-in system presets cannot be modified directly. Create a custom copy instead.',
      });
    }
    throw createError({ statusCode: 404, statusMessage: 'Preset not found' });
  }

  if (!existing.business_id) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Built-in global presets cannot be modified directly.',
    });
  }

  const { data: business } = await getBusinessForAdmin(userId, String(existing.business_id));
  if (!business) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const body = await readBody<{
    name?: string;
    description?: string | null;
    category?: string | null;
    presetKey?: string | null;
    preset_key?: string | null;
    uiLayout?: unknown;
    ui_layout?: unknown;
    permissions?: unknown;
    schemaDef?: unknown;
    schemaDefinition?: unknown;
    schema_definition?: unknown;
    syncLinkedTerminals?: boolean;
    applySchema?: boolean;
  }>(event);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const updates: Record<string, unknown> = {};
  const previousVersion = resolvePresetVersionNumber(existing.version, 1);

  if (body.name !== undefined) {
    const cleanName = sanitizeTextInput(body.name, 120, false).trim();
    if (!cleanName) {
      throw createError({ statusCode: 400, statusMessage: 'Preset name cannot be empty' });
    }
    updates.name = cleanName;
  }

  if (body.description !== undefined) {
    const desc = body.description != null ? sanitizeTextInput(body.description, 1000, true).trim() : '';
    updates.description = desc || null;
  }

  if (body.category !== undefined) {
    const cat = sanitizeTextInput(body.category, 60, false).trim();
    updates.category = cat || 'custom';
  }

  if (body.presetKey !== undefined || body.preset_key !== undefined) {
    const rawKey = sanitizeTextInput(body.presetKey ?? body.preset_key, 80, false).trim();
    updates.preset_key = rawKey || null;
  }

  const rawLayout = body.uiLayout !== undefined ? body.uiLayout : body.ui_layout;
  if (rawLayout !== undefined) {
    try {
      const cleanLayout = rawLayout === null ? {} : sanitizePresetLayoutInput(rawLayout);
      updates.ui_layout = JSON.stringify(cleanLayout);
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: (err as Error).message });
    }
  }

  if (body.permissions !== undefined) {
    try {
      const keyForFallback = (updates.preset_key as string | null | undefined) ?? (existing.preset_key as string | null);
      const normalizedPerms = normalizePresetPermissionsInput(body.permissions, keyForFallback);
      updates.permissions = JSON.stringify(normalizedPerms ?? {});
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: (err as Error).message });
    }
  }

  const rawSchema = body.schemaDef !== undefined
    ? body.schemaDef
    : body.schemaDefinition !== undefined
      ? body.schemaDefinition
      : body.schema_definition;
  if (rawSchema !== undefined) {
    try {
      const cleanSchema = sanitizePresetSchemaDefinition(rawSchema);
      updates.schema_definition = JSON.stringify(cleanSchema ?? {});
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: (err as Error).message });
    }
  }

  const hasContentUpdates = Object.keys(updates).length > 0;
  if (!hasContentUpdates && body.syncLinkedTerminals !== true) {
    throw createError({ statusCode: 400, statusMessage: 'No updates provided' });
  }

  const nowIso = new Date().toISOString();
  let updatedRow: Record<string, unknown> = existing;
  let nextVersion = previousVersion;

  if (hasContentUpdates) {
    nextVersion = previousVersion + 1;
    updates.version = nextVersion;
    updates.updated_at = nowIso;

    const { error: updateErr } = await db.update(
      'presets',
      updates,
      { id: String(existing.id) },
    );

    if (updateErr) {
      throw createError({ statusCode: 500, statusMessage: updateErr });
    }
    updatedRow = { ...existing, ...updates };
  }

  const nextName = String(updatedRow.name ?? existing.name);
  const nextPresetKey = typeof updatedRow.preset_key === 'string' ? updatedRow.preset_key : null;
  const effectiveLayoutObj = parseJsonObject(updatedRow.ui_layout);
  const hasTemplateLayout = Boolean(
    effectiveLayoutObj && Array.isArray(effectiveLayoutObj.elements) && effectiveLayoutObj.elements.length > 0,
  );
  const rawPermObj = parseJsonObject(updatedRow.permissions);
  const hasExplicitPermissions = Boolean(rawPermObj && Object.keys(rawPermObj).length > 0);
  const effectivePermissions: TerminalPermissions | null = hasExplicitPermissions
    ? normalizePermissions(rawPermObj as Partial<TerminalPermissions>, nextPresetKey)
    : (nextPresetKey ? normalizePermissions({}, nextPresetKey) : null);

  const { data: businessTerminals } = await db.query<{
    id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
  }>(
    'SELECT id, display_name, role, permissions, ui_layout FROM terminals WHERE business_id = ?',
    [business.id],
  );

  const linkedTerminals = (businessTerminals ?? []).filter((term) =>
    terminalMatchesPreset(term, String(existing.id), null),
  );

  const syncedTerminalIds: string[] = [];

  if (body.syncLinkedTerminals === true) {
    if (body.applySchema === true) {
      const parsedSchema = sanitizePresetSchemaDefinition(updatedRow.schema_definition);
      if (parsedSchema?.tables.length) {
        const dialect = getSqlDialect();
        for (const tableDef of parsedSchema.tables) {
          const sql = buildCreateTableSql(tableDef, business.schema_name, dialect);
          const execRes = await db.execute(sql);
          if (execRes.error) {
            throw createError({ statusCode: 500, statusMessage: execRes.error });
          }
        }
      }
    }

    for (const term of linkedTerminals) {
      const terminalUpdates: Record<string, unknown> = {};
      let upgradedLayout: Record<string, unknown> | null = null;

      if (hasTemplateLayout && effectiveLayoutObj) {
        upgradedLayout = buildBrandedTerminalLayoutForPreset({
          templateLayout: effectiveLayoutObj as unknown as UiLayout,
          presetId: String(existing.id),
          presetVersion: nextVersion,
          presetName: nextName,
          businessPaletteRaw: business.color_palette,
          existingTerminalLayout: term.ui_layout,
        });
        terminalUpdates.ui_layout = JSON.stringify(upgradedLayout);
      }

      if (effectivePermissions) {
        terminalUpdates.permissions = JSON.stringify(effectivePermissions);
      }

      if (Object.keys(terminalUpdates).length === 0) continue;

      const { error: termUpdateErr } = await db.update('terminals', terminalUpdates, { id: term.id });
      if (termUpdateErr) continue;

      syncedTerminalIds.push(term.id);

      realtimeHub.publish(business.id, {
        table: 'terminals',
        action: 'update',
        recordId: term.id,
        data: {
          id: term.id,
          ...(upgradedLayout ? { ui_layout: upgradedLayout } : {}),
          ...(effectivePermissions ? { permissions: effectivePermissions } : {}),
          presetId: String(existing.id),
          presetVersion: nextVersion,
        },
      });
    }
  }

  const formattedPreset = normalizeDbPresetRow(updatedRow, linkedTerminals.length);

  realtimeHub.publish(business.id, {
    table: 'presets',
    action: 'update',
    recordId: formattedPreset.id,
    data: formattedPreset as unknown as Record<string, unknown>,
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'preset:update' as AuditActionType,
    targetTable: 'presets',
    targetId: formattedPreset.id,
    payloadBefore: {
      name: existing.name,
      category: existing.category,
      preset_key: existing.preset_key,
      version: previousVersion,
    },
    payloadAfter: {
      name: formattedPreset.name,
      category: formattedPreset.category,
      preset_key: formattedPreset.preset_key,
      version: formattedPreset.version,
      syncedTerminalIds,
    },
    metadata: {
      event: 'preset:update',
      syncLinkedTerminals: Boolean(body.syncLinkedTerminals),
      syncedCount: syncedTerminalIds.length,
    },
  });

  return {
    success: true,
    preset: formattedPreset,
    syncedTerminalIds,
    syncedCount: syncedTerminalIds.length,
    error: null,
  };
});
