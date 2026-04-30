import { defineEventHandler, readBody, getCookie } from 'h3';
import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { inpointId, tableName, record } = body;

  if (!inpointId || !tableName || !record) {
    return { success: false, error: 'Missing required fields' };
  }

  // Authorize by checking if there's a valid session cookie for this inpoint
  const sessionCookie = getCookie(event, `inpoint_session_${inpointId}`);
  if (!sessionCookie) return { success: false, error: 'Unauthorized' };

  // Fetch the business associated with this inpoint
  const { data: inpoint, error: inpointErr } = await db.queryOne<{ business_id: string }>(
    'SELECT business_id FROM inpoints WHERE id = ?',
    [inpointId],
  );

  if (inpointErr || !inpoint) return { success: false, error: 'Inpoint not found' };

  const { data: business, error: bizError } = await db.queryOne<{ schema_name: string }>(
    'SELECT schema_name FROM businesses WHERE id = ?',
    [inpoint.business_id],
  );

  if (bizError || !business) return { success: false, error: 'Business not found' };

  try {
    validateIdentifier(tableName);
    const keys = Object.keys(record);
    if (keys.length === 0) return { success: true };

    for (const key of keys) {
      validateIdentifier(key);
    }

    const isDevMode = process.env.DEV_MODE === 'true';
    const tbl = isDevMode
      ? `${business.schema_name}_${tableName}`
      : `"${business.schema_name}"."${tableName}"`;

    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => record[k]);

    const sql = `INSERT INTO ${tbl} (${cols}) VALUES (${placeholders})`;

    // SQLite driver uses ? instead of $1
    const finalSql = isDevMode ? sql.replace(/\$[0-9]+/g, '?') : sql;

    await db.query(finalSql, values);
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});
