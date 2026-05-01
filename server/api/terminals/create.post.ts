/**
 * POST /api/terminals/create
 * Creates a new terminal (staff terminal) for the business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { hashPin } from '~/lib/authUtils';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';
import { presetByKey, TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';

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
  const layoutData = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  const preset = presetByKey(body.presetKey) ?? TERMINAL_PERMISSION_PRESETS[0];
  if (body.resolution) {
    const [w, h] = body.resolution.split('x').map(Number);
    if (!isNaN(w) && !isNaN(h)) {
      layoutData.resolution = { width: w, height: h };
    }
  }

  const { data: terminal, error } = await db.insert('terminals', {
    business_id: body.businessId,
    display_name: body.displayName,
    role: 'staff',
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
