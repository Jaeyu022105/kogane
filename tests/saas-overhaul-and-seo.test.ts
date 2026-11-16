import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_BUILDER_PRESETS,
  BUILDER_PRESETS,
  INDUSTRY_BUILDER_PRESETS,
  attachPresetMetaToLayout,
  buildBrandedTerminalLayoutForPreset,
  buildBuiltInLatestVersionMap,
  extractPresetMetaFromLayout,
  findBuiltInBuilderPreset,
  formatBuiltInPresetRecord,
  getTerminalPresetStatus,
  normalizeDbPresetRow,
  normalizePresetPermissionsInput,
  sanitizePresetLayoutInput,
  sanitizePresetSchemaDefinition,
  terminalMatchesPreset,
} from '../lib/builderPresets';
import {
  ALL_TERMINAL_PERMISSION_PRESETS,
  isActionAllowed,
  normalizePermissions,
  presetByKey,
  presetByRoleOrKey,
  resolveTablePermissions,
} from '../lib/permissions';
import { resolveRuntimePathTemplate, resolveRuntimePayload } from '../lib/runtime';
import { normalizeLayout } from '../lib/uiTypes';
import {
  buildAuditCsv,
  escapeCsvCell,
  isSensitiveAuditKey,
  parseAuditTimestamp,
  redactAuditPayload,
  summarizeAuditDiff,
} from '../lib/audit';
import {
  isLocalHostname,
  normalizeCanonicalOrigin,
  normalizeCanonicalPath,
  serializeJsonLd,
} from '../composables/useSeo';
import seoHeadersMiddleware, {
  isNoindexPath,
  normalizeServerOrigin,
  resolveServerSiteOrigin,
} from '../server/middleware/seoHeaders';
import sitemapHandler from '../server/routes/sitemap.xml';
import robotsHandler from '../server/routes/robots.txt';
import llmsHandler from '../server/routes/llms.txt';

const ROOT = process.cwd();

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

function createMockH3Event(path = '/', host = 'kogane.app', proto = 'https') {
  const responseHeaders: Record<string, string> = {};
  return {
    path,
    node: {
      req: {
        url: path,
        headers: {
          host,
          'x-forwarded-host': host,
          'x-forwarded-proto': proto,
        },
      },
      res: {
        statusCode: 200,
        setHeader(name: string, val: string) {
          responseHeaders[name.toLowerCase()] = String(val);
        },
        getHeader(name: string) {
          return responseHeaders[name.toLowerCase()];
        },
      },
    },
    _headers: responseHeaders,
  } as any;
}

