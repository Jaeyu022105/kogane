import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDonutSlices,
  buildHorizontalBars,
  buildTrendChartSeries,
  formatShortPeriodLabel,
  isSalesMutationTable,
} from '../lib/reportDiagrams';
import { db, resetDbAdapter, setDbAdapterForTest } from '../lib/db';
import { FirestoreAdapter, InMemoryFirestoreStore } from '../lib/db-firebase';
import { realtimeHub } from '../server/utils/realtimeHub';
import { ensureStarterBusinessTable } from '../server/utils/starterTables';
import signupHandler from '../server/api/auth/signup.post';
import dataInsertHandler from '../server/api/data/insert.post';
import salesMetricsHandler from '../server/api/reports/sales-metrics.get';
import transactionsReportHandler from '../server/api/reports/transactions.get';
import { calculateSalesMetrics, type RawOrderRecord } from '../server/utils/salesMetrics';

function createMockEvent(opts: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const method = opts.method ?? 'POST';
  const body = opts.body;
  const responseHeaders: Record<string, string | string[]> = {};
  const rawHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 Chrome/131.0.0.0',
    ...(opts.headers ?? {}),
  };

  return {
    method,
    node: {
      req: {
        method,
        url: opts.url ?? '/',
        headers: rawHeaders,
        socket: { remoteAddress: '127.0.0.1', encrypted: true },
        body,
        [Symbol.for('h3ParsedBody')]: body,
      },
      res: {
        statusCode: 200,
        setHeader(name: string, val: string | string[]) {
          responseHeaders[name.toLowerCase()] = val;
        },
        getHeader(name: string) {
          return responseHeaders[name.toLowerCase()];
        },
      },
    },
    context: { params: {} },
  } as any;
}

