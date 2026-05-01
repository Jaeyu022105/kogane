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
      SELECT actor_name, actor_type, metadata, created_at
      FROM audit_log
      WHERE business_id = ${sqlPlaceholder(1)}
      ORDER BY created_at DESC
    `,
  );
  const result = await db.query<{ actor_name: string; actor_type: string; metadata: string | null; created_at: string }>(
    sql,
    [businessResult.data.id],
  );

  const grouped = new Map<string, { actor_name: string; actor_type: string; role: string; actions: number }>();
  for (const row of result.data ?? []) {
    if (!inDateRange(row.created_at, range.from, range.to)) continue;

    let role = 'unknown';
    try {
      role = row.metadata ? JSON.parse(row.metadata)?.role ?? 'unknown' : 'unknown';
    } catch {
      role = 'unknown';
    }

    const key = `${row.actor_type}:${row.actor_name}:${role}`;
    const current = grouped.get(key) ?? {
      actor_name: row.actor_name,
      actor_type: row.actor_type,
      role,
      actions: 0,
    };
    current.actions += 1;
    grouped.set(key, current);
  }

  return {
    rows: Array.from(grouped.values()).sort((left, right) => right.actions - left.actions),
    error: result.error ?? null,
  };
});
