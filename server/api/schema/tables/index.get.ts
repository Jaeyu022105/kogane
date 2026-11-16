/**
 * GET /api/schema/tables
 * Returns all user-defined tables for the authenticated business.
 */

import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { listBusinessTables } from '~/server/utils/business';

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

  const { data: tables } = await listBusinessTables(business.schema_name);

  return { tables: tables ?? [], error: null };
});