describe('Live Sales Diagrams Math & Geometry', () => {
  test('isSalesMutationTable identifies sales-impacting tables across raw and prefixed names', () => {
    expect(isSalesMutationTable('orders')).toBe(true);
    expect(isSalesMutationTable('transactions')).toBe(true);
    expect(isSalesMutationTable('invoices')).toBe(true);
    expect(isSalesMutationTable('products')).toBe(true);
    expect(isSalesMutationTable('biz_usr123_orders')).toBe(true);
    expect(isSalesMutationTable('biz_usr123_transactions')).toBe(true);
    expect(isSalesMutationTable('ORDERS')).toBe(true);

    expect(isSalesMutationTable('sessions')).toBe(false);
    expect(isSalesMutationTable('businesses')).toBe(false);
    expect(isSalesMutationTable('')).toBe(false);
    expect(isSalesMutationTable(null)).toBe(false);
    expect(isSalesMutationTable(undefined)).toBe(false);
  });

  test('formatShortPeriodLabel formats day, week, month, and fallback labels cleanly', () => {
    expect(formatShortPeriodLabel('2026-11-12')).toBe('Nov 12');
    expect(formatShortPeriodLabel('2026-01-05')).toBe('Jan 5');
    expect(formatShortPeriodLabel('2026-11')).toBe("Nov '26");
    expect(formatShortPeriodLabel('2026-W45')).toBe('W45');
    expect(formatShortPeriodLabel('')).toBe('—');
    expect(formatShortPeriodLabel('Very Long Custom Label Name')).toBe('Very Long Cu…');
  });

  test('buildTrendChartSeries handles empty, zero-value, single-point, and multi-point datasets safely', () => {
    const empty = buildTrendChartSeries([], 'revenue');
    expect(empty.points).toEqual([]);
    expect(empty.linePath).toBe('');
    expect(empty.areaPath).toBe('');
    expect(empty.maxValue).toBeGreaterThanOrEqual(1);

    const zeroSeries = buildTrendChartSeries(
      [
        { label: '2026-11-01', revenue: 0, orders: 0 },
        { label: '2026-11-02', revenue: 0, orders: 0 },
      ],
      'revenue',
    );
    expect(zeroSeries.maxValue).toBe(1);
    expect(zeroSeries.points.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))).toBe(true);

    const single = buildTrendChartSeries(
      [{ label: '2026-11-12', revenue: 250, orders: 5 }],
      'revenue',
    );
    expect(single.points.length).toBe(1);
    expect(single.points[0].averageOrderValue).toBe(50);
    expect(Number.isFinite(single.points[0].x)).toBe(true);
    expect(Number.isFinite(single.points[0].y)).toBe(true);
    expect(single.linePath).toBe('');

    const multi = buildTrendChartSeries(
      [
        { label: '2026-11-10', revenue: 100, orders: 2, movingAverage7d: 100 },
        { label: '2026-11-11', revenue: 240, orders: 4, movingAverage7d: 170 },
        { label: '2026-11-12', revenue: 300, orders: 6, movingAverage7d: 213.33 },
      ],
      'revenue',
    );
    expect(multi.points.length).toBe(3);
    expect(multi.linePath.startsWith('M ')).toBe(true);
    expect(multi.areaPath.endsWith(' Z')).toBe(true);
    expect(multi.hasMovingAverage).toBe(true);
    expect(multi.maLinePath.startsWith('M ')).toBe(true);

    const orderMetric = buildTrendChartSeries(
      [
        { label: '2026-11-10', revenue: 100, orders: 2 },
        { label: '2026-11-11', revenue: 240, orders: 6 },
      ],
      'orders',
    );
    expect(orderMetric.points[1].value).toBe(6);
    expect(orderMetric.hasMovingAverage).toBe(false);
  });

  test('buildTrendChartSeries caps x-axis label indices for dense 30+ day ranges and avoids duplicate order Y-ticks', () => {
    const dense = Array.from({ length: 35 }, (_, i) => ({
      label: `2026-10-${String(i + 1).padStart(2, '0')}`,
      revenue: (i + 1) * 20,
      orders: i + 1,
    }));
    const series = buildTrendChartSeries(dense, 'revenue');
    expect(series.xLabelIndices.length).toBeLessThanOrEqual(6);
    expect(series.xLabelIndices[0]).toBe(0);
    expect(series.xLabelIndices[series.xLabelIndices.length - 1]).toBe(34);

    // Small order counts (1 or 2 orders) should still yield distinct integer Y-ticks
    const smallOrders = buildTrendChartSeries(
      [
        { label: '2026-11-11', revenue: 100, orders: 1 },
        { label: '2026-11-12', revenue: 200, orders: 2 },
      ],
      'orders',
    );
    const tickValues = smallOrders.yTicks.map((t) => t.value);
    expect(new Set(tickValues).size).toBe(tickValues.length);
    expect(tickValues).toEqual([0, 1, 2, 3, 4]);
  });

  test('buildDonutSlices handles empty, single 100% channel, and multi-channel splits', () => {
    expect(buildDonutSlices([])).toEqual({ total: 0, slices: [] });
    expect(buildDonutSlices([{ label: 'Cash', value: 0 }])).toEqual({ total: 0, slices: [] });

    const single = buildDonutSlices([{ label: 'Cash', value: 450, count: 9 }]);
    expect(single.total).toBe(450);
    expect(single.slices.length).toBe(1);
    expect(single.slices[0].isFullCircle).toBe(true);
    expect(single.slices[0].percentage).toBe(100);
    // Two 180-degree ring arcs avoid degenerate zero-length SVG 360-degree arc
    expect(single.slices[0].path.split('M ').length - 1).toBe(2);

    const multi = buildDonutSlices([
      { label: 'Cash', value: 300, count: 6 },
      { label: 'Card', value: 150, count: 3 },
      { label: 'GCash', value: 50, count: 1 },
    ]);
    expect(multi.total).toBe(500);
    expect(multi.slices.length).toBe(3);
    expect(multi.slices[0].percentage).toBe(60);
    expect(multi.slices[1].percentage).toBe(30);
    expect(multi.slices[2].percentage).toBe(10);
    expect(multi.slices.every((s) => !s.isFullCircle)).toBe(true);
  });

  test('buildHorizontalBars normalizes bar widths and respects limit', () => {
    const bars = buildHorizontalBars(
      [
        { label: 'Ramen', value: 400, secondaryLabel: '20 units', share: 50 },
        { label: 'Gyoza', value: 200, secondaryLabel: '20 units', share: 25 },
        { label: 'Tea', value: 100, secondaryLabel: '20 units', share: 12.5 },
        { label: 'Mochi', value: 50, secondaryLabel: '10 units', share: 6.25 },
      ],
      3,
    );
    expect(bars.length).toBe(3);
    expect(bars[0].widthPct).toBe(100);
    expect(bars[1].widthPct).toBe(50);
    expect(bars[2].widthPct).toBe(25);

    const zeroBars = buildHorizontalBars([{ label: 'Nothing', value: 0 }], 5);
    expect(zeroBars[0].widthPct).toBe(0);
  });
});

