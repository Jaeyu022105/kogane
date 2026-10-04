<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next';
import type { TableViewElementDef } from '~/lib/uiTypes';

const props = defineProps<{
  element: TableViewElementDef;
  businessId: string;
  runtime?: any;
  builderMode?: boolean;
}>();

const loading = ref(false);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const displayColumns = computed(() =>
  props.element.columns.length > 0
    ? props.element.columns
    : ['name', 'status', 'amount'],
);

const columnLabels: Record<string, string> = {
  id: 'Reference',
  table_number: 'Table number',
  total: 'Total',
  status: 'Status',
  created_at: 'Created',
  updated_at: 'Updated',
  items: 'Items',
  item_name: 'Item',
  quantity: 'Quantity',
  unit: 'Unit',
  reorder_at: 'Reorder level',
  name: 'Name',
  category: 'Category',
  price: 'Price',
  customer_name: 'Customer',
  phone: 'Phone',
  email: 'Email',
  description: 'Details',
  notes: 'Notes',
};

function columnLabel(column: string) {
  if (columnLabels[column]) return columnLabels[column];

  return column
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const rows = computed<Record<string, unknown>[]>(() => {
  if (props.builderMode) {
    return [
      Object.fromEntries(displayColumns.value.map((column, index) => [column, ['Sample', 'Ready', 42][index] ?? `Value ${index + 1}`])),
      Object.fromEntries(displayColumns.value.map((column, index) => [column, ['Another', 'Pending', 18][index] ?? `Value ${index + 2}`])),
    ];
  }

  return props.runtime?.state?.value?.queryResults?.[props.element.id] ?? [];
});

const sourceLabel = computed(() =>
  props.element.source === 'audit-log'
    ? 'audit log'
    : props.element.tableName || 'table',
);

const textColor = computed(() => props.element.textColor ?? '#f5ede4');
const mutedTextColor = computed(() => 'rgba(245,237,228,0.65)');
const surfaceColor = computed(() => props.element.backgroundColor ?? '#161116');
const headerColor = computed(() => props.element.headerBackgroundColor ?? 'rgba(255,255,255,0.06)');

async function fetchRows() {
  if (props.builderMode || !props.runtime) return;
  loading.value = true;

  try {
    if (props.runtime.reloadElement) {
      await props.runtime.reloadElement(props.element);
    } else {
      await props.runtime.loadElement(props.element);
    }
  } finally {
    loading.value = false;
  }
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();

  if (props.builderMode) return;

  const intervalMs = Number(props.element.autoRefreshMs ?? 0);
  if (!intervalMs || intervalMs < 1000) return;

  refreshTimer = setInterval(() => {
    fetchRows();
  }, intervalMs);
}

let unsubscribeRealtime: (() => void) | null = null;

function statusBadgeClasses(status: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'fulfilled' || s === 'completed' || s === 'served') {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (s === 'preparing' || s === 'in_progress') {
    return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  }
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

async function cycleOrderStatus(row: Record<string, unknown>, e: Event) {
  e.stopPropagation();
  if (props.builderMode || !props.runtime || props.element.tableName !== 'orders' || !row.id) return;
  const current = String(row.status || 'pending').toLowerCase();
  const nextStatus = current === 'pending' ? 'preparing' : current === 'preparing' ? 'fulfilled' : 'pending';

  try {
    await props.runtime.dispatch({
      type: 'update',
      table: 'orders',
      rowId: row.id,
      payload: { status: nextStatus },
    }, {
      element: props.element,
      trigger: 'click',
    });
  } catch (err) {
    console.error('Failed to bump order status:', err);
  }
}

watch(
  () => [
    props.element.source,
    props.element.tableName,
    props.element.columns.join(','),
    JSON.stringify(props.element.filters ?? {}),
    props.element.pageSize,
  ],
  fetchRows,
  { deep: true },
);

watch(
  () => props.element.autoRefreshMs,
  () => startAutoRefresh(),
);

onMounted(() => {
  fetchRows();
  startAutoRefresh();

  if (props.runtime?.on) {
    unsubscribeRealtime = props.runtime.on('realtime:table-update', (payload: any) => {
      if (!payload?.table) return;
      if (
        payload.table === props.element.tableName ||
        (props.element.source === 'audit-log' && payload.table === 'audit_log')
      ) {
        fetchRows();
      }
    });
  }
});

onUnmounted(() => {
  stopAutoRefresh();
  unsubscribeRealtime?.();
});
</script>

<template>
  <div
    class="w-full h-full flex flex-col overflow-hidden rounded-[22px]"
    :style="{
      background: surfaceColor,
      border: '1px solid rgba(255,255,255,0.08)',
      color: textColor,
    }"
  >
    <div
      class="px-4 py-3 border-b flex items-start justify-between gap-3 shrink-0"
      style="border-color: rgba(255,255,255,0.08);"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate">{{ element.title || sourceLabel }}</p>
        <p v-if="element.subtitle" class="text-[11px] truncate" :style="{ color: mutedTextColor }">{{ element.subtitle }}</p>
      </div>
      <button
        class="text-xs shrink-0 transition-colors"
        :style="{ color: mutedTextColor }"
        aria-label="Refresh list"
        @click="fetchRows"
      >
        <RefreshCw class="w-3.5 h-3.5" />
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color: rgba(255,255,255,0.16); border-top-color: #e8748a;" />
    </div>

    <div v-else class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="sticky top-0" :style="{ background: headerColor }">
          <tr>
            <th
              v-for="column in displayColumns"
              :key="column"
              class="px-4 py-2 text-left font-medium whitespace-nowrap"
              :style="{ color: mutedTextColor }"
            >
              {{ columnLabel(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="index"
            class="border-t transition-colors"
            :style="{
              borderColor: 'rgba(255,255,255,0.06)',
              background: element.striped && index % 2 === 1 ? 'rgba(255,255,255,0.03)' : 'transparent',
            }"
          >
            <td
              v-for="column in displayColumns"
              :key="column"
              class="px-4 py-2 whitespace-nowrap max-w-[220px] truncate"
            >
              <template v-if="column === 'status'">
                <button
                  v-if="element.tableName === 'orders' && !builderMode"
                  type="button"
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all active:scale-95 cursor-pointer hover:brightness-125 shadow-sm"
                  :class="statusBadgeClasses(String(row[column] ?? 'pending'))"
                  title="Click to advance status (pending → preparing → fulfilled)"
                  @click="cycleOrderStatus(row, $event)"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {{ String(row[column] ?? 'pending').toUpperCase() }}
                </button>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                  :class="statusBadgeClasses(String(row[column] ?? 'pending'))"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current" />
                  {{ String(row[column] ?? 'pending').toUpperCase() }}
                </span>
              </template>
              <template v-else>
                {{ row[column] ?? '-' }}
              </template>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="Math.max(displayColumns.length, 1)" class="px-4 py-8 text-center" :style="{ color: mutedTextColor }">
              {{ element.emptyLabel ?? 'No records yet' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
