/**
 * GET /api/schema/tables
 * Returns all user-defined tables for the authenticated business.
 */

import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const { businessId } = getQuery(event) as { businessId: string };

  if (!businessId) {
    return { error: 'Missing businessId', tables: null };
  }

  // Fetch the business to confirm ownership and get the schema name
  const { data: business, error } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (error || !business) return { error: 'Business not found', tables: null };
  if (business.admin_user_id !== userId) return { error: 'Forbidden', tables: null };

  const isDevMode = process.env.DEV_MODE === 'true';

  let tables: string[] = [];

  if (isDevMode) {
    // SQLite: find all tables prefixed with the schema name
    const { data } = await db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name`,
      [`${business.schema_name}_%`],
    );
    tables = (data ?? []).map(r => r.name.replace(`${business.schema_name}_`, ''));
  } else {
    // Postgres: query information_schema for the business schema
    const { data } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [business.schema_name],
    );
    tables = (data ?? []).map(r => r.table_name);
  }

  return { tables, error: null };
});
