import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { normalizeDateRange } from '~/server/utils/reporting';
import {
  calculateSalesMetrics,
  fetchBusinessOrders,
} from '~/server/utils/salesMetrics';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return { error: 'Business not found', summary: null, trends: [], topItems: [], forecasts: null };
  }

  const query = getQuery(event) as { from?: string; to?: string };
  const range = normalizeDateRange(query.from, query.to);

  const { orders, error } = await fetchBusinessOrders(
    businessResult.data.schema_name,
    range.from,
    range.to,
  );

  if (error) {
    return { error, summary: null, trends: [], topItems: [], forecasts: null };
  }

  const report = calculateSalesMetrics(orders, range.from, range.to);

  return {
    error: null,
    summary: report.summary,
    trends: report.trends,
    topItems: report.topItems,
    forecasts: report.forecasts,
    ordersCount: orders.length,
  };
});
