import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody(event);
  const { businessId, tableName, rowId, updates } = body;

  if (!businessId || !tableName || rowId === undefined || !updates) {
    return { success: false, error: 'Missing required fields' };
  }

  const { data: business, error: bizError } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (bizError || !business) return { success: false, error: 'Business not found' };
  if (business.admin_user_id !== userId) return { success: false, error: 'Forbidden' };

  try {
    validateIdentifier(tableName);
    const keys = Object.keys(updates);
    if (keys.length === 0) return { success: true };

    for (const key of keys) {
      validateIdentifier(key);
    }

    const isDevMode = process.env.DEV_MODE === 'true';
    const tbl = isDevMode
      ? `${business.schema_name}_${tableName}`
      : `"${business.schema_name}"."${tableName}"`;

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = keys.map(k => updates[k]);

    const sql = `UPDATE ${tbl} SET ${setClauses} WHERE id = $${keys.length + 1}`;
    const args = [...values, rowId];

    // SQLite driver uses ? instead of $1
    const finalSql = isDevMode ? sql.replace(/\$[0-9]+/g, '?') : sql;

    await db.query(finalSql, args);
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});
