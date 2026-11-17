/**
 * Audit log search, shared by the audit log page and its CSV / JSON export.
 *
 * SQLite filters, counts and pages in SQL. The Firestore translator cannot run the
 * OR / LOWER(COALESCE(...)) LIKE search, so on Firebase the narrower filters run as
 * SQL and the table group and text search are applied in memory. Callers see the
 * same result either way.
 */

import { redactAuditJsonString } from '~/lib/audit';
import { db, isLocalBackend } from '~/lib/db';

const SEARCHABLE_COLUMNS = [
  'actor_name',
  'target_table',
  'target_id',
  'action_type',
  'metadata',
  'payload_before',
  'payload_after',
] as const;

export interface AuditLogFilters {
  businessId: string;
  actorType?: string;
  actionType?: string;
  /** A table name, or the groups `schema` (schema changes) and `business`. */
  table?: string;
  from?: Date | null;
  to?: Date | null;
  search?: string;
  limit: number;
  offset: number;
}

export interface AuditLogPage {
  entries: Record<string, unknown>[];
  total: number;
  error: string | null;
}

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
  return SEARCHABLE_COLUMNS.some((col) => {
    const val = row[col];
    return val != null && String(val).toLowerCase().includes(needleLower);
  });
}

function isSchemaChange(row: Record<string, unknown>): boolean {
  return row.target_table === 'schema' || String(row.action_type ?? '').startsWith('schema:');
}

export async function queryAuditLog(filters: AuditLogFilters): Promise<AuditLogPage> {
  const local = isLocalBackend();
  const clauses = ['business_id = ?'];
  const params: unknown[] = [filters.businessId];

  if (filters.actorType && filters.actorType !== 'all') {
    params.push(filters.actorType);
    clauses.push('actor_type = ?');
  }

  if (filters.actionType) {
    params.push(filters.actionType);
    clauses.push('action_type = ?');
  }

  const table = filters.table;
  if (table === 'business') {
    params.push('business', 'businesses');
    clauses.push('target_table IN (?, ?)');
  } else if (table === 'schema') {
    if (local) {
      params.push('schema', 'schema:%');
      clauses.push('(target_table = ? OR action_type LIKE ?)');
    }
  } else if (table) {
    params.push(table);
    clauses.push('target_table = ?');
  }

  const formatDate = (date: Date) => (local ? formatSqliteUtc(date) : date.toISOString());
  if (filters.from) {
    params.push(formatDate(filters.from));
    clauses.push('datetime(created_at) >= datetime(?)');
  }
  if (filters.to) {
    params.push(formatDate(filters.to));
    clauses.push('datetime(created_at) <= datetime(?)');
  }

  const search = filters.search?.trim() ?? '';
  if (search && local) {
    const pattern = `%${search.toLowerCase().replace(/[!%_]/g, '!$&')}%`;
    const orParts = SEARCHABLE_COLUMNS.map((col) => {
      params.push(pattern);
      return `LOWER(COALESCE(${col}, '')) LIKE ? ESCAPE '!'`;
    });
    clauses.push(`(${orParts.join(' OR ')})`);
  }

  const whereClause = `WHERE ${clauses.join(' AND ')}`;

  if (local) {
    const countResult = await db.queryOne<{ c: number | string }>(
      `SELECT COUNT(*) as c FROM audit_log ${whereClause}`,
      params,
    );
    const rowsResult = await db.query<Record<string, unknown>>(
      `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, filters.offset],
    );
    return {
      entries: (rowsResult.data ?? []).map(sanitizeAuditEntry),
      total: Number(countResult.data?.c ?? 0),
      error: rowsResult.error ?? countResult.error ?? null,
    };
  }

  const allResult = await db.query<Record<string, unknown>>(
    `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC`,
    params,
  );
  let rows = (allResult.data ?? []).map(sanitizeAuditEntry);
  if (table === 'schema') rows = rows.filter(isSchemaChange);
  if (search) {
    const needleLower = search.toLowerCase();
    rows = rows.filter((row) => matchesAuditSearch(row, needleLower));
  }

  return {
    entries: rows.slice(filters.offset, filters.offset + filters.limit),
    total: rows.length,
    error: allResult.error ?? null,
  };
}
