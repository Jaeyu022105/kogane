/**
 * PATCH /api/terminals/layout
 * Saves the UI layout JSON for an terminal.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { normalizeLayout, type UiLayout } from '~/lib/uiTypes';
import { hasUnsafeControlChars, validateAndSanitizeRecord } from '~/lib/securityClient';
import { writeAuditLog } from '~/server/utils/audit';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const parsed = await readBody<{ terminalId?: string; layout?: UiLayout }>(event).catch(() => null);
  const body = (parsed && Object.keys(parsed).length > 0)
    ? parsed
    : (event.context?.body ?? (event as any)._body ?? {}) as { terminalId?: string; layout?: UiLayout };

  if (!body?.terminalId || !body?.layout) return { error: 'Missing required fields', success: false };
  if (typeof body.terminalId !== 'string' || hasUnsafeControlChars(body.terminalId) || body.terminalId.length > 100) {
    return { error: 'Invalid terminal ID', success: false };
  }

  let cleanLayout: UiLayout;
  try {
    const sanitized = validateAndSanitizeRecord(body.layout, {
      maxDepth: 10,
      maxArrayLength: 500,
      maxStringLength: 10000,
    });
    cleanLayout = normalizeLayout(sanitized as Partial<UiLayout>);
  } catch (err) {
    return { error: (err as Error).message, success: false };
  }

  // Confirm the terminal belongs to this admin's business
  const { data: row } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    ui_layout: string | null;
    admin_user_id: string;
  }>(
    `SELECT i.id, i.business_id, i.display_name, i.ui_layout, b.admin_user_id
     FROM terminals i
     JOIN businesses b ON b.id = i.business_id
     WHERE i.id = ?`,
    [body.terminalId],
  );

  if (!row || row.admin_user_id !== userId) return { error: 'Forbidden', success: false };

  const { error } = await db.update(
    'terminals',
    { ui_layout: JSON.stringify(cleanLayout) },
    { id: body.terminalId },
  );

  if (error) return { error, success: false };

  let prevLayout: Partial<UiLayout> | null = null;
  try {
    prevLayout = row.ui_layout ? JSON.parse(row.ui_layout) : null;
  } catch {
    prevLayout = null;
  }

  await writeAuditLog({
    businessId: row.business_id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Owner',
    actionType: 'update',
    targetTable: 'terminals',
    targetId: body.terminalId,
    payloadBefore: prevLayout ? {
      presetId: prevLayout.presetId ?? null,
      presetVersion: prevLayout.presetVersion ?? null,
      elementCount: Array.isArray(prevLayout.elements) ? prevLayout.elements.length : 0,
      modalCount: Array.isArray(prevLayout.modals) ? prevLayout.modals.length : 0,
    } : null,
    payloadAfter: {
      presetId: cleanLayout.presetId ?? null,
      presetVersion: cleanLayout.presetVersion ?? null,
      elementCount: cleanLayout.elements.length,
      modalCount: cleanLayout.modals?.length ?? 0,
    },
    metadata: {
      event: 'terminal:layout:update',
      terminalId: body.terminalId,
      displayName: row.display_name,
      presetId: cleanLayout.presetId ?? null,
      presetVersion: cleanLayout.presetVersion ?? null,
    },
  });

  realtimeHub.publish(row.business_id, {
    table: 'terminals',
    action: 'update',
    recordId: body.terminalId,
    data: {
      terminalId: body.terminalId,
      event: 'terminal:layout',
      uiLayout: cleanLayout,
    },
  });

  return { success: true, error: null };
});
