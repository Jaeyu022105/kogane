/**
 * PATCH /api/terminals/layout
 * Saves the UI layout JSON for an terminal.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { normalizeLayout, type UiLayout } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ terminalId: string; layout: UiLayout }>(event);

  if (!body.terminalId || !body.layout) return { error: 'Missing required fields', success: false };

  // Confirm the terminal belongs to this admin's business
  const { data: row } = await db.queryOne<{ admin_user_id: string }>(
    `SELECT b.admin_user_id FROM terminals i
     JOIN businesses b ON b.id = i.business_id
     WHERE i.id = ?`,
    [body.terminalId],
  );

  if (!row || row.admin_user_id !== userId) return { error: 'Forbidden', success: false };

  const { error } = await db.update(
    'terminals',
    { ui_layout: JSON.stringify(normalizeLayout(body.layout)) },
    { id: body.terminalId },
  );

  if (error) return { error, success: false };

  return { success: true, error: null };
});