describe('Sales Metrics Breakdown for Live Diagrams', () => {
  test('calculateSalesMetrics computes paymentBreakdown and statusBreakdown and reacts to added orders', () => {
    const from = new Date('2026-11-10T00:00:00.000Z');
    const to = new Date('2026-11-12T23:59:59.999Z');

    const initialOrders: RawOrderRecord[] = [
      {
        id: 'o-1',
        created_at: '2026-11-10T10:00:00.000Z',
        total: 120,
        status: 'fulfilled',
        payment_method: 'cash',
        line_items: JSON.stringify([{ name: 'Katsu Curry', price: 120, qty: 1, subtotal: 120 }]),
      },
      {
        id: 'o-2',
        created_at: '2026-11-11T11:00:00.000Z',
        total: 80,
        status: 'pending',
        payment_method: 'gcash',
        line_items: JSON.stringify([{ name: 'Matcha Latte', price: 80, qty: 1, subtotal: 80 }]),
      },
    ];

    const before = calculateSalesMetrics(initialOrders, from, to);
    expect(before.paymentBreakdown.length).toBe(2);
    expect(before.paymentBreakdown[0]).toEqual({
      method: 'cash',
      label: 'Cash',
      orders: 1,
      revenue: 120,
      shareOfSales: 60,
    });
    expect(before.paymentBreakdown[1]).toEqual({
      method: 'gcash',
      label: 'GCash',
      orders: 1,
      revenue: 80,
      shareOfSales: 40,
    });
    expect(before.statusBreakdown.length).toBe(2);

    // Simulate a live Card checkout coming in
    const afterOrders: RawOrderRecord[] = [
      ...initialOrders,
      {
        id: 'o-3',
        created_at: '2026-11-12T12:00:00.000Z',
        total: 200,
        status: 'fulfilled',
        payment_method: 'card',
        line_items: JSON.stringify([{ name: 'Matcha Latte', price: 100, qty: 2, subtotal: 200 }]),
      },
    ];

    const after = calculateSalesMetrics(afterOrders, from, to);
    expect(after.summary.totalRevenue).toBe(400);
    expect(after.paymentBreakdown.length).toBe(3);
    expect(after.paymentBreakdown[0].label).toBe('Card');
    expect(after.paymentBreakdown[0].shareOfSales).toBe(50);
    expect(after.topItems[0].name).toBe('Matcha Latte');
    expect(after.topItems[0].revenue).toBe(280);
  });

  test('calculateSalesMetrics handles empty orders cleanly without NaN', () => {
    const from = new Date('2026-11-10T00:00:00.000Z');
    const to = new Date('2026-11-12T23:59:59.999Z');
    const empty = calculateSalesMetrics([], from, to);
    expect(empty.paymentBreakdown).toEqual([]);
    expect(empty.statusBreakdown).toEqual([]);
    expect(empty.summary.totalRevenue).toBe(0);
  });
});

