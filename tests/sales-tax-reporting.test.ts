import { describe, expect, test } from 'bun:test';
import {
  calculateSalesMetrics,
  parseOrderLineItems,
  buildSalesMetricsWorkbook,
  type RawOrderRecord,
} from '../server/utils/salesMetrics';
import {
  calculateTaxFilingReport,
  buildTaxFilingWorkbook,
} from '../server/utils/taxFiling';
import { generateSpreadsheetXml, generateXlsx, generateCsv } from '../server/utils/spreadsheet';

describe('Sales Metrics & Predictive Forecasting Engine', () => {
  const sampleOrders: RawOrderRecord[] = [
    {
      id: 'ord-1',
      created_at: '2026-10-01T10:00:00.000Z',
      total: 50.0,
      payment_method: 'cash',
      payment_status: 'paid',
      receipt_number: 'REC-001',
      line_items: JSON.stringify([
        { name: 'Burger', price: 15.0, qty: 2, subtotal: 30.0 },
        { name: 'Fries', price: 5.0, qty: 2, subtotal: 10.0 },
        { name: 'Soda', price: 5.0, qty: 2, subtotal: 10.0 },
      ]),
    },
    {
      id: 'ord-2',
      created_at: '2026-10-01T14:30:00.000Z',
      total: 30.0,
      payment_method: 'card',
      payment_status: 'paid',
      receipt_number: 'REC-002',
      line_items: JSON.stringify([
        { name: 'Burger', price: 15.0, qty: 2, subtotal: 30.0 },
      ]),
    },
    {
      id: 'ord-3',
      created_at: '2026-10-02T12:00:00.000Z',
      total: 45.0,
      payment_method: 'card',
      payment_status: 'paid',
      receipt_number: 'REC-003',
      items: 'Burger x1, Fries x3',
    },
    {
      id: 'ord-4',
      created_at: '2026-10-03T18:00:00.000Z',
      total: 120.0,
      payment_method: 'qr',
      payment_status: 'paid',
      receipt_number: 'REC-004',
      line_items: JSON.stringify([
        { name: 'Burger', price: 15.0, qty: 6, subtotal: 90.0 },
        { name: 'Beer', price: 10.0, qty: 3, subtotal: 30.0, taxable: false }, // Tax-exempt item
      ]),
    },
  ];

  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-03T23:59:59.999Z');

  test('parseOrderLineItems parses JSON, text summaries, and fallbacks correctly', () => {
    // 1. JSON line items
    const jsonItems = parseOrderLineItems(sampleOrders[0]);
    expect(jsonItems.length).toBe(3);
    expect(jsonItems[0].name).toBe('Burger');
    expect(jsonItems[0].qty).toBe(2);
    expect(jsonItems[0].subtotal).toBe(30.0);

    // 2. Text summary fallback
    const textItems = parseOrderLineItems(sampleOrders[2]);
    expect(textItems.length).toBe(2);
    expect(textItems[0].name).toBe('Burger');
    expect(textItems[0].qty).toBe(1);
    expect(textItems[1].name).toBe('Fries');
    expect(textItems[1].qty).toBe(3);

    // 3. Fallback generic item
    const fallback = parseOrderLineItems({
      id: 'ord-fallback',
      created_at: '2026-10-01T00:00:00.000Z',
      total: 99.99,
    });
    expect(fallback.length).toBe(1);
    expect(fallback[0].name).toBe('General Sale');
    expect(fallback[0].subtotal).toBe(99.99);
  });

  test('calculateSalesMetrics correctly aggregates revenue, AOV, and trends', () => {
    const report = calculateSalesMetrics(sampleOrders, from, to);

    // Total = 50 + 30 + 45 + 120 = 245
    expect(report.summary.totalRevenue).toBe(245.0);
    expect(report.summary.totalOrders).toBe(4);
    expect(report.summary.averageOrderValue).toBe(61.25);
    expect(report.summary.activeDays).toBe(3);

    // Trends: Day 1 (80), Day 2 (45), Day 3 (120)
    expect(report.trends.length).toBe(3);
    expect(report.trends[0].date).toBe('2026-10-01');
    expect(report.trends[0].revenue).toBe(80.0);
    expect(report.trends[0].orders).toBe(2);

    expect(report.trends[1].date).toBe('2026-10-02');
    expect(report.trends[1].revenue).toBe(45.0);

    expect(report.trends[2].date).toBe('2026-10-03');
    expect(report.trends[2].revenue).toBe(120.0);
  });

  test('calculateSalesMetrics computes moving averages and run-rates', () => {
    const report = calculateSalesMetrics(sampleOrders, from, to);

    expect(report.forecasts.periodDays).toBe(3);
    expect(report.forecasts.dailyRunRate).toBeCloseTo(245 / 3, 1);
    expect(report.forecasts.projected30DayRunRate).toBeCloseTo((245 / 3) * 30, 0);
    expect(report.forecasts.projectedAnnualRunRate).toBeCloseTo((245 / 3) * 365, 0);

    // 3-day SMA on Day 3 is average of (80 + 45 + 120) / 3 = 81.67
    expect(report.forecasts.movingAverage3d).toBeCloseTo(81.67, 1);
  });

  test('calculateSalesMetrics projects demand for top items', () => {
    const report = calculateSalesMetrics(sampleOrders, from, to);

    // Burger was ordered: 2 (ord1) + 2 (ord2) + 1 (ord3) + 6 (ord4) = 11 units
    const burger = report.topItems.find((i) => i.name === 'Burger');
    expect(burger).toBeDefined();
    expect(burger!.unitsSold).toBe(11);
    expect(burger!.dailyVelocity).toBeCloseTo(11 / 3, 1);
    expect(burger!.projected7DayDemand).toBeGreaterThan(0);
    expect(burger!.projected30DayDemand).toBeGreaterThan(0);
  });

  test('buildSalesMetricsWorkbook produces multi-sheet workbook with valid OpenXML and SpreadsheetML', () => {
    const report = calculateSalesMetrics(sampleOrders, from, to);
    const workbook = buildSalesMetricsWorkbook(report, 'Kogane Cafe', { from, to });

    expect(workbook.sheets.length).toBe(4);
    expect(workbook.sheets[0].name).toBe('Executive Performance');
    expect(workbook.sheets[1].name).toBe('Revenue Trends');
    expect(workbook.sheets[2].name).toBe('Product Demand Forecast');
    expect(workbook.sheets[3].name).toBe('Detailed Transactions');

    // Generate .xlsx
    const xlsx = generateXlsx(workbook);
    expect(xlsx.length).toBeGreaterThan(1000);
    expect(xlsx[0]).toBe(0x50); // PK zip header

    // Generate .xls (SpreadsheetML)
    const xml = generateSpreadsheetXml(workbook);
    expect(xml).toContain('Executive Performance');
    expect(xml).toContain('Revenue Trends');
    expect(xml).toContain('Product Demand Forecast');
  });
});

