<script setup lang="ts">
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Play,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
} from 'lucide-vue-next';
import SalesDiagrams from '~/components/SalesDiagrams.vue';
import { isSalesMutationTable, type TrendInputPoint } from '~/lib/reportDiagrams';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { business, fetchBusiness } = useBusiness();
const { format: formatCurrency, symbol: currencySymbol } = useCurrency();
const realtimeSync = useRealtimeSync();

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

// Live sync state
const liveEnabled = ref(true);
const livePulse = ref(false);
const lastUpdatedLabel = ref('');
let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pulseTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackSyncTimer: ReturnType<typeof setInterval> | null = null;
let activeRequestId = 0;

function effectiveTaxRateDecimal(): number {
  const parsed = Number(taxRatePercent.value);
  const pct = Number.isFinite(parsed) && parsed >= 0 ? Math.min(100, parsed) : 10;
  return pct / 100;
}

// Performance & Prediction state (also powers live diagrams across tabs)
const performanceData = ref<{
  summary: any;
  trends: any[];
  topItems: any[];
  paymentBreakdown?: any[];
  statusBreakdown?: any[];
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
  average_order_value: 'Average Order Value',
  table: 'Area',
  inserts: 'Added',
  updates: 'Updated',
  deletes: 'Removed',
  total: 'Total',
  actor_name: 'Team Member',
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
  terminals: 'Staff Workspaces',
  audit_log: 'Activity',
};

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

const transactionsDiagramPoints = computed<TrendInputPoint[]>(() => {
  const perfTrends = performanceData.value?.trends ?? [];
  const hasPerfSales = perfTrends.some((pt) => Number(pt.revenue) > 0 || Number(pt.orders) > 0);

  if (group.value === 'day' && perfTrends.length > 0 && (hasPerfSales || rows.value.length === 0)) {
    return perfTrends.map((pt) => ({
      label: String(pt.date ?? ''),
      revenue: Number(pt.revenue ?? 0),
      orders: Number(pt.orders ?? 0),
      averageOrderValue: Number(pt.averageOrderValue ?? 0),
      movingAverage7d: pt.movingAverage7d != null ? Number(pt.movingAverage7d) : undefined,
    }));
  }

  return rows.value.map((row) => ({
    label: String(row.period ?? ''),
    revenue: Number(row.revenue ?? 0),
    orders: Number(row.transactions ?? 0),
    averageOrderValue: Number(row.average_order_value ?? 0),
  }));
});

const performanceDiagramPoints = computed<TrendInputPoint[]>(() =>
  (performanceData.value?.trends ?? []).map((pt) => ({
    label: String(pt.date ?? ''),
    revenue: Number(pt.revenue ?? 0),
    orders: Number(pt.orders ?? 0),
    averageOrderValue: Number(pt.averageOrderValue ?? 0),
    movingAverage7d: pt.movingAverage7d != null ? Number(pt.movingAverage7d) : undefined,
  })),
);

const taxBreakdownBars = computed(() => {
  if (!taxData.value?.summary) return [];
  const s = taxData.value.summary;
  const total = Math.max(Number(s.grossSales) || 0, 1);
  const netRetained = Math.max(0, Number(s.netSales) || 0);
  const taxCollected = Math.max(0, Number(s.taxCollected) || 0);
  const exempt = Math.max(0, Number(s.exemptSales) || 0);

  return [
    {
      label: 'Net Sales Retained',
      amount: netRetained,
      pct: Number(((netRetained / total) * 100).toFixed(1)),
      color: '#059669',
    },
    {
      label: 'Sales Tax / VAT Payable',
      amount: taxCollected,
      pct: Number(((taxCollected / total) * 100).toFixed(1)),
      color: '#D97706',
    },
    {
      label: 'Tax-Exempt Sales',
      amount: exempt,
      pct: Number(((exempt / total) * 100).toFixed(1)),
      color: '#68293A',
    },
  ];
});

