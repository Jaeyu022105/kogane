import { defineEventHandler, readBody } from 'h3';
import { verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { isActionAllowed, normalizePermissions } from '~/lib/permissions';
import { validateIdentifier } from '~/lib/schemaUtils';
import { validateAndSanitizeRecord } from '~/lib/securityClient';
import { writeAuditLog } from '~/server/utils/audit';
import { isPrefixDb } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const parsed = await readBody<Record<string, unknown>>(event).catch(() => null);
  const body = (parsed && Object.keys(parsed).length > 0)
    ? parsed
    : (event.context?.body ?? (event as any)._body ?? {}) as Record<string, any>;
  const { terminalId, tableName, record } = body ?? {};

  if (!terminalId || !tableName || !record) {
    return { success: false, error: 'Missing required fields' };
  }

  // Authorize via signed & stateful terminal session
  let sessionPayload;
  try {
    sessionPayload = await verifyTerminalSession(event, terminalId);
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  // Fetch the terminal and business associated with this terminal
  const { data: terminal, error: terminalErr } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    permissions: string | null;
  }>(
    'SELECT id, business_id, display_name, role, permissions FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (terminalErr || !terminal) return { success: false, error: 'Terminal not found' };

  const { data: business, error: bizError } = await db.queryOne<{ schema_name: string }>(
    'SELECT schema_name FROM businesses WHERE id = ?',
    [terminal.business_id],
  );

  if (bizError || !business) return { success: false, error: 'Business not found' };

  try {
    validateIdentifier(tableName);

    const normalizedTableName = tableName.startsWith(`${business.schema_name}_`)
      ? tableName.slice(business.schema_name.length + 1)
      : tableName;
    const effectiveRole = (terminal.role && terminal.role !== 'staff')
      ? terminal.role
      : (terminal.display_name || terminal.role);
    const permissions = normalizePermissions(terminal.permissions, effectiveRole);

    if (!isActionAllowed(permissions, { type: 'insert', table: normalizedTableName }, effectiveRole)) {
      await writeAuditLog({
        businessId: terminal.business_id,
        actorType: 'inpoint',
        actorName: sessionPayload.displayName || terminal.display_name,
        actionType: 'permission:denied',
        targetTable: normalizedTableName,
        metadata: {
          terminal_id: terminalId,
          endpoint: '/api/terminals/insert',
          action: { type: 'insert', table: normalizedTableName },
        },
      });
      return { success: false, error: 'Forbidden' };
    }

    const sanitizedRecord = validateAndSanitizeRecord(record);
    const keys = Object.keys(sanitizedRecord);
    if (keys.length === 0) return { success: true };

    for (const key of keys) {
      validateIdentifier(key);
    }

    const isDevMode = isPrefixDb();
    const tbl = isDevMode
      ? `${business.schema_name}_${tableName}`
      : `"${business.schema_name}"."${tableName}"`;

    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const val = sanitizedRecord[k];
      if (val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      if (Array.isArray(val) || (val && typeof val === 'object')) return JSON.stringify(val);
      return val;
    });

    const sql = `INSERT INTO ${tbl} (${cols}) VALUES (${placeholders})`;

    // SQLite driver uses ? instead of $1
    const finalSql = isDevMode ? sql.replace(/\$[0-9]+/g, '?') : sql;

    await db.query(finalSql, values);

    await writeAuditLog({
      businessId: terminal.business_id,
      actorType: 'inpoint',
      actorName: sessionPayload.displayName || terminal.display_name,
      actionType: 'insert',
      targetTable: normalizedTableName,
      payloadAfter: sanitizedRecord,
      metadata: {
        terminal_id: terminalId,
        endpoint: '/api/terminals/insert',
      },
    });

    realtimeHub.publish(terminal.business_id, {
      table: normalizedTableName,
      action: 'insert',
      data: sanitizedRecord,
    });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});
