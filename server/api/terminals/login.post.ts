/**
 * POST /api/terminals/login
 * Authenticates a terminal user via terminal id + PIN.
 * Returns a session token for the terminal session.
 */

import { defineEventHandler, readBody } from 'h3';
import { issueTerminalSession, verifyPin } from '~/lib/authUtils';
import { normalizeLayout } from '~/lib/uiTypes';
import { normalizePermissions } from '~/lib/permissions';
import { db } from '~/lib/db';
import { writeAuditLog } from '~/server/utils/audit';
import { findCountry } from '~/lib/currency';

export default defineEventHandler(async (event) => {
  const body = (await readBody<{
    terminalId?: string;
    businessId?: string;
    displayName?: string;
    pin?: string;
  }>(event)) ?? {};

  if (!body.pin || (!body.terminalId && (!body.businessId || !body.displayName))) {
    return { error: 'Missing credentials', session: null, token: null };
  }

  const query = body.terminalId
    ? `
        SELECT
          t.id,
          t.business_id,
          t.pin_hash,
          t.role,
          t.permissions,
          t.ui_layout,
          t.display_name,
          b.name as business_name,
          b.country as business_country,
          b.currency as business_currency,
          b.currency_symbol as business_currency_symbol,
          b.color_palette as business_color_palette
        FROM terminals t
        JOIN businesses b ON b.id = t.business_id
        WHERE t.id = ?
      `
    : `
        SELECT
          t.id,
          t.business_id,
          t.pin_hash,
          t.role,
          t.permissions,
          t.ui_layout,
          t.display_name,
          b.name as business_name,
          b.country as business_country,
          b.currency as business_currency,
          b.currency_symbol as business_currency_symbol,
          b.color_palette as business_color_palette
        FROM terminals t
        JOIN businesses b ON b.id = t.business_id
        WHERE t.business_id = ? AND t.display_name = ?
      `;
  const params = body.terminalId
    ? [body.terminalId]
    : [body.businessId, body.displayName];

  const { data: terminal } = await db.queryOne<{
    id: string;
    business_id: string;
    pin_hash: string;
    role: string;
    permissions: string;
    ui_layout: string;
    display_name: string;
    business_name: string;
    business_country?: string | null;
    business_currency?: string | null;
    business_currency_symbol?: string | null;
    business_color_palette?: string | null;
  }>(query, params);

  if (!terminal) return { error: 'Invalid credentials', session: null, token: null };

  const valid = await verifyPin(body.pin, terminal.pin_hash);
  if (!valid) return { error: 'Invalid credentials', session: null, token: null };

  // Parse UI layout from stored JSON
  let uiLayout;
  try {
    uiLayout = normalizeLayout(
      typeof terminal.ui_layout === 'string'
        ? JSON.parse(terminal.ui_layout)
        : terminal.ui_layout,
    );
  } catch {
    uiLayout = normalizeLayout();
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const token = await issueTerminalSession(event, {
    terminalId: terminal.id,
    businessId: terminal.business_id,
    displayName: terminal.display_name,
    role: terminal.role,
    expiresAt,
  });

  await writeAuditLog({
    businessId: terminal.business_id,
    actorType: 'inpoint',
    actorName: terminal.display_name,
    actionType: 'login',
    metadata: {
      terminal_id: terminal.id,
      role: terminal.role,
    },
  });

  let paletteCountry: string | undefined;
  let paletteCurrency: string | undefined;
  let paletteSymbol: string | undefined;
  try {
    const pal = JSON.parse(terminal.business_color_palette || '{}');
    paletteCountry = pal.country;
    paletteCurrency = pal.currency;
    paletteSymbol = pal.currencySymbol;
  } catch {
    // Ignore invalid JSON
  }

  const resolvedCountry = findCountry(terminal.business_country || paletteCountry || 'US');
  const country = terminal.business_country || paletteCountry || resolvedCountry.code;
  const currency = terminal.business_currency || paletteCurrency || resolvedCountry.currency;
  const currencySymbol = terminal.business_currency_symbol || paletteSymbol || resolvedCountry.symbol;

  return {
    token,
    session: {
      terminalId: terminal.id,
      businessId: terminal.business_id,
      displayName: terminal.display_name,
      businessName: terminal.business_name,
      country,
      currency,
      currencySymbol,
      role: terminal.role,
      permissions: normalizePermissions(terminal.permissions, terminal.role),
      uiLayout,
      expiresAt,
    },
    error: null,
  };
});
