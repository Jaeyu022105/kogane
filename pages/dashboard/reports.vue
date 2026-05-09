<script setup lang="ts">
import { BarChart3, Download, Play } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();

const activeTab  = ref<'transactions' | 'table-activity' | 'inpoint-activity' | 'custom'>('transactions');
const from       = ref(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
const to         = ref(new Date().toISOString().slice(0, 10));
const group      = ref<'day' | 'week' | 'month'>('day');
const loading    = ref(false);
const rows       = ref<Record<string, unknown>[]>([]);
const customSql  = ref('SELECT * FROM transactions');
const customColumns = ref<string[]>([]);

const TABS = [
  { key: 'transactions',      label: 'Transactions' },
  { key: 'table-activity',    label: 'Table activity' },
  { key: 'inpoint-activity',  label: 'Inpoint activity' },
  { key: 'custom',            label: 'Custom SQL' },
] as const;

async function loadReport() {
  loading.value = true;
  try {
    if (activeTab.value === 'custom') {
      const res = await $fetch<{ columns: string[]; rows: Record<string, unknown>[]; error: string | null }>('/api/reports/custom', {
        method:  'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body:    { sql: customSql.value },
      });
      customColumns.value = res.columns ?? [];
      rows.value          = res.rows ?? [];
      return;
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
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  if (rows.value.length === 0 || !import.meta.client) return;
  const columns = customColumns.value.length > 0 ? customColumns.value : Object.keys(rows.value[0]);
  const lines   = [
    columns.join(','),
    ...rows.value.map((row) => columns.map((col) => JSON.stringify(row[col] ?? '')).join(',')),
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
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8 flex items-end justify-between gap-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <BarChart3 class="w-4 h-4" style="color: rgba(61,24,32,0.35);" />
          <p class="text-[10px] font-mono uppercase tracking-[0.18em]" style="color: rgba(61,24,32,0.35);">Reports</p>
        </div>
        <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Data summaries</h1>
        <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">Operational summaries, activity reports, and custom read-only SQL</p>
      </div>

      <button
        class="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all active:scale-[0.97] btn-ghost"
        @click="exportCsv"
      >
        <Download class="w-3.5 h-3.5" /> Export CSV
      </button>
    </div>

    <div class="px-10 py-7 space-y-5">

      <!-- ── Tab row ────────────────────────────────────────────── -->
      <div class="flex items-center gap-1" style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0;">
        <button
          v-for="tab in TABS"
          :key="tab.key"
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
        <input v-model="from" type="date" class="input-warm px-3 py-2 text-xs" />
        <input v-model="to"   type="date" class="input-warm px-3 py-2 text-xs" />
        <select v-if="activeTab === 'transactions'" v-model="group" class="input-warm px-3 py-2 text-xs">
          <option value="day">By day</option>
          <option value="week">By week</option>
          <option value="month">By month</option>
        </select>
        <button
          class="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon"
          @click="loadReport"
        >
          <Play class="w-3.5 h-3.5" /> Run
        </button>
      </div>

      <!-- Custom SQL textarea -->
      <div v-if="activeTab === 'custom'">
        <textarea
          v-model="customSql"
          rows="7"
          class="input-warm w-full px-4 py-3 text-xs font-mono resize-none"
          style="border-radius: 0.5rem;"
        />
      </div>

      <!-- ── Results table ──────────────────────────────────────── -->
      <div style="border: 1px solid rgba(61,24,32,0.09); border-radius: 0.75rem; overflow: hidden;">

        <div class="px-5 py-3 flex items-center justify-between" style="background: rgba(61,24,32,0.02); border-bottom: 1px solid rgba(61,24,32,0.07);">
          <p class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">
            {{ TABS.find(t => t.key === activeTab)?.label }}
          </p>
          <p class="text-[10px] font-mono" style="color: rgba(61,24,32,0.3);">{{ rows.length }} row{{ rows.length !== 1 ? 's' : '' }}</p>
        </div>

        <div v-if="loading" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          Running report…
        </div>

        <div v-else-if="rows.length === 0" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          No data returned.
        </div>

        <div v-else class="overflow-auto">
          <table class="w-full min-w-[640px] text-xs">
            <thead>
              <tr style="background: rgba(61,24,32,0.02);">
                <th
                  v-for="col in customColumns"
                  :key="col"
                  class="px-4 py-3 text-left font-mono uppercase tracking-wider text-[10px]"
                  style="color: rgba(61,24,32,0.4); border-bottom: 1px solid rgba(61,24,32,0.07);"
                >
                  {{ col }}
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
                  {{ row[col] }}
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
</style>
