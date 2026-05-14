/**
 * POST /api/terminals/create
 * Creates a new terminal (staff terminal) for the business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';
import { defaultLayoutVariantForPreset } from '~/lib/starterWorkstations';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';
import { createManagedTerminal } from '~/server/utils/managedTerminals';

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

  if (!body.businessId || !body.displayName || !body.pin) {
    return { error: 'Missing required fields', terminal: null };
  }

  if (!/^\d{4,8}$/.test(body.pin)) {
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

  const preset = TERMINAL_PERMISSION_PRESETS.find((item) => item.key === body.presetKey) ?? TERMINAL_PERMISSION_PRESETS[0];
  const { terminal, error } = await createManagedTerminal({
    businessId: body.businessId,
    businessSchema: business.schema_name,
    displayName: body.displayName.trim(),
    presetKey: preset.key,
    pin: body.pin,
    resolution: body.resolution,
    layoutVariant: body.layoutVariant || brandConfig?.terminalLayouts?.[preset.key] || defaultLayoutVariantForPreset(preset.key),
    brandConfig,
  });

  if (error) return { error, terminal: null };

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'update',
    targetTable: 'terminals',
    targetId: (terminal as any)?.id ?? null,
    payloadAfter: terminal,
    metadata: {
      event: 'terminal:create',
      preset: preset.key,
    },
  });

  return { terminal, error: null };
});
