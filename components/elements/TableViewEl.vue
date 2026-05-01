<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next';
import type { TableViewElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: TableViewElementDef; businessId: string; runtime?: any; builderMode?: boolean }>();

const rows = computed<Record<string, unknown>[]>(() => props.runtime?.state?.value?.queryResults?.[props.element.id] ?? []);

async function fetchRows() {
  if (props.builderMode) return;
  await props.runtime?.loadElement?.(props.element);
}

onMounted(fetchRows);
</script>

<template>
  <div class="w-full h-full flex flex-col surface rounded-lg overflow-hidden">
    <div class="px-3 py-2 border-b border-white/10 flex items-center justify-between">
      <span class="text-xs font-semibold text-white/60 uppercase tracking-wide">
        {{ element.tableName }}
      </span>
      <button class="text-white/40 hover:text-white/80 text-xs" @click="fetchRows">
        <RefreshCw class="w-3.5 h-3.5" />
      </button>
    </div>

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
            v-for="(row, index) in rows"
            :key="index"
            class="border-t border-white/5 hover:bg-white/5 transition-colors"
          >
            <td
              v-for="col in element.columns"
              :key="col"
              class="px-3 py-2 text-white/80 whitespace-nowrap max-w-[180px] truncate"
            >
              {{ row[col] ?? '-' }}
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="element.columns.length" class="px-3 py-6 text-center text-white/30">
              {{ element.emptyLabel ?? 'No records' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