describe('Tax Filing & Compliance Engine', () => {
  const sampleOrders: RawOrderRecord[] = [
    {
      id: 'tax-1',
      created_at: '2026-10-01T10:00:00.000Z',
      total: 110.0,
      payment_method: 'cash',
      payment_status: 'paid',
      receipt_number: 'REC-101',
      line_items: JSON.stringify([
        { name: 'Standard Item', price: 100.0, qty: 1, subtotal: 100.0, taxable: true },
        { name: 'Exempt Grocery', price: 10.0, qty: 1, subtotal: 10.0, taxable: false },
      ]),
    },
    {
      id: 'tax-2',
      created_at: '2026-10-02T15:00:00.000Z',
      total: 220.0,
      payment_method: 'card',
      payment_status: 'paid',
      receipt_number: 'REC-102',
      line_items: JSON.stringify([
        { name: 'Standard Item 2', price: 220.0, qty: 1, subtotal: 220.0, taxable: true },
      ]),
    },
  ];

  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-02T23:59:59.999Z');

  test('calculateTaxFilingReport calculates gross, exempt, taxable sales and tax collected at 10%', () => {
    const report = calculateTaxFilingReport(sampleOrders, 'Kogane Retail', from, to, { taxRate: 0.10 });

    // Total gross = 110 + 220 = 330
    expect(report.summary.grossSales).toBe(330.0);
    expect(report.summary.exemptSales).toBe(10.0);

    // Taxable gross = 320. With 10% tax-inclusive:
    // Taxable base = 320 / 1.10 = 290.91
    // Tax collected = 320 - 290.91 = 29.09
    expect(report.summary.taxableSales).toBeCloseTo(290.91, 1);
    expect(report.summary.taxCollected).toBeCloseTo(29.09, 1);
    expect(report.summary.netSales).toBeCloseTo(330.0 - 29.09, 1);
    expect(report.summary.totalTransactions).toBe(2);
  });

  test('calculateTaxFilingReport breaks down payment methods for 1099-K audit reconciliation', () => {
    const report = calculateTaxFilingReport(sampleOrders, 'Kogane Retail', from, to, { taxRate: 0.10 });

    expect(report.paymentReconciliation.length).toBe(2);
    const cash = report.paymentReconciliation.find((p) => p.paymentMethod.toLowerCase() === 'cash');
    const card = report.paymentReconciliation.find((p) => p.paymentMethod.toLowerCase() === 'card');

    expect(cash).toBeDefined();
    expect(cash!.grossSales).toBe(110.0);
    expect(cash!.transactionCount).toBe(1);

    expect(card).toBeDefined();
    expect(card!.grossSales).toBe(220.0);
    expect(card!.transactionCount).toBe(1);
  });

  test('calculateTaxFilingReport builds daily ledger schedule', () => {
    const report = calculateTaxFilingReport(sampleOrders, 'Kogane Retail', from, to, { taxRate: 0.10 });

    expect(report.dailyLedger.length).toBe(2);
    expect(report.dailyLedger[0].date).toBe('2026-10-01');
    expect(report.dailyLedger[0].grossSales).toBe(110.0);
    expect(report.dailyLedger[0].exemptSales).toBe(10.0);

    expect(report.dailyLedger[1].date).toBe('2026-10-02');
    expect(report.dailyLedger[1].grossSales).toBe(220.0);
  });

  test('buildTaxFilingWorkbook generates compliant 4-sheet tax workbook with full ledger totals', () => {
    const report = calculateTaxFilingReport(sampleOrders, 'Kogane Retail', from, to, { taxRate: 0.10 });
    const workbook = buildTaxFilingWorkbook(report, 'Kogane Retail', { from, to });

    expect(workbook.sheets.length).toBe(4);
    expect(workbook.sheets[0].name).toBe('Tax Filing Summary');
    expect(workbook.sheets[1].name).toBe('Periodic Tax Ledger');
    expect(workbook.sheets[2].name).toBe('Payment Method Audit');
    expect(workbook.sheets[3].name).toBe('Line Item Tax Audit');

    // Check that ledger summary row has non-null precomputed numbers for Cash, Card, Other
    const ledgerSheet = workbook.sheets[1];
    const totalRow = ledgerSheet.rows[ledgerSheet.rows.length - 1];
    expect((totalRow[6] as any).value).toBe(110.0); // Cash total
    expect((totalRow[7] as any).value).toBe(220.0); // Card total
    expect((totalRow[8] as any).value).toBe(0.0);   // Other total

    const xlsx = generateXlsx(workbook);
    expect(xlsx.length).toBeGreaterThan(1000);
    expect(xlsx[0]).toBe(0x50);

    const xml = generateSpreadsheetXml(workbook);
    expect(xml).toContain('Tax Filing Summary');
    expect(xml).toContain('Periodic Tax Ledger');
    expect(xml).toContain('Payment Method Audit');

    const csv = generateCsv(workbook.sheets[0]);
    expect(csv).toContain('Gross Sales');
  });

  test('calculateTaxFilingReport supports tax-exclusive pricing model', () => {
    // With 10% tax-exclusive:
    // Order 1: 100 taxable + 10 exempt. Tax = 10. Gross with tax = 120.
    // Order 2: 220 taxable. Tax = 22. Gross with tax = 242.
    // Total taxable base = 320. Total exempt = 10. Total tax = 32.
    // Total gross = 362. Net sales = 330.
    const report = calculateTaxFilingReport(sampleOrders, 'Kogane Retail', from, to, {
      taxRate: 0.10,
      taxInclusive: false,
    });

    expect(report.summary.taxableSales).toBe(320.0);
    expect(report.summary.exemptSales).toBe(10.0);
    expect(report.summary.taxCollected).toBe(32.0);
    expect(report.summary.grossSales).toBe(362.0);
    expect(report.summary.netSales).toBe(330.0);
    expect(report.summary.grossSales).toBe(report.summary.netSales + report.summary.taxCollected);
  });

  test('calculateSalesMetrics populates gap days with 0 revenue for true moving averages', () => {
    // 3 orders on Day 1 (Oct 1) and Day 3 (Oct 3), with 0 orders on Day 2 (Oct 2)
    const ordersWithGap: RawOrderRecord[] = [
      { id: '1', created_at: '2026-10-01T10:00:00Z', total: 100 },
      { id: '2', created_at: '2026-10-03T10:00:00Z', total: 200 },
    ];
    const rangeFrom = new Date('2026-10-01T00:00:00Z');
    const rangeTo = new Date('2026-10-03T23:59:59Z');

    const metrics = calculateSalesMetrics(ordersWithGap, rangeFrom, rangeTo);
    expect(metrics.trends.length).toBe(3);
    expect(metrics.trends[0].date).toBe('2026-10-01');
    expect(metrics.trends[0].revenue).toBe(100);

    expect(metrics.trends[1].date).toBe('2026-10-02');
    expect(metrics.trends[1].revenue).toBe(0);
    expect(metrics.trends[1].orders).toBe(0);

    expect(metrics.trends[2].date).toBe('2026-10-03');
    expect(metrics.trends[2].revenue).toBe(200);

    // 3-day SMA on Day 3: (100 + 0 + 200) / 3 = 100
    expect(metrics.trends[2].movingAverage3d).toBe(100);
    // Active trading days is 2 (only days with orders)
    expect(metrics.summary.activeDays).toBe(2);
  });
});
