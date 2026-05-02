/**
 * POST /api/terminals/create
 * Creates a new terminal (staff terminal) for the business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { hashPin } from '~/lib/authUtils';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';
import { BUILDER_PRESETS } from '~/lib/builderPresets';
import { presetByKey, TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';
import { ensureStarterBusinessTables, starterTableNamesForPreset } from '~/server/utils/starterTables';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    businessId: string;
    displayName: string;
    pin: string;
    resolution?: string;
    presetKey?: string;
  }>(event);

  if (!body.businessId || !body.displayName || !body.pin) {
    return { error: 'Missing required fields', terminal: null };
  }

  if (!/^\d{4,8}$/.test(body.pin)) {
    return { error: 'PIN must be 4–8 digits', terminal: null };
  }

  const { data: business } = await getBusinessForAdmin(userId, body.businessId);
  if (!business) return { error: 'Forbidden', terminal: null };

  const pinHash = await hashPin(body.pin);
  const preset = presetByKey(body.presetKey) ?? TERMINAL_PERMISSION_PRESETS[0];
  const presetLayoutMap: Record<string, string> = {
    'cashier-register': 'cashier-station',
    'catalog-registrar': 'catalog-station',
    'inventory-manager': 'inventory-station',
    'kitchen-display': 'kitchen-station',
    'reports-viewer': 'reports-station',
  };
  const initialLayoutPreset = BUILDER_PRESETS.find((item) => item.id === presetLayoutMap[preset.key]);
  const layoutData = JSON.parse(JSON.stringify(initialLayoutPreset?.layout ?? DEFAULT_LAYOUT));

  const starterTables = starterTableNamesForPreset(preset.key);
  if (starterTables.length > 0) {
    const starterResult = await ensureStarterBusinessTables(business.schema_name, starterTables);
    if (starterResult.error) {
      return { error: starterResult.error, terminal: null };
    }
  }

  if (body.resolution) {
    const [w, h] = body.resolution.split('x').map(Number);
    if (!isNaN(w) && !isNaN(h)) {
      layoutData.resolution = { width: w, height: h };
    }
  }

  const { data: terminal, error } = await db.insert('terminals', {
    business_id: body.businessId,
    display_name: body.displayName,
    role: preset.label,
    pin_hash: pinHash,
    pin_length: body.pin.length,
    permissions: JSON.stringify(preset.permissions),
    ui_layout: JSON.stringify(layoutData),
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
