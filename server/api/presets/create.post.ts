/**
 * POST /api/presets/create
 * Saves a new preset. Admin-only. Useful for saving a current schema as a template.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import type { SchemaDef } from '~/lib/schemaUtils';
import type { UiLayout } from '~/lib/uiTypes';
import { sanitizeTextInput, validateAndSanitizeRecord } from '~/lib/securityClient';

export default defineEventHandler(async (event) => {
  await verifyAdmin(event);

  const body = await readBody<{
    name: string;
    description?: string;
    schemaDef: SchemaDef;
    uiLayout?: UiLayout;
  }>(event);

  const cleanName = sanitizeTextInput(body.name, 100, false).trim();
  if (!cleanName) return { error: 'Name is required', preset: null };

  let cleanSchemaDef: unknown;
  let cleanUiLayout: unknown = {};
  try {
    cleanSchemaDef = validateAndSanitizeRecord(body.schemaDef, { maxDepth: 8, maxStringLength: 2000 });
    if (body.uiLayout !== undefined) {
      cleanUiLayout = validateAndSanitizeRecord(body.uiLayout, { maxDepth: 10, maxStringLength: 4000 });
    }
  } catch (err) {
    return { error: (err as Error).message, preset: null };
  }

  const { data: preset, error } = await db.insert('presets', {
    name: cleanName,
    description: sanitizeTextInput(body.description ?? '', 1000, true),
    schema_definition: JSON.stringify(cleanSchemaDef),
    ui_layout: JSON.stringify(cleanUiLayout),
  });

  if (error) return { error, preset: null };

  return { preset, error: null };
});