describe('Pillar 1 — Neapolitan Ice Cream Design & Ribbon Bookmark Aesthetic', () => {
  const targetFiles = [
    'assets/css/marketing.css',
    'layouts/marketing.vue',
    'pages/index.vue',
    'pages/features.vue',
    'pages/pricing.vue',
    'pages/login.vue',
    'error.vue',
  ] as const;

  test('Marketing CSS & pages include the warm Neapolitan palette (#68293A, #FF5776, #F6E6D7, #E3C7B9), DM Serif Display, and .ribbon / .btn-ribbon', () => {
    const marketingCss = readRepoFile('assets/css/marketing.css');
    expect(marketingCss).toMatch(/#68293A/i);
    expect(marketingCss).toMatch(/#FF5776/i);
    expect(marketingCss).toMatch(/#F6E6D7/i);
    expect(marketingCss).toMatch(/#E3C7B9/i);
    expect(marketingCss).toContain('DM Serif Display');
    expect(marketingCss).toMatch(/\.ribbon|\.btn-ribbon/);

    const combined = targetFiles.map(readRepoFile).join('\n');
    expect(combined).toMatch(/#68293A/i);
    expect(combined).toMatch(/#FF5776/i);
    expect(combined).toMatch(/#F6E6D7/i);
    expect(combined).toMatch(/#E3C7B9/i);

    const ribbonPages = ['pages/index.vue', 'pages/features.vue', 'pages/pricing.vue', 'error.vue'];
    for (const relPath of targetFiles) {
      const content = readRepoFile(relPath);
      expect(content).toMatch(/#68293A|--k-ink|--k-dark/i);
      if (ribbonPages.includes(relPath)) {
        expect(content).toMatch(/ribbon/);
      }
    }
  });

  test('Zero cold #F4F3EF/#E84A27 tokens and zero placeholder href="#" links across marketing & auth pages', () => {
    for (const relPath of targetFiles) {
      const content = readRepoFile(relPath);
      expect(content).not.toMatch(/#F4F3EF/i);
      expect(content).not.toMatch(/#E84A27/i);
      expect(content).not.toMatch(/href=["']#["']/);
    }
  });

  test('Public and auth pages maintain strict h1 -> h2 -> h3 heading hierarchy with no skipped heading levels', () => {
    const pagesWithHeadings = [
      'pages/index.vue',
      'pages/features.vue',
      'pages/pricing.vue',
      'pages/login.vue',
      'error.vue',
    ];

    for (const relPath of pagesWithHeadings) {
      const content = readRepoFile(relPath);
      const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
      const template = templateMatch ? templateMatch[1]! : content;
      const levels = Array.from(template.matchAll(/<h([1-6])\b/gi)).map((m) => Number(m[1]));

      expect(levels.length).toBeGreaterThan(0);
      expect(levels[0]).toBe(1);

      let maxSeen = 1;
      for (const lvl of levels) {
        // A heading level can never jump more than +1 above the highest level opened so far
        expect(lvl).toBeLessThanOrEqual(maxSeen + 1);
        if (lvl > maxSeen) maxSeen = lvl;
      }
    }
  });
});

describe('Pillar 2 — SaaS Pricing & 6-Locale Parity', () => {
  const localeCodes = ['en', 'es', 'ja', 'ko', 'ph', 'zh'] as const;

  test('pages/pricing.vue defines Starter ($0), Business ($15/$12), Multi-Site ($49/$39), Monthly/Annual toggle, and JSON-LD', () => {
    const pricingVue = readRepoFile('pages/pricing.vue');
    const enLocale = JSON.parse(readRepoFile('locales/en.json')) as Record<string, string>;

    // Billing cycle toggle state and controls
    expect(pricingVue).toContain('billingCycle');
    expect(pricingVue).toContain("'monthly'");
    expect(pricingVue).toContain("'annual'");

    // Plan keys and prices in en.json + pricing.vue JSON-LD
    expect(enLocale.plan_starter_name).toBe('Starter');
    expect(enLocale.plan_starter_price).toBe('$0');
    expect(enLocale.plan_business_name).toBe('Business');
    expect(enLocale.plan_business_price_monthly).toBe('$15');
    expect(enLocale.plan_business_price_annual).toBe('$12');
    expect(enLocale.plan_team_name).toContain('Multi-Site');
    expect(enLocale.plan_team_price_monthly).toBe('$49');
    expect(enLocale.plan_team_price_annual).toBe('$39');

    // Structured JSON-LD SoftwareApplication + FAQPage
    expect(pricingVue).toMatch(/SoftwareApplication/);
    expect(pricingVue).toMatch(/FAQPage/);
    expect(pricingVue).toMatch(/12/);
    expect(pricingVue).toMatch(/15/);
    expect(pricingVue).toMatch(/39/);
    expect(pricingVue).toMatch(/49/);
  });

  test('All 6 locales (en, es, ja, ko, ph, zh) have identical key sets, zero duplicate keys, and zero stale anti-SaaS/Postfolio strings', () => {
    const enRaw = readRepoFile('locales/en.json');
    const enObj = JSON.parse(enRaw) as Record<string, string>;
    const expectedKeys = Object.keys(enObj).sort();
    expect(expectedKeys.length).toBeGreaterThan(250);

    const forbiddenPatterns = [
      /postfolio/i,
      /no monthly SaaS tax/i,
      /zero monthly fees/i,
      /never pay a subscription/i,
    ];

    for (const code of localeCodes) {
      const relPath = `locales/${code}.json`;
      const raw = readRepoFile(relPath);

      // Check for duplicate keys in raw JSON text
      const keyMatches = Array.from(raw.matchAll(/^\s*"([^"]+)"\s*:/gm)).map((m) => m[1]!);
      const uniqueKeySet = new Set(keyMatches);
      expect(keyMatches.length).toBe(uniqueKeySet.size);

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const keys = Object.keys(parsed).sort();
      expect(keys).toEqual(expectedKeys);

      for (const [k, v] of Object.entries(parsed)) {
        expect(typeof v).toBe('string');
        expect((v as string).trim().length).toBeGreaterThan(0);
        for (const pat of forbiddenPatterns) {
          expect(String(v)).not.toMatch(pat);
        }
        expect(k).not.toMatch(/postfolio/i);
      }
    }
  });
});

describe('Pillar 3 — 20-Point SEO Infrastructure', () => {
  test('Static SEO assets exist with valid PNG dimensions (1200x630 og-image, 180x180 apple-touch-icon), Neapolitan favicon.svg & manifest', () => {
    const ogBuf = readFileSync(join(ROOT, 'public/og-image.png'));
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(ogBuf.subarray(0, 8).equals(pngMagic)).toBe(true);
    expect(ogBuf.readUInt32BE(16)).toBe(1200);
    expect(ogBuf.readUInt32BE(20)).toBe(630);

    const appleBuf = readFileSync(join(ROOT, 'public/apple-touch-icon.png'));
    expect(appleBuf.subarray(0, 8).equals(pngMagic)).toBe(true);
    expect(appleBuf.readUInt32BE(16)).toBe(180);
    expect(appleBuf.readUInt32BE(20)).toBe(180);

    const faviconSvg = readRepoFile('public/favicon.svg');
    expect(faviconSvg).toContain('<svg');
    expect(faviconSvg).toMatch(/#68293A/i);
    expect(faviconSvg).toMatch(/#FF5776/i);
    expect(faviconSvg).toMatch(/#F6E6D7/i);
    expect(faviconSvg).toMatch(/#E3C7B9/i);

    const manifest = JSON.parse(readRepoFile('public/manifest.webmanifest')) as Record<string, any>;
    expect(manifest.name).toBe('Kogane');
    expect(manifest.background_color).toBe('#F6E6D7');
    expect(manifest.theme_color).toBe('#68293A');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('composables/useSeo.ts & server/middleware/seoHeaders.ts normalize canonical URLs, JSON-LD, and X-Robots-Tag headers', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('127.0.0.1')).toBe(true);
    expect(isLocalHostname('192.168.1.25')).toBe(true);
    expect(isLocalHostname('kogane.app')).toBe(false);

    expect(normalizeCanonicalOrigin('http://kogane.app/foo')).toBe('https://kogane.app');
    expect(normalizeCanonicalOrigin('http://localhost:3000/bar')).toBe('http://localhost:3000');
    expect(normalizeServerOrigin('http://kogane.app')).toBe('https://kogane.app');

    expect(normalizeCanonicalPath('/')).toBe('/');
    expect(normalizeCanonicalPath('/pricing/?plan=business#faq')).toBe('/pricing');
    expect(normalizeCanonicalPath('features/')).toBe('/features');

    const safeJsonLd = serializeJsonLd({ '@type': 'Thing', name: '</script><script>alert(1)</script>' });
    expect(safeJsonLd).not.toContain('</script>');
    expect(safeJsonLd).toContain('\\u003c/script>');

    expect(isNoindexPath('/dashboard')).toBe(true);
    expect(isNoindexPath('/dashboard/builder')).toBe(true);
    expect(isNoindexPath('/login?mode=signup')).toBe(true);
    expect(isNoindexPath('/terminal/cashier-register-001')).toBe(true);
    expect(isNoindexPath('/t/front-counter')).toBe(true);
    expect(isNoindexPath('/api/presets')).toBe(true);
    expect(isNoindexPath('/')).toBe(false);
    expect(isNoindexPath('/features')).toBe(false);
    expect(isNoindexPath('/pricing')).toBe(false);

    const loginEv = createMockH3Event('/login');
    seoHeadersMiddleware(loginEv);
    expect(loginEv._headers['x-robots-tag']).toBe('noindex, nofollow');

    const publicEv = createMockH3Event('/pricing');
    seoHeadersMiddleware(publicEv);
    expect(publicEv._headers['x-robots-tag']).toBeUndefined();
  });

  test('server/routes/{sitemap.xml,robots.txt,llms.txt}.ts serve canonical SEO discovery endpoints', async () => {
    const ev = createMockH3Event('/sitemap.xml', 'kogane.app', 'https');
    expect(resolveServerSiteOrigin(ev)).toBe('https://kogane.app');

    const xml = String(await sitemapHandler(ev));
    expect(ev._headers['content-type']).toContain('application/xml');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://kogane.app/</loc>');
    expect(xml).toContain('<loc>https://kogane.app/features</loc>');
    expect(xml).toContain('<loc>https://kogane.app/pricing</loc>');
    expect(xml).toContain('<loc>https://kogane.app/privacy</loc>');
    expect(xml).toContain('<loc>https://kogane.app/terms</loc>');
    expect(xml).not.toContain('/dashboard');
    expect(xml).not.toContain('/login');

    const robotsEv = createMockH3Event('/robots.txt', 'kogane.app', 'https');
    const robotsTxt = String(await robotsHandler(robotsEv));
    expect(robotsEv._headers['content-type']).toContain('text/plain');
    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Disallow: /dashboard/');
    expect(robotsTxt).toContain('Disallow: /terminal/');
    expect(robotsTxt).toContain('Sitemap: https://kogane.app/sitemap.xml');

    const llmsEv = createMockH3Event('/llms.txt', 'kogane.app', 'https');
    const llmsTxt = String(await llmsHandler(llmsEv));
    expect(llmsEv._headers['content-type']).toContain('text/plain');
    expect(llmsTxt).toContain('# Kogane');
    expect(llmsTxt).toContain('Starter ($0 / mo)');
    expect(llmsTxt).toContain('Business ($15 / mo monthly, $12 / mo billed annually)');
    expect(llmsTxt).toContain('Multi-Site / Team ($49 / mo monthly, $39 / mo billed annually)');
  });
});

describe('Pillar 4 — Managed Presets & Terminal Sync', () => {
  test('All 9 builder and permission presets resolve by id, key, and station aliases with strict RBAC', () => {
    expect(BUILDER_PRESETS).toHaveLength(5);
    expect(INDUSTRY_BUILDER_PRESETS).toHaveLength(4);
    expect(ALL_BUILDER_PRESETS).toHaveLength(9);
    expect(ALL_TERMINAL_PERMISSION_PRESETS).toHaveLength(9);

    const expectedPairs: Array<[string, string]> = [
      ['cashier-station', 'cashier-register'],
      ['catalog-station', 'catalog-registrar'],
      ['inventory-station', 'inventory-manager'],
      ['kitchen-station', 'kitchen-display'],
      ['reports-station', 'reports-viewer'],
      ['dispatch-station', 'dispatch-console'],
      ['billing-station', 'billing-ledger'],
      ['appointment-station', 'appointment-desk'],
      ['directory-station', 'service-directory'],
    ];

    for (const [builderId, permKey] of expectedPairs) {
      const bp = findBuiltInBuilderPreset(builderId);
      expect(bp).not.toBeNull();
      expect(bp?.id).toBe(builderId);
      expect(bp?.presetKey).toBe(permKey);

      const byKey = findBuiltInBuilderPreset(permKey);
      expect(byKey?.id).toBe(builderId);

      const permPreset = presetByKey(permKey);
      expect(permPreset).not.toBeNull();
      expect(presetByRoleOrKey(builderId)?.key).toBe(permKey);

      const formatted = formatBuiltInPresetRecord(bp!);
      expect(formatted.id).toBe(builderId);
      expect(formatted.preset_key).toBe(permKey);
      expect(formatted.version).toBeGreaterThanOrEqual(1);
    }

    // Kitchen Display allows updating orders but forbids inserting into products
    const kitchenPerms = normalizePermissions({}, 'kitchen-station');
    expect(resolveTablePermissions(kitchenPerms, 'orders', 'kitchen-station').update).toBe(true);
    expect(resolveTablePermissions(kitchenPerms, 'products', 'kitchen-station').insert).toBe(false);
    expect(isActionAllowed(kitchenPerms, { type: 'update', table: 'orders' }, 'kitchen-station')).toBe(true);
    expect(isActionAllowed(kitchenPerms, { type: 'insert', table: 'products' }, 'kitchen-station')).toBe(false);
  });

  test('Preset creation, versioning, schema/layout sanitization, and branded terminal sync preserve branding & dimensions', () => {
    const schema = sanitizePresetSchemaDefinition({
      tables: [
        {
          name: 'orders',
          columns: [
            { name: 'table_number', type: 'text', nullable: false },
            { name: 'total', type: 'numeric', nullable: false, default: '0' },
          ],
        },
      ],
    });
    expect(schema?.tables).toHaveLength(1);
    expect(schema?.tables[0]?.name).toBe('orders');

    const cashierPreset = findBuiltInBuilderPreset('cashier-station')!;
    const sanitizedLayout = sanitizePresetLayoutInput({
      ...cashierPreset.layout,
      stationConfig: { receiptPrinter: 'thermal-80mm' },
    });
    expect(sanitizedLayout.elements.length).toBeGreaterThan(0);
    expect(sanitizedLayout.stationConfig).toEqual({ receiptPrinter: 'thermal-80mm' });

    const syncedLayout = buildBrandedTerminalLayoutForPreset({
      templateLayout: cashierPreset.layout,
      presetId: 'preset_custom_pos',
      presetVersion: 3,
      presetName: 'Custom POS v3',
      businessPaletteRaw: JSON.stringify({
        primary: '#1E3A5F',
        accent: '#d94e28',
        background: '#0d1524',
        secondary: '#1E3A5F',
      }),
      existingTerminalLayout: {
        resolution: { width: 1440, height: 900 },
        stationConfig: { lane: 'counter-2' },
      },
    });

    expect(syncedLayout.presetId).toBe('preset_custom_pos');
    expect(syncedLayout.presetVersion).toBe(3);
    expect(syncedLayout.presetName).toBe('Custom POS v3');
    expect(syncedLayout.resolution).toEqual({ width: 1440, height: 900 });
    expect(syncedLayout.stationConfig).toEqual({ lane: 'counter-2' });
    expect(syncedLayout.theme.accentColor.toLowerCase()).toBe('#d94e28');
    expect(syncedLayout.theme.brandColor).toBe('#1e3a5f');
    // The workspace palette is not frozen onto the terminal, so later brand kit edits still reach it.
    expect(syncedLayout.brandConfig).toBeUndefined();

    const overriddenLayout = buildBrandedTerminalLayoutForPreset({
      templateLayout: cashierPreset.layout,
      presetId: 'preset_custom_pos',
      presetVersion: 3,
      businessPaletteRaw: JSON.stringify({ primary: '#1E3A5F', accent: '#d94e28' }),
      existingTerminalLayout: { brandConfig: { layoutBundle: 'paper-ledger', accent: '#16a34a' } },
    });
    expect(overriddenLayout.theme.accentColor).toBe('#16a34a');
    expect(overriddenLayout.theme.brandColor).toBe('#1e3a5f');
    expect(overriddenLayout.brandConfig).toEqual({ layoutBundle: 'paper-ledger', accent: '#16a34a' });

    const extracted = extractPresetMetaFromLayout(syncedLayout);
    expect(extracted).toEqual({
      presetId: 'preset_custom_pos',
      presetVersion: 3,
      presetName: 'Custom POS v3',
    });

    expect(terminalMatchesPreset({ ui_layout: syncedLayout }, 'preset_custom_pos')).toBe(true);
    expect(terminalMatchesPreset({ ui_layout: syncedLayout }, 'other_preset')).toBe(false);

    const statusOutdated = getTerminalPresetStatus(
      { ui_layout: attachPresetMetaToLayout(cashierPreset.layout, { presetId: 'preset_custom_pos', presetVersion: 2 }) },
      { preset_custom_pos: 3 },
    );
    expect(statusOutdated.linked).toBe(true);
    expect(statusOutdated.updateAvailable).toBe(true);
    expect(statusOutdated.latestVersion).toBe(3);

    const statusCurrent = getTerminalPresetStatus(
      { ui_layout: syncedLayout },
      { preset_custom_pos: 3 },
    );
    expect(statusCurrent.updateAvailable).toBe(false);

    const dbRow = normalizeDbPresetRow(
      {
        id: 'preset_custom_pos',
        business_id: 'biz_123',
        name: 'Custom POS',
        preset_key: 'cashier-register',
        version: 3,
        schema_definition: JSON.stringify(schema),
        ui_layout: JSON.stringify(syncedLayout),
        permissions: JSON.stringify(normalizePresetPermissionsInput({}, 'cashier-register')),
      },
      4,
    );
    expect(dbRow.is_custom).toBe(true);
    expect(dbRow.version).toBe(3);
    expect(dbRow.linked_terminal_count).toBe(4);
    expect(buildBuiltInLatestVersionMap()['cashier-station']).toBeGreaterThanOrEqual(1);
  });
});

describe('Pillar 5 — Runtime UI & Audit Logs', () => {
  test('lib/runtime.ts resolves exact $$row.* tokens, {{$$...}} braced templates, and inline string interpolation', () => {
    const context = {
      cart: [{ id: 'item_1', qty: 2 }],
      inputs: { 'order-note': 'No ice', 'discount-code': 'VIP10' },
      uploads: { 'receipt-upload': '/storage/receipt.png' },
      session: { terminalId: 'term_01', actor: 'Cashier Mia' },
      elementId: 'btn-serve',
      row: { id: 'ord_42', table_number: 'T-08', total: 450, status: 'pending' },
    };

    expect(resolveRuntimePayload('$$row.id', context)).toBe('ord_42');
    expect(resolveRuntimePayload('$$row.total', context)).toBe(450);
    expect(resolveRuntimePayload('$$row', context)).toEqual(context.row);
    expect(resolveRuntimePayload('$$input.order-note', context)).toBe('No ice');
    expect(resolveRuntimePayload('$$element.id', context)).toBe('btn-serve');

    const interpolated = resolveRuntimePayload(
      {
        summary: 'Order {{$$row.id}} for table {{ $$row.table_number }} ({{$$input.order-note}})',
        inlineNote: 'Served by $$session.actor on $$element.id',
        nested: ['$$row.status', '{{$$upload.receipt-upload}}'],
      },
      context,
    ) as Record<string, any>;

    expect(interpolated.summary).toBe('Order ord_42 for table T-08 (No ice)');
    expect(interpolated.inlineNote).toBe('Served by Cashier Mia on btn-serve');
    expect(interpolated.nested).toEqual(['pending', '/storage/receipt.png']);

    const fixedDate = new Date(2026, 10, 14);
    expect(resolveRuntimePathTemplate('inventory/{{date}}/stock-{date}.csv', fixedDate)).toBe(
      'inventory/2026-11-14/stock-2026-11-14.csv',
    );
  });

  test('lib/uiTypes.ts normalizeLayout preserves input/scan maxLength, table/cart currency fields, preset metadata, and modals', () => {
    const normalized = normalizeLayout({
      version: 2,
      presetId: 'cashier-station',
      presetVersion: 4,
      brandConfig: { primaryColor: '#68293A' },
      stationConfig: { lane: 'A1' },
      resolution: { width: 1280, height: 720 },
      elements: [
        {
          id: 'inp-code',
          type: 'input-field',
          position: { x: 10, y: 10, width: 200, height: 48, zIndex: 1 },
          fieldName: 'promo_code',
          inputType: 'text',
          maxLength: 16,
        },
        {
          id: 'scan-sku',
          type: 'scan-field',
          position: { x: 10, y: 70, width: 200, height: 48, zIndex: 1 },
          fieldName: 'sku',
          maxLength: 32,
          burstThresholdMs: 35,
        },
        {
          id: 'tbl-orders',
          type: 'table-view',
          position: { x: 240, y: 10, width: 500, height: 400, zIndex: 1 },
          tableName: 'orders',
          columns: ['id', 'total'],
          currencySymbol: '₱',
          currency: 'PHP',
          country: 'PH',
        },
        {
          id: 'cart-pos',
          type: 'cart-widget',
          position: { x: 760, y: 10, width: 480, height: 500, zIndex: 1 },
          displayColumns: ['name', 'price'],
          currencySymbol: '¥',
          currency: 'JPY',
          country: 'JP',
        },
      ],
      modals: [
        {
          id: 'modal-receipt',
          name: 'Receipt Preview',
          presentation: 'drawer',
          width: 420,
          height: 600,
          elements: [
            {
              id: 'modal-txt',
              type: 'text',
              position: { x: 0, y: 0, width: 200, height: 32, zIndex: 1 },
              content: 'Receipt Details',
              fontSize: 18,
              fontWeight: 'bold',
            },
          ],
        },
      ],
    });

    expect(normalized.presetId).toBe('cashier-station');
    expect(normalized.presetVersion).toBe(4);
    expect(normalized.brandConfig).toEqual({ primaryColor: '#68293A' });
    expect(normalized.stationConfig).toEqual({ lane: 'A1' });
    expect(normalized.modals).toHaveLength(1);
    expect(normalized.modals?.[0]?.id).toBe('modal-receipt');
    expect(normalized.modals?.[0]?.elements).toHaveLength(1);

    const inputEl = normalized.elements.find((e) => e.id === 'inp-code') as any;
    const scanEl = normalized.elements.find((e) => e.id === 'scan-sku') as any;
    const tableEl = normalized.elements.find((e) => e.id === 'tbl-orders') as any;
    const cartEl = normalized.elements.find((e) => e.id === 'cart-pos') as any;

    expect(inputEl.maxLength).toBe(16);
    expect(scanEl.maxLength).toBe(32);
    expect(tableEl.currencySymbol).toBe('₱');
    expect(tableEl.currency).toBe('PHP');
    expect(tableEl.country).toBe('PH');
    expect(cartEl.currencySymbol).toBe('¥');
    expect(cartEl.currency).toBe('JPY');
    expect(cartEl.country).toBe('JP');
  });

  test('lib/audit.ts redacts PINs/secrets, summarizes field diffs, prevents CSV formula injection, and parses UTC timestamps', () => {
    expect(isSensitiveAuditKey('pin')).toBe(true);
    expect(isSensitiveAuditKey('pin_code')).toBe(true);
    expect(isSensitiveAuditKey('pin_hash')).toBe(true);
    expect(isSensitiveAuditKey('two_factor_secret')).toBe(true);
    expect(isSensitiveAuditKey('requiresPin')).toBe(false);
    expect(isSensitiveAuditKey('display_name')).toBe(false);

    const redacted = redactAuditPayload({
      display_name: 'Front Counter',
      pin: '1234',
      pin_hash: 'pin_pbkdf2$secret',
      requiresPin: true,
      nested: {
        accessToken: 'jwt-secret-token',
        status: 'active',
      },
    }) as Record<string, any>;

    expect(redacted.display_name).toBe('Front Counter');
    expect(redacted.requiresPin).toBe(true);
    expect(redacted.pin).toBeUndefined();
    expect(redacted.pin_hash).toBeUndefined();
    expect(redacted.nested.accessToken).toBeUndefined();
    expect(redacted.nested.status).toBe('active');

    const diff = summarizeAuditDiff(
      { price: 120, status: 'pending', pin: '1111', legacy: 'old' },
      { price: 150, status: 'pending', pin: '9999', note: 'rush' },
    );
    expect(diff.hasChanges).toBe(true);
    expect(diff.changed).toEqual(['price']);
    expect(diff.added).toEqual(['note']);
    expect(diff.removed).toEqual(['legacy']);
    expect(diff.unchangedCount).toBe(1);

    // Formula-injection safety in CSV cells and full audit CSV export
    expect(escapeCsvCell('=cmd|\'/C calc\'!A0')).toBe(`"'=cmd|'/C calc'!A0"`);
    expect(escapeCsvCell('+SUM(A1:A10)')).toBe(`"'+SUM(A1:A10)"`);
    expect(escapeCsvCell('@IMPORTXML()')).toBe(`"'@IMPORTXML()"`);
    expect(escapeCsvCell('  -2+3')).toBe(`"'  -2+3"`);

    const csv = buildAuditCsv([
      {
        id: 'aud_100',
        created_at: '2026-11-14 08:30:00',
        action_type: 'update',
        actor_type: 'admin',
        actor_name: '=EvilActor',
        actor_id: 'usr_1',
        target_table: 'products',
        target_id: 'prod_1',
        payload_before: JSON.stringify({ price: 100, pin_code: '1234' }),
        payload_after: JSON.stringify({ price: 125, pin_code: '5678' }),
        metadata: JSON.stringify({ ip: '127.0.0.1', secret: 'top-secret' }),
      },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(`"'=EvilActor"`);
    expect(csv).toContain('"price"');
    expect(csv).not.toContain('1234');
    expect(csv).not.toContain('5678');
    expect(csv).not.toContain('top-secret');

    const sqliteUtc = parseAuditTimestamp('2026-11-14 08:30:00');
    expect(sqliteUtc?.toISOString()).toBe('2026-11-14T08:30:00.000Z');
    const isoUtc = parseAuditTimestamp('2026-11-14T08:30:00.000Z');
    expect(isoUtc?.toISOString()).toBe('2026-11-14T08:30:00.000Z');
    expect(parseAuditTimestamp('')).toBeNull();
  });
});
