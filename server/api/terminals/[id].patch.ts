import { defineEventHandler, readBody } from 'h3';
import { hashPin, verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdmin } from '~/server/utils/business';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const terminalId = event.context.params?.id;
  const body = (await readBody<{
    businessId?: string;
    displayName?: string;
    pin?: string | null;
  }>(event)) ?? {};

  if (!terminalId || !body.businessId) {
    return { success: false, error: 'Missing required fields', terminal: null };
  }

  const { data: terminal } = await db.queryOne<{
    id: string;
    business_id: string;
  }>(
    'SELECT id, business_id FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (!terminal) {
    return { success: false, error: 'Terminal not found', terminal: null };
  }

  const { data: business } = await getBusinessForAdmin(userId, terminal.business_id);
  if (!business || business.id !== body.businessId) {
    return { success: false, error: 'Forbidden', terminal: null };
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.displayName === 'string' && body.displayName.trim()) {
    updates.display_name = body.displayName.trim();
  }

  if (typeof body.pin === 'string' && body.pin.length > 0) {
    if (!/^\d{4,8}$/.test(body.pin)) {
      return { success: false, error: 'PIN must be 4-8 digits', terminal: null };
    }

    updates.pin_hash = await hashPin(body.pin);
    updates.pin_code = body.pin;
    updates.pin_length = body.pin.length;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No changes supplied', terminal: null };
  }

  const { error } = await db.update('terminals', updates, { id: terminalId });
  if (error) {
    return { success: false, error, terminal: null };
  }

  const refreshed = await db.queryOne(
    'SELECT id, business_id, display_name, role, pin_code, permissions, ui_layout, is_public, public_slug, created_at FROM terminals WHERE id = ?',
    [terminalId],
  );

  return {
    success: true,
    error: null,
    terminal: refreshed.data ?? null,
  };
});
