/**
 * PATCH /api/businesses/theme
 * Updates the color palette and logo for the authenticated admin's business.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{ logoUrl?: string; colorPalette?: Record<string, string> }>(event);

  const updates: Record<string, unknown> = {};
  if (body.logoUrl !== undefined) updates.logo_url = body.logoUrl;
  if (body.colorPalette !== undefined) updates.color_palette = JSON.stringify(body.colorPalette);

  if (!Object.keys(updates).length) return { error: 'No updates provided', success: false };

  const { error } = await db.update('businesses', updates, { admin_user_id: userId });

  if (error) return { error, success: false };

  return { success: true, error: null };
});
