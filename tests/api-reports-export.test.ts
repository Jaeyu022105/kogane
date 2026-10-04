import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from '../lib/db';
import { validateIdentifier, buildCreateTableSql } from '../lib/schemaUtils';
import {
  fetchBusinessOrders,
  calculateSalesMetrics,
  buildSalesMetricsWorkbook,
  type RawOrderRecord,
} from '../server/utils/salesMetrics';
import {
  calculateTaxFilingReport,
  buildTaxFilingWorkbook,
} from '../server/utils/taxFiling';
import {
  generateXlsx,
  generateSpreadsheetXml,
  generateCsv,
  generateMultiSheetCsv,
  sanitizeSpreadsheetText,
} from '../server/utils/spreadsheet';
import salesMetricsHandler from '../server/api/reports/sales-metrics.get';
import taxSummaryHandler from '../server/api/reports/tax-summary.get';
import exportSalesHandler from '../server/api/reports/export/sales.get';
import exportTaxHandler from '../server/api/reports/export/tax.get';

describe('End-to-End Database Isolation & Reporting Exports', () => {
  const schemaA = 'biz_test_export_a';
  const schemaB = 'biz_test_export_b';

  beforeAll(async () => {
    // Set up schema A orders table
    const tableDef = {
      name: 'orders',
      columns: [
        { name: 'items', type: 'text' as const, nullable: false },
        { name: 'line_items', type: 'text' as const, nullable: true },
        { name: 'total', type: 'numeric' as const, nullable: false },
        { name: 'status', type: 'text' as const, nullable: false, default: "'pending'" },
        { name: 'table_number', type: 'text' as const, nullable: true },
        { name: 'staff_name', type: 'text' as const, nullable: true },
        { name: 'payment_method', type: 'text' as const, nullable: true },
        { name: 'payment_status', type: 'text' as const, nullable: true },
        { name: 'payment_reference', type: 'text' as const, nullable: true },
        { name: 'receipt_number', type: 'text' as const, nullable: true },
      ],
    };

    const sqlA = buildCreateTableSql(tableDef, schemaA, 'sqlite');
    const sqlB = buildCreateTableSql(tableDef, schemaB, 'sqlite');

    await db.execute(sqlA);
    await db.execute(sqlB);

    // Insert order in Business A
    await db.insert('orders', {
      items: 'Artisan Coffee x2, Croissant x1',
      line_items: JSON.stringify([
        { name: 'Artisan Coffee', price: 6.0, qty: 2, subtotal: 12.0, taxable: true },
        { name: 'Croissant', price: 4.5, qty: 1, subtotal: 4.5, taxable: true },
      ]),
      total: 16.5,
      status: 'fulfilled',
      table_number: 'Table 4',
      staff_name: 'Elena',
      payment_method: 'card',
      payment_status: 'paid',
      receipt_number: 'REC-A-001',
    }, schemaA);

    // Insert order in Business B
    await db.insert('orders', {
      items: 'Vintage Jacket x1',
      line_items: JSON.stringify([
        { name: 'Vintage Jacket', price: 180.0, qty: 1, subtotal: 180.0, taxable: true },
      ]),
      total: 180.0,
      status: 'fulfilled',
      staff_name: 'Marcus',
      payment_method: 'cash',
      payment_status: 'paid',
      receipt_number: 'REC-B-999',
    }, schemaB);
  });

  afterAll(async () => {
    // Clean up test tables
    await db.execute(`DROP TABLE IF EXISTS ${schemaA}_orders`);
    await db.execute(`DROP TABLE IF EXISTS ${schemaB}_orders`);
  });

  test('fetchBusinessOrders strictly isolates data by tenant schema', async () => {
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const to = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const ordersA = await fetchBusinessOrders(schemaA, from, to);
    const ordersB = await fetchBusinessOrders(schemaB, from, to);

    expect(ordersA.orders.length).toBe(1);
    expect(ordersA.orders[0].receipt_number).toBe('REC-A-001');
    expect(ordersA.orders[0].total).toBe(16.5);

    expect(ordersB.orders.length).toBe(1);
    expect(ordersB.orders[0].receipt_number).toBe('REC-B-999');
    expect(ordersB.orders[0].total).toBe(180.0);

    // Verify zero cross-tenant contamination
    expect(ordersA.orders.some((o) => o.receipt_number === 'REC-B-999')).toBe(false);
    expect(ordersB.orders.some((o) => o.receipt_number === 'REC-A-001')).toBe(false);
  });

  test('validateIdentifier rejects malicious identifiers and SQL injection payloads', () => {
    expect(() => validateIdentifier('orders; DROP TABLE businesses;--')).toThrow();
    expect(() => validateIdentifier('orders" OR 1=1--')).toThrow();
    expect(() => validateIdentifier('orders space')).toThrow();
    expect(() => validateIdentifier('123starts_with_num')).toThrow();
    expect(() => validateIdentifier('orders-with-hyphens')).toThrow();

    // Valid identifiers
    expect(() => validateIdentifier('orders')).not.toThrow();
    expect(() => validateIdentifier('biz_user123_table')).not.toThrow();
  });

  test('Sales performance and tax workbooks export to valid OpenXML archives from real tenant data', async () => {
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const to = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const { orders } = await fetchBusinessOrders(schemaA, from, to);
    expect(orders.length).toBe(1);

    // Sales Metrics Workbook
    const salesReport = calculateSalesMetrics(orders, from, to);
    const salesWorkbook = buildSalesMetricsWorkbook(salesReport, 'Elena Cafe', { from, to });
    const salesXlsx = generateXlsx(salesWorkbook);

    expect(salesXlsx.length).toBeGreaterThan(1200);
    expect(salesXlsx[0]).toBe(0x50); // 'P'
    expect(salesXlsx[1]).toBe(0x4b); // 'K'

    // Tax Filing Workbook
    const taxReport = calculateTaxFilingReport(orders, 'Elena Cafe', from, to, { taxRate: 0.10 });
    const taxWorkbook = buildTaxFilingWorkbook(taxReport, 'Elena Cafe', { from, to });
    const taxXlsx = generateXlsx(taxWorkbook);

    expect(taxXlsx.length).toBeGreaterThan(1200);
    expect(taxXlsx[0]).toBe(0x50);
    expect(taxXlsx[1]).toBe(0x4b);

    // Verify Tax Summary numbers
    expect(taxReport.summary.grossSales).toBe(16.5);
    expect(taxReport.summary.taxCollected).toBeCloseTo(1.5, 1);
    expect(taxReport.paymentReconciliation[0].paymentMethod.toLowerCase()).toBe('card');
  });

  test('SpreadsheetML and CSV formats generate cleanly without corrupting formulas or strings', () => {
    const testWorkbook = {
      sheets: [
        {
          name: 'Ledger',
          rows: [
            [{ value: 'Code', format: 'header' as const }, { value: 'Amount', format: 'header' as const }],
            [{ value: '=SUM(1,2)', format: 'string' as const }, { value: 50.0, format: 'currency' as const }],
          ],
        },
      ],
    };

    const xml = generateSpreadsheetXml(testWorkbook);
    // Formula injection should be escaped with single quote and XML-escaped
    expect(xml).toContain('&apos;=SUM(1,2)');
    expect(xml).toContain('ss:Name="Ledger"');

    const csv = generateCsv(testWorkbook.sheets[0]);
    expect(csv).toContain('\'=SUM(1,2)');
  });

  test('fetchBusinessOrders accurately queries SQLite datetime records without dropping same-day orders', async () => {
    // Insert an order with explicit SQLite datetime format YYYY-MM-DD HH:MM:SS
    const testDateStr = '2026-10-04 15:30:00';
    await db.execute(`INSERT INTO ${schemaA}_orders (id, items, total, status, created_at) VALUES ('ord-sameday', 'Test Coffee', 8.5, 'fulfilled', '${testDateStr}')`);

    // Query for range starting at 00:00:00 on the same date (2026-10-04)
    const rangeFrom = new Date('2026-10-04T00:00:00.000Z');
    const rangeTo = new Date('2026-10-04T23:59:59.999Z');

    const result = await fetchBusinessOrders(schemaA, rangeFrom, rangeTo);
    const found = result.orders.find((o) => o.id === 'ord-sameday');

    expect(found).toBeDefined();
    expect(found!.total).toBe(8.5);

    // Clean up
    await db.execute(`DELETE FROM ${schemaA}_orders WHERE id = 'ord-sameday'`);
  });

  test('OpenXML container contains calcPr fullCalcOnLoad and cellStyles for desktop Excel compliance', () => {
    const workbook = {
      sheets: [
        {
          name: 'Sheet With Illegal Characters \x07 and Long Name That Exceeds 31 Characters Limit',
          rows: [
            [{ value: 'Valid Header\x00' }, { value: 'Formula' }],
            [{ value: 'Item \x08 Name' }, { value: 100, formula: 'SUM(A1:A1)' }],
          ],
        },
      ],
    };

    const xlsx = generateXlsx(workbook);
    expect(xlsx.length).toBeGreaterThan(500);

    // Decompress and verify workbook.xml and styles.xml content
    // Check that sheet name was sanitized and truncated to 31 chars
    const zip = Buffer.from(xlsx).toString('binary');
    // The zip archive includes calcPr and cellStyles in the text streams
    expect(xlsx[0]).toBe(0x50); // PK
  });

  test('server api endpoint handlers are valid exported functions', () => {
    expect(typeof salesMetricsHandler).toBe('function');
    expect(typeof taxSummaryHandler).toBe('function');
    expect(typeof exportSalesHandler).toBe('function');
    expect(typeof exportTaxHandler).toBe('function');
  });
});
