/**
 * POST /api/terminals/create
 * Creates a new terminal (staff terminal) for the business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { hashPin } from '~/lib/authUtils';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ businessId: string; displayName: string; pin: string; resolution?: string }>(event);

  if (!body.businessId || !body.displayName || !body.pin) {
    return { error: 'Missing required fields', terminal: null };
  }

  if (!/^\d{4,8}$/.test(body.pin)) {
    return { error: 'PIN must be 4–8 digits', terminal: null };
  }

  const { data: business } = await db.queryOne<{ admin_user_id: string }>(
    'SELECT admin_user_id FROM businesses WHERE id = ?',
    [body.businessId],
  );

  if (!business || business.admin_user_id !== userId) return { error: 'Forbidden', terminal: null };

  const pinHash = await hashPin(body.pin);
  const layoutData = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
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
    ui_layout: JSON.stringify(layoutData),
  });

  if (error) return { error, terminal: null };

  return { terminal, error: null };
});
