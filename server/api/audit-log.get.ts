import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdminUser, replacePlaceholdersForDialect, sqlPlaceholder } from '~/server/utils/business';
import { normalizeDateRange } from '~/server/utils/reporting';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return { entries: [], page: 1, per_page: 50, total: 0, error: 'Business not found' };
  }

  const query = getQuery(event) as {
    page?: string;
    per_page?: string;
    actor_type?: string;
    action_type?: string;
    table?: string;
    from?: string;
    to?: string;
  };

  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10));
  const perPage = Math.min(200, Math.max(1, Number.parseInt(query.per_page ?? '50', 10)));
  const offset = (page - 1) * perPage;

  const clauses = [`business_id = ${sqlPlaceholder(1)}`];
  const params: unknown[] = [businessResult.data.id];
  const dateRange = query.from || query.to
    ? normalizeDateRange(query.from, query.to)
    : null;

  if (query.actor_type && query.actor_type !== 'all') {
    params.push(query.actor_type);
    clauses.push(`actor_type = ${sqlPlaceholder(params.length)}`);
  }

  if (query.action_type) {
    params.push(query.action_type);
    clauses.push(`action_type = ${sqlPlaceholder(params.length)}`);
  }

  if (query.table) {
    params.push(query.table);
    clauses.push(`target_table = ${sqlPlaceholder(params.length)}`);
  }

  if (query.from && dateRange) {
    params.push(dateRange.from.toISOString());
    clauses.push(`created_at >= ${sqlPlaceholder(params.length)}`);
  }

  if (query.to && dateRange) {
    params.push(dateRange.to.toISOString());
    clauses.push(`created_at <= ${sqlPlaceholder(params.length)}`);
  }

  const whereClause = `WHERE ${clauses.join(' AND ')}`;

  const countSql = replacePlaceholdersForDialect(
    `SELECT COUNT(*) as c FROM audit_log ${whereClause}`,
  );
  const countResult = await db.queryOne<{ c: number | string }>(countSql, params);
  const total = Number(countResult.data?.c ?? 0);

  const pagedParams = [...params, perPage, offset];
  const rowsSql = replacePlaceholdersForDialect(
    `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT ${sqlPlaceholder(params.length + 1)} OFFSET ${sqlPlaceholder(params.length + 2)}`,
  );
  const rowsResult = await db.query(rowsSql, pagedParams);

  return {
    entries: rowsResult.data ?? [],
    page,
    per_page: perPage,
    total,
    error: rowsResult.error ?? countResult.error ?? null,
  };
});
