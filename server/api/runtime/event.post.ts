import { createError, defineEventHandler, readBody } from 'h3';
import { verifyTerminalSession } from '~/lib/authUtils';
import { isActionAllowed, normalizePermissions } from '~/lib/permissions';
import type { AuditActionType } from '~/lib/audit';
import type { RuntimeEventEnvelope } from '~/lib/runtime';
import { writeAuditLog } from '~/server/utils/audit';
import { deleteBusinessRow, fetchRowById, insertBusinessRow, queryBusinessRows, updateBusinessRow } from '~/server/utils/businessTable';
import { getTerminalContext, replacePlaceholdersForDialect, sqlPlaceholder } from '~/server/utils/business';
import { ensureStarterBusinessTable } from '~/server/utils/starterTables';
import { db } from '~/lib/db';

type RuntimeBatchBody =
  | RuntimeEventEnvelope
  | { events: RuntimeEventEnvelope[] };

function asArray(body: RuntimeBatchBody): RuntimeEventEnvelope[] {
  if (Array.isArray((body as { events?: RuntimeEventEnvelope[] }).events)) {
    return (body as { events: RuntimeEventEnvelope[] }).events;
  }
  return [body as RuntimeEventEnvelope];
}

function actionToAuditType(actionType: string): AuditActionType {
  if (actionType === 'insert' || actionType === 'update' || actionType === 'delete') {
    return actionType;
  }
  return 'permission:denied';
}

const AUDIT_LOG_COLUMNS = new Set([
  'id',
  'business_id',
  'actor_id',
  'actor_type',
  'actor_name',
  'action_type',
  'target_table',
  'target_id',
  'payload_before',
  'payload_after',
  'metadata',
  'created_at',
]);

const AUDIT_LOG_FILTER_COLUMNS = new Set([
  'actor_type',
  'actor_name',
  'action_type',
  'target_table',
  'target_id',
]);