function markUpdatedNow() {
  lastUpdatedLabel.value = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function loadReport(options?: { silent?: boolean }) {
  const requestId = ++activeRequestId;
  const silent = options?.silent === true;
  if (!silent) {
    loading.value = true;
  }
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
      if (requestId !== activeRequestId) return;
      if (res.error) {
        errorMessage.value = res.error;
      } else {
        performanceData.value = res;
        markUpdatedNow();
      }
      return;
    }

    if (activeTab.value === 'tax') {
      const res = await $fetch<any>('/api/reports/tax-summary', {
        headers: authHeaders(),
        query: {
          from: from.value,
          to: to.value,
          taxRate: effectiveTaxRateDecimal(),
          taxInclusive: taxInclusive.value,
        },
      });
      if (requestId !== activeRequestId) return;
      if (res.error) {
        errorMessage.value = res.error;
      } else {
        taxData.value = res;
        markUpdatedNow();
      }
      return;
    }

    if (activeTab.value === 'transactions') {
      const [txRes, metricsRes] = await Promise.all([
        $fetch<{ rows: Record<string, unknown>[]; error: string | null }>('/api/reports/transactions', {
          headers: authHeaders(),
          query: { from: from.value, to: to.value, group: group.value },
        }),
        $fetch<any>('/api/reports/sales-metrics', {
          headers: authHeaders(),
          query: { from: from.value, to: to.value },
        }).catch(() => null),
      ]);
      if (requestId !== activeRequestId) return;

      rows.value = txRes.rows ?? [];
      customColumns.value = rows.value.length > 0 ? Object.keys(rows.value[0]) : [];
      if (metricsRes && !metricsRes.error) {
        performanceData.value = metricsRes;
      } else if (!silent) {
        performanceData.value = null;
      }
      errorMessage.value = txRes.error ? 'Some results could not be refreshed. Please try again.' : '';
      if (!txRes.error) markUpdatedNow();
      return;
    }

    const endpoint = activeTab.value === 'table-activity'
      ? '/api/reports/table-activity'
      : '/api/reports/inpoint-activity';

    const res = await $fetch<{ rows: Record<string, unknown>[]; error: string | null }>(endpoint, {
      headers: authHeaders(),
      query: { from: from.value, to: to.value, group: group.value },
    });
    if (requestId !== activeRequestId) return;
    rows.value = res.rows ?? [];
    customColumns.value = rows.value.length > 0 ? Object.keys(rows.value[0]) : [];
    errorMessage.value = res.error ? 'Some results could not be refreshed. Please try again.' : '';
    if (!res.error) markUpdatedNow();
  } catch {
    if (requestId !== activeRequestId) return;
    if (!silent) {
      rows.value = [];
      customColumns.value = [];
      errorMessage.value = 'We could not load this report right now. Please try again.';
    }
  } finally {
    if (requestId === activeRequestId && !silent) {
      loading.value = false;
    }
  }
}

function triggerLivePulse() {
  livePulse.value = true;
  if (pulseTimer) clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => {
    livePulse.value = false;
  }, 2600);
}

function scheduleLiveRefresh() {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  refreshDebounceTimer = setTimeout(async () => {
    await loadReport({ silent: true });
    triggerLivePulse();
  }, 350);
}

function connectRealtime(businessId: string) {
  if (!import.meta.client || !businessId || !liveEnabled.value) return;
  realtimeSync.connect({
    businessId,
    onMutation: (mutation) => {
      if (!liveEnabled.value) return;
      const relevantForActivity = activeTab.value === 'table-activity' || activeTab.value === 'inpoint-activity';
      if (relevantForActivity || isSalesMutationTable(mutation.table)) {
        scheduleLiveRefresh();
      }
    },
    onReconnect: () => {
      if (liveEnabled.value) {
        void loadReport({ silent: true });
      }
    },
  });
}

function startFallbackSyncPolling() {
  if (!import.meta.client) return;
  if (fallbackSyncTimer) clearInterval(fallbackSyncTimer);
  fallbackSyncTimer = setInterval(() => {
    if (!liveEnabled.value || realtimeSync.isConnected.value) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    void loadReport({ silent: true });
  }, 15000);
}

