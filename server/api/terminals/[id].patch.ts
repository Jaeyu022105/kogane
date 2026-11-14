import { defineEventHandler, readBody } from 'h3';
import { hashPin, verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdmin } from '~/server/utils/business';
import { applyBrandingToLayout, type WorkspaceBrandConfig } from '~/lib/workspaceBranding';
import { normalizeLayout } from '~/lib/uiTypes';
import { normalizePermissions } from '~/lib/permissions';
import { sanitizeTextInput, validateAndSanitizeRecord } from '~/lib/securityClient';
import { writeAuditLog } from '~/server/utils/audit';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const terminalId = event.context.params?.id;

  const parsed = await readBody<{
    businessId?:   string;
    displayName?:  string;
    pin?:          string | null;
    brandConfig?:  Partial<WorkspaceBrandConfig> | null;
    stationConfig?: Record<string, unknown> | null;
  }>(event).catch(() => null);
  const body = (parsed && Object.keys(parsed).length > 0) ? parsed : (event.context?.body ?? (event as any)._body ?? {});

  if (!terminalId || !body.businessId) {
    return { success: false, error: 'Missing required fields', terminal: null };
  }

  // Verify ownership
  const { data: terminal } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    pin_length: number | null;
    ui_layout: string | null;
  }>(
    'SELECT id, business_id, display_name, pin_length, ui_layout FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (!terminal) {
    return { success: false, error: 'Terminal not found', terminal: null };
  }

  const { data: business } = await getBusinessForAdmin(userId, terminal.business_id);
  if (!business || business.id !== body.businessId) {
    return { success: false, error: 'Forbidden', terminal: null };
  }

  let beforeLayout: Record<string, unknown> = {};
  try {
    const rawBefore = typeof terminal.ui_layout === 'string'
      ? terminal.ui_layout
      : JSON.stringify(terminal.ui_layout ?? '{}');
    beforeLayout = JSON.parse(rawBefore) || {};
  } catch {
    beforeLayout = {};
  }

  const updates: Record<string, unknown> = {};

  // ── Basic fields ──────────────────────────────────────────────────────────

  if (typeof body.displayName === 'string') {
    const cleanName = sanitizeTextInput(body.displayName, 100, false).trim();
    if (cleanName) updates.display_name = cleanName;
  }

  if (typeof body.pin === 'string' && body.pin.length > 0) {
    if (!/^\d{4,8}$/.test(body.pin)) {
      return { success: false, error: 'PIN must be 4-8 digits', terminal: null };
    }
    updates.pin_hash   = await hashPin(body.pin);
    updates.pin_code   = body.pin;
    updates.pin_length = body.pin.length;
  }

  // ── Appearance + station config ───────────────────────────────────────────

  if (body.brandConfig || body.stationConfig) {
    let cleanBrandConfig: Partial<WorkspaceBrandConfig> | null = null;
    let cleanStationConfig: Record<string, unknown> | null = null;
    try {
      if (body.brandConfig) {
        cleanBrandConfig = validateAndSanitizeRecord(body.brandConfig, { maxDepth: 6, maxStringLength: 1000 }) as Partial<WorkspaceBrandConfig>;
      }
      if (body.stationConfig) {
        cleanStationConfig = validateAndSanitizeRecord(body.stationConfig, { maxDepth: 6, maxStringLength: 2000 });
      }
    } catch (err) {
      return { success: false, error: (err as Error).message, terminal: null };
    }

    // Parse existing layout
    let existingLayout: Record<string, unknown> = {};
    try {
      const raw = typeof terminal.ui_layout === 'string'
        ? terminal.ui_layout
        : JSON.stringify(terminal.ui_layout ?? '{}');
      existingLayout = JSON.parse(raw);
    } catch {
      existingLayout = {};
    }

    let updatedLayout = { ...existingLayout };

    // Re-apply branding if brandConfig was supplied
    if (cleanBrandConfig) {
      const mergedBrandConfig: Partial<WorkspaceBrandConfig> = {
        ...(existingLayout.brandConfig as Partial<WorkspaceBrandConfig> ?? {}),
        ...cleanBrandConfig,
      };

      // applyBrandingToLayout expects a UiLayout-shaped object
      const rebranded = applyBrandingToLayout(updatedLayout as any, mergedBrandConfig);
      updatedLayout = {
        ...rebranded,
        brandConfig: mergedBrandConfig,         // store so we can restore it
      };
    }

    // Merge station config
    if (cleanStationConfig) {
      updatedLayout.stationConfig = {
        ...(existingLayout.stationConfig as Record<string, unknown> ?? {}),
        ...cleanStationConfig,
      };
    }

    updates.ui_layout = JSON.stringify(updatedLayout);
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No changes supplied', terminal: null };
  }

  const { error } = await db.update('terminals', updates, { id: terminalId });
  if (error) {
    return { success: false, error, terminal: null };
  }

  // Revoke active stateful sessions when a terminal's PIN is rotated
  const pinRotated = typeof updates.pin_hash === 'string';
  if (pinRotated) {
    await db.update(
      'sessions',
      { revoked_at: new Date().toISOString() },
      { terminal_id: terminalId },
    );
  }

  const refreshed = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    pin_code: string | null;
    permissions: string | null;
    ui_layout: string | null;
    is_public: number | boolean | null;
    public_slug: string | null;
    created_at: string;
  }>(
    'SELECT id, business_id, display_name, role, pin_code, permissions, ui_layout, is_public, public_slug, created_at FROM terminals WHERE id = ?',
    [terminalId],
  );

  let parsedLayout: Record<string, unknown> | null = null;
  try {
    parsedLayout = refreshed.data?.ui_layout
      ? (typeof refreshed.data.ui_layout === 'string' ? JSON.parse(refreshed.data.ui_layout) : refreshed.data.ui_layout)
      : null;
  } catch {
    parsedLayout = null;
  }

  const updatedFields = Object.keys(updates).filter(
    (field) => field !== 'pin_hash' && field !== 'pin_code',
  );

  await writeAuditLog({
    businessId: terminal.business_id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Owner',
    actionType: 'update',
    targetTable: 'terminals',
    targetId: terminalId,
    payloadBefore: {
      displayName: terminal.display_name,
      pinLength: terminal.pin_length ?? null,
      brandConfig: (beforeLayout.brandConfig as Record<string, unknown> | undefined) ?? null,
      stationConfig: (beforeLayout.stationConfig as Record<string, unknown> | undefined) ?? null,
    },
    payloadAfter: {
      displayName: typeof updates.display_name === 'string' ? updates.display_name : terminal.display_name,
      pinRotated,
      ...(pinRotated ? { pinLength: updates.pin_length ?? null } : {}),
      ...(updates.ui_layout ? {
        brandConfig: (parsedLayout?.brandConfig as Record<string, unknown> | undefined) ?? null,
        stationConfig: (parsedLayout?.stationConfig as Record<string, unknown> | undefined) ?? null,
      } : {}),
    },
    metadata: {
      event: 'terminal:update',
      terminalId,
      pinRotated,
      updatedFields,
    },
  });

  realtimeHub.publish(terminal.business_id, {
    table: 'terminals',
    action: 'update',
    recordId: terminalId,
    data: {
      terminalId,
      event: 'terminal:updated',
      displayName: refreshed.data?.display_name ?? terminal.display_name,
      pinRotated,
    },
  });

  return {
    success:  true,
    error:    null,
    terminal: refreshed.data ? {
      ...refreshed.data,
      permissions: normalizePermissions(refreshed.data.permissions, refreshed.data.role),
      ui_layout: normalizeLayout(parsedLayout),
    } : null,
  };
});
