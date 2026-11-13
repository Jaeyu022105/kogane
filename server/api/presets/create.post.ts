/**
 * POST /api/presets/create
 * Creates a business-scoped custom preset from an existing terminal, a custom layout/permissions
 * payload, or a custom schema definition.
 */

import { createError, defineEventHandler, readBody } from 'h3';
import type { AuditActionType } from '~/lib/audit';
import { verifyAdmin } from '~/lib/authUtils';
import {
  attachPresetMetaToLayout,
  normalizeDbPresetRow,
  normalizePresetPermissionsInput,
  parseJsonObject,
  sanitizePresetLayoutInput,
  sanitizePresetSchemaDefinition,
} from '~/lib/builderPresets';
import { db } from '~/lib/db';
import { DEFAULT_TERMINAL_PERMISSIONS, presetByRoleOrKey } from '~/lib/permissions';
import { sanitizeTextInput } from '~/lib/securityClient';
import type { UiLayout } from '~/lib/uiTypes';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin, getBusinessForAdminUser } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    businessId?: string;
    name?: string;
    description?: string | null;
    category?: string | null;
    presetKey?: string | null;
    preset_key?: string | null;
    terminalId?: string | null;
    uiLayout?: unknown;
    ui_layout?: unknown;
    permissions?: unknown;
    schemaDef?: unknown;
    schemaDefinition?: unknown;
    schema_definition?: unknown;
    linkTerminal?: boolean;
  }>(event);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const name = sanitizeTextInput(body.name, 120, false).trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Preset name is required' });
  }

  const descriptionRaw = body.description != null ? sanitizeTextInput(body.description, 1000, true).trim() : '';
  const description = descriptionRaw || null;
  const category = sanitizeTextInput(body.category, 60, false).trim() || 'custom';
  const requestedBusinessId = typeof body.businessId === 'string' && body.businessId.trim()
    ? body.businessId.trim()
    : null;
  const terminalId = typeof body.terminalId === 'string' && body.terminalId.trim()
    ? sanitizeTextInput(body.terminalId, 128, false).trim()
    : null;

  let sourceTerminal: {
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
  } | null = null;

  let businessIdToResolve = requestedBusinessId;

  if (terminalId) {
    const { data: term, error: termErr } = await db.queryOne<{
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
    if (termErr || !term) {
      throw createError({ statusCode: 404, statusMessage: 'Source terminal not found' });
    }
    if (requestedBusinessId && term.business_id !== requestedBusinessId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }
    sourceTerminal = term;
    businessIdToResolve = term.business_id;
  }

  const businessResult = businessIdToResolve
    ? await getBusinessForAdmin(userId, businessIdToResolve)
    : await getBusinessForAdminUser(userId);

  if (businessIdToResolve && (businessResult.error || !businessResult.data)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  if (!businessResult.data) {
    throw createError({ statusCode: 404, statusMessage: businessResult.error ?? 'Business not found' });
  }

  const business = businessResult.data;

  const rawLayout = body.uiLayout ?? body.ui_layout ?? sourceTerminal?.ui_layout ?? null;
  const rawSchema = body.schemaDef ?? body.schemaDefinition ?? body.schema_definition ?? null;

  if (rawLayout == null && rawSchema == null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a source terminal, UI layout, or schema definition',
    });
  }

  let cleanLayout: (UiLayout & Record<string, unknown>) | null = null;
  if (rawLayout != null) {
    try {
      cleanLayout = sanitizePresetLayoutInput(rawLayout);
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: (err as Error).message });
    }
  }

  let cleanSchema = null;
  if (rawSchema != null) {
    try {
      cleanSchema = sanitizePresetSchemaDefinition(rawSchema);
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: (err as Error).message });
    }
  }

  const rawKeyInput = sanitizeTextInput(body.presetKey ?? body.preset_key, 80, false).trim();
  const inferredKey = sourceTerminal ? (presetByRoleOrKey(sourceTerminal.role)?.key ?? null) : null;
  const presetKey = rawKeyInput
    ? (presetByRoleOrKey(rawKeyInput)?.key ?? rawKeyInput)
    : inferredKey;

  let cleanPermissions = DEFAULT_TERMINAL_PERMISSIONS;
  try {
    const normalized = normalizePresetPermissionsInput(
      body.permissions ?? sourceTerminal?.permissions ?? null,
      presetKey ?? sourceTerminal?.role ?? null,
    );
    if (normalized) {
      cleanPermissions = normalized;
    }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message });
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await db.insert<Record<string, unknown>>('presets', {
    business_id: business.id,
    name,
    description,
    category,
    preset_key: presetKey,
    schema_definition: JSON.stringify(cleanSchema ?? {}),
    ui_layout: JSON.stringify(cleanLayout ?? {}),
    permissions: JSON.stringify(cleanPermissions),
    version: 1,
    updated_at: nowIso,
    created_at: nowIso,
  });

  if (insertError || !inserted) {
    throw createError({ statusCode: 500, statusMessage: insertError ?? 'Failed to create preset' });
  }

  let linkedCount = 0;
  if (body.linkTerminal === true && sourceTerminal && cleanLayout) {
    const existingTermObj = parseJsonObject(sourceTerminal.ui_layout);
    const linkedLayout = attachPresetMetaToLayout(cleanLayout, {
      presetId: String(inserted.id),
      presetVersion: 1,
      presetName: name,
      brandConfig: parseJsonObject(existingTermObj?.brandConfig),
      stationConfig: parseJsonObject(existingTermObj?.stationConfig),
    });
    const { error: linkErr } = await db.update(
      'terminals',
      { ui_layout: JSON.stringify(linkedLayout) },
      { id: sourceTerminal.id },
    );
    if (!linkErr) {
      linkedCount = 1;
      realtimeHub.publish(business.id, {
        table: 'terminals',
        action: 'update',
        recordId: sourceTerminal.id,
        data: {
          id: sourceTerminal.id,
          ui_layout: linkedLayout,
          presetId: String(inserted.id),
          presetVersion: 1,
        },
      });
    }
  }

  const formattedPreset = normalizeDbPresetRow(inserted, linkedCount);

  realtimeHub.publish(business.id, {
    table: 'presets',
    action: 'insert',
    recordId: formattedPreset.id,
    data: formattedPreset as unknown as Record<string, unknown>,
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'preset:create' as AuditActionType,
    targetTable: 'presets',
    targetId: formattedPreset.id,
    payloadAfter: {
      id: formattedPreset.id,
      name: formattedPreset.name,
      category: formattedPreset.category,
      preset_key: formattedPreset.preset_key,
      version: formattedPreset.version,
      hasSchema: Boolean(cleanSchema),
      hasLayout: Boolean(cleanLayout),
      sourceTerminalId: sourceTerminal?.id ?? null,
    },
    metadata: {
      event: 'preset:create',
      sourceTerminalId: sourceTerminal?.id ?? null,
      linkTerminal: Boolean(body.linkTerminal),
    },
  });

  return {
    success: true,
    preset: formattedPreset,
    error: null,
  };
});
