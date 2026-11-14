/**
 * POST /api/terminals/create
 * Creates a new terminal (staff terminal) for the business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { ALL_TERMINAL_PERMISSION_PRESETS, presetByRoleOrKey } from '~/lib/permissions';
import { defaultLayoutVariantForPreset } from '~/lib/starterWorkstations';
import { parseAuditJson, redactAuditPayload } from '~/lib/audit';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';
import { createManagedTerminal } from '~/server/utils/managedTerminals';
import { sanitizeTextInput } from '~/lib/securityClient';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    businessId: string;
    displayName: string;
    pin: string;
    resolution?: string;
    presetKey?: string;
    layoutVariant?: string;
  }>(event);

  const cleanDisplayName = sanitizeTextInput(body.displayName, 100, false).trim();
  if (!body.businessId || !cleanDisplayName || !body.pin) {
    return { error: 'Missing required fields', terminal: null };
  }

  if (typeof body.pin !== 'string' || !/^\d{4,8}$/.test(body.pin)) {
    return { error: 'PIN must be 4–8 digits', terminal: null };
  }

  const { data: business } = await getBusinessForAdmin(userId, body.businessId);
  if (!business) return { error: 'Forbidden', terminal: null };

  let brandConfig: Record<string, any> = {};
  try {
    const { data: businessRow } = await db.queryOne<{ color_palette: string | null }>(
      'SELECT color_palette FROM businesses WHERE id = ?',
      [body.businessId],
    );
    brandConfig = businessRow?.color_palette ? JSON.parse(businessRow.color_palette) : {};
  } catch {
    brandConfig = {};
  }

  const preset =
    ALL_TERMINAL_PERMISSION_PRESETS.find((item) => item.key === body.presetKey) ??
    presetByRoleOrKey(body.presetKey) ??
    ALL_TERMINAL_PERMISSION_PRESETS[0];
  const resolvedLayoutVariant = (body.layoutVariant ? sanitizeTextInput(body.layoutVariant, 64, false).trim() : '')
    || brandConfig?.terminalLayouts?.[preset.key]
    || defaultLayoutVariantForPreset(preset.key);
  const { terminal, error } = await createManagedTerminal({
    businessId: body.businessId,
    businessSchema: business.schema_name,
    displayName: cleanDisplayName,
    presetKey: preset.key,
    pin: body.pin,
    resolution: body.resolution ? sanitizeTextInput(body.resolution, 32, false).trim() : undefined,
    layoutVariant: resolvedLayoutVariant,
    brandConfig,
  });

  if (error) return { error, terminal: null };

  const rawTerminal = terminal && typeof terminal === 'object' ? (terminal as Record<string, unknown>) : {};
  const sanitizedTerminalPayload = redactAuditPayload({
    id: rawTerminal.id ?? null,
    business_id: rawTerminal.business_id ?? business.id,
    display_name: rawTerminal.display_name ?? cleanDisplayName,
    role: rawTerminal.role ?? preset.label,
    pin_length: rawTerminal.pin_length ?? body.pin.length,
    permissions: parseAuditJson(rawTerminal.permissions as string | null) ?? preset.permissions,
    is_public: rawTerminal.is_public ?? 0,
    public_slug: rawTerminal.public_slug ?? null,
    created_at: rawTerminal.created_at ?? null,
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'insert',
    targetTable: 'terminals',
    targetId: (terminal as any)?.id ?? null,
    payloadAfter: sanitizedTerminalPayload,
    metadata: {
      event: 'terminal:create',
      preset: preset.key,
      terminal_name: cleanDisplayName,
      layout_variant: resolvedLayoutVariant,
    },
  });

  return { terminal, error: null };
});