describe('Reports Page Typography Consistency & Live Diagrams Integration', () => {
  const reportsVue = readFileSync(join(process.cwd(), 'pages/dashboard/reports.vue'), 'utf8');
  const salesDiagramsVue = readFileSync(join(process.cwd(), 'components/SalesDiagrams.vue'), 'utf8');

  test('reports.vue uses website-consistent Inter/DM Serif typography and avoids tiny unreadable mono text', () => {
    expect(reportsVue).not.toContain('font-mono');
    expect(reportsVue).not.toContain('text-[10px]');
    expect(reportsVue).not.toContain('text-[11px]');
    expect(reportsVue).not.toContain('text-stone-400');
    expect(reportsVue).toContain('font-sans');
    expect(reportsVue).toContain('font-serif');
    expect(reportsVue).toContain('tabular-nums');
  });

  test('reports.vue integrates SalesDiagrams and real-time sales sync', () => {
    expect(reportsVue).toContain('SalesDiagrams');
    expect(reportsVue).toContain('useRealtimeSync');
    expect(reportsVue).toContain('isSalesMutationTable');
    expect(reportsVue).toContain('toggleLiveUpdates');
  });

  test('SalesDiagrams.vue renders interactive trend, product, payment, and status diagrams with accessible text', () => {
    expect(salesDiagramsVue).not.toContain('font-mono');
    expect(salesDiagramsVue).not.toContain('text-stone-400');
    expect(salesDiagramsVue).toContain('Sales Over Time');
    expect(salesDiagramsVue).toContain('Top Selling Items');
    expect(salesDiagramsVue).toContain('Sales by Payment Method');
    expect(salesDiagramsVue).toContain('Order Fulfillment Mix');
    expect(salesDiagramsVue).toContain('Live updates active');
    expect(salesDiagramsVue).toContain('useId()');
    expect(salesDiagramsVue).toContain('#B8294B');
  });

  test('reports.vue supports 0% tax rate and avoids stale fallback coercion', () => {
    expect(reportsVue).toContain('effectiveTaxRateDecimal');
    expect(reportsVue).toContain('onReconnect');
    expect(reportsVue).toContain(':status-breakdown');
    expect(reportsVue).not.toContain('(Number(taxRatePercent.value) || 10)');
  });
});

