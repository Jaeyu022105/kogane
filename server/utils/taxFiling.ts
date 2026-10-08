/**
 * Tax Filing & Compliance Engine for Kogane.
 * Generates specialized tax reports for accounting, schedule C / VAT returns,
 * and 1099-K payment settlement reconciliation.
 */

import { inDateRange, toDateBucket } from '~/server/utils/reporting';
import {
  parseOrderLineItems,
  type LineItemParsed,
  type RawOrderRecord,
} from '~/server/utils/salesMetrics';
import type { SpreadsheetWorkbook } from '~/server/utils/spreadsheet';

export interface TaxLineItemAudit {
  timestamp: string;
  receiptNumber: string;
  orderId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  exemptAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  paymentMethod: string;
  paymentReference: string | null;
}

export interface PaymentMethodTaxReconciliation {
  paymentMethod: string;
  transactionCount: number;
  grossSales: number;
  exemptSales: number;
  taxableSales: number;
  taxCollected: number;
  percentageOfGross: number;
}

export interface DailyTaxLedgerRow {
  date: string;
  transactionCount: number;
  grossSales: number;
  exemptSales: number;
  taxableSales: number;
  taxCollected: number;
  cashSales: number;
  cardSales: number;
  otherSales: number;
}

export interface TaxFilingReport {
  summary: {
    businessName: string;
    dateFrom: string;
    dateTo: string;
    configuredTaxRate: number;
    effectiveTaxRate: number;
    totalTransactions: number;
    grossSales: number;
    exemptSales: number;
    taxableSales: number;
    taxCollected: number;
    netSales: number; // Gross - Tax Collected
  };
  paymentReconciliation: PaymentMethodTaxReconciliation[];
  dailyLedger: DailyTaxLedgerRow[];
  lineItems: TaxLineItemAudit[];
}

export interface TaxCalculationOptions {
  taxRate?: number; // e.g. 0.10 for 10%
  taxInclusive?: boolean; // default true for POS (price includes tax)
}

/**
 * Calculates complete business tax filing reports from order records.
 */
