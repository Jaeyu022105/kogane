/**
 * GET /api/presets
 * Returns all available presets (platform-wide, not per-business).
 */

import { defineEventHandler } from 'h3';
import { db } from '~/lib/db';

export default defineEventHandler(async () => {
  const { data, error } = await db.query(
    'SELECT id, name, description, schema_definition, ui_layout, created_at FROM presets ORDER BY created_at DESC',
  );

  return { presets: data ?? [], error: error ?? null };
});
