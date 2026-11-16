import { describe, expect, test } from 'bun:test';
import { db } from '../lib/db';
import { DEFAULT_TERMINAL_PIN } from '../lib/permissions';
import { normalizeLayout, type UiLayout } from '../lib/uiTypes';
import {
  applyBrandingToLayout,
  brandInitials,
  buildLayoutTheme,
  mergeTerminalBrandConfig,
  readableTextColor,
  rebrandLayout,
} from '../lib/workspaceBranding';
import { resolveTerminalBusiness } from '../server/utils/terminalBrand';
import { createTestAdminToken } from './helpers/sessions';
import onboardHandler from '../server/api/businesses/onboard.post';
import themeHandler from '../server/api/businesses/theme.patch';
import terminalPatchHandler from '../server/api/terminals/[id].patch';
import terminalMetaHandler from '../server/api/terminals/[id]/meta.get';

function makeEvent(method: string, url: string, body: unknown, token: string, params: Record<string, string> = {}) {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  return {
    method,
    path: url,
    node: {
      req: { method, url, headers, body, [Symbol.for('h3ParsedBody')]: body },
      res: { setHeader: () => {}, getHeader: () => undefined },
    },
    headers: new Headers(headers),
    context: { body, params },
    _body: body,
  } as any;
}

const sampleLayout = {
  version: 2,
  resolution: { width: 1280, height: 720 },
  elements: [
    { id: 'pay', type: 'button', label: 'Pay', text: 'Pay', position: { x: 0, y: 0, width: 200, height: 48, zIndex: 1 } },
    { id: 'custom', type: 'button', label: 'Custom', text: 'Custom', position: { x: 0, y: 60, width: 200, height: 48, zIndex: 1 } },
  ],
} as unknown as UiLayout;

describe('Brand kit helpers', () => {
  test('readableTextColor keeps white on typical brand colors and flips on pale accents', () => {
    expect(readableTextColor('#68293A')).toBe('#ffffff');
    expect(readableTextColor('#FF5776')).toBe('#ffffff');
    expect(readableTextColor('#d97706')).toBe('#ffffff');
    expect(readableTextColor('#facc15')).not.toBe('#ffffff');
    expect(readableTextColor('#F6E6D7')).not.toBe('#ffffff');
    expect(readableTextColor('not-a-color')).toBe('#ffffff');
  });

  test('brandInitials builds a short monogram from the business name', () => {
    expect(brandInitials('Harbor Coffee Roasters')).toBe('HR');
    expect(brandInitials('kogane')).toBe('KO');
    expect(brandInitials('')).toBe('K');
    expect(brandInitials('  ')).toBe('K');
  });

  test('buildLayoutTheme tints the frame with an explicit business primary but keeps panels readable', () => {
    const plain = buildLayoutTheme({ layoutBundle: 'aurora-service' });
    const branded = buildLayoutTheme({ layoutBundle: 'aurora-service', primary: '#1E3A5F' });

    expect(branded.brandColor).toBe('#1e3a5f');
    expect(branded.frameBackground).not.toBe(plain.frameBackground);
    expect(branded.panelBackground).toBe(plain.panelBackground);
    expect(branded.panelText).toBe(plain.panelText);

    const pale = buildLayoutTheme({ layoutBundle: 'paper-ledger', accent: '#facc15' });
    expect(pale.accentTextColor).not.toBe('#ffffff');
    const pay = applyBrandingToLayout(sampleLayout, { layoutBundle: 'paper-ledger', accent: '#facc15' })
      .elements.find((element) => element.id === 'pay') as unknown as Record<string, unknown>;
    expect(pay.textColor).toBe(pale.accentTextColor);
  });

  test('mergeTerminalBrandConfig lets a terminal override only its own style keys', () => {
    const merged = mergeTerminalBrandConfig(
      { primary: '#68293A', accent: '#FF5776', layoutBundle: 'aurora-service', country: 'PH' },
      { accent: '#16a34a', primary: '#000000' } as Record<string, string>,
    );
    expect(merged.accent).toBe('#16a34a');
    expect(merged.primary).toBe('#68293A');
    expect(merged.layoutBundle).toBe('aurora-service');
    expect(merged.country).toBe('PH');
  });

  test('rebrandLayout moves theme defaults to the new brand but keeps hand-picked element colors', () => {
    const original = applyBrandingToLayout(sampleLayout, { layoutBundle: 'aurora-service', accent: '#FF5776' });
    const customized = normalizeLayout({
      ...original,
      elements: original.elements.map((element) => (
        element.id === 'custom' ? { ...element, backgroundColor: '#123456' } : element
      )),
    });

    const next = rebrandLayout(customized, { layoutBundle: 'aurora-service', accent: '#0ea5e9', primary: '#1E3A5F' });
    const pay = next.elements.find((element) => element.id === 'pay') as unknown as Record<string, unknown>;
    const custom = next.elements.find((element) => element.id === 'custom') as unknown as Record<string, unknown>;

    expect(next.theme.accentColor).toBe('#0ea5e9');
    expect(pay.backgroundColor).toBe('#0ea5e9');
    expect(custom.backgroundColor).toBe('#123456');
  });

  test('resolveTerminalBusiness returns region and brand, dropping unsafe logo URLs', () => {
    const resolved = resolveTerminalBusiness({
      business_name: 'Harbor Coffee',
      business_logo_url: 'javascript:alert(1)',
      business_country: null,
      business_currency: null,
      business_currency_symbol: null,
      business_color_palette: JSON.stringify({ country: 'PH', primary: '#1E3A5F', accent: '#FF5776' }),
    });

    expect(resolved.country).toBe('PH');
    expect(resolved.currency).toBe('PHP');
    expect(resolved.brand.name).toBe('Harbor Coffee');
    expect(resolved.brand.initials).toBe('HC');
    expect(resolved.brand.logoUrl).toBeNull();
    expect(resolved.brand.primary).toBe('#1e3a5f');
  });
});

