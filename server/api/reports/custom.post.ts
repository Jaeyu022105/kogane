import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { limitSqlRows, validateAndQualifyBusinessSql } from '~/lib/sql';
import { getBusinessForAdminUser, isPrefixDb, listBusinessTables } from '~/server/utils/business';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return { columns: [], rows: [], error: 'Business not found' };
  }

  const body = await readBody<{ sql: string }>(event);
  const tablesResult = await listBusinessTables(businessResult.data.schema_name);
  const allowedTables = tablesResult.data ?? [];

  try {
    const qualifiedSql = validateAndQualifyBusinessSql(
      body?.sql ?? '',
      businessResult.data.schema_name,
      allowedTables,
      isPrefixDb(),
    );
    const limitedSql = limitSqlRows(qualifiedSql, 1000);
    const result = await db.query<Record<string, unknown>>(limitedSql);
    const rows = result.data ?? [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      error: result.error ?? null,
    };
  } catch (err) {
    return {
      columns: [],
      rows: [],
      error: (err as Error).message,
    };
  }
});
