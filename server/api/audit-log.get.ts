import { createError, defineEventHandler, getQuery, setHeader } from 'h3';
import { buildAuditCsv, redactAuditJsonString } from '~/lib/audit';
import { verifyAdmin } from '~/lib/authUtils';
import { db, getDbProvider } from '~/lib/db';
import { sanitizeTextInput } from '~/lib/securityClient';
import { getBusinessForAdminUser, replacePlaceholdersForDialect, sqlPlaceholder } from '~/server/utils/business';
import { normalizeDateRange } from '~/server/utils/reporting';

const SEARCHABLE_COLUMNS = [
  'actor_name',
  'target_table',
  'target_id',
  'action_type',
  'metadata',
  'payload_before',
  'payload_after',
] as const;

function formatSqliteUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function sanitizeAuditEntry(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    payload_before: redactAuditJsonString(row.payload_before),
    payload_after: redactAuditJsonString(row.payload_after),
    metadata: redactAuditJsonString(row.metadata),
  };
}

function matchesAuditSearch(row: Record<string, unknown>, needleLower: string): boolean {
  for (const col of SEARCHABLE_COLUMNS) {
    const val = row[col];
    if (val != null && String(val).toLowerCase().includes(needleLower)) {
      return true;
    }
  }
  return false;
}

