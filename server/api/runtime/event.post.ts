import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3';
import { verifyTerminalSession } from '~/lib/authUtils';
import { isActionAllowed, normalizePermissions } from '~/lib/permissions';
import type { AuditActionType } from '~/lib/audit';
import type { RuntimeEventEnvelope } from '~/lib/runtime';
import { writeAuditLog } from '~/server/utils/audit';
import { deleteBusinessRow, fetchRowById, insertBusinessRow, queryBusinessRows, updateBusinessRow } from '~/server/utils/businessTable';
import { getTerminalContext, replacePlaceholdersForDialect, sqlPlaceholder } from '~/server/utils/business';
import { ensureStarterBusinessTable } from '~/server/utils/starterTables';
import { db } from '~/lib/db';
import { realtimeHub } from '~/server/utils/realtimeHub';

type RuntimeBatchBody =
  | RuntimeEventEnvelope
  | { events: RuntimeEventEnvelope[] };

function asArray(body: RuntimeBatchBody | null | undefined): RuntimeEventEnvelope[] {
  if (!body) return [];
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
  const body = await readBody<RuntimeBatchBody>(event);
  const events = asArray(body);

  if (events.length === 0) {
    return { results: [], error: null };
  }

  const requestedTerminalId = events[0]?.inpoint_id || getRequestHeader(event, 'x-terminal-id');
  const session = await verifyTerminalSession(event, requestedTerminalId);

  const { data: terminal, error } = await getTerminalContext(session.terminalId);
  if (error || !terminal) {
    throw createError({ statusCode: 404, message: 'Terminal not found' });
  }

  const permissions = normalizePermissions(terminal.permissions, terminal.role);
  const results: Array<{ ok: boolean; data?: unknown; error?: string | null }> = [];

  for (const item of events) {
    try {
      if (!item.inpoint_id || item.inpoint_id !== session.terminalId) {
        item.inpoint_id = session.terminalId;
      }
      if (!item.business_id || item.business_id !== session.businessId) {
        item.business_id = session.businessId;
      }

      if (item.action.table && terminal.schemaName && item.action.table.startsWith(`${terminal.schemaName}_`)) {
        item.action.table = item.action.table.slice(terminal.schemaName.length + 1);
      }
      if (item.action.table?.endsWith('_orders')) {
        item.action.table = 'orders';
      } else if (item.action.table?.endsWith('_products')) {
        item.action.table = 'products';
      } else if (item.action.table?.endsWith('_inventory')) {
        item.action.table = 'inventory';
      }

      const effectiveRole = (terminal.role && terminal.role !== 'staff') ? terminal.role : (terminal.displayName || terminal.role);
      const isKitchenRole = /kitchen/i.test(effectiveRole) || /kitchen/i.test(terminal.displayName || '') || /kitchen/i.test(terminal.role || '');
      const isAllowed = isActionAllowed(permissions, item.action, effectiveRole)
        || (isKitchenRole && item.action.type === 'update' && item.action.table === 'orders');

      if (!isAllowed) {
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

        const insertPayload = { ...(item.payload as Record<string, unknown>) };

        if (item.action.table === 'products' || item.action.table.endsWith('_products')) {
          if (insertPayload.name != null) {
            insertPayload.name = String(insertPayload.name).trim();
          }
          if (insertPayload.price != null) {
            const rawPrice = String(insertPayload.price).trim().replace(/^[$\s]+/, '').replace(/,/g, '').trim();
            const num = Number(rawPrice);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              insertPayload.price = num;
            }
          }
          if (insertPayload.available === undefined || insertPayload.available === null) {
            insertPayload.available = 1;
          } else {
            const av = insertPayload.available;
            insertPayload.available = (av === 1 || av === true || av === '1' || av === 'true') ? 1 : 0;
          }
        }

        const inserted = await insertBusinessRow(
          terminal.schemaName,
          item.action.table,
          insertPayload,
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

        realtimeHub.publish(session.businessId, {
          table: item.action.table,
          action: 'insert',
          recordId: (inserted.data as any)?.id ?? null,
          data: inserted.data as Record<string, unknown>,
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

        const updatePayload = { ...(item.payload as Record<string, unknown>) };

        if (item.action.table === 'products' || item.action.table.endsWith('_products')) {
          if (updatePayload.name != null) {
            updatePayload.name = String(updatePayload.name).trim();
          }
          if (updatePayload.price != null) {
            const rawPrice = String(updatePayload.price).trim().replace(/^[$\s]+/, '').replace(/,/g, '').trim();
            const num = Number(rawPrice);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              updatePayload.price = num;
            }
          }
          if (updatePayload.available !== undefined && updatePayload.available !== null) {
            const av = updatePayload.available;
            updatePayload.available = (av === 1 || av === true || av === '1' || av === 'true') ? 1 : 0;
          }
        }

        if (item.action.table === 'orders' || item.action.table.endsWith('_orders')) {
          if (updatePayload.status != null) {
            const rawStatus = String(updatePayload.status).toLowerCase().trim();
            if (rawStatus === 'served' || rawStatus === 'completed' || rawStatus === 'ready') {
              updatePayload.status = 'fulfilled';
            }
          }
        }

        const before = await fetchRowById(terminal.schemaName, item.action.table, item.action.rowId);
        const updated = await updateBusinessRow(
          terminal.schemaName,
          item.action.table,
          item.action.rowId,
          updatePayload,
        );

        if (updated.error || !updated.data) throw new Error(updated.error ?? 'Update failed');

        await writeAuditLog({
          businessId: session.businessId,
          actorType: 'inpoint',
          actorName: session.displayName,
          actionType: 'update',
          targetTable: item.action.table,
          targetId: String(item.action.rowId),
          payloadBefore: before?.data ?? null,
          payloadAfter: updated.data,
          metadata: {
            terminal_id: session.terminalId,
            trigger: item.trigger,
            element_id: item.element_id,
          },
        });

        realtimeHub.publish(session.businessId, {
          table: item.action.table,
          action: 'update',
          recordId: String(item.action.rowId),
          data: updated.data as Record<string, unknown>,
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
          payloadBefore: before?.data ?? deleted.data ?? null,
          metadata: {
            terminal_id: session.terminalId,
            trigger: item.trigger,
            element_id: item.element_id,
          },
        });

        realtimeHub.publish(session.businessId, {
          table: item.action.table,
          action: 'delete',
          recordId: String(item.action.rowId),
          data: before.data ?? deleted.data ?? null,
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
