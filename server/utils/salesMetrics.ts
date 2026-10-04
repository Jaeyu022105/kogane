/**
 * Sales and Performance Metrics Engine.
 * Aggregates transactions, revenue trends, top items, and predictive forecasts
 * (moving averages, run-rates, linear regression demand predictions).
 */

import { db } from '~/lib/db';
import { validateIdentifier } from '~/lib/schemaUtils';
import {
  isDevDb,
  qualifyBusinessTable,
  replacePlaceholdersForDialect,
  sqlPlaceholder,
} from '~/server/utils/business';
import { getBusinessTableColumns } from '~/server/utils/businessTable';
import { inDateRange, toDateBucket, type ReportGrouping } from '~/server/utils/reporting';
import type { SpreadsheetWorkbook } from '~/server/utils/spreadsheet';

export interface RawOrderRecord {
  id: string;
  created_at: string;
  total: number;
  status?: string | null;
  items?: string | null;
  line_items?: string | null;
  table_number?: string | null;
  staff_name?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  receipt_number?: string | null;
}

export interface LineItemParsed {
  id?: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  taxable?: boolean;
}

export interface DailyTrendPoint {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  movingAverage7d?: number;
  movingAverage3d?: number;
}

export interface TopItemMetric {
  name: string;
  unitsSold: number;
  revenue: number;
  averagePrice: number;
  shareOfSales: number;
  dailyVelocity: number;
  projected7DayDemand: number;
  projected30DayDemand: number;
  projected30DayRevenue: number;
}

export interface PredictiveForecasts {
  periodDays: number;
  dailyRunRate: number;
  projected30DayRunRate: number;
  projectedAnnualRunRate: number;
  movingAverage3d: number;
  movingAverage7d: number;
  trendStatus: 'growing' | 'stable' | 'declining';
  dailyTrendSlope: number;
  projectedNext7Days: number;
  projectedNext14Days: number;
  projectedNext30Days: number;
  confidenceLower30d: number;
  confidenceUpper30d: number;
}

export interface SalesMetricsReport {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    activeDays: number;
    dateFrom: string;
    dateTo: string;
  };
  trends: DailyTrendPoint[];
  topItems: TopItemMetric[];
  forecasts: PredictiveForecasts;
  orders: RawOrderRecord[];
}

export function parseOrderLineItems(order: RawOrderRecord): LineItemParsed[] {
  // 1. Try JSON in line_items column
  if (order.line_items) {
    try {
      const parsed = typeof order.line_items === 'string'
        ? JSON.parse(order.line_items)
        : order.line_items;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => {
          const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
          const price = Number(item.price ?? item.unit_price ?? 0) || 0;
          const subtotal = Number(item.subtotal ?? (price * qty)) || (price * qty);
          return {
            id: item.id ? String(item.id) : undefined,
            name: String(item.name ?? item.title ?? 'Item'),
            price,
            qty,
            subtotal,
            taxable: item.taxable !== false,
          };
        });
      }
    } catch {
      // fallback to parsing items text
    }
  }

  // 2. Try parsing items summary string: e.g. "Cheeseburger x2, Fries x1"
  if (order.items && typeof order.items === 'string') {
    const parts = order.items.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const items: LineItemParsed[] = [];
      const totalAmount = Number(order.total) || 0;
      for (const part of parts) {
        const match = part.match(/^(.*?)\s*[xX*]\s*(\d+)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10) || 1;
          items.push({
            name: name || 'Item',
            qty,
            price: 0,
            subtotal: 0,
            taxable: true,
          });
        } else {
          items.push({
            name: part,
            qty: 1,
            price: 0,
            subtotal: 0,
            taxable: true,
          });
        }
      }
      // Distribute total across items if price was unknown
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0) || 1;
      const unitPrice = totalAmount / totalQty;
      return items.map((item) => ({
        ...item,
        price: Number(unitPrice.toFixed(2)),
        subtotal: Number((unitPrice * item.qty).toFixed(2)),
      }));
    }
  }

  // 3. Fallback: single generic line item matching the order total
  const orderTotal = Number(order.total) || 0;
  return [
    {
      name: 'General Sale',
      qty: 1,
      price: orderTotal,
      subtotal: orderTotal,
      taxable: true,
    },
  ];
}

/**
 * Fetch raw sales/orders for a business within a date range with strict tenant isolation.
 */
