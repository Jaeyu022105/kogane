import { defineEventHandler, readBody } from 'h3';
import { hashPin, verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdmin } from '~/server/utils/business';
import { applyBrandingToLayout, type WorkspaceBrandConfig } from '~/lib/workspaceBranding';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const terminalId = event.context.params?.id;

  const body = (await readBody<{
    businessId?:   string;
    displayName?:  string;
    pin?:          string | null;
    brandConfig?:  Partial<WorkspaceBrandConfig> | null;
    stationConfig?: Record<string, unknown> | null;
  }>(event)) ?? {};

  if (!terminalId || !body.businessId) {
    return { success: false, error: 'Missing required fields', terminal: null };
  }

  // Verify ownership
  const { data: terminal } = await db.queryOne<{
    id: string;
    business_id: string;
    ui_layout: string | null;
  }>(
    'SELECT id, business_id, ui_layout FROM terminals WHERE id = ?',
    [terminalId],
  );

  if (!terminal) {
    return { success: false, error: 'Terminal not found', terminal: null };
  }

  const { data: business } = await getBusinessForAdmin(userId, terminal.business_id);
  if (!business || business.id !== body.businessId) {
    return { success: false, error: 'Forbidden', terminal: null };
  }

  const updates: Record<string, unknown> = {};

  // ── Basic fields ──────────────────────────────────────────────────────────

  if (typeof body.displayName === 'string' && body.displayName.trim()) {
    updates.display_name = body.displayName.trim();
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
    if (body.brandConfig) {
      const mergedBrandConfig: Partial<WorkspaceBrandConfig> = {
        ...(existingLayout.brandConfig as Partial<WorkspaceBrandConfig> ?? {}),
        ...body.brandConfig,
      };

      // applyBrandingToLayout expects a UiLayout-shaped object
      const rebranded = applyBrandingToLayout(updatedLayout as any, mergedBrandConfig);
      updatedLayout = {
        ...rebranded,
        brandConfig: mergedBrandConfig,         // store so we can restore it
      };
    }

    // Merge station config
    if (body.stationConfig) {
      updatedLayout.stationConfig = {
        ...(existingLayout.stationConfig as Record<string, unknown> ?? {}),
        ...body.stationConfig,
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

  const refreshed = await db.queryOne(
    'SELECT id, business_id, display_name, role, pin_code, permissions, ui_layout, is_public, public_slug, created_at FROM terminals WHERE id = ?',
    [terminalId],
  );

  return {
    success:  true,
    error:    null,
    terminal: refreshed.data ?? null,
  };
});
