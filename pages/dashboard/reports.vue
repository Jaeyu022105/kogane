<script setup lang="ts">
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Play,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
} from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { isEnterprise } = useEnterpriseAccess();

type TabKey = 'transactions' | 'performance' | 'tax' | 'table-activity' | 'inpoint-activity';

const activeTab = ref<TabKey>('transactions');
const from = ref(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));
const group = ref<'day' | 'week' | 'month'>('day');
const taxRatePercent = ref('10');
const taxInclusive = ref(true);
const loading = ref(false);
const exporting = ref(false);
const rows = ref<Record<string, unknown>[]>([]);
const customColumns = ref<string[]>([]);
const errorMessage = ref('');

// Performance & Prediction state
const performanceData = ref<{
  summary: any;
  trends: any[];
  topItems: any[];
  forecasts: any;
} | null>(null);

// Tax filing state
const taxData = ref<{
  summary: any;
  paymentReconciliation: any[];
  dailyLedger: any[];
  lineItems: any[];
  totalLineItemsCount?: number;
} | null>(null);

const REPORT_COLUMN_LABELS: Record<string, string> = {
  period: 'Period',
  revenue: 'Revenue',
  transactions: 'Transactions',
  average_order_value: 'Average order value',
  table: 'Area',
  inserts: 'Added',
  updates: 'Updated',
  deletes: 'Removed',
  total: 'Total',
  actor_name: 'Team member',
  actor_type: 'Workspace',
  role: 'Role',
  actions: 'Activities',
};

const AREA_LABELS: Record<string, string> = {
  products: 'Catalog',
  orders: 'Orders',
  inventory: 'Inventory',
  transactions: 'Sales',
  appointments: 'Appointments',
  customers: 'Customers',
  terminals: 'Staff workspaces',
  audit_log: 'Activity',
};

const { format: formatCurrency, symbol: currencySymbol } = useCurrency();


function formatPercent(val: unknown): string {
  const num = Number(val) || 0;
  return `${num.toFixed(1)}%`;
}

