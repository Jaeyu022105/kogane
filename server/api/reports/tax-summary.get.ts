import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { normalizeDateRange } from '~/server/utils/reporting';
import { fetchBusinessOrders } from '~/server/utils/salesMetrics';
import { calculateTaxFilingReport } from '~/server/utils/taxFiling';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return {
      error: 'Business not found',
      summary: null,
      paymentReconciliation: [],
      dailyLedger: [],
      lineItems: [],
    };
  }

  const query = getQuery(event) as { from?: string; to?: string; taxRate?: string; taxInclusive?: string | boolean };
  const range = normalizeDateRange(query.from, query.to);

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
    return {
      error,
      summary: null,
      paymentReconciliation: [],
      dailyLedger: [],
      lineItems: [],
    };
  }

  const taxReport = calculateTaxFilingReport(
    orders,
    businessResult.data.name,
    range.from,
    range.to,
    { taxRate, taxInclusive },
  );

  return {
    error: null,
    summary: taxReport.summary,
    paymentReconciliation: taxReport.paymentReconciliation,
    dailyLedger: taxReport.dailyLedger,
    lineItems: taxReport.lineItems.slice(0, 500), // Limit line item array in UI view for fast rendering
    totalLineItemsCount: taxReport.lineItems.length,
  };
});