function toggleLiveUpdates() {
  liveEnabled.value = !liveEnabled.value;
  if (liveEnabled.value && business.value?.id) {
    connectRealtime(business.value.id);
    startFallbackSyncPolling();
    void loadReport({ silent: true });
  } else {
    if (fallbackSyncTimer) {
      clearInterval(fallbackSyncTimer);
      fallbackSyncTimer = null;
    }
    realtimeSync.disconnect();
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
  const rate = effectiveTaxRateDecimal();
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
    const rate = effectiveTaxRateDecimal();
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

onMounted(async () => {
  void loadReport();
  if (liveEnabled.value) {
    startFallbackSyncPolling();
  }
  if (!business.value) {
    await fetchBusiness();
  }
});

watch(
  () => business.value?.id,
  (bizId) => {
    if (bizId && liveEnabled.value) {
      connectRealtime(bizId);
    }
  },
  { immediate: true },
);

watch([activeTab, group, taxInclusive], () => {
  void loadReport();
});

onUnmounted(() => {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  if (pulseTimer) clearTimeout(pulseTimer);
  if (fallbackSyncTimer) clearInterval(fallbackSyncTimer);
  realtimeSync.disconnect();
});
</script>

<template>
  <div class="reports-page flex-1 overflow-y-auto font-sans" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8 flex flex-wrap items-end justify-between gap-4" style="border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
      <div>
        <div class="flex items-center gap-2 mb-1.5">
          <BarChart3 class="w-4 h-4" style="color: rgb(var(--shell-pink));" />
          <p class="text-xs font-bold uppercase tracking-[0.16em] m-0" style="color: #B8294B;">
            Reports &amp; Analytics
          </p>
        </div>
        <h1 class="font-serif font-normal text-2xl sm:text-3xl m-0" style="color: rgb(var(--shell-sidebar));">
          Business intelligence &amp; compliance
        </h1>
        <p class="text-sm mt-1.5 m-0" style="color: #5c3742;">
          Track live sales diagrams, performance forecasts, and exportable tax filing sheets.
        </p>
      </div>

      <!-- Export Action Buttons -->
      <div class="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] bg-white border shadow-sm cursor-pointer hover:bg-stone-50"
          style="border-color: rgba(104, 41, 58, 0.2); color: rgb(var(--shell-sidebar));"
          :disabled="exporting"
          @click="exportSalesExcel()"
        >
          <FileSpreadsheet class="w-4 h-4 text-emerald-700" />
          <span>Export Sales (.xlsx)</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] bg-white border shadow-sm cursor-pointer hover:bg-stone-50"
          style="border-color: rgba(104, 41, 58, 0.2); color: rgb(var(--shell-sidebar));"
          :disabled="exporting"
          @click="exportTaxExcel()"
        >
          <Receipt class="w-4 h-4 text-amber-700" />
          <span>Export Tax (.xlsx)</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] btn-ghost cursor-pointer"
          :disabled="exporting"
          @click="exportCsv"
        >
          <Download class="w-4 h-4" />
          <span>CSV</span>
        </button>
      </div>
    </div>

    <div class="px-10 py-7 space-y-6">

      <!-- ── Tab row ────────────────────────────────────────────── -->
      <div
        class="flex items-center gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Report views"
        style="border-bottom: 1px solid rgba(104, 41, 58, 0.12);"
      >
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-150 relative cursor-pointer bg-transparent border-0"
          :style="activeTab === tab.key
            ? 'color: rgb(var(--shell-sidebar));'
            : 'color: #6c4450;'"
          @click="activeTab = tab.key as TabKey"
        >
          {{ tab.label }}
          <span
            v-if="activeTab === tab.key"
            class="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t"
            style="background: rgb(var(--shell-pink));"
          />
        </button>
      </div>

      <!-- ── Controls ───────────────────────────────────────────── -->
      <div class="flex flex-wrap items-end gap-3.5">
        <div>
          <label for="report-from" class="block text-xs font-semibold uppercase tracking-wider mb-1.5" style="color: #5c3742;">From</label>
          <input id="report-from" v-model="from" type="date" class="input-warm px-3.5 py-2 text-sm font-medium" />
        </div>
        <div>
          <label for="report-to" class="block text-xs font-semibold uppercase tracking-wider mb-1.5" style="color: #5c3742;">To</label>
          <input id="report-to" v-model="to" type="date" class="input-warm px-3.5 py-2 text-sm font-medium" />
        </div>

        <div v-if="activeTab === 'transactions'">
          <label for="report-group" class="block text-xs font-semibold uppercase tracking-wider mb-1.5" style="color: #5c3742;">Group by</label>
          <select id="report-group" v-model="group" class="input-warm px-3.5 py-2 text-sm font-medium">
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        </div>

        <div v-if="activeTab === 'tax'">
          <label for="report-tax-rate" class="block text-xs font-semibold uppercase tracking-wider mb-1.5" style="color: #5c3742;">Tax Rate (%)</label>
          <div class="relative flex items-center">
            <input
              id="report-tax-rate"
              v-model="taxRatePercent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              class="input-warm px-3.5 py-2 text-sm font-medium w-28 pr-7 tabular-nums"
            />
            <span class="absolute right-3 text-sm font-semibold" style="color: #5c3742;">%</span>
          </div>
        </div>

        <div v-if="activeTab === 'tax'">
          <label for="report-tax-model" class="block text-xs font-semibold uppercase tracking-wider mb-1.5" style="color: #5c3742;">Pricing Model</label>
          <select id="report-tax-model" v-model="taxInclusive" class="input-warm px-3.5 py-2 text-sm font-medium">
            <option :value="true">Tax Inclusive (VAT / GST)</option>
            <option :value="false">Tax Exclusive (Added at register)</option>
          </select>
        </div>

        <button
          type="button"
          class="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon cursor-pointer"
          @click="loadReport()"
        >
          <Play class="w-4 h-4" /> Run Report
        </button>
      </div>

      <p
        v-if="errorMessage"
        class="text-sm font-medium px-4 py-2.5 rounded-lg"
        style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #92400e;"
        role="status"
      >
        {{ errorMessage }}
      </p>

      <!-- ── TAB 1: SALES TRANSACTIONS + LIVE DIAGRAMS ──────────── -->
      <div v-if="activeTab === 'transactions'" class="space-y-6">
        <SalesDiagrams
          :trend-points="transactionsDiagramPoints"
          :top-items="performanceData?.topItems ?? []"
          :payment-breakdown="performanceData?.paymentBreakdown ?? []"
          :status-breakdown="performanceData?.statusBreakdown ?? []"
          :loading="loading"
          :live-enabled="liveEnabled"
          :live-connected="realtimeSync.isConnected.value"
          :live-pulse="livePulse"
          :last-updated-label="lastUpdatedLabel"
          :show-moving-average="group === 'day'"
          title="Live Sales Diagrams"
          subtitle="Interactive revenue, product mix, and payment channel diagrams that update live as orders come in."
          @toggle-live="toggleLiveUpdates"
          @refresh="loadReport()"
        />

        <!-- Transactions Breakdown Table -->
        <div
          class="rounded-2xl border bg-white shadow-sm overflow-hidden"
          style="border-color: rgba(104, 41, 58, 0.12);"
        >
          <div
            class="px-6 py-4 flex items-center justify-between"
            style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
          >
            <div>
              <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                {{ activeTabLabel }}
              </h3>
              <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
                Grouped breakdown of completed orders and revenue
              </p>
            </div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full tabular-nums" style="background: rgba(104, 41, 58, 0.07); color: rgb(var(--shell-sidebar));">
              {{ rows.length }} period{{ rows.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <div v-if="loading" class="px-6 py-12 text-sm text-center font-medium" style="color: #5c3742;">
            Loading sales transactions…
          </div>

          <div v-else-if="rows.length === 0" class="px-6 py-12 text-sm text-center" style="color: #5c3742;">
            No sales activity recorded for this period yet.
          </div>

          <div v-else class="overflow-auto">
            <table class="reports-table w-full min-w-[640px] text-sm">
              <thead>
                <tr style="background: rgba(104, 41, 58, 0.03);">
                  <th
                    v-for="col in customColumns"
                    :key="col"
                    class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style="color: #5c3742; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
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
                  style="border-bottom: 1px solid rgba(104, 41, 58, 0.07);"
                >
                  <td
                    v-for="col in customColumns"
                    :key="`${i}-${col}`"
                    class="px-5 py-3.5 tabular-nums font-medium"
                    :style="col === 'revenue' || col === 'period' ? 'color: rgb(var(--shell-sidebar)); font-weight: 600;' : 'color: #4a2530;'"
                  >
                    {{ reportCellValue(row[col], col) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── TAB 2: PERFORMANCE & FORECASTS ─────────────────────── -->
      <div v-else-if="activeTab === 'performance'" class="space-y-6">
        <div v-if="loading" class="px-6 py-16 text-sm text-center font-medium" style="color: #5c3742;">
          Calculating performance metrics &amp; regression forecasts…
        </div>

        <template v-else-if="performanceData">
          <!-- KPI Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Gross Revenue -->
            <div class="p-5 rounded-2xl border bg-white shadow-sm" style="border-color: rgba(104, 41, 58, 0.12);">
              <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">Gross Sales</p>
              <h3 class="text-2xl sm:text-3xl font-serif mt-2 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                {{ formatCurrency(performanceData.summary.totalRevenue) }}
              </h3>
              <p class="text-sm mt-1.5 mb-0 tabular-nums" style="color: #4a2530;">
                {{ performanceData.summary.totalOrders }} orders · Avg {{ formatCurrency(performanceData.summary.averageOrderValue) }}
              </p>
            </div>

            <!-- 30-Day Run-Rate -->
            <div class="p-5 rounded-2xl border bg-white shadow-sm" style="border-color: rgba(104, 41, 58, 0.12);">
              <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">30-Day Run Rate</p>
              <h3 class="text-2xl sm:text-3xl font-serif mt-2 mb-0 tabular-nums text-emerald-800">
                {{ formatCurrency(performanceData.forecasts.projected30DayRunRate) }}
              </h3>
              <p class="text-sm mt-1.5 mb-0 tabular-nums" style="color: #4a2530;">
                Daily pace: {{ formatCurrency(performanceData.forecasts.dailyRunRate) }}/day
              </p>
            </div>

            <!-- Moving Average -->
            <div class="p-5 rounded-2xl border bg-white shadow-sm" style="border-color: rgba(104, 41, 58, 0.12);">
              <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">7-Day Moving Avg</p>
              <h3 class="text-2xl sm:text-3xl font-serif mt-2 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                {{ formatCurrency(performanceData.forecasts.movingAverage7d) }}
              </h3>
              <p class="text-sm mt-1.5 mb-0 tabular-nums" style="color: #4a2530;">
                3-Day Avg: {{ formatCurrency(performanceData.forecasts.movingAverage3d) }}
              </p>
            </div>

            <!-- Trend Trajectory -->
            <div class="p-5 rounded-2xl border bg-white shadow-sm" style="border-color: rgba(104, 41, 58, 0.12);">
              <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">Sales Trajectory</p>
              <div class="flex items-center gap-2 mt-2.5">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold capitalize"
                  :class="performanceData.forecasts.trendStatus === 'growing'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : performanceData.forecasts.trendStatus === 'declining'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-stone-100 text-stone-800 border border-stone-200'"
                >
                  <ArrowUpRight v-if="performanceData.forecasts.trendStatus === 'growing'" class="w-4 h-4" />
                  <ArrowDownRight v-else-if="performanceData.forecasts.trendStatus === 'declining'" class="w-4 h-4" />
                  <Minus v-else class="w-4 h-4" />
                  {{ performanceData.forecasts.trendStatus }}
                </span>
              </div>
              <p class="text-sm mt-2 mb-0 tabular-nums" style="color: #4a2530;">
                {{ performanceData.forecasts.dailyTrendSlope > 0 ? '+' : '' }}{{ performanceData.forecasts.dailyTrendSlope }} {{ currencySymbol }}/day drift
              </p>
            </div>
          </div>

          <!-- Live Performance Diagrams -->
          <SalesDiagrams
            :trend-points="performanceDiagramPoints"
            :top-items="performanceData.topItems ?? []"
            :payment-breakdown="performanceData.paymentBreakdown ?? []"
            :status-breakdown="performanceData.statusBreakdown ?? []"
            :loading="loading"
            :live-enabled="liveEnabled"
            :live-connected="realtimeSync.isConnected.value"
            :live-pulse="livePulse"
            :last-updated-label="lastUpdatedLabel"
            :show-moving-average="true"
            title="Live Performance & Trend Diagrams"
            subtitle="Daily sales trajectory with 7-day moving average, top products, and payment channels."
            @toggle-live="toggleLiveUpdates"
            @refresh="loadReport()"
          />

          <!-- Predictive Forecasting Panel -->
          <div class="p-6 rounded-2xl border bg-white shadow-sm space-y-4" style="border-color: rgba(104, 41, 58, 0.12);">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style="color: #B8294B;">
                  <Sparkles class="w-4 h-4 text-amber-600" />
                  <span>Next Period Demand &amp; Sales Projections</span>
                </div>
                <p class="text-lg font-serif mt-1 mb-0" style="color: rgb(var(--shell-sidebar));">
                  Forward-looking estimates calculated from your sales pace
                </p>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full" style="background: #FDF7F2; color: #5c3742; border: 1px solid rgba(104, 41, 58, 0.12);">
                Linear regression model
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div class="p-4 rounded-xl border" style="background: #FDF7F2; border-color: rgba(104, 41, 58, 0.1);">
                <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">Next 7 Days Demand</p>
                <p class="text-2xl font-serif mt-1.5 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                  {{ formatCurrency(performanceData.forecasts.projectedNext7Days) }}
                </p>
                <p class="text-sm mt-1 mb-0" style="color: #4a2530;">Short-term operations baseline</p>
              </div>

              <div class="p-4 rounded-xl border" style="background: #FDF7F2; border-color: rgba(104, 41, 58, 0.1);">
                <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">Next 14 Days Demand</p>
                <p class="text-2xl font-serif mt-1.5 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                  {{ formatCurrency(performanceData.forecasts.projectedNext14Days) }}
                </p>
                <p class="text-sm mt-1 mb-0" style="color: #4a2530;">Bi-weekly staffing forecast</p>
              </div>

              <div class="p-4 rounded-xl border" style="background: rgba(16, 185, 129, 0.06); border-color: rgba(16, 185, 129, 0.22);">
                <p class="text-xs font-semibold uppercase tracking-wider m-0 text-emerald-800">Next 30 Days Forecast Range</p>
                <p class="text-2xl font-serif text-emerald-900 mt-1.5 mb-0 tabular-nums">
                  {{ formatCurrency(performanceData.forecasts.projectedNext30Days) }}
                </p>
                <p class="text-sm mt-1 mb-0 tabular-nums text-emerald-900">
                  Range: {{ formatCurrency(performanceData.forecasts.confidenceLower30d) }} – {{ formatCurrency(performanceData.forecasts.confidenceUpper30d) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Top Items Restock Forecast Table -->
          <div class="rounded-2xl border bg-white shadow-sm overflow-hidden" style="border-color: rgba(104, 41, 58, 0.12);">
            <div
              class="px-6 py-4 flex items-center justify-between"
              style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
            >
              <div>
                <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                  Top Products &amp; Inventory Restock Projections
                </h3>
                <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
                  Sales velocity and predicted unit demand for the next cycle
                </p>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full tabular-nums" style="background: rgba(104, 41, 58, 0.07); color: rgb(var(--shell-sidebar));">
                {{ performanceData.topItems.length }} item{{ performanceData.topItems.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr style="background: rgba(104, 41, 58, 0.03); border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Product Name</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Units Sold</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Total Sales</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Avg Price</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Share</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Units/Day</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-emerald-800">Next 7d Units</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-emerald-800">Next 30d Units</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style="color: #5c3742;">Next 30d Value</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 tabular-nums">
                  <tr v-for="item in performanceData.topItems" :key="item.name" class="report-row transition-colors">
                    <td class="px-4 py-3 text-left font-semibold" style="color: rgb(var(--shell-sidebar));">{{ item.name }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ item.unitsSold }}</td>
                    <td class="px-4 py-3 text-right font-semibold" style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(item.revenue) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ formatCurrency(item.averagePrice) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #5c3742;">{{ item.shareOfSales }}%</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ item.dailyVelocity }}</td>
                    <td class="px-4 py-3 text-right text-emerald-800 font-semibold">{{ item.projected7DayDemand }}</td>
                    <td class="px-4 py-3 text-right text-emerald-800 font-semibold">{{ item.projected30DayDemand }}</td>
                    <td class="px-4 py-3 text-right font-semibold" style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(item.projected30DayRevenue) }}</td>
                  </tr>
                  <tr v-if="performanceData.topItems.length === 0">
                    <td colspan="9" class="px-4 py-10 text-center text-sm" style="color: #5c3742;">
                      No order line items recorded in this period yet.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <!-- ── TAB 3: TAX FILING SCHEDULE ─────────────────────────── -->
      <div v-else-if="activeTab === 'tax'" class="space-y-6">
        <div v-if="loading" class="px-6 py-16 text-sm text-center font-medium" style="color: #5c3742;">
          Compiling tax ledger &amp; 1099-K settlement schedules…
        </div>

        <template v-else-if="taxData">
          <!-- Executive Tax Return Schedule -->
          <div class="rounded-2xl border bg-white shadow-sm overflow-hidden" style="border-color: rgba(104, 41, 58, 0.12);">
            <div
              class="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
              style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
            >
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-amber-800 m-0">
                  Official Business Tax Filing Schedule
                </p>
                <h3 class="text-lg font-serif mt-1 mb-0" style="color: rgb(var(--shell-sidebar));">
                  {{ taxData.summary.businessName }} ({{ from }} to {{ to }})
                </h3>
              </div>
              <span class="text-xs font-semibold px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-full tabular-nums">
                Rate: {{ taxData.summary.configuredTaxRate }}% (Effective: {{ taxData.summary.effectiveTaxRate }}%)
              </span>
            </div>

            <div class="p-6 space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="p-4 rounded-xl border" style="background: #FDF7F2; border-color: rgba(104, 41, 58, 0.1);">
                  <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">1. Gross Receipts / Gross Sales</p>
                  <p class="text-2xl font-serif mt-1.5 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                    {{ formatCurrency(taxData.summary.grossSales) }}
                  </p>
                  <p class="text-sm mt-1 mb-0" style="color: #4a2530;">Total revenue collected across all sales</p>
                </div>

                <div class="p-4 rounded-xl border" style="background: #FDF7F2; border-color: rgba(104, 41, 58, 0.1);">
                  <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">2. Non-Taxable / Exempt Sales</p>
                  <p class="text-2xl font-serif mt-1.5 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                    {{ formatCurrency(taxData.summary.exemptSales) }}
                  </p>
                  <p class="text-sm mt-1 mb-0" style="color: #4a2530;">Zero-rated or exempt goods</p>
                </div>

                <div class="p-4 rounded-xl border" style="background: #FDF7F2; border-color: rgba(104, 41, 58, 0.1);">
                  <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">3. Net Taxable Sales Base</p>
                  <p class="text-2xl font-serif mt-1.5 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                    {{ formatCurrency(taxData.summary.taxableSales) }}
                  </p>
                  <p class="text-sm mt-1 mb-0" style="color: #4a2530;">Tax base before tax collection</p>
                </div>

                <div class="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                  <p class="text-xs font-semibold uppercase tracking-wider text-amber-900 m-0">4. Total Sales Tax / VAT Collected</p>
                  <p class="text-2xl font-serif text-amber-950 mt-1.5 mb-0 tabular-nums">
                    {{ formatCurrency(taxData.summary.taxCollected) }}
                  </p>
                  <p class="text-sm text-amber-900 mt-1 mb-0">Payable to tax authority</p>
                </div>

                <div class="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <p class="text-xs font-semibold uppercase tracking-wider text-emerald-900 m-0">5. Net Sales Retained</p>
                  <p class="text-2xl font-serif text-emerald-950 mt-1.5 mb-0 tabular-nums">
                    {{ formatCurrency(taxData.summary.netSales) }}
                  </p>
                  <p class="text-sm text-emerald-900 mt-1 mb-0">Gross receipts less tax collected</p>
                </div>

                <div class="p-4 rounded-xl border" style="background: #FDF7F2; border-color: rgba(104, 41, 58, 0.1);">
                  <p class="text-xs font-semibold uppercase tracking-wider m-0" style="color: #5c3742;">6. Total Transactions</p>
                  <p class="text-2xl font-serif mt-1.5 mb-0 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                    {{ taxData.summary.totalTransactions }}
                  </p>
                  <p class="text-sm mt-1 mb-0" style="color: #4a2530;">Audited sales receipts in period</p>
                </div>
              </div>

              <!-- Live Tax Allocation Visual Bar -->
              <div v-if="taxData.summary.grossSales > 0" class="p-4 rounded-xl border bg-white" style="border-color: rgba(104, 41, 58, 0.1);">
                <div class="flex items-center justify-between gap-2 mb-2.5">
                  <p class="text-sm font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                    Gross Receipts Allocation
                  </p>
                  <span class="text-xs font-medium tabular-nums" style="color: #5c3742;">
                    Total {{ formatCurrency(taxData.summary.grossSales) }}
                  </span>
                </div>
                <div class="w-full h-3.5 rounded-full overflow-hidden flex" style="background: rgba(104, 41, 58, 0.08);">
                  <div
                    v-for="seg in taxBreakdownBars"
                    :key="seg.label"
                    class="h-full transition-all duration-500"
                    :style="{ width: `${seg.pct}%`, background: seg.color }"
                    :title="`${seg.label}: ${formatCurrency(seg.amount)} (${seg.pct}%)`"
                  />
                </div>
                <div class="flex flex-wrap items-center gap-5 mt-3 text-xs font-medium" style="color: #4a2530;">
                  <span v-for="seg in taxBreakdownBars" :key="seg.label" class="inline-flex items-center gap-2 tabular-nums">
                    <span class="w-2.5 h-2.5 rounded-full" :style="{ background: seg.color }" />
                    <span>{{ seg.label }}: <strong>{{ formatCurrency(seg.amount) }}</strong> ({{ seg.pct }}%)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 1099-K Settlement Reconciliation -->
          <div class="rounded-2xl border bg-white shadow-sm overflow-hidden" style="border-color: rgba(104, 41, 58, 0.12);">
            <div class="px-6 py-4" style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
              <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                1099-K &amp; Settlement Reconciliation
              </h3>
              <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
                Breakdown by payment settlement channel for merchant accounting
              </p>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr style="background: rgba(104, 41, 58, 0.03); border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Channel</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Transactions</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Gross Sales</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Exempt</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Taxable Base</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Tax Collected</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">% of Gross</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 tabular-nums">
                  <tr v-for="p in taxData.paymentReconciliation" :key="p.paymentMethod" class="report-row transition-colors">
                    <td class="px-4 py-3 text-left font-semibold" style="color: rgb(var(--shell-sidebar));">{{ p.paymentMethod }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ p.transactionCount }}</td>
                    <td class="px-4 py-3 text-right font-semibold" style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(p.grossSales) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #5c3742;">{{ formatCurrency(p.exemptSales) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ formatCurrency(p.taxableSales) }}</td>
                    <td class="px-4 py-3 text-right text-amber-800 font-semibold">{{ formatCurrency(p.taxCollected) }}</td>
                    <td class="px-4 py-3 text-right font-medium" style="color: #5c3742;">{{ p.percentageOfGross }}%</td>
                  </tr>
                  <tr v-if="taxData.paymentReconciliation.length === 0">
                    <td colspan="7" class="px-4 py-10 text-center text-sm" style="color: #5c3742;">
                      No transactions recorded for settlement reconciliation.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Daily Tax Ledger Schedule -->
          <div class="rounded-2xl border bg-white shadow-sm overflow-hidden" style="border-color: rgba(104, 41, 58, 0.12);">
            <div class="px-6 py-4 flex items-center justify-between" style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
              <div>
                <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                  Periodic Tax Ledger Schedule
                </h3>
                <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
                  Day-by-day record of taxable transactions and tax liabilities
                </p>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full tabular-nums" style="background: rgba(104, 41, 58, 0.07); color: rgb(var(--shell-sidebar));">
                {{ taxData.dailyLedger.length }} day{{ taxData.dailyLedger.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr style="background: rgba(104, 41, 58, 0.03); border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Date</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Count</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Gross Sales</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Exempt</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Taxable</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-amber-800">Tax Collected</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Cash</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Card</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Other</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 tabular-nums">
                  <tr v-for="d in taxData.dailyLedger" :key="d.date" class="report-row transition-colors">
                    <td class="px-4 py-3 text-left font-medium" style="color: rgb(var(--shell-sidebar));">{{ d.date }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ d.transactionCount }}</td>
                    <td class="px-4 py-3 text-right font-semibold" style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(d.grossSales) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #5c3742;">{{ formatCurrency(d.exemptSales) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ formatCurrency(d.taxableSales) }}</td>
                    <td class="px-4 py-3 text-right text-amber-800 font-semibold">{{ formatCurrency(d.taxCollected) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ formatCurrency(d.cashSales) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ formatCurrency(d.cardSales) }}</td>
                    <td class="px-4 py-3 text-right" style="color: #4a2530;">{{ formatCurrency(d.otherSales) }}</td>
                  </tr>
                  <tr v-if="taxData.dailyLedger.length === 0">
                    <td colspan="9" class="px-4 py-10 text-center text-sm" style="color: #5c3742;">
                      No daily tax activity recorded.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Line-Item Tax Audit Trail -->
          <div class="rounded-2xl border bg-white shadow-sm overflow-hidden" style="border-color: rgba(104, 41, 58, 0.12);">
            <div class="px-6 py-4 flex items-center justify-between" style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
              <div>
                <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                  Line-Item Tax Audit Trail
                </h3>
                <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
                  Audited line-item entries with tax calculations and receipt references
                </p>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full tabular-nums" style="background: rgba(104, 41, 58, 0.07); color: rgb(var(--shell-sidebar));">
                {{ taxData.lineItems.length }}
                <span v-if="taxData.totalLineItemsCount && taxData.totalLineItemsCount > taxData.lineItems.length">
                  of {{ taxData.totalLineItemsCount }}
                </span>
                item{{ taxData.lineItems.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[820px]">
                <thead>
                  <tr style="background: rgba(104, 41, 58, 0.03); border-bottom: 1px solid rgba(104, 41, 58, 0.1);">
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Timestamp</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Receipt / ID</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Item Description</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Qty</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Price</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Gross</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Taxable</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Tax %</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-amber-800">Tax Amt</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Payment</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">Ref</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 tabular-nums">
                  <tr v-for="(item, idx) in taxData.lineItems" :key="idx" class="report-row transition-colors">
                    <td class="px-4 py-2.5 text-left text-xs whitespace-nowrap" style="color: #5c3742;">{{ item.timestamp?.slice(0, 19).replace('T', ' ') || '—' }}</td>
                    <td class="px-4 py-2.5 text-left font-semibold" style="color: rgb(var(--shell-sidebar));">{{ item.receiptNumber || item.orderId }}</td>
                    <td class="px-4 py-2.5 text-left font-medium" style="color: rgb(var(--shell-sidebar));">{{ item.itemName }}</td>
                    <td class="px-4 py-2.5 text-right" style="color: #4a2530;">{{ item.quantity }}</td>
                    <td class="px-4 py-2.5 text-right" style="color: #4a2530;">{{ formatCurrency(item.unitPrice) }}</td>
                    <td class="px-4 py-2.5 text-right font-semibold" style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(item.grossAmount) }}</td>
                    <td class="px-4 py-2.5 text-right" style="color: #4a2530;">{{ formatCurrency(item.taxableAmount) }}</td>
                    <td class="px-4 py-2.5 text-right" style="color: #5c3742;">{{ item.taxRate }}%</td>
                    <td class="px-4 py-2.5 text-right text-amber-800 font-semibold">{{ formatCurrency(item.taxAmount) }}</td>
                    <td class="px-4 py-2.5 text-left capitalize" style="color: #4a2530;">{{ item.paymentMethod }}</td>
                    <td class="px-4 py-2.5 text-left text-xs" style="color: #5c3742;">{{ item.paymentReference || '—' }}</td>
                  </tr>
                  <tr v-if="taxData.lineItems.length === 0">
                    <td colspan="11" class="px-4 py-10 text-center text-sm" style="color: #5c3742;">
                      No line item tax details recorded.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <!-- ── TAB 4 & 5: WORKSPACE & STAFF ACTIVITY TABLES ───────── -->
      <div
        v-else
        class="rounded-2xl border bg-white shadow-sm overflow-hidden"
        style="border-color: rgba(104, 41, 58, 0.12);"
      >
        <div
          class="px-6 py-4 flex items-center justify-between"
          style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
        >
          <div>
            <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
              {{ activeTabLabel }}
            </h3>
            <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
              Summary of actions recorded across your terminals and workspace
            </p>
          </div>
          <span class="text-xs font-semibold px-3 py-1 rounded-full tabular-nums" style="background: rgba(104, 41, 58, 0.07); color: rgb(var(--shell-sidebar));">
            {{ rows.length }} row{{ rows.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <div v-if="loading" class="px-6 py-12 text-sm text-center font-medium" style="color: #5c3742;">
          Running report…
        </div>

        <div v-else-if="rows.length === 0" class="px-6 py-12 text-sm text-center" style="color: #5c3742;">
          No activity for this period yet.
        </div>

        <div v-else class="overflow-auto">
          <table class="reports-table w-full min-w-[640px] text-sm">
            <thead>
              <tr style="background: rgba(104, 41, 58, 0.03);">
                <th
                  v-for="col in customColumns"
                  :key="col"
                  class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                  style="color: #5c3742; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
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
                style="border-bottom: 1px solid rgba(104, 41, 58, 0.07);"
              >
                <td
                  v-for="col in customColumns"
                  :key="`${i}-${col}`"
                  class="px-5 py-3.5 tabular-nums font-medium"
                  style="color: #4a2530;"
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
  background: rgba(104, 41, 58, 0.025);
}

@media (max-width: 768px) {
  .reports-table {
    min-width: 100% !important;
    table-layout: fixed;
  }

  .reports-table th,
  .reports-table td {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    overflow-wrap: anywhere;
  }
}
</style>
