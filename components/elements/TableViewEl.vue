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
});

onUnmounted(() => {
  stopAutoRefresh();
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
              {{ row[column] ?? '-' }}
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
