import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdminUser, replacePlaceholdersForDialect, sqlPlaceholder } from '~/server/utils/business';
import { inDateRange, normalizeDateRange } from '~/server/utils/reporting';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return { rows: [], error: 'Business not found' };
  }

  const query = getQuery(event) as { from?: string; to?: string };
  const range = normalizeDateRange(query.from, query.to);

  const sql = replacePlaceholdersForDialect(
    `
      SELECT target_table, action_type, created_at
      FROM audit_log
      WHERE business_id = ${sqlPlaceholder(1)}
        AND action_type IN ('insert', 'update', 'delete')
      ORDER BY created_at DESC
    `,
  );
  const result = await db.query<{ target_table: string | null; action_type: string; created_at: string }>(
    sql,
    [businessResult.data.id],
  );

  const grouped = new Map<string, { inserts: number; updates: number; deletes: number }>();
  for (const row of result.data ?? []) {
    if (!inDateRange(row.created_at, range.from, range.to)) continue;
    const key = row.target_table ?? 'unknown';
    const current = grouped.get(key) ?? { inserts: 0, updates: 0, deletes: 0 };
    if (row.action_type === 'insert') current.inserts += 1;
    if (row.action_type === 'update') current.updates += 1;
    if (row.action_type === 'delete') current.deletes += 1;
    grouped.set(key, current);
  }

  return {
    rows: Array.from(grouped.entries()).map(([table, counts]) => ({
      table,
      ...counts,
      total: counts.inserts + counts.updates + counts.deletes,
    })).sort((left, right) => right.total - left.total),
    error: result.error ?? null,
  };
});
