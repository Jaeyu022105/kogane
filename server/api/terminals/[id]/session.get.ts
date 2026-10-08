import { defineEventHandler } from 'h3';
import { issueTerminalSession, verifyAdmin, verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { normalizeLayout } from '~/lib/uiTypes';
import { normalizePermissions } from '~/lib/permissions';
import { findCountry } from '~/lib/currency';

export default defineEventHandler(async (event) => {
  const terminalId = event.context.params?.id;
  if (!terminalId) {
    return { session: null, token: null, error: 'Missing terminal ID' };
  }

  // 1. Check existing terminal session cookie or header
  let sessionPayload: any = null;
  try {
    sessionPayload = await verifyTerminalSession(event, terminalId);
  } catch {
    // No valid terminal session cookie
  }

  // 2. Query terminal details
  const { data: terminal } = await db.queryOne<{
    id: string;
    business_id: string;
    display_name: string;
    role: string;
    permissions: string | null;
    ui_layout: string | null;
    business_name: string;
    admin_user_id: string;
    business_country?: string | null;
    business_currency?: string | null;
    business_currency_symbol?: string | null;
    business_color_palette?: string | null;
  }>(
    `SELECT
       t.id,
       t.business_id,
       t.display_name,
       t.role,
       t.permissions,
       t.ui_layout,
       b.name as business_name,
       b.admin_user_id,
       b.country as business_country,
       b.currency as business_currency,
       b.currency_symbol as business_currency_symbol,
       b.color_palette as business_color_palette
     FROM terminals t
     JOIN businesses b ON b.id = t.business_id
     WHERE t.id = ?`,
    [terminalId],
  );

  if (!terminal) {
    return { session: null, token: null, error: 'Terminal not found' };
  }

  // 3. If no session cookie, check for admin session passthrough
  if (!sessionPayload) {
    try {
      const { userId } = await verifyAdmin(event);
      if (userId && terminal.admin_user_id === userId) {
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        sessionPayload = {
          terminalId: terminal.id,
          businessId: terminal.business_id,
          displayName: terminal.display_name,
          role: terminal.role,
          expiresAt,
        };
      }
    } catch {
      // Not admin
    }
  }

  if (!sessionPayload) {
    return { session: null, token: null, error: null };
  }

  const token = await issueTerminalSession(event, sessionPayload);

  let parsedLayout;
  try {
    parsedLayout = terminal.ui_layout
      ? JSON.parse(terminal.ui_layout)
      : null;
  } catch {
    parsedLayout = null;
  }

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
      uiLayout: normalizeLayout(parsedLayout),
      expiresAt: sessionPayload.expiresAt,
    },
    error: null,
  };
});