describe('End-to-End Live Sales Metrics & Realtime Diagram Sync', () => {
  test('GET /api/reports/sales-metrics updates live when a new sale is inserted and emits realtimeHub event', async () => {
    const prevProvider = process.env.DB_PROVIDER;
    setDbAdapterForTest(new FirestoreAdapter(new InMemoryFirestoreStore()));
    process.env.DB_PROVIDER = 'firebase';

    const receivedMutations: string[] = [];
    let unsub: (() => void) | null = null;

    try {
      const signupRes = await signupHandler(
        createMockEvent({
          body: {
            email: `reports-live-${Date.now()}@kogane.dev`,
            password: 'StrongPassword1',
            fullName: 'Reports Tester',
          },
        }),
      );
      const token = signupRes.session!.token;
      const userId = signupRes.session!.userId;
      const bizId = `biz_rep_${Date.now()}`;
      const schemaName = `biz_rep_schema_${Date.now()}`;

      await db.insert('businesses', {
        id: bizId,
        admin_user_id: userId,
        name: 'Kogane Bistro',
        schema_name: schemaName,
      });

      await ensureStarterBusinessTable(schemaName, 'orders');

      unsub = realtimeHub.subscribe(bizId, (mutation) => {
        if (isSalesMutationTable(mutation.table)) {
          receivedMutations.push(`${mutation.action}:${mutation.table}`);
        }
      });

      const today = new Date().toISOString().slice(0, 10);

      // Before any sales
      const beforeRes = await salesMetricsHandler(
        createMockEvent({
          method: 'GET',
          url: `/api/reports/sales-metrics?from=${today}&to=${today}`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );
      expect(beforeRes.error).toBeNull();
      expect(beforeRes.summary?.totalRevenue).toBe(0);
      expect(beforeRes.paymentBreakdown).toEqual([]);

      // Insert first sale (Cash)
      const ins1 = await dataInsertHandler(
        createMockEvent({
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: {
            businessId: bizId,
            tableName: 'orders',
            values: {
              items: 'Tonkotsu Ramen x2',
              line_items: JSON.stringify([
                { name: 'Tonkotsu Ramen', price: 150, qty: 2, subtotal: 300 },
              ]),
              total: 300,
              status: 'fulfilled',
              payment_method: 'cash',
              created_at: new Date().toISOString(),
            },
          },
        }),
      );
      expect(ins1.error).toBeNull();

      // Insert second sale (GCash)
      const ins2 = await dataInsertHandler(
        createMockEvent({
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: {
            businessId: bizId,
            tableName: 'orders',
            values: {
              items: 'Matcha Cheesecake x1',
              line_items: JSON.stringify([
                { name: 'Matcha Cheesecake', price: 200, qty: 1, subtotal: 200 },
              ]),
              total: 200,
              status: 'pending',
              payment_method: 'gcash',
              created_at: new Date().toISOString(),
            },
          },
        }),
      );
      expect(ins2.error).toBeNull();

      expect(receivedMutations).toEqual(['insert:orders', 'insert:orders']);

      const afterRes = await salesMetricsHandler(
        createMockEvent({
          method: 'GET',
          url: `/api/reports/sales-metrics?from=${today}&to=${today}`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );
      expect(afterRes.error).toBeNull();
      expect(afterRes.summary?.totalRevenue).toBe(500);
      expect(afterRes.summary?.totalOrders).toBe(2);
      expect(afterRes.topItems.length).toBe(2);
      expect(afterRes.paymentBreakdown).toEqual([
        { method: 'cash', label: 'Cash', orders: 1, revenue: 300, shareOfSales: 60 },
        { method: 'gcash', label: 'GCash', orders: 1, revenue: 200, shareOfSales: 40 },
      ]);
      expect(afterRes.statusBreakdown.length).toBe(2);

      // Verify GET /api/reports/transactions matches sales-metrics (even if empty transactions table exists)
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ${schemaName}_transactions (id TEXT PRIMARY KEY, total NUMERIC, created_at TEXT)`,
      );
      const txDayRes = await transactionsReportHandler(
        createMockEvent({
          method: 'GET',
          url: `/api/reports/transactions?from=${today}&to=${today}&group=day`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );
      expect(txDayRes.error).toBeNull();
      expect(txDayRes.rows.length).toBe(1);
      expect(txDayRes.rows[0].revenue).toBe(500);
      expect(txDayRes.rows[0].transactions).toBe(2);
    } finally {
      unsub?.();
      resetDbAdapter();
      if (prevProvider === undefined) delete process.env.DB_PROVIDER;
      else process.env.DB_PROVIDER = prevProvider;
    }
  });

  test('GET /api/reports/transactions includes SQLite datetime("now") same-day orders', async () => {
    const signupRes = await signupHandler(
      createMockEvent({
        body: {
          email: `sqlite-tx-${Date.now()}@kogane.dev`,
          password: 'StrongPassword1',
          fullName: 'SQLite Tx Tester',
        },
      }),
    );
    const token = signupRes.session!.token;
    const userId = signupRes.session!.userId;
    const bizId = `biz_sq_${Date.now()}`;
    const schemaName = `biz_sq_schema_${Date.now()}`;

    await db.insert('businesses', {
      id: bizId,
      admin_user_id: userId,
      name: 'Kogane SQLite Diner',
      schema_name: schemaName,
    });
    await ensureStarterBusinessTable(schemaName, 'orders');

    // Insert same-day order using SQLite space-separated datetime('now') format
    await db.execute(
      `INSERT INTO ${schemaName}_orders (id, items, total, status, created_at) VALUES ('ord-sqlite-today', 'Ramen x1', 185.5, 'fulfilled', '2026-11-12 09:15:00')`,
    );

    const res = await transactionsReportHandler(
      createMockEvent({
        method: 'GET',
        url: '/api/reports/transactions?from=2026-11-12&to=2026-11-12&group=day',
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(res.error).toBeNull();
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]).toEqual({
      period: '2026-11-12',
      revenue: 185.5,
      transactions: 1,
      average_order_value: 185.5,
    });
  });
});
