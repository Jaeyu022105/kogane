import { createError, defineEventHandler, getQuery, setHeader } from 'h3';
import { buildAuditCsv } from '~/lib/audit';
import { verifyAdmin } from '~/lib/authUtils';
import { sanitizeTextInput } from '~/lib/securityClient';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { queryAuditLog } from '~/server/utils/auditLogQuery';
import { normalizeDateRange } from '~/server/utils/reporting';

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

  const dateRange = query.from || query.to
    ? normalizeDateRange(query.from, query.to)
    : null;

  const { entries, total, error: queryError } = await queryAuditLog({
    businessId: businessResult.data.id,
    actorType,
    actionType,
    table: tableFilter,
    from: query.from ? dateRange?.from : null,
    to: query.to ? dateRange?.to : null,
    search: searchQ,
    limit: effectiveLimit,
    offset: effectiveOffset,
  });

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
