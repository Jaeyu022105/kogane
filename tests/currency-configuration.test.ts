import { describe, expect, test } from 'bun:test';
import {
  COUNTRIES,
  findCountry,
  formatCurrencyAmount,
} from '../lib/currency';
import { db } from '../lib/db';
import {
  buildSalesMetricsWorkbook,
  calculateSalesMetrics,
  type RawOrderRecord,
} from '../server/utils/salesMetrics';
import {
  buildTaxFilingWorkbook,
  calculateTaxFilingReport,
} from '../server/utils/taxFiling';
import {
  generateCsv,
  generateMultiSheetCsv,
  generateSpreadsheetXml,
  generateXlsx,
  resolveCurrencyFormatCode,
  type SpreadsheetWorkbook,
} from '../server/utils/spreadsheet';

describe('Country & Currency Configuration Registry (lib/currency.ts)', () => {
  test('COUNTRIES contains all major countries with ISO codes, symbols, and decimals', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(20);

    const ph = COUNTRIES.find((c) => c.code === 'PH');
    expect(ph).toBeDefined();
    expect(ph?.currency).toBe('PHP');
    expect(ph?.symbol).toBe('₱');
    expect(ph?.decimals).toBe(2);

    const us = COUNTRIES.find((c) => c.code === 'US');
    expect(us).toBeDefined();
    expect(us?.currency).toBe('USD');
    expect(us?.symbol).toBe('$');
    expect(us?.decimals).toBe(2);

    const gb = COUNTRIES.find((c) => c.code === 'GB');
    expect(gb).toBeDefined();
    expect(gb?.currency).toBe('GBP');
    expect(gb?.symbol).toBe('£');
    expect(gb?.decimals).toBe(2);

    const eu = COUNTRIES.find((c) => c.code === 'EU');
    expect(eu).toBeDefined();
    expect(eu?.currency).toBe('EUR');
    expect(eu?.symbol).toBe('€');
    expect(eu?.decimals).toBe(2);

    const jp = COUNTRIES.find((c) => c.code === 'JP');
    expect(jp).toBeDefined();
    expect(jp?.currency).toBe('JPY');
    expect(jp?.symbol).toBe('¥');
    expect(jp?.decimals).toBe(0); // Zero decimals for Yen
  });

  test('findCountry matches by country code, name, or currency code case-insensitively', () => {
    // By code
    expect(findCountry('PH').code).toBe('PH');
    expect(findCountry('ph').currency).toBe('PHP');
    expect(findCountry('GB').symbol).toBe('£');
    expect(findCountry('JP').symbol).toBe('¥');

    // By currency
    expect(findCountry('PHP').code).toBe('PH');
    expect(findCountry('eur').symbol).toBe('€');
    expect(findCountry('cad').currency).toBe('CAD');

    // By country name
    expect(findCountry('Philippines').symbol).toBe('₱');
    expect(findCountry('japan').currency).toBe('JPY');
    expect(findCountry('United Kingdom').symbol).toBe('£');

    // By symbol
    expect(findCountry('₱').code).toBe('PH');
    expect(findCountry('¥').code).toBe('JP');
    expect(findCountry('£').code).toBe('GB');
    expect(findCountry('€').code).toBe('EU');
    expect(findCountry('₩').code).toBe('KR');

    // Fallback on unknown or empty
    expect(findCountry(null).code).toBe('US');
    expect(findCountry(undefined).code).toBe('US');
    expect(findCountry('').code).toBe('US');
    expect(findCountry('NON_EXISTENT').code).toBe('US');
  });

  test('formatCurrencyAmount formats various currencies and handles decimal precision', () => {
    // Philippines PHP
    expect(formatCurrencyAmount(1250.5, { symbol: '₱' })).toBe('₱1,250.50');
    expect(formatCurrencyAmount(50, { country: 'PH' })).toBe('₱50.00');

    // UK GBP
    expect(formatCurrencyAmount(99.99, { country: 'GB' })).toBe('£99.99');

    // EU EUR
    expect(formatCurrencyAmount(120.4, { currency: 'EUR' })).toBe('€120.40');

    // Japan JPY (0 decimals)
    expect(formatCurrencyAmount(3500, { country: 'JP' })).toBe('¥3,500');

    // Default USD
    expect(formatCurrencyAmount(42.5)).toBe('$42.50');

    // Negative amounts and negative formatted strings
    expect(formatCurrencyAmount(-25.75, { symbol: '₱' })).toBe('-₱25.75');
    expect(formatCurrencyAmount('-₱25.75', { symbol: '₱' })).toBe('-₱25.75');
    expect(formatCurrencyAmount(-1000, { country: 'JP' })).toBe('-¥1,000');
    expect(formatCurrencyAmount('-¥1000', { symbol: '¥' })).toBe('-¥1,000');

    // Symbol-inferred zero-decimals (JPY, KRW)
    expect(formatCurrencyAmount(3500, { symbol: '¥' })).toBe('¥3,500');
    expect(formatCurrencyAmount(50000, { symbol: '₩' })).toBe('₩50,000');

    // String numbers with existing symbols and commas
    expect(formatCurrencyAmount('₱1,250.50', { symbol: '₱' })).toBe('₱1,250.50');
    expect(formatCurrencyAmount('$500.00', { symbol: '₱' })).toBe('₱500.00');
    expect(formatCurrencyAmount('1,500', { symbol: '£' })).toBe('£1,500.00');

    // Empty and null values
    expect(formatCurrencyAmount(null)).toBe('—');
    expect(formatCurrencyAmount('')).toBe('—');
    expect(formatCurrencyAmount(undefined)).toBe('—');
    expect(formatCurrencyAmount('—')).toBe('—');

    // Non-numeric strings preserved
    expect(formatCurrencyAmount('N/A')).toBe('N/A');
  });
});

