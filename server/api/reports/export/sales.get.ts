import { createError, defineEventHandler, getQuery, setHeader } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { normalizeDateRange } from '~/server/utils/reporting';
import {
  buildSalesMetricsWorkbook,
  calculateSalesMetrics,
  fetchBusinessOrders,
} from '~/server/utils/salesMetrics';
import {
  generateCsv,
  generateMultiSheetCsv,
  generateSpreadsheetXml,
  generateXlsx,
} from '~/server/utils/spreadsheet';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' });
  }

  const query = getQuery(event) as { from?: string; to?: string; format?: string };
  const range = normalizeDateRange(query.from, query.to);
  const format = (query.format?.toLowerCase() ?? 'xlsx') as 'xlsx' | 'xls' | 'csv';

  const { orders, error } = await fetchBusinessOrders(
    businessResult.data.schema_name,
    range.from,
    range.to,
  );

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to load orders: ${error}` });
  }

  const report = calculateSalesMetrics(orders, range.from, range.to);
  const workbook = buildSalesMetricsWorkbook(report, businessResult.data.name, range, {
    currencySymbol: businessResult.data.currency_symbol || '$',
    currencyCode: businessResult.data.currency || 'USD',
  });

  const fromStr = range.from.toISOString().slice(0, 10);
  const toStr = range.to.toISOString().slice(0, 10);
  const baseName = `sales-performance-${fromStr}-to-${toStr}`;

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
