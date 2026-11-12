/**
 * POST /api/data/query
 * Queries rows from a user-defined table in the business schema.
 * Used by TableViewEl and CartWidgetEl to load live data.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import { isPrefixDb } from '~/server/utils/business';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    businessId: string;
    tableName: string;
    columns: string[];
    limit?: number;
    offset?: number;
  }>(event);

  if (!body.businessId || !body.tableName) {
    return { data: null, error: 'Missing businessId or tableName' };
  }

  const rawCols = Array.isArray(body.columns) ? body.columns : [];

  try {
    validateIdentifier(body.tableName);
    for (const col of rawCols) {
      if (col !== '*') validateIdentifier(col);
    }
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }

  const { data: business, error: bizErr } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [body.businessId],
  );

  if (bizErr || !business) return { data: null, error: 'Business not found' };
  if (business.admin_user_id !== userId) return { data: null, error: 'Forbidden' };

  try {
    validateIdentifier(business.schema_name);
  } catch {
    return { data: null, error: 'Invalid business schema identifier' };
  }

  const isDevMode = isPrefixDb();
  const cols = rawCols.length
    ? (rawCols.includes('*')
        ? '*'
        : (rawCols.includes('id') ? rawCols : ['id', ...rawCols]).map((c) => `"${c}"`).join(', '))
    : '*';
  const parsedLimit = Number(body.limit);
  const parsedOffset = Number(body.offset);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 200) : 50;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.floor(parsedOffset) : 0;

  let sql: string;
  let params: unknown[];

  if (isDevMode) {
    const tbl = `${business.schema_name}_${body.tableName}`;
    sql = `SELECT ${cols} FROM ${tbl} LIMIT ? OFFSET ?`;
    params = [limit, offset];
  } else {
    sql = `SELECT ${cols} FROM "${business.schema_name}"."${body.tableName}" LIMIT $1 OFFSET $2`;
    params = [limit, offset];
  }

  const { data, error } = await db.query(sql, params);

  return { data: data ?? [], error: error ?? null };
});