function clampLimit(raw: string | undefined, fallback: number, max: number): number {
  if (raw == null || String(raw).trim() === '') return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);

  const query = getQuery(event) as {
    page?: string;
    per_page?: string;
    limit?: string;
    actor_type?: string;
    action_type?: string;
    table?: string;
    from?: string;
    to?: string;
    q?: string;
    format?: string;
  };

  const format = String(query.format ?? '').trim().toLowerCase();
  const isCsv = format === 'csv';
  const isJsonExport = format === 'json';
  const isExport = isCsv || isJsonExport;

  if (!businessResult.data) {
    if (isExport) {
      throw createError({ statusCode: 404, statusMessage: 'Business not found' });
    }
    return { entries: [], page: 1, per_page: 50, total: 0, error: 'Business not found' };
  }

  const rawPage = Number.parseInt(String(query.page ?? '1'), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawLimitParam = query.limit ?? query.per_page;
  const perPage = clampLimit(rawLimitParam, 50, 200);
  const exportLimit = clampLimit(rawLimitParam, 5000, 5000);
  const effectiveLimit = isExport ? exportLimit : perPage;
  const effectiveOffset = isExport ? 0 : (page - 1) * perPage;

  const actorType = sanitizeTextInput(query.actor_type ?? '', 64, false).trim();
  const actionType = sanitizeTextInput(query.action_type ?? '', 64, false).trim();
  const tableFilter = sanitizeTextInput(query.table ?? '', 128, false).trim();
  const searchQ = sanitizeTextInput(query.q ?? '', 200, false).trim();

  const provider = getDbProvider();
  const clauses = [`business_id = ${sqlPlaceholder(1)}`];
  const params: unknown[] = [businessResult.data.id];

  const dateRange = query.from || query.to
    ? normalizeDateRange(query.from, query.to)
    : null;

  if (actorType && actorType !== 'all') {
    params.push(actorType);
    clauses.push(`actor_type = ${sqlPlaceholder(params.length)}`);
  }

  if (actionType) {
    params.push(actionType);
    clauses.push(`action_type = ${sqlPlaceholder(params.length)}`);
  }

  if (tableFilter) {
    if (provider !== 'firebase') {
      if (tableFilter === 'schema') {
        params.push('schema', 'schema:%');
        clauses.push(`(target_table = ${sqlPlaceholder(params.length - 1)} OR action_type LIKE ${sqlPlaceholder(params.length)})`);
      } else if (tableFilter === 'business') {
        params.push('business', 'businesses');
        clauses.push(`target_table IN (${sqlPlaceholder(params.length - 1)}, ${sqlPlaceholder(params.length)})`);
      } else {
        params.push(tableFilter);
        clauses.push(`target_table = ${sqlPlaceholder(params.length)}`);
      }
    } else if (tableFilter === 'business') {
      params.push('business', 'businesses');
      clauses.push('target_table IN (?, ?)');
    } else if (tableFilter !== 'schema') {
      params.push(tableFilter);
      clauses.push('target_table = ?');
    }
  }

  if (query.from && dateRange) {
    if (provider === 'sqlite') {
      params.push(formatSqliteUtc(dateRange.from));
      clauses.push('datetime(created_at) >= datetime(?)');
    } else if (provider === 'firebase') {
      params.push(dateRange.from.toISOString());
      clauses.push('datetime(created_at) >= datetime(?)');
    } else {
      params.push(dateRange.from.toISOString());
      clauses.push(`created_at >= ${sqlPlaceholder(params.length)}`);
    }
  }

  if (query.to && dateRange) {
    if (provider === 'sqlite') {
      params.push(formatSqliteUtc(dateRange.to));
      clauses.push('datetime(created_at) <= datetime(?)');
    } else if (provider === 'firebase') {
      params.push(dateRange.to.toISOString());
      clauses.push('datetime(created_at) <= datetime(?)');
    } else {
      params.push(dateRange.to.toISOString());
      clauses.push(`created_at <= ${sqlPlaceholder(params.length)}`);
    }
  }

  if (searchQ && provider !== 'firebase') {
    const escaped = searchQ.toLowerCase().replace(/[!%_]/g, '!$&');
    const pattern = `%${escaped}%`;
    const orParts = SEARCHABLE_COLUMNS.map((col) => {
      params.push(pattern);
      return `LOWER(COALESCE(${col}, '')) LIKE ${sqlPlaceholder(params.length)} ESCAPE '!'`;
    });
    clauses.push(`(${orParts.join(' OR ')})`);
  }

  const whereClause = `WHERE ${clauses.join(' AND ')}`;

  let total = 0;
  let entries: Record<string, unknown>[] = [];
  let queryError: string | null = null;

  if (provider === 'firebase') {
    const allSql = `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC`;
    const allRes = await db.query<Record<string, unknown>>(allSql, params);
    queryError = allRes.error ?? null;

    let filtered = (allRes.data ?? []).map(sanitizeAuditEntry);
    if (tableFilter === 'schema') {
      filtered = filtered.filter(
        (row) => row.target_table === 'schema' || String(row.action_type ?? '').startsWith('schema:'),
      );
    }
    if (searchQ) {
      const needleLower = searchQ.toLowerCase();
      filtered = filtered.filter((row) => matchesAuditSearch(row, needleLower));
    }

    total = filtered.length;
    entries = filtered.slice(effectiveOffset, effectiveOffset + effectiveLimit);
  } else {
    const countSql = replacePlaceholdersForDialect(
      `SELECT COUNT(*) as c FROM audit_log ${whereClause}`,
    );
    const countResult = await db.queryOne<{ c: number | string }>(countSql, params);
    total = Number(countResult.data?.c ?? 0);

    const pagedParams = [...params, effectiveLimit, effectiveOffset];
    const rowsSql = replacePlaceholdersForDialect(
      `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT ${sqlPlaceholder(params.length + 1)} OFFSET ${sqlPlaceholder(params.length + 2)}`,
    );
    const rowsResult = await db.query<Record<string, unknown>>(rowsSql, pagedParams);

    entries = (rowsResult.data ?? []).map(sanitizeAuditEntry);
    queryError = rowsResult.error ?? countResult.error ?? null;
  }

  if (isExport) {
    const safeDatePart = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : '');
    const fromPart = safeDatePart(query.from);
    const toPart = safeDatePart(query.to);
    const baseName = fromPart || toPart
      ? `audit-log-${fromPart || 'start'}-to-${toPart || 'now'}`
      : 'audit-log-export';

    if (isCsv) {
      setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
      setHeader(event, 'Content-Disposition', `attachment; filename="${baseName}.csv"`);
      return buildAuditCsv(entries);
    }

    setHeader(event, 'Content-Type', 'application/json; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${baseName}.json"`);
    return {
      exported_at: new Date().toISOString(),
      business_id: businessResult.data.id,
      total,
      entries,
      error: queryError,
    };
  }

  return {
    entries,
    page,
    per_page: perPage,
    total,
    error: queryError,
  };
});