export async function fetchBusinessOrders(
  schemaName: string,
  from: Date,
  to: Date,
): Promise<{ orders: RawOrderRecord[]; error: string | null }> {
  // Determine table name: prioritize orders, then transactions, then invoices
  const candidateTables = ['orders', 'transactions', 'invoices'];
  let chosenTable: string | null = null;
  let revenueCol = 'total';
  let dateCol = 'created_at';

  for (const table of candidateTables) {
    const colsResult = await getBusinessTableColumns(schemaName, table);
    const cols = (colsResult.data ?? []).map((c) => c.name);
    if (cols.length === 0) continue;

    const revMatch = ['total', 'amount', 'grand_total', 'total_amount', 'subtotal'].find((c) =>
      cols.includes(c),
    );
    const dateMatch = ['created_at', 'transaction_date', 'issue_date', 'date'].find((c) =>
      cols.includes(c),
    );

    if (revMatch && dateMatch) {
      chosenTable = table;
      revenueCol = revMatch;
      dateCol = dateMatch;
      break;
    }
  }

  if (!chosenTable) {
    return { orders: [], error: null };
  }

  const qualified = qualifyBusinessTable(schemaName, chosenTable);
  validateIdentifier(dateCol);
  validateIdentifier(revenueCol);
  const isSqlite = isDevDb;
  const sql = isSqlite
    ? `SELECT * FROM ${qualified} WHERE datetime("${dateCol}") >= datetime(?) AND datetime("${dateCol}") <= datetime(?) ORDER BY "${dateCol}" ASC`
    : replacePlaceholdersForDialect(
        `SELECT * FROM ${qualified} WHERE "${dateCol}" >= ${sqlPlaceholder(1)} AND "${dateCol}" <= ${sqlPlaceholder(2)} ORDER BY "${dateCol}" ASC`,
      );

  const res = await db.query<Record<string, unknown>>(sql, [from.toISOString(), to.toISOString()]);
  if (res.error) {
    return { orders: [], error: res.error };
  }

  const rawOrders: RawOrderRecord[] = (res.data ?? [])
    .filter((row) => inDateRange(row[dateCol] as string, from, to))
    .map((row) => ({
      id: String(row.id ?? ''),
      created_at: String(row[dateCol] ?? ''),
      total: Number(row[revenueCol] ?? 0),
      status: row.status != null ? String(row.status) : null,
      items: row.items != null ? String(row.items) : null,
      line_items: row.line_items != null ? String(row.line_items) : null,
      table_number: row.table_number != null ? String(row.table_number) : null,
      staff_name: row.staff_name != null ? String(row.staff_name) : null,
      payment_method: row.payment_method != null ? String(row.payment_method) : 'cash',
      payment_status: row.payment_status != null ? String(row.payment_status) : 'paid',
      payment_reference: row.payment_reference != null ? String(row.payment_reference) : null,
      receipt_number: row.receipt_number != null ? String(row.receipt_number) : null,
    }));

  return { orders: rawOrders, error: null };
}

/**
 * Calculates complete sales metrics, aggregations, product performance, and predictive forecasts.
 */