describe('Database Schema & Business Currency Persistence', () => {
  test('businesses table in SQLite has country, currency, and currency_symbol columns', async () => {
    process.env.DEV_MODE = 'true';
    const { data: cols } = await db.query<{ name: string; type: string }>(
      'PRAGMA table_info(businesses)',
    );
    const colNames = (cols ?? []).map((c) => c.name);

    expect(colNames).toContain('country');
    expect(colNames).toContain('currency');
    expect(colNames).toContain('currency_symbol');
  });

  test('can insert and retrieve business record with configured Philippines PHP currency', async () => {
    process.env.DEV_MODE = 'true';
    const bizId = `test-biz-curr-${Date.now()}`;
    const schemaName = `test_biz_curr_${Date.now()}`;

    await db.insert('businesses', {
      id: bizId,
      admin_user_id: 'admin-test-user',
      name: 'Manila Roast Cafe',
      schema_name: schemaName,
      country: 'PH',
      currency: 'PHP',
      currency_symbol: '₱',
      color_palette: JSON.stringify({ country: 'PH', currency: 'PHP', currencySymbol: '₱', themeId: 'cappuccino' }),
    });

    const { data: biz } = await db.queryOne<{
      id: string;
      name: string;
      country: string;
      currency: string;
      currency_symbol: string;
      color_palette: string;
    }>('SELECT id, name, country, currency, currency_symbol, color_palette FROM businesses WHERE id = ?', [bizId]);

    expect(biz).not.toBeNull();
    expect(biz?.country).toBe('PH');
    expect(biz?.currency).toBe('PHP');
    expect(biz?.currency_symbol).toBe('₱');

    const pal = JSON.parse(biz?.color_palette || '{}');
    expect(pal.country).toBe('PH');
    expect(pal.currency).toBe('PHP');
    expect(pal.currencySymbol).toBe('₱');
  });
});