describe('Brand kit propagation to workspace terminals', () => {
  test('saving the brand kit re-themes every terminal, keeps overrides and custom colors, and exposes the brand', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const email = `brandkit-${suffix}@example.com`;
    const adminRes = await db.insert<{ id: string }>('users', { email, full_name: 'Brand Admin', password_hash: 'hash' });
    expect(adminRes.error).toBeNull();
    const token = await createTestAdminToken({ userId: adminRes.data!.id, email, role: 'admin' });

    const onboardRes = await onboardHandler(makeEvent('POST', '/api/businesses/onboard', {
      businessName: `Harbor Coffee ${suffix}`,
      businessType: 'restaurant',
      features: ['orders', 'products'],
      country: 'US',
      currency: 'USD',
      currencySymbol: '$',
      colorPalette: { primary: '#68293A', accent: '#FF5776', layoutBundle: 'aurora-service' },
    }, token));
    expect(onboardRes.error).toBeNull();
    const businessId = String((onboardRes.business as any).id);

    const { data: terminals } = await db.query<{ id: string; pin_code: string | null; ui_layout: string }>(
      'SELECT id, pin_code, ui_layout FROM terminals WHERE business_id = ?',
      [businessId],
    );
    expect((terminals ?? []).length).toBeGreaterThanOrEqual(2);
    expect(terminals!.every((terminal) => terminal.pin_code === DEFAULT_TERMINAL_PIN)).toBe(true);

    const THEMED_TYPES = ['button', 'table-view', 'input-field', 'scan-field', 'cart-widget'];
    const isThemed = (element: { type: string }) => THEMED_TYPES.includes(element.type);
    const hasThemedElement = (row: { ui_layout: string }) => JSON.parse(row.ui_layout).elements.some(isThemed);
    const followingTerminal = terminals!.find(hasThemedElement)!;
    expect(followingTerminal).toBeTruthy();
    const overriddenTerminal = terminals!.find((row) => row.id !== followingTerminal.id)!;

    // Hand-style one element on the following terminal, the way the builder would.
    const followingLayout = JSON.parse(followingTerminal.ui_layout);
    const handStyled = followingLayout.elements.find(isThemed);
    expect(handStyled).toBeTruthy();
    handStyled.backgroundColor = '#123456';
    await db.update('terminals', { ui_layout: JSON.stringify(followingLayout) }, { id: followingTerminal.id });

    // Give the second terminal its own accent.
    const overrideRes = await terminalPatchHandler(makeEvent('PATCH', `/api/terminals/${overriddenTerminal.id}`, {
      businessId,
      brandConfig: { accent: '#16a34a' },
    }, token, { id: overriddenTerminal.id }));
    expect(overrideRes.success).toBe(true);
    expect(overrideRes.terminal?.ui_layout?.theme?.accentColor).toBe('#16a34a');

    const saveRes = await themeHandler(makeEvent('PATCH', '/api/businesses/theme', {
      name: `Harbor Roasters ${suffix}`,
      colorPalette: { primary: '#1E3A5F', accent: '#0ea5e9', layoutBundle: 'ink-studio' },
    }, token));
    expect(saveRes.success).toBe(true);
    expect(saveRes.terminalsUpdated).toBeGreaterThanOrEqual(2);

    const { data: after } = await db.query<{ id: string; ui_layout: string }>(
      'SELECT id, ui_layout FROM terminals WHERE business_id = ?',
      [businessId],
    );
    const byId = new Map((after ?? []).map((row) => [row.id, JSON.parse(row.ui_layout)]));

    const following = byId.get(followingTerminal.id);
    expect(following.theme.accentColor).toBe('#0ea5e9');
    expect(following.theme.brandColor).toBe('#1e3a5f');
    expect(following.theme.panelBackground).toBe('#111c2e');
    expect(following.brandConfig).toBeUndefined();
    expect(following.elements.find((element: { id: string }) => element.id === handStyled.id).backgroundColor).toBe('#123456');

    const overridden = byId.get(overriddenTerminal.id);
    expect(overridden.theme.accentColor).toBe('#16a34a');
    expect(overridden.theme.brandColor).toBe('#1e3a5f');
    expect(overridden.brandConfig).toEqual({ accent: '#16a34a' });

    const meta = await terminalMetaHandler(makeEvent('GET', `/api/terminals/${followingTerminal.id}/meta`, undefined, '', { id: followingTerminal.id }));
    expect(meta.brand?.name).toBe(`Harbor Roasters ${suffix}`);
    expect(meta.brand?.initials).toBe(brandInitials(`Harbor Roasters ${suffix}`));

    // Resetting the override hands the terminal back to the workspace brand kit.
    const resetRes = await terminalPatchHandler(makeEvent('PATCH', `/api/terminals/${overriddenTerminal.id}`, {
      businessId,
      resetBrand: true,
    }, token, { id: overriddenTerminal.id }));
    expect(resetRes.success).toBe(true);
    expect(resetRes.terminal?.ui_layout?.theme?.accentColor).toBe('#0ea5e9');
    expect(resetRes.terminal?.ui_layout?.brandConfig).toBeUndefined();

    const { data: audit } = await db.query<{ metadata: string }>(
      "SELECT metadata FROM audit_log WHERE business_id = ? AND target_table = 'business'",
      [businessId],
    );
    expect((audit ?? []).some((row) => String(row.metadata).includes('business:brand-kit'))).toBe(true);
  });
});
