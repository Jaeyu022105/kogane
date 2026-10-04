import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdminUser, qualifyBusinessTable, replacePlaceholdersForDialect, sqlPlaceholder } from '~/server/utils/business';
import { getBusinessTableColumns } from '~/server/utils/businessTable';
import { inDateRange, normalizeDateRange, toDateBucket, type ReportGrouping } from '~/server/utils/reporting';

const REVENUE_COLUMNS = ['total', 'amount', 'grand_total', 'subtotal'];
const DATE_COLUMNS = ['created_at', 'transaction_date', 'date'];

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const businessResult = await getBusinessForAdminUser(userId);
  if (!businessResult.data) {
    return { rows: [], error: 'Business not found' };
  }

  const query = getQuery(event) as { from?: string; to?: string; group?: ReportGrouping };
  const grouping = (query.group ?? 'day') as ReportGrouping;
  const range = normalizeDateRange(query.from, query.to);

  const candidateTables = ['transactions', 'orders', 'invoices'];
  let chosenTable: string | null = null;
  let revenueColumn: string | undefined;
  let dateColumn: string | undefined;

  for (const t of candidateTables) {
    const columnsResult = await getBusinessTableColumns(businessResult.data.schema_name, t);
    const columns = columnsResult.data ?? [];
    const revMatch = REVENUE_COLUMNS.find((name) => columns.some((column) => column.name === name));
    const dateMatch = DATE_COLUMNS.find((name) => columns.some((column) => column.name === name));
    if (revMatch && dateMatch) {
      chosenTable = t;
      revenueColumn = revMatch;
      dateColumn = dateMatch;
      break;
    }
  }

  if (!chosenTable || !revenueColumn || !dateColumn) {
    return {
      rows: [],
      error: null,
      meta: {
        missing: {
          revenueColumn,
          dateColumn,
        },
      },
    };
  }

  const table = qualifyBusinessTable(businessResult.data.schema_name, chosenTable);
  const params: unknown[] = [range.from.toISOString(), range.to.toISOString()];
  const sql = replacePlaceholdersForDialect(
    `SELECT "${dateColumn}" as report_date, "${revenueColumn}" as revenue FROM ${table} WHERE "${dateColumn}" >= ${sqlPlaceholder(1)} AND "${dateColumn}" <= ${sqlPlaceholder(2)} ORDER BY "${dateColumn}" ASC`,
  );
  const result = await db.query<{ report_date: string; revenue: number | string | null }>(sql, params);

  const grouped = new Map<string, { revenue: number; transactions: number }>();
  for (const row of result.data ?? []) {
    if (!inDateRange(row.report_date, range.from, range.to)) continue;
    const bucket = toDateBucket(row.report_date, grouping);
    const current = grouped.get(bucket) ?? { revenue: 0, transactions: 0 };
    current.revenue += Number(row.revenue ?? 0);
    current.transactions += 1;
    grouped.set(bucket, current);
  }

  const rows = Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, value]) => ({
      period,
      revenue: Number(value.revenue.toFixed(2)),
      transactions: value.transactions,
      average_order_value: value.transactions > 0
        ? Number((value.revenue / value.transactions).toFixed(2))
        : 0,
    }));

  return { rows, error: result.error ?? null };
});
