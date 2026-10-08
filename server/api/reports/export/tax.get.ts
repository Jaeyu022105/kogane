import { createError, defineEventHandler, getQuery, setHeader } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { normalizeDateRange } from '~/server/utils/reporting';
import { fetchBusinessOrders } from '~/server/utils/salesMetrics';
import {
  generateCsv,
  generateMultiSheetCsv,
  generateSpreadsheetXml,
  generateXlsx,
} from '~/server/utils/spreadsheet';
import {
  buildTaxFilingWorkbook,
  calculateTaxFilingReport,
} from '~/server/utils/taxFiling';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' });
  }

  const query = getQuery(event) as {
    from?: string;
    to?: string;
    taxRate?: string;
    taxInclusive?: string | boolean;
    format?: string;
  };
  const range = normalizeDateRange(query.from, query.to);
  const format = (query.format?.toLowerCase() ?? 'xlsx') as 'xlsx' | 'xls' | 'csv';

  let taxRate = 0.10;
  if (query.taxRate != null) {
    const rawRate = String(query.taxRate).replace('%', '').trim();
    const parsed = parseFloat(rawRate);
    if (!Number.isNaN(parsed)) {
      taxRate = parsed > 1 ? parsed / 100 : parsed;
    }
  }

  const taxInclusive = query.taxInclusive === 'false' || query.taxInclusive === false ? false : true;

  const { orders, error } = await fetchBusinessOrders(
    businessResult.data.schema_name,
    range.from,
    range.to,
  );

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to load orders: ${error}` });
  }

  const taxReport = calculateTaxFilingReport(
    orders,
    businessResult.data.name,
    range.from,
    range.to,
    { taxRate, taxInclusive },
  );

  const workbook = buildTaxFilingWorkbook(taxReport, businessResult.data.name, range, {
    currencySymbol: businessResult.data.currency_symbol || '$',
    currencyCode: businessResult.data.currency || 'USD',
  });

  const fromStr = range.from.toISOString().slice(0, 10);
  const toStr = range.to.toISOString().slice(0, 10);
  const baseName = `tax-filing-report-${fromStr}-to-${toStr}`;

  if (format === 'csv') {
    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${baseName}.csv"`);
    return generateMultiSheetCsv(workbook);
  }

  if (format === 'xls') {
    setHeader(event, 'Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${baseName}.xls"`);
    return generateSpreadsheetXml(workbook);
  }

  // Default: OpenXML .xlsx
  setHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  setHeader(event, 'Content-Disposition', `attachment; filename="${baseName}.xlsx"`);
  return Buffer.from(generateXlsx(workbook));
});
