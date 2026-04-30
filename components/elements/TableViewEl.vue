<script setup lang="ts">
/**
 * TableViewEl — renders data from a user-defined table.
 * Fetches rows via a generic data API endpoint.
 * Completely isolated — no awareness of other elements.
 */

import type { TableViewElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: TableViewElementDef; businessId: string }>();

const rows    = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const error   = ref<string | null>(null);
const page    = ref(0);

const { authHeaders } = useAuth();
const pageSize = props.element.pageSize ?? 20;

async function fetchRows() {
  loading.value = true;
  error.value   = null;

  try {
    const res = await $fetch<{ data: Record<string, unknown>[]; error: string | null }>(
      '/api/data/query',
      {
        method:  'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body:    {
          businessId: props.businessId,
          tableName:  props.element.tableName,
          columns:    props.element.columns,
          limit:      pageSize,
          offset:     page.value * pageSize,
        },
      },
    );

    rows.value  = res.data ?? [];
    error.value = res.error;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchRows);
watch(() => [props.element.tableName, page.value], fetchRows);
</script>

<template>
  <div class="w-full h-full flex flex-col surface rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="px-3 py-2 border-b border-white/10 flex items-center justify-between">
      <span class="text-xs font-semibold text-white/60 uppercase tracking-wide">
        {{ element.tableName }}
      </span>
      <button class="text-white/40 hover:text-white/80 text-xs" @click="fetchRows">↻</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="w-5 h-5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center text-red-400 text-xs px-4 text-center">
      {{ error }}
    </div>

    <!-- Table -->
    <template v-else>
      <div class="flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-white/5">
            <tr>
              <th
                v-for="col in element.columns"
                :key="col"
                class="px-3 py-2 text-left text-white/50 font-medium whitespace-nowrap"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in rows"
              :key="i"
              class="border-t border-white/5 hover:bg-white/5 transition-colors"
            >
              <td
                v-for="col in element.columns"
                :key="col"
                class="px-3 py-2 text-white/80 whitespace-nowrap max-w-[180px] truncate"
              >
                {{ row[col] ?? '—' }}
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td :colspan="element.columns.length" class="px-3 py-6 text-center text-white/30">
                No records
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-3 py-2 border-t border-white/10 flex items-center gap-2">
        <button
          class="text-xs text-white/50 hover:text-white disabled:opacity-30"
          :disabled="page === 0"
          @click="page--"
        >
          ← Prev
        </button>
        <span class="text-xs text-white/40">Page {{ page + 1 }}</span>
        <button
          class="text-xs text-white/50 hover:text-white disabled:opacity-30"
          :disabled="rows.length < pageSize"
          @click="page++"
        >
          Next →
        </button>
      </div>
    </template>
  </div>
</template>
