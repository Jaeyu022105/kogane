/**
 * POST /api/schema/tables/analyze
 * Runs normalization analysis on a table definition and returns hints.
 * Does not write to the DB — purely advisory.
 */

import { defineEventHandler, readBody } from 'h3';
import { analyzeNormalization } from '~/lib/schemaUtils';
import type { TableDef } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ table: TableDef }>(event);

  if (!body.table) return { error: 'Missing table definition', hints: null };

  const hints = analyzeNormalization(body.table);

  return { hints, error: null };
});
