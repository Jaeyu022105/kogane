/**
 * POST /api/presets/apply
 * Applies a system or custom business preset's schema_definition, ui_layout, and permissions
 * to a target terminal (or creates a new linked terminal), recording presetId & presetVersion.
 */

import { randomUUID } from 'node:crypto';
import { createError, defineEventHandler, readBody } from 'h3';
import type { AuditActionType } from '~/lib/audit';
import { verifyAdmin, hashPin } from '~/lib/authUtils';
import {
  buildBrandedTerminalLayoutForPreset,
  findBuiltInBuilderPreset,
  parseJsonObject,
  resolvePresetVersionNumber,
  sanitizePresetSchemaDefinition,
} from '~/lib/builderPresets';
import { db } from '~/lib/db';
import {
  DEFAULT_TERMINAL_PERMISSIONS,
  normalizePermissions,
  presetByRoleOrKey,
  type TerminalPermissions,
} from '~/lib/permissions';
import { buildCreateTableSql, type TableDef } from '~/lib/schemaUtils';
import { sanitizeTextInput } from '~/lib/securityClient';
import { cloneLayout, DEFAULT_LAYOUT, type UiLayout } from '~/lib/uiTypes';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin, getBusinessForAdminUser } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';
import { STARTER_BUSINESS_TABLES, starterTableNamesForPreset } from '~/server/utils/starterTables';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    presetId?: string;
    businessId?: string;
    terminalId?: string;
    createTerminal?: boolean;
    displayName?: string;
    pin?: string;
    applySchema?: boolean;
    applyLayout?: boolean;
    applyPermissions?: boolean;
  }>(event);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const presetId = typeof body.presetId === 'string' ? sanitizeTextInput(body.presetId, 128, false).trim() : '';
  if (!presetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing presetId' });
  }

  const requestedBusinessId = typeof body.businessId === 'string' && body.businessId.trim()
    ? sanitizeTextInput(body.businessId, 128, false).trim()
    : null;
  const terminalId = typeof body.terminalId === 'string' && body.terminalId.trim()
    ? sanitizeTextInput(body.terminalId, 128, false).trim()
    : null;

  let targetTerminal: {
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
      throw createError({ statusCode: 404, statusMessage: 'Target terminal not found' });
    }
    if (requestedBusinessId && term.business_id !== requestedBusinessId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }
    targetTerminal = term;
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

  // Look up custom/global DB preset first; fallback to built-in 9 presets.
  const { data: dbPreset, error: presetErr } = await db.queryOne<Record<string, unknown>>(
    'SELECT id, business_id, name, description, category, preset_key, schema_definition, ui_layout, permissions, version FROM presets WHERE id = ?',
    [presetId],
  );
  if (presetErr) {
    throw createError({ statusCode: 500, statusMessage: presetErr });
  }

  const builtInPreset = dbPreset ? null : findBuiltInBuilderPreset(presetId);

  if (!dbPreset && !builtInPreset) {
    throw createError({ statusCode: 404, statusMessage: 'Preset not found' });
  }

  if (dbPreset?.business_id && String(dbPreset.business_id) !== business.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const effectivePresetId = dbPreset ? String(dbPreset.id) : builtInPreset!.id;
  const effectivePresetName = dbPreset ? String(dbPreset.name) : builtInPreset!.name;
  const effectivePresetKey = dbPreset
    ? (typeof dbPreset.preset_key === 'string' && dbPreset.preset_key.trim() ? dbPreset.preset_key.trim() : null)
    : builtInPreset!.presetKey;
  const effectiveVersion = dbPreset
    ? resolvePresetVersionNumber(dbPreset.version, 1)
    : builtInPreset!.presetVersion;

  let schemaTables: TableDef[] = [];
  if (dbPreset) {
    const cleanSchema = sanitizePresetSchemaDefinition(dbPreset.schema_definition);
    schemaTables = cleanSchema?.tables ?? [];
  } else if (builtInPreset) {
    schemaTables = starterTableNamesForPreset(builtInPreset.presetKey)
      .map((tableName) => STARTER_BUSINESS_TABLES[tableName])
      .filter((t): t is TableDef => Boolean(t));
  }

  const appliedTables: string[] = [];
  if (body.applySchema !== false && schemaTables.length > 0) {
    for (const tableDef of schemaTables) {
      const sql = buildCreateTableSql(tableDef, business.schema_name);
      const execRes = await db.execute(sql);
      if (execRes.error) {
        throw createError({ statusCode: 500, statusMessage: execRes.error });
      }
      appliedTables.push(tableDef.name);
    }
  }

  const rawLayoutObj = dbPreset
    ? parseJsonObject(dbPreset.ui_layout)
    : (builtInPreset!.layout as unknown as Record<string, unknown>);
  const hasTemplateLayout = Boolean(
    rawLayoutObj && Array.isArray(rawLayoutObj.elements) && rawLayoutObj.elements.length > 0,
  );

  let effectivePermissions: TerminalPermissions | null = null;
  if (dbPreset) {
    const rawPerms = parseJsonObject(dbPreset.permissions);
    if (rawPerms && Object.keys(rawPerms).length > 0) {
      effectivePermissions = normalizePermissions(rawPerms as Partial<TerminalPermissions>, effectivePresetKey);
    } else if (effectivePresetKey) {
      effectivePermissions = normalizePermissions({}, effectivePresetKey);
    }
  } else if (builtInPreset) {
    effectivePermissions = normalizePermissions({}, builtInPreset.presetKey);
  }

  let resultTerminal: Record<string, unknown> | null = null;

  if (targetTerminal) {
    const updates: Record<string, unknown> = {};
    let brandedLayout: Record<string, unknown> | null = null;

    if (hasTemplateLayout && body.applyLayout !== false) {
      brandedLayout = buildBrandedTerminalLayoutForPreset({
        templateLayout: rawLayoutObj as unknown as UiLayout,
        presetId: effectivePresetId,
        presetVersion: effectiveVersion,
        presetName: effectivePresetName,
        businessPaletteRaw: business.color_palette,
        existingTerminalLayout: targetTerminal.ui_layout,
      });
      updates.ui_layout = JSON.stringify(brandedLayout);
    }

    let nextPermissions = parseJsonObject(targetTerminal.permissions) ?? DEFAULT_TERMINAL_PERMISSIONS;
    if (effectivePermissions && body.applyPermissions !== false) {
      nextPermissions = effectivePermissions as unknown as Record<string, unknown>;
      updates.permissions = JSON.stringify(effectivePermissions);
    }

    const permissionPreset = effectivePresetKey ? presetByRoleOrKey(effectivePresetKey) : null;
    const nextRole = permissionPreset?.label ?? targetTerminal.role;
    if (permissionPreset && body.applyPermissions !== false) {
      updates.role = nextRole;
    }

    if (Object.keys(updates).length > 0) {
      const { error: termUpdateErr } = await db.update('terminals', updates, { id: targetTerminal.id });
      if (termUpdateErr) {
        throw createError({ statusCode: 500, statusMessage: termUpdateErr });
      }

      realtimeHub.publish(business.id, {
        table: 'terminals',
        action: 'update',
        recordId: targetTerminal.id,
        data: {
          id: targetTerminal.id,
          role: nextRole,
          ...(brandedLayout ? { ui_layout: brandedLayout } : {}),
          ...(effectivePermissions && body.applyPermissions !== false ? { permissions: nextPermissions } : {}),
          presetId: effectivePresetId,
          presetVersion: effectiveVersion,
        },
      });
    }

    resultTerminal = {
      id: targetTerminal.id,
      display_name: targetTerminal.display_name,
      role: nextRole,
      ui_layout: brandedLayout ?? parseJsonObject(targetTerminal.ui_layout) ?? {},
      permissions: nextPermissions,
      presetId: effectivePresetId,
      presetVersion: effectiveVersion,
    };
  } else if (body.createTerminal === true) {
    const displayName = sanitizeTextInput(body.displayName ?? effectivePresetName, 120, false).trim() || effectivePresetName;
    const rawPin = typeof body.pin === 'string' && body.pin.trim() ? body.pin.trim() : '1234';
    if (rawPin.length < 4 || rawPin.length > 12) {
      throw createError({ statusCode: 400, statusMessage: 'Terminal PIN must be 4 to 12 characters' });
    }
    const pinHash = await hashPin(rawPin);
    const permissionPreset = effectivePresetKey ? presetByRoleOrKey(effectivePresetKey) : null;
    const roleLabel = permissionPreset?.label ?? effectivePresetName;
    const finalPermissions = effectivePermissions ?? DEFAULT_TERMINAL_PERMISSIONS;
    const baseTemplateLayout = hasTemplateLayout
      ? (rawLayoutObj as unknown as UiLayout)
      : cloneLayout(DEFAULT_LAYOUT);

    const brandedLayout = buildBrandedTerminalLayoutForPreset({
      templateLayout: baseTemplateLayout,
      presetId: effectivePresetId,
      presetVersion: effectiveVersion,
      presetName: effectivePresetName,
      businessPaletteRaw: business.color_palette,
    });

    const newTerminalId = randomUUID();
    const nowIso = new Date().toISOString();
    const { data: insertedTerminal, error: insertTermErr } = await db.insert<Record<string, unknown>>('terminals', {
      id: newTerminalId,
      business_id: business.id,
      display_name: displayName,
      role: roleLabel,
      pin_hash: pinHash,
      pin_code: rawPin,
      pin_length: rawPin.length,
      permissions: JSON.stringify(finalPermissions),
      ui_layout: JSON.stringify(brandedLayout),
      created_at: nowIso,
    });

    if (insertTermErr) {
      throw createError({ statusCode: 500, statusMessage: insertTermErr });
    }

    realtimeHub.publish(business.id, {
      table: 'terminals',
      action: 'insert',
      recordId: newTerminalId,
      data: {
        id: newTerminalId,
        display_name: displayName,
        role: roleLabel,
        ui_layout: brandedLayout,
        permissions: finalPermissions,
        presetId: effectivePresetId,
        presetVersion: effectiveVersion,
      },
    });

    resultTerminal = {
      id: String(insertedTerminal?.id ?? newTerminalId),
      display_name: displayName,
      role: roleLabel,
      ui_layout: brandedLayout,
      permissions: finalPermissions,
      presetId: effectivePresetId,
      presetVersion: effectiveVersion,
    };
  }

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'preset:apply' as AuditActionType,
    targetTable: resultTerminal ? 'terminals' : 'presets',
    targetId: resultTerminal ? String(resultTerminal.id) : effectivePresetId,
    payloadAfter: {
      presetId: effectivePresetId,
      presetName: effectivePresetName,
      presetVersion: effectiveVersion,
      appliedTables,
      terminalId: resultTerminal ? String(resultTerminal.id) : null,
      createdTerminal: Boolean(body.createTerminal),
    },
    metadata: {
      event: 'preset:apply',
      presetId: effectivePresetId,
      presetVersion: effectiveVersion,
      appliedTables,
    },
  });

  return {
    success: true,
    presetId: effectivePresetId,
    presetName: effectivePresetName,
    presetVersion: effectiveVersion,
    appliedTables,
    terminal: resultTerminal,
    error: null,
  };
});
