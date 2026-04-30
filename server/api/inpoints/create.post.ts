/**
 * POST /api/inpoints/create
 * Creates a new in-point (staff terminal) for the business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { hashPin } from '~/lib/authUtils';
import { DEFAULT_LAYOUT } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ businessId: string; displayName: string; role: string; pin: string }>(event);

  if (!body.businessId || !body.displayName || !body.role || !body.pin) {
    return { error: 'Missing required fields', inpoint: null };
  }

  if (!/^\d{4,8}$/.test(body.pin)) {
    return { error: 'PIN must be 4–8 digits', inpoint: null };
  }

  const { data: business } = await db.queryOne<{ admin_user_id: string }>(
    'SELECT admin_user_id FROM businesses WHERE id = ?',
    [body.businessId],
  );

  if (!business || business.admin_user_id !== userId) return { error: 'Forbidden', inpoint: null };

  const pinHash = await hashPin(body.pin);

  const { data: inpoint, error } = await db.insert('inpoints', {
    business_id:  body.businessId,
    display_name: body.displayName,
    role:         body.role,
    pin_hash:     pinHash,
    ui_layout:    JSON.stringify(DEFAULT_LAYOUT),
  });

  if (error) return { error, inpoint: null };

  return { inpoint, error: null };
});
