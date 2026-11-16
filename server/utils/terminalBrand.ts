/**
 * Business brand kit helpers for terminals.
 *
 * - `resolveTerminalBusiness` turns the joined business columns that every terminal endpoint selects
 *   into the region (country, currency) and brand (name, logo, colors) a running terminal shows.
 * - `propagateBrandKit` re-themes every terminal in a workspace after the brand kit changes, so the
 *   admin configures the look once and each connected terminal follows.
 */

import { db } from '~/lib/db';
import { findCountry } from '~/lib/currency';
import { sanitizeImageSrc } from '~/lib/securityClient';
import { normalizeLayout, type UiLayout } from '~/lib/uiTypes';
import {
  brandInitials,
  mergeTerminalBrandConfig,
  normalizeWorkspaceBrandConfig,
  rebrandLayout,
  type TerminalBrandInfo,
  type WorkspaceBrandConfig,
} from '~/lib/workspaceBranding';
import { realtimeHub } from '~/server/utils/realtimeHub';

/** Columns every terminal endpoint selects from `businesses b` (aliased with a `business_` prefix). */
export const TERMINAL_BUSINESS_COLUMNS = `
  b.name as business_name,
  b.logo_url as business_logo_url,
  b.country as business_country,
  b.currency as business_currency,
  b.currency_symbol as business_currency_symbol,
  b.color_palette as business_color_palette
`;

export interface TerminalBusinessRow {
  business_name?: string | null;
  business_logo_url?: string | null;
  business_country?: string | null;
  business_currency?: string | null;
  business_currency_symbol?: string | null;
  business_color_palette?: string | null;
}

export type TerminalBrand = TerminalBrandInfo;

export function parseBusinessPalette(raw: unknown): Partial<WorkspaceBrandConfig> & Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveTerminalBusiness(row: TerminalBusinessRow) {
  const palette = parseBusinessPalette(row.business_color_palette);
  const paletteCountry = typeof palette.country === 'string' ? palette.country : undefined;
  const paletteCurrency = typeof palette.currency === 'string' ? palette.currency : undefined;
  const paletteSymbol = typeof palette.currencySymbol === 'string' ? palette.currencySymbol : undefined;

  const resolvedCountry = findCountry(row.business_country || paletteCountry || 'US');
  const resolvedBrand = normalizeWorkspaceBrandConfig(palette);
  const name = String(row.business_name ?? '').trim();

  const brand: TerminalBrand = {
    name,
    logoUrl: sanitizeImageSrc(row.business_logo_url) || null,
    initials: brandInitials(name),
    primary: resolvedBrand.primary,
    accent: resolvedBrand.accent,
  };

  return {
    businessName: name,
    country: row.business_country || paletteCountry || resolvedCountry.code,
    currency: row.business_currency || paletteCurrency || resolvedCountry.currency,
    currencySymbol: row.business_currency_symbol || paletteSymbol || resolvedCountry.symbol,
    brand,
  };
}

/**
 * Re-themes each terminal of a business with the latest brand kit, keeping each terminal's own
 * style override (layout bundle, accent) and any colors customized element by element in the builder.
 */
export async function propagateBrandKit(businessId: string, workspaceBrand: Partial<WorkspaceBrandConfig>) {
  const { data: terminals, error } = await db.query<{ id: string; ui_layout: string | null }>(
    'SELECT id, ui_layout FROM terminals WHERE business_id = ?',
    [businessId],
  );
  if (error || !terminals) return { updated: 0, error: error ?? null };

  let updated = 0;
  for (const terminal of terminals) {
    const raw = parseBusinessPalette(terminal.ui_layout);
    if (!Array.isArray(raw.elements)) continue;

    const override = parseBusinessPalette(raw.brandConfig) as Partial<WorkspaceBrandConfig>;
    const effective = mergeTerminalBrandConfig(workspaceBrand, Object.keys(override).length ? override : null);
    const rebranded = rebrandLayout(normalizeLayout(raw as Partial<UiLayout>), effective);
    // Keep preset metadata such as presetName that normalizeLayout does not carry.
    const nextLayout = { ...raw, ...rebranded };
    const serialized = JSON.stringify(nextLayout);
    if (serialized === terminal.ui_layout) continue;

    const { error: updateError } = await db.update('terminals', { ui_layout: serialized }, { id: terminal.id });
    if (updateError) continue;

    updated += 1;
    realtimeHub.publish(businessId, {
      table: 'terminals',
      action: 'update',
      recordId: terminal.id,
      data: { id: terminal.id, terminalId: terminal.id, reason: 'brand-kit' },
    });
  }

  return { updated, error: null };
}
