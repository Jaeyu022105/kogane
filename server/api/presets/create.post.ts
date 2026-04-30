/**
 * POST /api/presets/create
 * Saves a new preset. Admin-only. Useful for saving a current schema as a template.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import type { SchemaDef } from '~/lib/schemaUtils';
import type { UiLayout } from '~/lib/uiTypes';

export default defineEventHandler(async (event) => {
  await verifyAdmin(event);

  const body = await readBody<{
    name:             string;
    description?:     string;
    schemaDef:        SchemaDef;
    uiLayout?:        UiLayout;
  }>(event);

  if (!body.name?.trim()) return { error: 'Name is required', preset: null };

  const { data: preset, error } = await db.insert('presets', {
    name:              body.name.trim(),
    description:       body.description ?? '',
    schema_definition: JSON.stringify(body.schemaDef),
    ui_layout:         JSON.stringify(body.uiLayout ?? {}),
  });

  if (error) return { error, preset: null };

  return { preset, error: null };
});