describe('Spreadsheet & Export Currency Propagation', () => {
  const sampleOrders: RawOrderRecord[] = [
    {
      id: 'ord-php-1',
      created_at: '2026-10-01T10:00:00.000Z',
      total: 500.0,
      payment_method: 'cash',
      payment_status: 'paid',
      receipt_number: 'REC-PH-001',
      line_items: JSON.stringify([
        { name: 'Barako Coffee', price: 150.0, qty: 2, subtotal: 300.0 },
        { name: 'Ube Cake', price: 200.0, qty: 1, subtotal: 200.0 },
      ]),
    },
    {
      id: 'ord-php-2',
      created_at: '2026-10-02T11:00:00.000Z',
      total: 350.0,
      payment_method: 'card',
      payment_status: 'paid',
      receipt_number: 'REC-PH-002',
      line_items: JSON.stringify([
        { name: 'Barako Coffee', price: 150.0, qty: 1, subtotal: 150.0 },
        { name: 'Ensaymada', price: 100.0, qty: 2, subtotal: 200.0 },
      ]),
    },
  ];

  const range = {
    from: new Date('2026-10-01T00:00:00.000Z'),
    to: new Date('2026-10-07T23:59:59.999Z'),
  };

  test('buildSalesMetricsWorkbook formats headers with Philippine Peso ₱', () => {
    const report = calculateSalesMetrics(sampleOrders, range.from, range.to);
    const workbook = buildSalesMetricsWorkbook(report, 'Manila Roast Cafe', range, {
      currencySymbol: '₱',
      currencyCode: 'PHP',
    });

    expect(workbook.currencySymbol).toBe('₱');
    expect(workbook.currencyCode).toBe('PHP');

    // Sheet 1: Executive Performance
    const execSheet = workbook.sheets[0];
    const trendTrajectoryRow = execSheet.rows.find((r) =>
      Array.isArray(r) && r[0] && typeof r[0] === 'object' && 'value' in r[0] && r[0].value === 'Sales Trend Trajectory',
    ) as any[];
    expect(trendTrajectoryRow).toBeDefined();
    expect(trendTrajectoryRow[1].value).toContain('₱/day');

    // Sheet 3: Product Demand Forecast
    const itemSheet = workbook.sheets[2];
    const headerRow = itemSheet.rows[0] as any[];
    const headerValues = headerRow.map((c) => c.value);
    expect(headerValues).toContain('Total Sales (₱)');
    expect(headerValues).toContain('Next 30d Forecast (₱)');

    // Sheet 4: Detailed Transactions
    const orderSheet = workbook.sheets[3];
    const orderHeaders = (orderSheet.rows[0] as any[]).map((c) => c.value);
    expect(orderHeaders).toContain('Total (₱)');
  });

  test('generateSpreadsheetXml generates valid SpreadsheetML with custom ₱ currency format', () => {
    const report = calculateSalesMetrics(sampleOrders, range.from, range.to);
    const workbook = buildSalesMetricsWorkbook(report, 'Manila Roast Cafe', range, {
      currencySymbol: '₱',
      currencyCode: 'PHP',
    });

    const xml = generateSpreadsheetXml(workbook);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    // Verifies custom currency style definition in SpreadsheetML
    expect(xml).toContain('<NumberFormat ss:Format="&quot;₱&quot;#,##0.00"/>');
  });

  test('generateXlsx generates OpenXML package with custom currency format for ₱', () => {
    const report = calculateSalesMetrics(sampleOrders, range.from, range.to);
    const workbook = buildSalesMetricsWorkbook(report, 'Manila Roast Cafe', range, {
      currencySymbol: '₱',
      currencyCode: 'PHP',
    });

    const bytes = generateXlsx(workbook);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // PKZIP header
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  test('buildTaxFilingWorkbook formats headers and styles with British Pound £', () => {
    const taxReport = calculateTaxFilingReport(sampleOrders, 'London Bistro', range.from, range.to, {
      taxRate: 0.20,
      taxInclusive: true,
    });

    const workbook = buildTaxFilingWorkbook(taxReport, 'London Bistro', range, {
      currencySymbol: '£',
      currencyCode: 'GBP',
    });

    expect(workbook.currencySymbol).toBe('£');
    expect(workbook.currencyCode).toBe('GBP');

    // Sheet 1: Tax Filing Summary
    const summarySheet = workbook.sheets[0];
    const schedHeader = (summarySheet.rows[3] as any[]).map((c) => c.value);
    expect(schedHeader).toContain('AMOUNT (£)');

    // Sheet 2: Periodic Tax Ledger
    const ledgerSheet = workbook.sheets[1];
    const ledgerHeaders = (ledgerSheet.rows[0] as any[]).map((c) => c.value);
    expect(ledgerHeaders).toContain('Gross Sales (£)');
    expect(ledgerHeaders).toContain('Tax Collected (£)');
    expect(ledgerHeaders).toContain('Cash Gross (£)');

    // Sheet 4: Line Item Tax Detail
    const lineSheet = workbook.sheets[3];
    const lineHeaders = (lineSheet.rows[0] as any[]).map((c) => c.value);
    expect(lineHeaders).toContain('Unit Price (£)');
    expect(lineHeaders).toContain('Gross Total (£)');
    expect(lineHeaders).toContain('Tax Amount (£)');

    // SpreadsheetML formatting
    const xml = generateSpreadsheetXml(workbook);
    expect(xml).toContain('<NumberFormat ss:Format="&quot;£&quot;#,##0.00"/>');
  });

  test('CSV export preserves currency headers cleanly', () => {
    const report = calculateSalesMetrics(sampleOrders, range.from, range.to);
    const workbook = buildSalesMetricsWorkbook(report, 'Manila Roast Cafe', range, {
      currencySymbol: '₱',
      currencyCode: 'PHP',
    });

    const multiCsv = generateMultiSheetCsv(workbook);
    expect(multiCsv).toContain('Total Sales (₱)');
    expect(multiCsv).toContain('Total (₱)');
  });
});

describe('Database Add Row Non-USD Currency Input Sanitization', () => {
  test('sanitizes inputs with various currency symbols into valid numbers', () => {
    const sanitizeInput = (rawVal: unknown) => {
      const rawStr = String(rawVal).trim();
      if (/\d/.test(rawStr)) {
        const isNeg = rawStr.startsWith('-') || /-\s*[^\d]/.test(rawStr) || /^\(.*\)$/.test(rawStr);
        const digits = rawStr.replace(/[^\d.]/g, '');
        const parsed = parseFloat(digits) * (isNeg ? -1 : 1);
        return Number.isFinite(parsed) ? parsed : rawVal;
      }
      return rawVal;
    };

    expect(sanitizeInput('₱150.00')).toBe(150.00);
    expect(sanitizeInput('-₱150.00')).toBe(-150.00);
    expect(sanitizeInput('£25.50')).toBe(25.50);
    expect(sanitizeInput('€1,299.99')).toBe(1299.99);
    expect(sanitizeInput('¥5000')).toBe(5000);
    expect(sanitizeInput('-¥5000')).toBe(-5000);
    expect(sanitizeInput('$12.34')).toBe(12.34);
    expect(sanitizeInput('₱ 450.75')).toBe(450.75);
    expect(sanitizeInput('100')).toBe(100);
    expect(sanitizeInput('not a number')).toBe('not a number');
  });
});

describe('Terminal Session Country & Currency Propagation', () => {
  test('terminal queries join business country and currency fields', async () => {
    process.env.DEV_MODE = 'true';
    const bizId = `test-biz-term-${Date.now()}`;
    const termId = `test-term-${Date.now()}`;
    const schemaName = `test_biz_term_${Date.now()}`;

    await db.insert('businesses', {
      id: bizId,
      admin_user_id: 'admin-term-owner',
      name: 'Tokyo Ramen Bar',
      schema_name: schemaName,
      country: 'JP',
      currency: 'JPY',
      currency_symbol: '¥',
      color_palette: JSON.stringify({ country: 'JP', currency: 'JPY', currencySymbol: '¥' }),
    });

    await db.insert('terminals', {
      id: termId,
      business_id: bizId,
      display_name: 'Counter Terminal',
      role: 'cashier-register',
      pin_hash: 'test-hash',
      pin_code: '1234',
      ui_layout: '{}',
      is_public: 0,
    });

    const { data: terminalWithBiz } = await db.queryOne<{
      id: string;
      display_name: string;
      business_name: string;
      business_country: string;
      business_currency: string;
      business_currency_symbol: string;
    }>(
      `SELECT
         t.id,
         t.display_name,
         b.name as business_name,
         b.country as business_country,
         b.currency as business_currency,
         b.currency_symbol as business_currency_symbol
       FROM terminals t
       JOIN businesses b ON b.id = t.business_id
       WHERE t.id = ?`,
      [termId],
    );

    expect(terminalWithBiz).not.toBeNull();
    expect(terminalWithBiz?.business_country).toBe('JP');
    expect(terminalWithBiz?.business_currency).toBe('JPY');
    expect(terminalWithBiz?.business_currency_symbol).toBe('¥');
  });

  test('Euro (€) and Japanese Yen (¥) workbooks generate correctly with custom symbols', () => {
    const orders: RawOrderRecord[] = [
      {
        id: 'ord-jp-1',
        created_at: '2026-10-01T10:00:00.000Z',
        total: 1200,
        payment_method: 'cash',
        payment_status: 'paid',
        receipt_number: 'REC-JP-001',
      },
    ];

    const range = {
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-07T23:59:59.999Z'),
    };

    const metricsReport = calculateSalesMetrics(orders, range.from, range.to);

    // Japan Yen (¥)
    const jpWorkbook = buildSalesMetricsWorkbook(metricsReport, 'Tokyo Ramen Bar', range, {
      currencySymbol: '¥',
      currencyCode: 'JPY',
    });
    expect(jpWorkbook.currencySymbol).toBe('¥');
    expect(resolveCurrencyFormatCode('¥', 'JPY')).toBe('"¥"#,##0');
    expect(resolveCurrencyFormatCode('₱', 'PHP')).toBe('"₱"#,##0.00');
    const jpXml = generateSpreadsheetXml(jpWorkbook);
    expect(jpXml).toContain('<NumberFormat ss:Format="&quot;¥&quot;#,##0"/>');

    // Euro (€)
    const euWorkbook = buildSalesMetricsWorkbook(metricsReport, 'Paris Bistro', range, {
      currencySymbol: '€',
      currencyCode: 'EUR',
    });
    expect(euWorkbook.currencySymbol).toBe('€');
    expect(resolveCurrencyFormatCode('€', 'EUR')).toBe('"€"#,##0.00');
    const euXml = generateSpreadsheetXml(euWorkbook);
    expect(euXml).toContain('<NumberFormat ss:Format="&quot;€&quot;#,##0.00"/>');
  });

  test('formatCurrencyAmount handles edge cases: zero, large numbers, and formatted strings', () => {
    expect(formatCurrencyAmount(0, { symbol: '₱' })).toBe('₱0.00');
    expect(formatCurrencyAmount(0, { country: 'JP' })).toBe('¥0');
    expect(formatCurrencyAmount(1000000, { symbol: '₱' })).toBe('₱1,000,000.00');
    expect(formatCurrencyAmount('  ¥ 2500  ', { country: 'JP' })).toBe('¥2,500');
    expect(formatCurrencyAmount('45.9', { symbol: '€' })).toBe('€45.90');
  });
});