export function calculateTaxFilingReport(
  orders: RawOrderRecord[],
  businessName: string,
  from: Date,
  to: Date,
  options?: TaxCalculationOptions,
): TaxFilingReport {
  const taxRate = options?.taxRate != null && !Number.isNaN(options.taxRate)
    ? Math.max(0, options.taxRate)
    : 0.10; // 10% standard default
  const taxInclusive = options?.taxInclusive !== false; // default true

  let totalGross = 0;
  let totalExempt = 0;
  let totalTaxable = 0;
  let totalTax = 0;

  const lineItemsAudit: TaxLineItemAudit[] = [];
  const dailyLedgerMap = new Map<string, {
    transactionCount: number;
    grossSales: number;
    exemptSales: number;
    taxableSales: number;
    taxCollected: number;
    cashSales: number;
    cardSales: number;
    otherSales: number;
  }>();

  const paymentMethodMap = new Map<string, {
    transactionCount: number;
    grossSales: number;
    exemptSales: number;
    taxableSales: number;
    taxCollected: number;
  }>();

  for (const order of orders) {
    const orderTotal = Number(order.total) || 0;
    const dateBucket = toDateBucket(order.created_at, 'day');
    const paymentMethod = (order.payment_method || 'cash').trim().toLowerCase();
    const receiptNum = order.receipt_number || order.id;

    const parsedLines = parseOrderLineItems(order);

    let orderExemptGross = 0;
    let orderTaxableGross = 0;

    for (const line of parsedLines) {
      const lineGross = line.subtotal > 0 ? line.subtotal : line.price * line.qty;
      const isExempt = line.taxable === false;

      let lineTaxable = 0;
      let lineTax = 0;
      let lineExempt = 0;

      if (isExempt) {
        lineExempt = lineGross;
        orderExemptGross += lineGross;
      } else {
        if (taxInclusive) {
          lineTaxable = lineGross / (1 + taxRate);
          lineTax = lineGross - lineTaxable;
        } else {
          lineTaxable = lineGross;
          lineTax = lineGross * taxRate;
        }
        orderTaxableGross += lineGross;
      }

      lineItemsAudit.push({
        timestamp: order.created_at,
        receiptNumber: receiptNum,
        orderId: order.id,
        itemName: line.name,
        quantity: line.qty,
        unitPrice: Number(line.price.toFixed(2)),
        grossAmount: Number(lineGross.toFixed(2)),
        exemptAmount: Number(lineExempt.toFixed(2)),
        taxableAmount: Number(lineTaxable.toFixed(2)),
        taxRate: Number((taxRate * 100).toFixed(2)),
        taxAmount: Number(lineTax.toFixed(2)),
        paymentMethod: order.payment_method || 'cash',
        paymentReference: order.payment_reference ?? null,
      });
    }

    // Order level aggregates
    const orderExempt = orderExemptGross;
    const orderTaxableBase = taxInclusive
      ? (orderTotal - orderExempt) / (1 + taxRate)
      : (orderTotal - orderExempt);
    const orderTaxAmount = taxInclusive
      ? (orderTotal - orderExempt) - orderTaxableBase
      : orderTaxableBase * taxRate;
    const orderGross = taxInclusive
      ? orderTotal
      : orderTotal + orderTaxAmount;

    totalGross += orderGross;
    totalExempt += orderExempt;
    totalTaxable += orderTaxableBase;
    totalTax += orderTaxAmount;

    // Daily Ledger update
    const curDaily = dailyLedgerMap.get(dateBucket) ?? {
      transactionCount: 0,
      grossSales: 0,
      exemptSales: 0,
      taxableSales: 0,
      taxCollected: 0,
      cashSales: 0,
      cardSales: 0,
      otherSales: 0,
    };
    curDaily.transactionCount += 1;
    curDaily.grossSales += orderGross;
    curDaily.exemptSales += orderExempt;
    curDaily.taxableSales += orderTaxableBase;
    curDaily.taxCollected += orderTaxAmount;

    if (paymentMethod === 'cash') {
      curDaily.cashSales += orderGross;
    } else if (paymentMethod === 'card' || paymentMethod.includes('card') || paymentMethod === 'stripe') {
      curDaily.cardSales += orderGross;
    } else {
      curDaily.otherSales += orderGross;
    }
    dailyLedgerMap.set(dateBucket, curDaily);

    // Payment Method Reconciliation update
    const curPay = paymentMethodMap.get(paymentMethod) ?? {
      transactionCount: 0,
      grossSales: 0,
      exemptSales: 0,
      taxableSales: 0,
      taxCollected: 0,
    };
    curPay.transactionCount += 1;
    curPay.grossSales += orderGross;
    curPay.exemptSales += orderExempt;
    curPay.taxableSales += orderTaxableBase;
    curPay.taxCollected += orderTaxAmount;
    paymentMethodMap.set(paymentMethod, curPay);
  }

  // Sorted daily ledger
  const sortedDates = Array.from(dailyLedgerMap.keys()).sort();
  const dailyLedger: DailyTaxLedgerRow[] = sortedDates.map((date) => {
    const d = dailyLedgerMap.get(date)!;
    return {
      date,
      transactionCount: d.transactionCount,
      grossSales: Number(d.grossSales.toFixed(2)),
      exemptSales: Number(d.exemptSales.toFixed(2)),
      taxableSales: Number(d.taxableSales.toFixed(2)),
      taxCollected: Number(d.taxCollected.toFixed(2)),
      cashSales: Number(d.cashSales.toFixed(2)),
      cardSales: Number(d.cardSales.toFixed(2)),
      otherSales: Number(d.otherSales.toFixed(2)),
    };
  });

  // Payment reconciliation
  const paymentReconciliation: PaymentMethodTaxReconciliation[] = Array.from(
    paymentMethodMap.entries(),
  ).map(([pm, data]) => ({
    paymentMethod: pm.charAt(0).toUpperCase() + pm.slice(1),
    transactionCount: data.transactionCount,
    grossSales: Number(data.grossSales.toFixed(2)),
    exemptSales: Number(data.exemptSales.toFixed(2)),
    taxableSales: Number(data.taxableSales.toFixed(2)),
    taxCollected: Number(data.taxCollected.toFixed(2)),
    percentageOfGross: totalGross > 0 ? Number(((data.grossSales / totalGross) * 100).toFixed(1)) : 0,
  }));

  const netSales = Math.max(0, totalGross - totalTax);
  const effectiveTaxRate = totalTaxable > 0 ? (totalTax / totalTaxable) * 100 : taxRate * 100;

  return {
    summary: {
      businessName,
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
      configuredTaxRate: Number((taxRate * 100).toFixed(2)),
      effectiveTaxRate: Number(effectiveTaxRate.toFixed(2)),
      totalTransactions: orders.length,
      grossSales: Number(totalGross.toFixed(2)),
      exemptSales: Number(totalExempt.toFixed(2)),
      taxableSales: Number(totalTaxable.toFixed(2)),
      taxCollected: Number(totalTax.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
    },
    paymentReconciliation,
    dailyLedger,
    lineItems: lineItemsAudit,
  };
}

/**
 * Builds a multi-sheet spreadsheet workbook specifically formatted for Tax Filing & Audit.
 */
export function buildTaxFilingWorkbook(
  report: TaxFilingReport,
  businessName: string,
  range: { from: Date; to: Date },
  options?: { currencySymbol?: string; currencyCode?: string },
): SpreadsheetWorkbook {
  const fromStr = range.from.toISOString().slice(0, 10);
  const toStr = range.to.toISOString().slice(0, 10);
  const currencySymbol = options?.currencySymbol || '$';
  const currencyCode = options?.currencyCode || 'USD';

  // ── Sheet 1: Tax Filing Summary ───────────────────────────────────────────────
  const summaryRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [{ value: `${businessName} — Business Tax Filing Report`, format: 'title' }, { value: null }],
    [{ value: `Tax Reporting Period: ${fromStr} to ${toStr}`, format: 'subtitle' }, { value: null }],
    [{ value: null }, { value: null }],
    [{ value: 'TAX RETURN SCHEDULE', format: 'header' }, { value: `AMOUNT (${currencySymbol})`, format: 'header' }],
    [{ value: '1. Gross Sales / Total Receipts', bold: true }, { value: report.summary.grossSales, format: 'currency' }],
    [{ value: '2. Non-Taxable / Exempt Sales', bold: true }, { value: report.summary.exemptSales, format: 'currency' }],
    [{ value: '3. Net Taxable Sales Base', bold: true }, { value: report.summary.taxableSales, format: 'currency' }],
    [{ value: '4. Applicable Sales / VAT Tax Rate', bold: true }, { value: report.summary.configuredTaxRate / 100, format: 'percent' }],
    [{ value: '5. Total Sales Tax / VAT Collected', bold: true }, { value: report.summary.taxCollected, format: 'total' }],
    [{ value: '6. Net Sales (Gross Receipts less Tax Collected)', bold: true }, { value: report.summary.netSales, format: 'currency' }],
    [{ value: '7. Total Recorded Transactions', bold: true }, { value: report.summary.totalTransactions, format: 'integer' }],
    [{ value: null }, { value: null }],
    [{ value: 'SETTLEMENT RECONCILIATION (1099-K / BANKING AUDIT)', format: 'header' }, { value: 'GROSS AMOUNT', format: 'header' }],
  ];

  for (const p of report.paymentReconciliation) {
    summaryRows.push([
      { value: `${p.paymentMethod} Receipts (${p.transactionCount} transactions, ${p.percentageOfGross}%)`, bold: true },
      { value: p.grossSales, format: 'currency' },
    ]);
  }

  // ── Sheet 2: Periodic Tax Ledger ─────────────────────────────────────────────
  const ledgerRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [
      { value: 'Date', format: 'header' },
      { value: 'Transactions', format: 'header' },
      { value: `Gross Sales (${currencySymbol})`, format: 'header' },
      { value: `Exempt Sales (${currencySymbol})`, format: 'header' },
      { value: `Taxable Sales (${currencySymbol})`, format: 'header' },
      { value: `Tax Collected (${currencySymbol})`, format: 'header' },
      { value: `Cash Gross (${currencySymbol})`, format: 'header' },
      { value: `Card Gross (${currencySymbol})`, format: 'header' },
      { value: `Other Gross (${currencySymbol})`, format: 'header' },
    ],
  ];

  for (const d of report.dailyLedger) {
    ledgerRows.push([
      { value: d.date, format: 'string' },
      { value: d.transactionCount, format: 'integer' },
      { value: d.grossSales, format: 'currency' },
      { value: d.exemptSales, format: 'currency' },
      { value: d.taxableSales, format: 'currency' },
      { value: d.taxCollected, format: 'currency' },
      { value: d.cashSales, format: 'currency' },
      { value: d.cardSales, format: 'currency' },
      { value: d.otherSales, format: 'currency' },
    ]);
  }

  if (report.dailyLedger.length > 0) {
    const endRow = report.dailyLedger.length + 1;
    const totalCash = report.dailyLedger.reduce((sum, d) => sum + d.cashSales, 0);
    const totalCard = report.dailyLedger.reduce((sum, d) => sum + d.cardSales, 0);
    const totalOther = report.dailyLedger.reduce((sum, d) => sum + d.otherSales, 0);

    ledgerRows.push([
      { value: 'Total', bold: true },
      { value: report.summary.totalTransactions, format: 'integer', formula: `SUM(B2:B${endRow})` },
      { value: report.summary.grossSales, format: 'total', formula: `SUM(C2:C${endRow})` },
      { value: report.summary.exemptSales, format: 'currency', formula: `SUM(D2:D${endRow})` },
      { value: report.summary.taxableSales, format: 'currency', formula: `SUM(E2:E${endRow})` },
      { value: report.summary.taxCollected, format: 'total', formula: `SUM(F2:F${endRow})` },
      { value: Number(totalCash.toFixed(2)), format: 'currency', formula: `SUM(G2:G${endRow})` },
      { value: Number(totalCard.toFixed(2)), format: 'currency', formula: `SUM(H2:H${endRow})` },
      { value: Number(totalOther.toFixed(2)), format: 'currency', formula: `SUM(I2:I${endRow})` },
    ]);
  }

  // ── Sheet 3: Payment Method Audit ────────────────────────────────────────────
  const payRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [
      { value: 'Payment Method', format: 'header' },
      { value: 'Transactions', format: 'header' },
      { value: `Gross Sales (${currencySymbol})`, format: 'header' },
      { value: `Exempt Sales (${currencySymbol})`, format: 'header' },
      { value: `Taxable Sales (${currencySymbol})`, format: 'header' },
      { value: `Tax Collected (${currencySymbol})`, format: 'header' },
      { value: 'Share of Sales (%)', format: 'header' },
    ],
  ];

  for (const p of report.paymentReconciliation) {
    payRows.push([
      { value: p.paymentMethod, format: 'string' },
      { value: p.transactionCount, format: 'integer' },
      { value: p.grossSales, format: 'currency' },
      { value: p.exemptSales, format: 'currency' },
      { value: p.taxableSales, format: 'currency' },
      { value: p.taxCollected, format: 'currency' },
      { value: p.percentageOfGross / 100, format: 'percent' },
    ]);
  }

  // ── Sheet 4: Line Item Tax Detail ────────────────────────────────────────────
  const lineRows: SpreadsheetWorkbook['sheets'][0]['rows'] = [
    [
      { value: 'Timestamp', format: 'header' },
      { value: 'Receipt / Order ID', format: 'header' },
      { value: 'Item Description', format: 'header' },
      { value: 'Quantity', format: 'header' },
      { value: `Unit Price (${currencySymbol})`, format: 'header' },
      { value: `Gross Total (${currencySymbol})`, format: 'header' },
      { value: `Taxable Amount (${currencySymbol})`, format: 'header' },
      { value: 'Tax Rate (%)', format: 'header' },
      { value: `Tax Amount (${currencySymbol})`, format: 'header' },
      { value: 'Payment Method', format: 'header' },
      { value: 'Payment Reference', format: 'header' },
    ],
  ];

  for (const l of report.lineItems) {
    lineRows.push([
      { value: l.timestamp, format: 'string' },
      { value: l.receiptNumber, format: 'string' },
      { value: l.itemName, format: 'string' },
      { value: l.quantity, format: 'integer' },
      { value: l.unitPrice, format: 'currency' },
      { value: l.grossAmount, format: 'currency' },
      { value: l.taxableAmount, format: 'currency' },
      { value: l.taxRate / 100, format: 'percent' },
      { value: l.taxAmount, format: 'currency' },
      { value: l.paymentMethod, format: 'string' },
      { value: l.paymentReference || '—', format: 'string' },
    ]);
  }

  return {
    title: `${businessName} Tax Filing Report`,
    author: 'Kogane',
    createdAt: new Date(),
    currencySymbol,
    currencyCode,
    sheets: [
      {
        name: 'Tax Filing Summary',
        columnWidths: [38, 22],
        rows: summaryRows,
      },
      {
        name: 'Periodic Tax Ledger',
        columnWidths: [16, 14, 18, 16, 18, 18, 16, 16, 16],
        rows: ledgerRows,
      },
      {
        name: 'Payment Method Audit',
        columnWidths: [22, 14, 18, 16, 18, 18, 18],
        rows: payRows,
      },
      {
        name: 'Line Item Tax Audit',
        columnWidths: [22, 20, 28, 10, 14, 16, 16, 12, 14, 16, 20],
        rows: lineRows,
      },
    ],
  };
}
