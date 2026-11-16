/**
 * PATCH /api/businesses/theme
 * Updates the brand kit (name, logo, colors, terminal style), country, and currency for the
 * authenticated admin's business. Brand changes are pushed to every terminal in the workspace.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { findCountry } from '~/lib/currency';
import { sanitizeImageSrc, sanitizeTextInput, validateAndSanitizeRecord } from '~/lib/securityClient';
import type { WorkspaceBrandConfig } from '~/lib/workspaceBranding';
import { writeAuditLog } from '~/server/utils/audit';
import { realtimeHub } from '~/server/utils/realtimeHub';
import { parseBusinessPalette, propagateBrandKit } from '~/server/utils/terminalBrand';

/** Palette keys that change how terminals look; any change re-themes the workspace terminals. */
const TERMINAL_LOOK_KEYS = ['primary', 'secondary', 'accent', 'background', 'layoutBundle', 'surfaceStyle', 'particleEffect'] as const;

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const body = await readBody<{
    logoUrl?: string;
    colorPalette?: Record<string, any>;
    country?: string;
    currency?: string;
    currencySymbol?: string;
    name?: string;
  }>(event);

  const updates: Record<string, unknown> = {};
  if (body.logoUrl !== undefined) {
    updates.logo_url = body.logoUrl ? (sanitizeImageSrc(body.logoUrl) || null) : null;
  }
  if (body.name !== undefined) {
    const cleanName = sanitizeTextInput(body.name, 120, false).trim();
    if (cleanName) updates.name = cleanName;
  }

  // If country is provided, resolve corresponding currency and currency symbol if not explicitly given
  if (body.country !== undefined) {
    const cleanCountry = sanitizeTextInput(body.country, 16, false).trim();
    const resolved = findCountry(cleanCountry);
    updates.country = resolved.code;
    updates.currency = sanitizeTextInput(body.currency, 16, false).trim() || resolved.currency;
    updates.currency_symbol = sanitizeTextInput(body.currencySymbol, 16, false).trim() || resolved.symbol;
  } else {
    if (body.currency !== undefined) updates.currency = sanitizeTextInput(body.currency, 16, false).trim();
    if (body.currencySymbol !== undefined) updates.currency_symbol = sanitizeTextInput(body.currencySymbol, 16, false).trim();
  }

  if (body.colorPalette !== undefined) {
    let cleanPalette: Record<string, any> = {};
    if (body.colorPalette !== null) {
      try {
        cleanPalette = validateAndSanitizeRecord(body.colorPalette, {
          maxDepth: 6,
          maxStringLength: 1000,
          maxArrayLength: 50,
          maxObjectKeys: 100,
          allowMultiline: false,
        });
      } catch (err) {
        return { error: (err as Error).message, success: false };
      }
    }
    const paletteWithCurrency = {
      ...cleanPalette,
      ...(updates.country ? { country: updates.country } : {}),
      ...(updates.currency ? { currency: updates.currency } : {}),
      ...(updates.currency_symbol ? { currencySymbol: updates.currency_symbol } : {}),
    };
    updates.color_palette = JSON.stringify(paletteWithCurrency);
  } else if (updates.country || updates.currency || updates.currency_symbol) {
    // Keep color_palette JSON synchronized with country / currency
    const { data: existing } = await db.queryOne<{ color_palette: string | null }>(
      'SELECT color_palette FROM businesses WHERE admin_user_id = ?',
      [userId],
    );
    let parsed: Record<string, any> = {};
    try {
      parsed = existing?.color_palette ? JSON.parse(existing.color_palette) : {};
    } catch {
      parsed = {};
    }
    if (updates.country) parsed.country = updates.country;
    if (updates.currency) parsed.currency = updates.currency;
    if (updates.currency_symbol) parsed.currencySymbol = updates.currency_symbol;
    updates.color_palette = JSON.stringify(parsed);
  }

  if (!Object.keys(updates).length) return { error: 'No updates provided', success: false };

  const { data: before } = await db.queryOne<{
    id: string;
    name: string | null;
    logo_url: string | null;
    color_palette: string | null;
  }>('SELECT id, name, logo_url, color_palette FROM businesses WHERE admin_user_id = ?', [userId]);

  const { error } = await db.update('businesses', updates, { admin_user_id: userId });

  if (error) return { error, success: false };
  if (!before?.id) return { success: true, error: null, terminalsUpdated: 0 };

  const previousPalette = parseBusinessPalette(before.color_palette);
  const nextPalette = typeof updates.color_palette === 'string'
    ? parseBusinessPalette(updates.color_palette)
    : previousPalette;
  const lookChanged = TERMINAL_LOOK_KEYS.some((key) => (previousPalette[key] ?? null) !== (nextPalette[key] ?? null));
  const nameChanged = updates.name !== undefined && updates.name !== before.name;
  const logoChanged = updates.logo_url !== undefined && updates.logo_url !== before.logo_url;

  let terminalsUpdated = 0;
  if (lookChanged) {
    const result = await propagateBrandKit(before.id, nextPalette as Partial<WorkspaceBrandConfig>);
    terminalsUpdated = result.updated;
  }
  if (nameChanged || logoChanged) {
    // Running terminals show the business name and logo in their header; ask them to refresh.
    realtimeHub.publish(before.id, {
      table: 'terminals',
      action: 'update',
      data: { reason: 'brand-kit' },
    });
  }

  if (lookChanged || nameChanged || logoChanged) {
    const brandSnapshot = (name: string | null, logoUrl: string | null, palette: Record<string, unknown>) => ({
      name,
      logo_url: logoUrl,
      ...Object.fromEntries(TERMINAL_LOOK_KEYS.map((key) => [key, palette[key] ?? null])),
    });
    await writeAuditLog({
      businessId: before.id,
      actorId: userId,
      actorType: 'admin',
      actorName: 'Admin',
      actionType: 'update',
      targetTable: 'business',
      targetId: before.id,
      payloadBefore: brandSnapshot(before.name, before.logo_url, previousPalette),
      payloadAfter: brandSnapshot(
        (updates.name as string | undefined) ?? before.name,
        updates.logo_url !== undefined ? (updates.logo_url as string | null) : before.logo_url,
        nextPalette,
      ),
      metadata: { event: 'business:brand-kit', terminals_updated: terminalsUpdated },
    });
  }

  return { success: true, error: null, terminalsUpdated };
});
