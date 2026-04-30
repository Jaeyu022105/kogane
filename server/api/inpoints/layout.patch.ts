/**
 * PATCH /api/inpoints/layout
 * Saves the UI layout JSON for an in-point.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import type { UiLayout } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ inpointId: string; layout: UiLayout }>(event);

  if (!body.inpointId || !body.layout) return { error: 'Missing required fields', success: false };

  // Confirm the in-point belongs to this admin's business
  const { data: row } = await db.queryOne<{ admin_user_id: string }>(
    `SELECT b.admin_user_id FROM inpoints i
     JOIN businesses b ON b.id = i.business_id
     WHERE i.id = ?`,
    [body.inpointId],
  );

  if (!row || row.admin_user_id !== userId) return { error: 'Forbidden', success: false };

  const { error } = await db.update(
    'inpoints',
    { ui_layout: JSON.stringify(body.layout) },
    { id: body.inpointId },
  );

  if (error) return { error, success: false };

  return { success: true, error: null };
});
