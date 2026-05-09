<script setup lang="ts">
import { BarChart3, Download, Play } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();

const activeTab = ref<'transactions' | 'table-activity' | 'inpoint-activity' | 'custom'>('transactions');
const from = ref(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));
const group = ref<'day' | 'week' | 'month'>('day');
const loading = ref(false);
const rows = ref<Record<string, unknown>[]>([]);
const customSql = ref('SELECT * FROM transactions');
const customColumns = ref<string[]>([]);

async function loadReport() {
  loading.value = true;
  try {
    if (activeTab.value === 'custom') {
      const res = await $fetch<{ columns: string[]; rows: Record<string, unknown>[]; error: string | null }>('/api/reports/custom', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { sql: customSql.value },
      });
      customColumns.value = res.columns ?? [];
      rows.value = res.rows ?? [];
      return;
    }

    const endpoint = activeTab.value === 'transactions'
      ? '/api/reports/transactions'
      : activeTab.value === 'table-activity'
        ? '/api/reports/table-activity'
        : '/api/reports/inpoint-activity';

    const res = await $fetch<{ rows: Record<string, unknown>[]; error: string | null }>(endpoint, {
      headers: authHeaders(),
      query: {
        from: from.value,
        to: to.value,
        group: group.value,
      },
    });
    rows.value = res.rows ?? [];
    customColumns.value = rows.value.length > 0 ? Object.keys(rows.value[0]) : [];
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  if (rows.value.length === 0 || !import.meta.client) return;
  const columns = customColumns.value.length > 0 ? customColumns.value : Object.keys(rows.value[0]);
  const lines = [
    columns.join(','),
    ...rows.value.map((row) => columns.map((column) => JSON.stringify(row[column] ?? '')).join(',')),
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
watch([activeTab, group], loadReport);
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <header class="px-8 py-5" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="font-serif text-2xl font-normal flex items-center gap-3" style="color: rgb(var(--shell-sidebar));">
            <BarChart3 class="w-6 h-6" /> Reports
          </h1>
          <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">Operational summaries, activity reports, and custom read-only SQL</p>
        </div>
        <button class="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2" style="background: rgba(61,24,32,0.08); color: rgb(var(--shell-sidebar));" @click="exportCsv">
          <Download class="w-4 h-4" /> Export CSV
        </button>
      </div>
    </header>

    <div class="px-8 py-7 space-y-6">
      <div class="bg-white rounded-xl p-5 shadow-warm space-y-4">
        <div class="flex flex-wrap gap-2">
          <button v-for="tab in ['transactions','table-activity','inpoint-activity','custom']" :key="tab" class="rounded-md px-4 py-1.5 text-sm font-medium capitalize" :style="activeTab === tab ? 'background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));' : 'background: rgba(61,24,32,0.06); color: rgba(61,24,32,0.55);'" @click="activeTab = tab as any">
            {{ tab.replace('-', ' ') }}
          </button>
        </div>

        <div class="grid gap-3 md:grid-cols-4">
          <input v-model="from" type="date" class="input-warm px-3 py-2 text-sm" />
          <input v-model="to" type="date" class="input-warm px-3 py-2 text-sm" />
          <select v-if="activeTab === 'transactions'" v-model="group" class="input-warm px-3 py-2 text-sm">
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
          <button class="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2" style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));" @click="loadReport">
            <Play class="w-4 h-4" /> Run
          </button>
        </div>

        <div v-if="activeTab === 'custom'">
          <textarea v-model="customSql" rows="8" class="input-warm w-full px-4 py-3 text-sm font-mono resize-none" />
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-warm overflow-hidden">
        <div class="px-5 py-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
          <p class="text-sm font-semibold capitalize" style="color: rgb(var(--shell-sidebar));">{{ activeTab.replace('-', ' ') }}</p>
        </div>

        <div v-if="loading" class="px-5 py-8 text-sm" style="color: rgba(61,24,32,0.45);">Loading report...</div>
        <div v-else-if="rows.length === 0" class="px-5 py-8 text-sm" style="color: rgba(61,24,32,0.45);">No data returned for this report.</div>
        <div v-else class="overflow-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead style="background: #fdf7f2;">
              <tr>
                <th v-for="column in customColumns" :key="column" class="px-4 py-3 text-left font-semibold" style="color: rgba(61,24,32,0.5);">
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="index" style="border-top: 1px solid rgba(61,24,32,0.06);">
                <td v-for="column in customColumns" :key="`${index}-${column}`" class="px-4 py-3" style="color: rgba(61,24,32,0.68);">
                  {{ row[column] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