export function calculateSalesMetrics(
  orders: RawOrderRecord[],
  from: Date,
  to: Date,
): SalesMetricsReport {
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 1. Group by day across all calendar days in range
  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  const pad = (n: number) => String(n).padStart(2, '0');
  const curDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const endDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  const maxDays = 730;
  let dayCount = 0;
  while (curDay <= endDay && dayCount < maxDays) {
    const bucket = `${curDay.getUTCFullYear()}-${pad(curDay.getUTCMonth() + 1)}-${pad(curDay.getUTCDate())}`;
    dailyMap.set(bucket, { revenue: 0, orders: 0 });
    curDay.setUTCDate(curDay.getUTCDate() + 1);
    dayCount++;
  }

  for (const order of orders) {
    const bucket = toDateBucket(order.created_at, 'day');
    const cur = dailyMap.get(bucket) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(order.total) || 0;
    cur.orders += 1;
    dailyMap.set(bucket, cur);
  }

  const sortedDates = Array.from(dailyMap.keys()).sort();
  const rawTrendPoints: DailyTrendPoint[] = sortedDates.map((date) => {
    const item = dailyMap.get(date)!;
    return {
      date,
      revenue: Number(item.revenue.toFixed(2)),
      orders: item.orders,
      averageOrderValue: item.orders > 0 ? Number((item.revenue / item.orders).toFixed(2)) : 0,
    };
  });

  // Calculate moving averages across daily trend points
  const trends: DailyTrendPoint[] = rawTrendPoints.map((point, index) => {
    // 3-day SMA
    const window3 = rawTrendPoints.slice(Math.max(0, index - 2), index + 1);
    const ma3 = window3.reduce((s, p) => s + p.revenue, 0) / window3.length;

    // 7-day SMA
    const window7 = rawTrendPoints.slice(Math.max(0, index - 6), index + 1);
    const ma7 = window7.reduce((s, p) => s + p.revenue, 0) / window7.length;

    return {
      ...point,
      movingAverage3d: Number(ma3.toFixed(2)),
      movingAverage7d: Number(ma7.toFixed(2)),
    };
  });

  // 2. Active days and Period Days
  const periodDurationMs = Math.max(1, to.getTime() - from.getTime());
  const periodDays = Math.max(1, Math.ceil(periodDurationMs / (1000 * 60 * 60 * 24)));
  const activeDays = sortedDates.filter((d) => dailyMap.get(d)!.orders > 0).length || (orders.length > 0 ? 1 : 0);
  const dailyRunRate = totalRevenue / periodDays;
  const projected30DayRunRate = dailyRunRate * 30;
  const projectedAnnualRunRate = dailyRunRate * 365;

  // 3. Top Products Performance & Velocity
  const itemMap = new Map<string, { unitsSold: number; revenue: number }>();
  for (const order of orders) {
    const lineItems = parseOrderLineItems(order);
    for (const line of lineItems) {
      const cur = itemMap.get(line.name) ?? { unitsSold: 0, revenue: 0 };
      cur.unitsSold += line.qty;
      cur.revenue += line.subtotal > 0 ? line.subtotal : (line.price * line.qty);
      itemMap.set(line.name, cur);
    }
  }

  const topItems: TopItemMetric[] = Array.from(itemMap.entries())
    .map(([name, data]) => {
      const avgPrice = data.unitsSold > 0 ? data.revenue / data.unitsSold : 0;
      const shareOfSales = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
      const dailyVelocity = data.unitsSold / periodDays;
      const projected7DayDemand = Math.round(dailyVelocity * 7);
      const projected30DayDemand = Math.round(dailyVelocity * 30);
      const projected30DayRevenue = projected30DayDemand * avgPrice;

      return {
        name,
        unitsSold: data.unitsSold,
        revenue: Number(data.revenue.toFixed(2)),
        averagePrice: Number(avgPrice.toFixed(2)),
        shareOfSales: Number(shareOfSales.toFixed(1)),
        dailyVelocity: Number(dailyVelocity.toFixed(2)),
        projected7DayDemand,
        projected30DayDemand,
        projected30DayRevenue: Number(projected30DayRevenue.toFixed(2)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // 4. Predictive Forecasting & Linear Regression
  // y = mx + b on daily revenue
  const n = trends.length;
  let slope = 0;
  let intercept = dailyRunRate;

  if (n >= 2) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = trends[i].revenue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator !== 0) {
      slope = (n * sumXY - sumX * sumY) / denominator;
      intercept = (sumY - slope * sumX) / n;
    }
  }

  const trendStatus: 'growing' | 'stable' | 'declining' =
    slope > 5 ? 'growing' : slope < -5 ? 'declining' : 'stable';

  // Project future days
  function projectDays(daysCount: number): number {
    let projectedSum = 0;
    for (let step = 1; step <= daysCount; step++) {
      const x = n + step;
      const pred = Math.max(0, intercept + slope * x);
      projectedSum += pred;
    }
    return Number(projectedSum.toFixed(2));
  }

  const projectedNext7Days = n > 0 ? projectDays(7) : Number((dailyRunRate * 7).toFixed(2));
  const projectedNext14Days = n > 0 ? projectDays(14) : Number((dailyRunRate * 14).toFixed(2));
  const projectedNext30Days = n > 0 ? projectDays(30) : Number((dailyRunRate * 30).toFixed(2));

  // Volatility / Confidence interval (+- 15% or std dev)
  const residuals = trends.map((t, idx) => Math.abs(t.revenue - (intercept + slope * idx)));
  const avgResidual = residuals.length > 0 ? residuals.reduce((s, r) => s + r, 0) / residuals.length : dailyRunRate * 0.15;
  const boundDelta = avgResidual * 30 * 0.5;

  const confidenceLower30d = Math.max(0, Number((projectedNext30Days - boundDelta).toFixed(2)));
  const confidenceUpper30d = Number((projectedNext30Days + boundDelta).toFixed(2));

  const latestTrend = trends[trends.length - 1];
  const movingAverage3d = latestTrend?.movingAverage3d ?? dailyRunRate;
  const movingAverage7d = latestTrend?.movingAverage7d ?? dailyRunRate;

  return {
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      activeDays,
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
    },
    trends,
    topItems,
    forecasts: {
      periodDays,
      dailyRunRate: Number(dailyRunRate.toFixed(2)),
      projected30DayRunRate: Number(projected30DayRunRate.toFixed(2)),
      projectedAnnualRunRate: Number(projectedAnnualRunRate.toFixed(2)),
      movingAverage3d: Number(movingAverage3d.toFixed(2)),
      movingAverage7d: Number(movingAverage7d.toFixed(2)),
      trendStatus,
      dailyTrendSlope: Number(slope.toFixed(2)),
      projectedNext7Days,
      projectedNext14Days,
      projectedNext30Days,
      confidenceLower30d,
      confidenceUpper30d,
    },
    orders,
  };
}

/**
 * Builds a multi-sheet spreadsheet workbook for Sales & Performance Metrics.
 */
export function buildSalesMetricsWorkbook(
  report: SalesMetricsReport,
  businessName: string,
  range: { from: Date; to: Date },
): SpreadsheetWorkbook {
  const fromStr = range.from.toISOString().slice(0, 10);
  const toStr = range.to.toISOString().slice(0, 10);

  // ── Sheet 1: Executive Performance ───────────────────────────────────────────
  const execRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [{ value: `${businessName} — Performance & Forecasting`, format: 'title' }, { value: null }],
    [{ value: `Reporting Period: ${fromStr} to ${toStr} (${report.forecasts.periodDays} days)`, format: 'subtitle' }, { value: null }],
    [{ value: null }, { value: null }],
    [{ value: 'METRIC', format: 'header' }, { value: 'VALUE', format: 'header' }],
    [{ value: 'Total Gross Revenue', bold: true }, { value: report.summary.totalRevenue, format: 'currency' }],
    [{ value: 'Total Transactions / Orders', bold: true }, { value: report.summary.totalOrders, format: 'integer' }],
    [{ value: 'Average Order Value (AOV)', bold: true }, { value: report.summary.averageOrderValue, format: 'currency' }],
    [{ value: 'Active Trading Days', bold: true }, { value: report.summary.activeDays, format: 'integer' }],
    [{ value: 'Current Daily Run-Rate', bold: true }, { value: report.forecasts.dailyRunRate, format: 'currency' }],
    [{ value: '7-Day Moving Average', bold: true }, { value: report.forecasts.movingAverage7d, format: 'currency' }],
    [{ value: '3-Day Moving Average', bold: true }, { value: report.forecasts.movingAverage3d, format: 'currency' }],
    [{ value: 'Sales Trend Trajectory', bold: true }, { value: `${report.forecasts.trendStatus.toUpperCase()} (${report.forecasts.dailyTrendSlope > 0 ? '+' : ''}${report.forecasts.dailyTrendSlope} $/day)` }],
    [{ value: null }, { value: null }],
    [{ value: 'PREDICTIVE FORECASTS', format: 'header' }, { value: 'PROJECTED REVENUE', format: 'header' }],
    [{ value: 'Next 7 Days Projected Demand', bold: true }, { value: report.forecasts.projectedNext7Days, format: 'currency' }],
    [{ value: 'Next 14 Days Projected Demand', bold: true }, { value: report.forecasts.projectedNext14Days, format: 'currency' }],
    [{ value: 'Next 30 Days Projected Demand', bold: true }, { value: report.forecasts.projectedNext30Days, format: 'currency' }],
    [{ value: '30-Day Forecast Range (Low Bound)', bold: true }, { value: report.forecasts.confidenceLower30d, format: 'currency' }],
    [{ value: '30-Day Forecast Range (High Bound)', bold: true }, { value: report.forecasts.confidenceUpper30d, format: 'currency' }],
    [{ value: 'Annualized Revenue Run-Rate (365d)', bold: true }, { value: report.forecasts.projectedAnnualRunRate, format: 'currency' }],
  ];

  // ── Sheet 2: Revenue Trends (Daily Ledger) ────────────────────────────────────
  const trendRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [
      { value: 'Date', format: 'header' },
      { value: 'Revenue', format: 'header' },
      { value: 'Orders', format: 'header' },
      { value: 'Average Order Value', format: 'header' },
      { value: '7-Day Moving Avg', format: 'header' },
    ],
  ];

  for (const t of report.trends) {
    trendRows.push([
      { value: t.date, format: 'string' },
      { value: t.revenue, format: 'currency' },
      { value: t.orders, format: 'integer' },
      { value: t.averageOrderValue, format: 'currency' },
      { value: t.movingAverage7d ?? t.revenue, format: 'currency' },
    ]);
  }

  if (report.trends.length > 0) {
    const endRow = report.trends.length + 1;
    trendRows.push([
      { value: 'Total / Average', bold: true },
      { value: report.summary.totalRevenue, format: 'total', formula: `SUM(B2:B${endRow})` },
      { value: report.summary.totalOrders, format: 'integer', formula: `SUM(C2:C${endRow})` },
      { value: report.summary.averageOrderValue, format: 'currency', formula: `AVERAGE(D2:D${endRow})` },
      { value: null },
    ]);
  }

  // ── Sheet 3: Product Demand Forecast & Top Items ──────────────────────────────
  const itemRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [
      { value: 'Product Name', format: 'header' },
      { value: 'Units Sold', format: 'header' },
      { value: 'Total Sales ($)', format: 'header' },
      { value: 'Avg Unit Price', format: 'header' },
      { value: 'Sales Share (%)', format: 'header' },
      { value: 'Velocity (Units/Day)', format: 'header' },
      { value: 'Next 7d Demand', format: 'header' },
      { value: 'Next 30d Demand', format: 'header' },
      { value: 'Next 30d Forecast ($)', format: 'header' },
    ],
  ];

  for (const item of report.topItems) {
    itemRows.push([
      { value: item.name, format: 'string' },
      { value: item.unitsSold, format: 'integer' },
      { value: item.revenue, format: 'currency' },
      { value: item.averagePrice, format: 'currency' },
      { value: item.shareOfSales / 100, format: 'percent' },
      { value: item.dailyVelocity, format: 'number' },
      { value: item.projected7DayDemand, format: 'integer' },
      { value: item.projected30DayDemand, format: 'integer' },
      { value: item.projected30DayRevenue, format: 'currency' },
    ]);
  }

  // ── Sheet 4: Detailed Transactions ───────────────────────────────────────────
  const orderRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [
      { value: 'Timestamp', format: 'header' },
      { value: 'Receipt / Order ID', format: 'header' },
      { value: 'Items Summary', format: 'header' },
      { value: 'Total ($)', format: 'header' },
      { value: 'Payment Method', format: 'header' },
      { value: 'Payment Status', format: 'header' },
      { value: 'Staff', format: 'header' },
      { value: 'Table / Ref', format: 'header' },
    ],
  ];

  for (const o of report.orders) {
    orderRows.push([
      { value: o.created_at, format: 'string' },
      { value: o.receipt_number || o.id, format: 'string' },
      { value: o.items || 'Order', format: 'string' },
      { value: o.total, format: 'currency' },
      { value: o.payment_method || 'cash', format: 'string' },
      { value: o.payment_status || 'paid', format: 'string' },
      { value: o.staff_name || 'Staff', format: 'string' },
      { value: o.table_number || '—', format: 'string' },
    ]);
  }

  return {
    title: `${businessName} Sales & Metrics`,
    author: 'Kogane',
    createdAt: new Date(),
    sheets: [
      {
        name: 'Executive Performance',
        columnWidths: [32, 22],
        rows: execRows,
      },
      {
        name: 'Revenue Trends',
        columnWidths: [16, 18, 14, 20, 20],
        rows: trendRows,
      },
      {
        name: 'Product Demand Forecast',
        columnWidths: [26, 14, 16, 16, 16, 20, 16, 16, 22],
        rows: itemRows,
      },
      {
        name: 'Detailed Transactions',
        columnWidths: [22, 20, 36, 14, 16, 16, 16, 16],
        rows: orderRows,
      },
    ],
  };
}