function reportColumnLabel(column: string) {
  return REPORT_COLUMN_LABELS[column]
    ?? column.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportAreaLabel(value: unknown) {
  const area = String(value ?? '').trim();
  if (!area) return '—';
  return AREA_LABELS[area.toLowerCase()] ?? 'Workspace records';
}

function reportCellValue(value: unknown, column: string) {
  if (value == null || value === '') return '—';
  if (column === 'table') return reportAreaLabel(value);
  if (column === 'actor_type') {
    const actor = String(value).toLowerCase();
    return actor === 'inpoint' ? 'Staff terminal' : actor === 'admin' ? 'Owner workspace' : 'Workspace';
  }
  if (column === 'revenue' || column === 'average_order_value') {
    return formatCurrency(value);
  }
  return String(value);
}

const TABS = computed(() => [
  { key: 'transactions', label: 'Sales Transactions' },
  { key: 'performance', label: 'Performance & Forecasts' },
  { key: 'tax', label: 'Tax Filing Schedule' },
  { key: 'table-activity', label: 'Workspace Activity' },
  { key: 'inpoint-activity', label: 'Staff Activity' },
]);

const activeTabLabel = computed(() =>
  TABS.value.find((tab) => tab.key === activeTab.value)?.label ?? 'Report',
);

async function loadReport() {
  loading.value = true;
  errorMessage.value = '';
  try {
    if (!TABS.value.some((tab) => tab.key === activeTab.value)) {
      activeTab.value = 'transactions';
    }

    if (activeTab.value === 'performance') {
      const res = await $fetch<any>('/api/reports/sales-metrics', {
        headers: authHeaders(),
        query: { from: from.value, to: to.value },
      });
      if (res.error) {
        errorMessage.value = res.error;
      } else {
        performanceData.value = res;
      }
      return;
    }

    if (activeTab.value === 'tax') {
      const res = await $fetch<any>('/api/reports/tax-summary', {
        headers: authHeaders(),
        query: {
          from: from.value,
          to: to.value,
          taxRate: (Number(taxRatePercent.value) || 10) / 100,
          taxInclusive: taxInclusive.value,
        },
      });
      if (res.error) {
        errorMessage.value = res.error;
      } else {
        taxData.value = res;
      }
      return;
    }

    const endpoint = activeTab.value === 'transactions'
      ? '/api/reports/transactions'
      : activeTab.value === 'table-activity'
        ? '/api/reports/table-activity'
        : '/api/reports/inpoint-activity';

    const res = await $fetch<{ rows: Record<string, unknown>[]; error: string | null }>(endpoint, {
      headers: authHeaders(),
      query: { from: from.value, to: to.value, group: group.value },
    });
    rows.value = res.rows ?? [];
    customColumns.value = rows.value.length > 0 ? Object.keys(rows.value[0]) : [];
    errorMessage.value = res.error ? 'Some results could not be refreshed. Please try again.' : '';
  } catch {
    rows.value = [];
    customColumns.value = [];
    errorMessage.value = 'We could not load this report right now. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function triggerDownload(endpoint: string, filename: string) {
  if (!import.meta.client) return;
  exporting.value = true;
  try {
    const blob = await $fetch<Blob>(endpoint, {
      headers: authHeaders(),
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch {
    errorMessage.value = 'Failed to generate spreadsheet file. Please try again.';
  } finally {
    exporting.value = false;
  }
}

function exportSalesExcel(format: 'xlsx' | 'xls' = 'xlsx') {
  const url = `/api/reports/export/sales?from=${from.value}&to=${to.value}&format=${format}`;
  triggerDownload(url, `sales-performance-${from.value}-to-${to.value}.${format}`);
}

function exportTaxExcel(format: 'xlsx' | 'xls' = 'xlsx') {
  const rate = (Number(taxRatePercent.value) || 10) / 100;
  const url = `/api/reports/export/tax?from=${from.value}&to=${to.value}&taxRate=${rate}&taxInclusive=${taxInclusive.value}&format=${format}`;
  triggerDownload(url, `tax-filing-${from.value}-to-${to.value}.${format}`);
}

function exportCsv() {
  if (activeTab.value === 'performance') {
    const url = `/api/reports/export/sales?from=${from.value}&to=${to.value}&format=csv`;
    triggerDownload(url, `sales-performance-${from.value}-to-${to.value}.csv`);
    return;
  }

  if (activeTab.value === 'tax') {
    const rate = (Number(taxRatePercent.value) || 10) / 100;
    const url = `/api/reports/export/tax?from=${from.value}&to=${to.value}&taxRate=${rate}&taxInclusive=${taxInclusive.value}&format=csv`;
    triggerDownload(url, `tax-filing-${from.value}-to-${to.value}.csv`);
    return;
  }

  if (rows.value.length === 0 || !import.meta.client) return;
  const columns = customColumns.value.length > 0 ? customColumns.value : Object.keys(rows.value[0]);
  const lines = [
    columns.map(reportColumnLabel).map((column) => JSON.stringify(column)).join(','),
    ...rows.value.map((row) =>
      columns.map((col) => JSON.stringify(reportCellValue(row[col], col))).join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${activeTab.value}-report.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

onMounted(loadReport);
watch([activeTab, group, taxInclusive], loadReport);
</script>

<template>
  <div class="dashboard-readable flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8 flex flex-wrap items-end justify-between gap-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <BarChart3 class="w-4 h-4" style="color: rgba(61,24,32,0.35);" />
          <p class="text-[10px] font-mono uppercase tracking-[0.18em]" style="color: rgba(61,24,32,0.35);">Reports & Analytics</p>
        </div>
        <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Business intelligence & compliance</h1>
        <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">Review performance, predictive forecasts, and exportable tax filing sheets</p>
      </div>

      <!-- Export Action Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] btn-secondary shadow-sm"
          :disabled="exporting"
          @click="exportSalesExcel"
        >
          <FileSpreadsheet class="w-3.5 h-3.5 text-emerald-600" />
          <span>Export Sales & Forecasts (.xlsx)</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] btn-secondary shadow-sm"
          :disabled="exporting"
          @click="exportTaxExcel"
        >
          <Receipt class="w-3.5 h-3.5 text-amber-600" />
          <span>Export Tax Filing (.xlsx)</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] btn-ghost"
          :disabled="exporting"
          @click="exportCsv"
        >
          <Download class="w-3.5 h-3.5" />
          <span>CSV</span>
        </button>
      </div>
    </div>

    <div class="px-10 py-7 space-y-6">

      <!-- ── Tab row ────────────────────────────────────────────── -->
      <div class="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Report views" style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0;">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 relative"
          :style="activeTab === tab.key
            ? 'color: rgb(var(--shell-sidebar));'
            : 'color: rgba(61,24,32,0.4);'"
          @click="activeTab = tab.key as any"
        >
          {{ tab.label }}
          <span
            v-if="activeTab === tab.key"
            class="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
            style="background: rgb(var(--shell-sidebar));"
          />
        </button>
      </div>

      <!-- ── Controls ───────────────────────────────────────────── -->
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="report-from" class="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">From</label>
          <input id="report-from" v-model="from" type="date" class="input-warm px-3 py-2 text-xs" />
        </div>
        <div>
          <label for="report-to" class="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">To</label>
          <input id="report-to" v-model="to" type="date" class="input-warm px-3 py-2 text-xs" />
        </div>

        <div v-if="activeTab === 'transactions'">
          <label for="report-group" class="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Group by</label>
          <select id="report-group" v-model="group" class="input-warm px-3 py-2 text-xs">
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        </div>

        <div v-if="activeTab === 'tax'">
          <label for="report-tax-rate" class="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Tax Rate (%)</label>
          <div class="relative flex items-center">
            <input
              id="report-tax-rate"
              v-model="taxRatePercent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              class="input-warm px-3 py-2 text-xs w-24 pr-6"
            />
            <span class="absolute right-2 text-xs font-mono text-stone-400">%</span>
          </div>
        </div>

        <div v-if="activeTab === 'tax'">
          <label for="report-tax-model" class="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Pricing Model</label>
          <select id="report-tax-model" v-model="taxInclusive" class="input-warm px-3 py-2 text-xs">
            <option :value="true">Tax Inclusive (VAT / GST)</option>
            <option :value="false">Tax Exclusive (Added at register)</option>
          </select>
        </div>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon mb-0.5"
          @click="loadReport"
        >
          <Play class="w-3.5 h-3.5" /> Run
        </button>
      </div>

      <p v-if="errorMessage" class="text-xs font-mono" style="color: #a16207;" role="status">
        {{ errorMessage }}
      </p>

      <!-- ── TAB 1: PERFORMANCE & FORECASTS ─────────────────────── -->
      <div v-if="activeTab === 'performance'" class="space-y-6">
        <div v-if="loading" class="px-5 py-16 text-xs text-center font-mono text-stone-400">
          Calculating performance metrics & regression forecasts…
        </div>

        <template v-else-if="performanceData">
          <!-- KPI Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Gross Revenue -->
            <div class="p-5 rounded-xl border border-stone-200/80 bg-white/80 shadow-sm">
              <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">Gross Sales</p>
              <h3 class="text-2xl font-serif mt-1 text-stone-800">{{ formatCurrency(performanceData.summary.totalRevenue) }}</h3>
              <p class="text-xs text-stone-500 mt-1 font-mono">
                {{ performanceData.summary.totalOrders }} orders · AOV {{ formatCurrency(performanceData.summary.averageOrderValue) }}
              </p>
            </div>

            <!-- 30-Day Run-Rate -->
            <div class="p-5 rounded-xl border border-stone-200/80 bg-white/80 shadow-sm">
              <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">30-Day Run Rate</p>
              <h3 class="text-2xl font-serif mt-1 text-emerald-800">{{ formatCurrency(performanceData.forecasts.projected30DayRunRate) }}</h3>
              <p class="text-xs text-stone-500 mt-1 font-mono">
                Daily pace: {{ formatCurrency(performanceData.forecasts.dailyRunRate) }}/day
              </p>
            </div>

            <!-- Moving Average -->
            <div class="p-5 rounded-xl border border-stone-200/80 bg-white/80 shadow-sm">
              <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">7-Day Moving Avg</p>
              <h3 class="text-2xl font-serif mt-1 text-stone-800">{{ formatCurrency(performanceData.forecasts.movingAverage7d) }}</h3>
              <p class="text-xs text-stone-500 mt-1 font-mono">
                3-Day MA: {{ formatCurrency(performanceData.forecasts.movingAverage3d) }}
              </p>
            </div>

            <!-- Trend Trajectory -->
            <div class="p-5 rounded-xl border border-stone-200/80 bg-white/80 shadow-sm">
              <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">Sales Trajectory</p>
              <div class="flex items-center gap-2 mt-1">
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                  :class="performanceData.forecasts.trendStatus === 'growing'
                    ? 'bg-emerald-50 text-emerald-700'
                    : performanceData.forecasts.trendStatus === 'declining'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-stone-100 text-stone-700'"
                >
                  <ArrowUpRight v-if="performanceData.forecasts.trendStatus === 'growing'" class="w-3.5 h-3.5" />
                  <ArrowDownRight v-else-if="performanceData.forecasts.trendStatus === 'declining'" class="w-3.5 h-3.5" />
                  <Minus v-else class="w-3.5 h-3.5" />
                  {{ performanceData.forecasts.trendStatus }}
                </span>
              </div>
              <p class="text-xs text-stone-500 mt-2 font-mono">
                {{ performanceData.forecasts.dailyTrendSlope > 0 ? '+' : '' }}{{ performanceData.forecasts.dailyTrendSlope }} {{ currencySymbol }}/day drift
              </p>
            </div>
          </div>

          <!-- Predictive Forecasting Panel -->
          <div class="p-6 rounded-xl border border-stone-200/80 bg-white shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-stone-500">
                  <Sparkles class="w-3.5 h-3.5 text-amber-500" />
                  <span>Next Period Demand & Sales Projections</span>
                </div>
                <p class="text-sm font-serif mt-0.5 text-stone-800">Forward-looking models calculated from historical velocity</p>
              </div>
              <span class="text-[11px] font-mono text-stone-400">Linear regression model</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">Next 7 Days Demand</p>
                <p class="text-xl font-serif text-stone-800 mt-1">{{ formatCurrency(performanceData.forecasts.projectedNext7Days) }}</p>
                <p class="text-[11px] font-mono text-stone-500 mt-1">Short-term operations baseline</p>
              </div>

              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">Next 14 Days Demand</p>
                <p class="text-xl font-serif text-stone-800 mt-1">{{ formatCurrency(performanceData.forecasts.projectedNext14Days) }}</p>
                <p class="text-[11px] font-mono text-stone-500 mt-1">Bi-weekly staffing forecast</p>
              </div>

              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">Next 30 Days Forecast Range</p>
                <p class="text-xl font-serif text-emerald-800 mt-1">{{ formatCurrency(performanceData.forecasts.projectedNext30Days) }}</p>
                <p class="text-[11px] font-mono text-stone-500 mt-1">
                  Confidence: {{ formatCurrency(performanceData.forecasts.confidenceLower30d) }} – {{ formatCurrency(performanceData.forecasts.confidenceUpper30d) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Top Items Restock Forecast Table -->
          <div class="rounded-xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
            <div class="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <p class="text-xs font-semibold text-stone-800">Top Products & Inventory Restock Projections</p>
                <p class="text-[11px] text-stone-500">Sales velocity and predicted unit demand for next cycle</p>
              </div>
              <span class="text-xs font-mono text-stone-400">{{ performanceData.topItems.length }} item{{ performanceData.topItems.length !== 1 ? 's' : '' }}</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-stone-100 bg-stone-50/30 text-stone-500 font-mono text-[10px] uppercase">
                    <th class="px-4 py-2.5 text-left">Product Name</th>
                    <th class="px-4 py-2.5 text-right">Units Sold</th>
                    <th class="px-4 py-2.5 text-right">Total Sales</th>
                    <th class="px-4 py-2.5 text-right">Avg Price</th>
                    <th class="px-4 py-2.5 text-right">Share</th>
                    <th class="px-4 py-2.5 text-right">Units/Day</th>
                    <th class="px-4 py-2.5 text-right text-emerald-700 font-bold">Next 7d Units</th>
                    <th class="px-4 py-2.5 text-right text-emerald-700 font-bold">Next 30d Units</th>
                    <th class="px-4 py-2.5 text-right">Next 30d Value</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 font-mono">
                  <tr v-for="item in performanceData.topItems" :key="item.name" class="hover:bg-stone-50/50">
                    <td class="px-4 py-2.5 text-left font-sans font-medium text-stone-800">{{ item.name }}</td>
                    <td class="px-4 py-2.5 text-right text-stone-600">{{ item.unitsSold }}</td>
                    <td class="px-4 py-2.5 text-right text-stone-800 font-semibold">{{ formatCurrency(item.revenue) }}</td>
                    <td class="px-4 py-2.5 text-right text-stone-600">{{ formatCurrency(item.averagePrice) }}</td>
                    <td class="px-4 py-2.5 text-right text-stone-500">{{ item.shareOfSales }}%</td>
                    <td class="px-4 py-2.5 text-right text-stone-600">{{ item.dailyVelocity }}</td>
                    <td class="px-4 py-2.5 text-right text-emerald-700 font-semibold">{{ item.projected7DayDemand }}</td>
                    <td class="px-4 py-2.5 text-right text-emerald-700 font-semibold">{{ item.projected30DayDemand }}</td>
                    <td class="px-4 py-2.5 text-right text-stone-800">{{ formatCurrency(item.projected30DayRevenue) }}</td>
                  </tr>
                  <tr v-if="performanceData.topItems.length === 0">
                    <td colspan="9" class="px-4 py-8 text-center text-stone-400 font-mono">No order line items recorded in this period yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <!-- ── TAB 2: TAX FILING SCHEDULE ─────────────────────────── -->
      <div v-else-if="activeTab === 'tax'" class="space-y-6">
        <div v-if="loading" class="px-5 py-16 text-xs text-center font-mono text-stone-400">
          Compiling tax ledger & 1099-K settlement schedules…
        </div>

        <template v-else-if="taxData">
          <!-- Executive Tax Return Schedule -->
          <div class="rounded-xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <p class="text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">Official Business Tax Filing Schedule</p>
                <h3 class="text-base font-serif text-stone-800 mt-0.5">{{ taxData.summary.businessName }} ({{ from }} to {{ to }})</h3>
              </div>
              <span class="text-xs font-mono px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full">
                Rate: {{ taxData.summary.configuredTaxRate }}% (Effective: {{ taxData.summary.effectiveTaxRate }}%)
              </span>
            </div>

            <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">1. Gross Receipts / Gross Sales</p>
                <p class="text-2xl font-serif text-stone-900 mt-1">{{ formatCurrency(taxData.summary.grossSales) }}</p>
                <p class="text-xs font-mono text-stone-500 mt-1">Total revenue collected across all sales</p>
              </div>

              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">2. Non-Taxable / Exempt Sales</p>
                <p class="text-2xl font-serif text-stone-600 mt-1">{{ formatCurrency(taxData.summary.exemptSales) }}</p>
                <p class="text-xs font-mono text-stone-500 mt-1">Zero-rated or exempt goods</p>
              </div>

              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">3. Net Taxable Sales Base</p>
                <p class="text-2xl font-serif text-stone-800 mt-1">{{ formatCurrency(taxData.summary.taxableSales) }}</p>
                <p class="text-xs font-mono text-stone-500 mt-1">Tax base before tax collection</p>
              </div>

              <div class="p-4 rounded-lg bg-amber-50/50 border border-amber-200/60">
                <p class="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-semibold">4. Total Sales Tax / VAT Collected</p>
                <p class="text-2xl font-serif text-amber-900 mt-1">{{ formatCurrency(taxData.summary.taxCollected) }}</p>
                <p class="text-xs font-mono text-amber-700 mt-1">Payable to tax authority</p>
              </div>

              <div class="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200/60">
                <p class="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-semibold">5. Net Sales Retained</p>
                <p class="text-2xl font-serif text-emerald-900 mt-1">{{ formatCurrency(taxData.summary.netSales) }}</p>
                <p class="text-xs font-mono text-emerald-700 mt-1">Gross receipts less tax collected</p>
              </div>

              <div class="p-4 rounded-lg bg-stone-50/70 border border-stone-100">
                <p class="text-[10px] font-mono uppercase tracking-wider text-stone-400">6. Total Transactions</p>
                <p class="text-2xl font-serif text-stone-800 mt-1">{{ taxData.summary.totalTransactions }}</p>
                <p class="text-xs font-mono text-stone-500 mt-1">Audited sales receipts in period</p>
              </div>
            </div>
          </div>

          <!-- 1099-K Settlement Reconciliation -->
          <div class="rounded-xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
            <div class="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <p class="text-xs font-semibold text-stone-800">1099-K & Settlement Reconciliation</p>
                <p class="text-[11px] text-stone-500">Breakdown by payment settlement channel for merchant accounting</p>
              </div>
            </div>

            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-stone-100 bg-stone-50/30 text-stone-500 font-mono text-[10px] uppercase">
                  <th class="px-4 py-2.5 text-left">Channel</th>
                  <th class="px-4 py-2.5 text-right">Transactions</th>
                  <th class="px-4 py-2.5 text-right">Gross Sales</th>
                  <th class="px-4 py-2.5 text-right">Exempt</th>
                  <th class="px-4 py-2.5 text-right">Taxable Base</th>
                  <th class="px-4 py-2.5 text-right">Tax Collected</th>
                  <th class="px-4 py-2.5 text-right">% of Gross</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-100 font-mono">
                <tr v-for="p in taxData.paymentReconciliation" :key="p.paymentMethod" class="hover:bg-stone-50/50">
                  <td class="px-4 py-2.5 text-left font-sans font-medium text-stone-800">{{ p.paymentMethod }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-600">{{ p.transactionCount }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-800 font-semibold">{{ formatCurrency(p.grossSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-500">{{ formatCurrency(p.exemptSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-700">{{ formatCurrency(p.taxableSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-amber-700 font-semibold">{{ formatCurrency(p.taxCollected) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-500">{{ p.percentageOfGross }}%</td>
                </tr>
                <tr v-if="taxData.paymentReconciliation.length === 0">
                  <td colspan="7" class="px-4 py-8 text-center text-stone-400 font-mono">No transactions recorded for settlement reconciliation.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Daily Tax Ledger Schedule -->
          <div class="rounded-xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
            <div class="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <p class="text-xs font-semibold text-stone-800">Periodic Tax Ledger Schedule</p>
                <p class="text-[11px] text-stone-500">Day-by-day record of taxable transactions and tax liabilities</p>
              </div>
              <span class="text-xs font-mono text-stone-400">{{ taxData.dailyLedger.length }} day{{ taxData.dailyLedger.length !== 1 ? 's' : '' }}</span>
            </div>

            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-stone-100 bg-stone-50/30 text-stone-500 font-mono text-[10px] uppercase">
                  <th class="px-4 py-2.5 text-left">Date</th>
                  <th class="px-4 py-2.5 text-right">Count</th>
                  <th class="px-4 py-2.5 text-right">Gross Sales</th>
                  <th class="px-4 py-2.5 text-right">Exempt</th>
                  <th class="px-4 py-2.5 text-right">Taxable</th>
                  <th class="px-4 py-2.5 text-right text-amber-700">Tax Collected</th>
                  <th class="px-4 py-2.5 text-right">Cash</th>
                  <th class="px-4 py-2.5 text-right">Card</th>
                  <th class="px-4 py-2.5 text-right">Other</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-100 font-mono">
                <tr v-for="d in taxData.dailyLedger" :key="d.date" class="hover:bg-stone-50/50">
                  <td class="px-4 py-2.5 text-left text-stone-700">{{ d.date }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-600">{{ d.transactionCount }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-800 font-semibold">{{ formatCurrency(d.grossSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-500">{{ formatCurrency(d.exemptSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-700">{{ formatCurrency(d.taxableSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-amber-700 font-semibold">{{ formatCurrency(d.taxCollected) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-600">{{ formatCurrency(d.cashSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-600">{{ formatCurrency(d.cardSales) }}</td>
                  <td class="px-4 py-2.5 text-right text-stone-600">{{ formatCurrency(d.otherSales) }}</td>
                </tr>
                <tr v-if="taxData.dailyLedger.length === 0">
                  <td colspan="9" class="px-4 py-8 text-center text-stone-400 font-mono">No daily tax activity recorded.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Line-Item Tax Audit Trail -->
          <div class="rounded-xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
            <div class="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <p class="text-xs font-semibold text-stone-800">Line-Item Tax Audit Trail</p>
                <p class="text-[11px] text-stone-500">Audited line-item entries with tax calculations and receipt references</p>
              </div>
              <span class="text-xs font-mono text-stone-400">
                {{ taxData.lineItems.length }}
                <span v-if="taxData.totalLineItemsCount && taxData.totalLineItemsCount > taxData.lineItems.length">
                  of {{ taxData.totalLineItemsCount }}
                </span>
                item{{ taxData.lineItems.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs min-w-[800px]">
                <thead>
                  <tr class="border-b border-stone-100 bg-stone-50/30 text-stone-500 font-mono text-[10px] uppercase">
                    <th class="px-4 py-2.5 text-left">Timestamp</th>
                    <th class="px-4 py-2.5 text-left">Receipt / ID</th>
                    <th class="px-4 py-2.5 text-left">Item Description</th>
                    <th class="px-4 py-2.5 text-right">Qty</th>
                    <th class="px-4 py-2.5 text-right">Price</th>
                    <th class="px-4 py-2.5 text-right">Gross</th>
                    <th class="px-4 py-2.5 text-right">Taxable</th>
                    <th class="px-4 py-2.5 text-right">Tax %</th>
                    <th class="px-4 py-2.5 text-right text-amber-700">Tax Amt</th>
                    <th class="px-4 py-2.5 text-left">Payment</th>
                    <th class="px-4 py-2.5 text-left">Ref</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 font-mono">
                  <tr v-for="(item, idx) in taxData.lineItems" :key="idx" class="hover:bg-stone-50/50">
                    <td class="px-4 py-2 text-left text-stone-500 text-[11px]">{{ item.timestamp?.slice(0, 19).replace('T', ' ') || '—' }}</td>
                    <td class="px-4 py-2 text-left text-stone-700 font-semibold">{{ item.receiptNumber || item.orderId }}</td>
                    <td class="px-4 py-2 text-left font-sans font-medium text-stone-800">{{ item.itemName }}</td>
                    <td class="px-4 py-2 text-right text-stone-600">{{ item.quantity }}</td>
                    <td class="px-4 py-2 text-right text-stone-600">{{ formatCurrency(item.unitPrice) }}</td>
                    <td class="px-4 py-2 text-right text-stone-800 font-semibold">{{ formatCurrency(item.grossAmount) }}</td>
                    <td class="px-4 py-2 text-right text-stone-700">{{ formatCurrency(item.taxableAmount) }}</td>
                    <td class="px-4 py-2 text-right text-stone-500">{{ item.taxRate }}%</td>
                    <td class="px-4 py-2 text-right text-amber-700 font-semibold">{{ formatCurrency(item.taxAmount) }}</td>
                    <td class="px-4 py-2 text-left text-stone-600 capitalize">{{ item.paymentMethod }}</td>
                    <td class="px-4 py-2 text-left text-stone-400 text-[11px]">{{ item.paymentReference || '—' }}</td>
                  </tr>
                  <tr v-if="taxData.lineItems.length === 0">
                    <td colspan="11" class="px-4 py-8 text-center text-stone-400 font-mono">No line item tax details recorded.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <!-- ── TAB 3, 4, 5: STANDARD DATA TABLES ──────────────────── -->
      <div v-else style="border: 1px solid rgba(61,24,32,0.09); border-radius: 0.75rem; overflow: hidden; background: #ffffff;">

        <div class="px-5 py-3 flex items-center justify-between" style="background: rgba(61,24,32,0.02); border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">
            {{ activeTabLabel }}
          </p>
          <p class="text-[10px] font-mono" style="color: rgba(61,24,32,0.3);">{{ rows.length }} row{{ rows.length !== 1 ? 's' : '' }}</p>
        </div>

        <div v-if="loading" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          Running report…
        </div>

        <div v-else-if="rows.length === 0" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.5);">
          No activity for this period yet.
        </div>

        <div v-else class="overflow-auto">
          <table class="reports-table w-full min-w-[640px] text-xs">
            <thead>
              <tr style="background: rgba(61,24,32,0.02);">
                <th
                  v-for="col in customColumns"
                  :key="col"
                  class="px-4 py-3 text-left font-mono uppercase tracking-wider text-[10px]"
                  style="color: rgba(61,24,32,0.4); border-bottom: 1px solid rgba(61,24,32,0.07);"
                >
                  {{ reportColumnLabel(col) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in rows"
                :key="i"
                class="report-row transition-colors"
                style="border-bottom: 1px solid rgba(61,24,32,0.05);"
              >
                <td
                  v-for="col in customColumns"
                  :key="`${i}-${col}`"
                  class="px-4 py-3 font-mono"
                  style="color: rgba(61,24,32,0.6);"
                >
                  {{ reportCellValue(row[col], col) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-row:hover {
  background: rgba(61,24,32,0.02);
}

.dashboard-readable [style*="color: rgba(61,24,32,0."] {
  color: rgba(61,24,32,0.7) !important;
}

@media (max-width: 768px) {
  .reports-table {
    min-width: 100% !important;
    table-layout: fixed;
  }

  .reports-table th,
  .reports-table td {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    overflow-wrap: anywhere;
  }
}
</style>