async function queryAuditLogRows(options: {
  businessId: string;
  columns?: string[];
  where?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}) {
  const selectedColumns = options.columns?.length ? options.columns : [
    'created_at',
    'actor_name',
    'actor_type',
    'action_type',
    'target_table',
    'target_id',
  ];

  for (const column of selectedColumns) {
    if (!AUDIT_LOG_COLUMNS.has(column)) {
      throw new Error(`Invalid audit_log column: ${column}`);
    }
  }

  const clauses = [`business_id = ${sqlPlaceholder(1)}`];
  const params: unknown[] = [options.businessId];

  for (const [key, value] of Object.entries(options.where ?? {})) {
    if (!AUDIT_LOG_FILTER_COLUMNS.has(key) || value == null || value === '') continue;
    params.push(value);
    clauses.push(`${key} = ${sqlPlaceholder(params.length)}`);
  }

  const limit = Math.min(options.limit ?? 50, 200);
  const offset = Math.max(options.offset ?? 0, 0);
  params.push(limit);
  const limitPlaceholder = sqlPlaceholder(params.length);
  params.push(offset);
  const offsetPlaceholder = sqlPlaceholder(params.length);

  const sql = replacePlaceholdersForDialect(
    `SELECT ${selectedColumns.join(', ')} FROM audit_log WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
  );

  return db.query(sql, params);
}

export default defineEventHandler(async (event) => {
  const session = await verifyTerminalSession(event);
  const body = await readBody<RuntimeBatchBody>(event);
  const events = asArray(body);

  if (events.length === 0) {
    return { results: [], error: null };
  }

  const { data: terminal, error } = await getTerminalContext(session.terminalId);
  if (error || !terminal) {
    throw createError({ statusCode: 404, message: 'Terminal not found' });
  }

  const permissions = normalizePermissions(terminal.permissions);
  const results: Array<{ ok: boolean; data?: unknown; error?: string | null }> = [];

  for (const item of events) {
    try {
      if (item.inpoint_id !== session.terminalId || item.business_id !== session.businessId) {
        throw new Error('Session does not match runtime event');
      }

      if (!isActionAllowed(permissions, item.action)) {
        await writeAuditLog({
          businessId: session.businessId,
          actorType: 'inpoint',
          actorName: session.displayName,
          actionType: 'permission:denied',
          targetTable: item.action.table ?? null,
          metadata: {
            terminal_id: session.terminalId,
            trigger: item.trigger,
            element_id: item.element_id,
            action: item.action,
          },
        });

        results.push({ ok: false, error: 'Forbidden' });
        continue;
      }

      if (item.action.table) {
        const ensured = await ensureStarterBusinessTable(terminal.schemaName, item.action.table);
        if (ensured.error) {
          throw new Error(ensured.error);
        }
      }

      if (item.action.type === 'query') {
        if (item.action.source === 'audit-log') {
          const queryResult = await queryAuditLogRows({
            businessId: session.businessId,
            columns: item.action.columns,
            where: item.action.where,
            limit: item.action.limit,
            offset: item.action.offset,
          });

          results.push({
            ok: !queryResult.error,
            data: queryResult.data ?? [],
            error: queryResult.error,
          });
          continue;
        }

        if (!item.action.table) throw new Error('Query actions require a table');

        const queryResult = await queryBusinessRows(
          terminal.schemaName,
          item.action.table,
          item.action.columns ?? [],
          {
            where: item.action.where as Record<string, unknown> | undefined,
            limit: Math.min(item.action.limit ?? 50, 200),
            offset: item.action.offset ?? 0,
            orderBy: item.action.orderBy,
            descending: item.action.descending,
          },
        );

        results.push({
          ok: !queryResult.error,
          data: queryResult.data ?? [],
          error: queryResult.error,
        });
        continue;
      }

      if (item.action.type === 'insert') {
        if (!item.action.table || !item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload)) {
          throw new Error('Insert actions require an object payload');
        }

        const inserted = await insertBusinessRow(
          terminal.schemaName,
          item.action.table,
          item.payload as Record<string, unknown>,
        );

        if (inserted.error || !inserted.data) throw new Error(inserted.error ?? 'Insert failed');

        await writeAuditLog({
          businessId: session.businessId,
          actorType: 'inpoint',
          actorName: session.displayName,
          actionType: 'insert',
          targetTable: item.action.table,
          targetId: (inserted.data as any).id ?? null,
          payloadAfter: inserted.data,
          metadata: {
            terminal_id: session.terminalId,
            trigger: item.trigger,
            element_id: item.element_id,
          },
        });

        results.push({ ok: true, data: inserted.data, error: null });
        continue;
      }

      if (item.action.type === 'update') {
        if (!item.action.table || !item.action.rowId) {
          throw new Error('Update actions require a table and row id');
        }
        if (!item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload)) {
          throw new Error('Update actions require an object payload');
        }

        const before = await fetchRowById(terminal.schemaName, item.action.table, item.action.rowId);
        const updated = await updateBusinessRow(
          terminal.schemaName,
          item.action.table,
          item.action.rowId,
          item.payload as Record<string, unknown>,
        );

        if (updated.error || !updated.data) throw new Error(updated.error ?? 'Update failed');

        await writeAuditLog({
          businessId: session.businessId,
          actorType: 'inpoint',
          actorName: session.displayName,
          actionType: 'update',
          targetTable: item.action.table,
          targetId: String(item.action.rowId),
          payloadBefore: before.data,
          payloadAfter: updated.data,
          metadata: {
            terminal_id: session.terminalId,
            trigger: item.trigger,
            element_id: item.element_id,
          },
        });

        results.push({ ok: true, data: updated.data, error: null });
        continue;
      }

      if (item.action.type === 'delete') {
        if (!item.action.table || !item.action.rowId) {
          throw new Error('Delete actions require a table and row id');
        }

        const before = await fetchRowById(terminal.schemaName, item.action.table, item.action.rowId);
        const deleted = await deleteBusinessRow(terminal.schemaName, item.action.table, item.action.rowId);
        if (deleted.error) throw new Error(deleted.error);

        await writeAuditLog({
          businessId: session.businessId,
          actorType: 'inpoint',
          actorName: session.displayName,
          actionType: 'delete',
          targetTable: item.action.table,
          targetId: String(item.action.rowId),
          payloadBefore: before.data ?? deleted.data,
          metadata: {
            terminal_id: session.terminalId,
            trigger: item.trigger,
            element_id: item.element_id,
          },
        });

        results.push({ ok: true, data: deleted.data, error: null });
        continue;
      }

      results.push({ ok: true, data: null, error: null });
    } catch (err) {
      results.push({
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  return { results, error: null };
});
