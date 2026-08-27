<script setup lang="ts">
import { BarChart3, Download, Play } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { isEnterprise } = useEnterpriseAccess();

const activeTab  = ref<'transactions' | 'table-activity' | 'inpoint-activity'>('transactions');
const from       = ref(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
const to         = ref(new Date().toISOString().slice(0, 10));
const group      = ref<'day' | 'week' | 'month'>('day');
const loading    = ref(false);
const rows       = ref<Record<string, unknown>[]>([]);
const customColumns = ref<string[]>([]);
const errorMessage = ref('');

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
  return String(value);
}

const TABS = computed(() => {
  const tabs = [
    { key: 'transactions',   label: 'Transactions' },
    { key: 'table-activity', label: 'Workspace activity' },
  ];

  if (isEnterprise.value) {
    tabs.push({ key: 'inpoint-activity', label: 'Staff activity' });
  }

  return tabs;
});

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

    const endpoint = activeTab.value === 'transactions'
      ? '/api/reports/transactions'
      : activeTab.value === 'table-activity'
        ? '/api/reports/table-activity'
        : '/api/reports/inpoint-activity';

    const res = await $fetch<{ rows: Record<string, unknown>[]; error: string | null }>(endpoint, {
      headers: authHeaders(),
      query:   { from: from.value, to: to.value, group: group.value },
    });
    rows.value          = res.rows ?? [];
    customColumns.value = rows.value.length > 0 ? Object.keys(rows.value[0]) : [];
    errorMessage.value  = res.error ? 'Some results could not be refreshed. Please try again.' : '';
  } catch {
    rows.value = [];
    customColumns.value = [];
    errorMessage.value = 'We could not load this report right now. Please try again.';
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  if (rows.value.length === 0 || !import.meta.client) return;
  const columns = customColumns.value.length > 0 ? customColumns.value : Object.keys(rows.value[0]);
  const lines   = [
    columns.map(reportColumnLabel).map((column) => JSON.stringify(column)).join(','),
    ...rows.value.map((row) => columns.map((col) => JSON.stringify(reportCellValue(row[col], col))).join(',')),
  ];
  const blob   = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = `${activeTab.value}-report.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

onMounted(loadReport);
watch([activeTab, group], loadReport);
</script>

<template>
  <div class="dashboard-readable flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8 flex items-end justify-between gap-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <BarChart3 class="w-4 h-4" style="color: rgba(61,24,32,0.35);" />
          <p class="text-[10px] font-mono uppercase tracking-[0.18em]" style="color: rgba(61,24,32,0.35);">Reports</p>
        </div>
        <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Business summaries</h1>
        <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">Review sales and workspace activity at a glance</p>
      </div>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] btn-ghost"
        @click="exportCsv"
      >
        <Download class="w-3.5 h-3.5" /> Export CSV
      </button>
    </div>

    <div class="px-10 py-7 space-y-5">

      <!-- ── Tab row ────────────────────────────────────────────── -->
      <div class="flex items-center gap-1" role="tablist" aria-label="Report views" style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0;">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="px-4 py-2.5 text-xs font-semibold transition-all duration-150 relative"
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
        <label for="report-from" class="sr-only">Start date</label>
        <input id="report-from" v-model="from" type="date" class="input-warm px-3 py-2 text-xs" />
        <label for="report-to" class="sr-only">End date</label>
        <input id="report-to" v-model="to" type="date" class="input-warm px-3 py-2 text-xs" />
        <label v-if="activeTab === 'transactions'" for="report-group" class="sr-only">Group transactions by</label>
        <select v-if="activeTab === 'transactions'" id="report-group" v-model="group" class="input-warm px-3 py-2 text-xs">
          <option value="day">By day</option>
          <option value="week">By week</option>
          <option value="month">By month</option>
        </select>
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon"
          @click="loadReport"
        >
          <Play class="w-3.5 h-3.5" /> Run
        </button>
      </div>

      <p v-if="errorMessage" class="text-xs" style="color: #a16207;" role="status">
        {{ errorMessage }}
      </p>

      <!-- ── Results table ──────────────────────────────────────── -->
      <div style="border: 1px solid rgba(61,24,32,0.09); border-radius: 0.75rem; overflow: hidden;">

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
