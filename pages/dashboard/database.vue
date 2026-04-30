<script setup lang="ts">
import type { TableDef, ColumnDef, ColumnType, NormalizationHint } from '~/lib/schemaUtils';
import { Database, Hexagon, RefreshCw, Plus, ArrowLeft, ArrowRight, X } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const businessId   = computed(() => business.value?.id);

const { tables, loading, error, fetchTables, createTable, dropTable, analyzeTable, fetchTableRows } = useSchema(businessId);

// ── Selected table & rows ──────────────────────────────────────────────────

const selectedTable  = ref<string | null>(null);
const tableColumns   = ref<{ name: string; type: string }[]>([]);
const tableRows      = ref<Record<string, unknown>[]>([]);
const rowsTotal      = ref(0);
const rowsPage       = ref(1);
const rowsLoading    = ref(false);

async function selectTable(name: string) {
  selectedTable.value = name;
  rowsPage.value      = 1;
  await loadRows();
}

async function loadRows() {
  if (!selectedTable.value) return;
  rowsLoading.value = true;

  const res = await fetchTableRows(selectedTable.value, rowsPage.value);

  tableColumns.value = res.columns ?? [];
  tableRows.value    = res.rows    ?? [];
  rowsTotal.value    = res.total   ?? 0;
  rowsLoading.value  = false;
}

// ── Create table form ──────────────────────────────────────────────────────

const showNewTable = ref(false);
const newTableName = ref('');
const newColumns   = ref<ColumnDef[]>([{ name: '', type: 'text', nullable: true }]);
const hints        = ref<NormalizationHint[]>([]);
const saving       = ref(false);
const formError    = ref<string | null>(null);

const COLUMN_TYPES: ColumnType[] = ['text', 'integer', 'numeric', 'boolean', 'date', 'timestamptz'];

let analyzeTimer: ReturnType<typeof setTimeout>;

watch([newTableName, newColumns], () => {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(async () => {
    const def: TableDef = {
      name:    newTableName.value || 'unnamed',
      columns: newColumns.value.filter(c => c.name.trim()),
    };
    hints.value = await analyzeTable(def);
  }, 600);
}, { deep: true });

function addColumn() {
  newColumns.value.push({ name: '', type: 'text', nullable: true });
}

function removeColumn(idx: number) {
  newColumns.value.splice(idx, 1);
}

async function handleCreate() {
  formError.value = null;
  saving.value    = true;

  const def: TableDef = {
    name:    newTableName.value.trim(),
    columns: newColumns.value.filter(c => c.name.trim()),
  };

  const err = await createTable(def);

  if (err) {
    formError.value = err;
  } else {
    showNewTable.value = false;
    newTableName.value = '';
    newColumns.value   = [{ name: '', type: 'text', nullable: true }];
    hints.value        = [];
    await selectTable(def.name);
  }

  saving.value = false;
}

async function handleDrop(tableName: string) {
  if (!confirm(`Drop table "${tableName}"? This cannot be undone.`)) return;
  const err = await dropTable(tableName);
  if (err) {
    formError.value = err;
  } else if (selectedTable.value === tableName) {
    selectedTable.value = null;
    tableColumns.value  = [];
    tableRows.value     = [];
  }
}

// ── Presets ────────────────────────────────────────────────────────────────

const showPresets  = ref(false);
const presets      = ref<any[]>([]);
const applyingId   = ref<string | null>(null);
const { authHeaders } = useAuth();

async function loadPresets() {
  const res = await $fetch<{ presets: any[] }>('/api/presets');
  presets.value = res.presets ?? [];
}

async function applyPreset(presetId: string) {
  if (!business.value) return;
  applyingId.value = presetId;

  await $fetch('/api/presets/apply', {
    method:  'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body:    { businessId: business.value.id, presetId },
  });

  await fetchTables();
  applyingId.value  = null;
  showPresets.value = false;
}

onMounted(async () => {
  await fetchTables();
  await loadPresets();
});

watch(businessId, fetchTables);

// ── Column type badge color ────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  text:        '#6366f1',
  integer:     '#f59e0b',
  numeric:     '#f59e0b',
  boolean:     '#10b981',
  date:        '#0ea5e9',
  timestamptz: '#0ea5e9',
  uuid:        '#a78bfa',
};

function typeColor(type: string): string {
  const key = Object.keys(TYPE_COLORS).find(k => type.toLowerCase().includes(k));
  return key ? TYPE_COLORS[key] : '#94a3b8';
}

// ── Display helpers ────────────────────────────────────────────────────────

function cellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  const s = String(val);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}
</script>

<template>
  <div class="flex-1 flex overflow-hidden" style="background: rgb(var(--shell-bg));">
    <!-- ── Left sidebar: schema / table tree ──────────────────────────────── -->
    <aside class="w-56 shrink-0 flex flex-col overflow-hidden" style="background: #1a0e11; border-right: 1px solid rgba(255,255,255,0.05);">
      <!-- Header -->
      <div class="px-4 py-3 flex items-center justify-between shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.07);">
        <span class="text-xs font-semibold tracking-widest uppercase" style="color: rgba(245,237,228,0.4);">Tables</span>
        <button
          class="text-xs font-semibold px-2 py-0.5 rounded transition-all"
          style="color: rgb(var(--shell-pink)); background: rgba(232,116,138,0.12);"
          title="New table"
          @click="showNewTable = true"
          <div class="flex items-center gap-1">
            <Plus class="w-3 h-3" /> New
          </div>
      </div>

      <!-- Schema label -->
      <div class="px-4 pt-3 pb-1">
        <p class="text-xs font-semibold" style="color: rgba(245,237,228,0.25);">
          {{ business?.schemaName ?? '—' }}
        </p>
      </div>

      <!-- Table list -->
      <div class="flex-1 overflow-y-auto py-1 px-2">
        <div v-if="loading" class="px-2 py-4 text-xs" style="color: rgba(245,237,228,0.25);">Loading…</div>

        <button
          v-for="table in tables"
          :key="table"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all mb-0.5"
          :style="selectedTable === table
            ? 'background: rgba(232,116,138,0.15); color: rgb(232,116,138);'
            : 'color: rgba(245,237,228,0.55);'"
          @click="selectTable(table)"
          @mouseenter="(e: MouseEvent) => { if (selectedTable !== table) (e.currentTarget as HTMLElement).style.background = 'rgba(245,237,228,0.05)'; }"
          @mouseleave="(e: MouseEvent) => { if (selectedTable !== table) (e.currentTarget as HTMLElement).style.background = ''; }"
        >
          <Database class="w-3 h-3 opacity-50" />
          <span class="font-mono truncate">{{ table }}</span>
        </button>

        <div v-if="!loading && tables.length === 0" class="px-2 py-4 text-xs text-center" style="color: rgba(245,237,228,0.2);">
          No tables yet
        </div>
      </div>

      <!-- Presets button -->
      <div class="p-3 shrink-0" style="border-top: 1px solid rgba(255,255,255,0.05);">
        <button
          class="w-full text-xs font-medium py-1.5 rounded-lg transition-all"
          style="color: rgba(245,237,228,0.4); background: rgba(245,237,228,0.05);"
          @click="showPresets = !showPresets"
          @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(245,237,228,0.75)'"
          @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(245,237,228,0.4)'"
        >
          <div class="flex items-center justify-center gap-1.5">
            <Hexagon class="w-3.5 h-3.5" /> Presets
          </div>
        </button>
      </div>
    </aside>

    <!-- ── Main content area ───────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Topbar -->
      <header
        class="px-6 py-3 flex items-center gap-3 shrink-0 bg-white"
        style="border-bottom: 1px solid rgba(61,24,32,0.1); min-height: 49px;"
      >
        <div v-if="selectedTable" class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-xs font-mono px-2 py-0.5 rounded" style="background: rgba(61,24,32,0.07); color: rgba(61,24,32,0.5);">
            {{ business?.schemaName }}
          </span>
          <span style="color: rgba(61,24,32,0.3);">/</span>
          <span class="font-mono font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">{{ selectedTable }}</span>
          <span class="text-xs ml-1" style="color: rgba(61,24,32,0.35);">{{ rowsTotal }} rows</span>
        </div>

        <div v-else class="flex-1">
          <p class="text-sm" style="color: rgba(61,24,32,0.4);">Select a table to view its data</p>
        </div>

        <div v-if="selectedTable" class="flex items-center gap-2 shrink-0">
          <button
            class="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.6);"
            @click="handleDrop(selectedTable!)"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.borderColor = '#dc2626'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(61,24,32,0.15)'"
          >
            Drop Table
          </button>
          <button
            class="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
            @click="loadRows"
          >
            <div class="flex items-center gap-1.5">
              <RefreshCw class="w-3.5 h-3.5" /> Refresh
            </div>
          </button>
        </div>
      </header>

      <!-- Grid area -->
      <div class="flex-1 overflow-auto">
        <!-- Empty state: no table selected -->
        <div v-if="!selectedTable" class="flex items-center justify-center h-full">
          <div class="text-center space-y-2">
            <Database class="w-12 h-12 mx-auto" style="color: rgba(61,24,32,0.12);" />
            <p class="text-sm" style="color: rgba(61,24,32,0.3);">Pick a table from the sidebar</p>
            <button
              class="mt-2 text-xs font-semibold px-4 py-2 rounded-full transition-all"
              style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
              @click="showNewTable = true"
            >
              <div class="flex items-center justify-center gap-1.5">
                <Plus class="w-3.5 h-3.5" /> New Table
              </div>
            </button>
          </div>
        </div>

        <!-- Loading rows -->
        <div v-else-if="rowsLoading" class="flex items-center justify-center h-32">
          <div
            class="w-6 h-6 rounded-full border-2 animate-spin"
            style="border-color: rgba(61,24,32,0.15); border-top-color: rgb(var(--shell-sidebar));"
          />
        </div>

        <!-- Spreadsheet grid -->
        <div v-else class="h-full">
          <table class="w-full border-collapse text-xs" style="min-width: max-content;">
            <!-- Column headers -->
            <thead>
              <tr style="background: #fdf7f2; position: sticky; top: 0; z-index: 2;">
                <!-- Row number col -->
                <th class="border-r border-b px-3 py-2 text-left font-medium w-10 shrink-0 select-none"
                    style="border-color: rgba(61,24,32,0.1); color: rgba(61,24,32,0.3); width: 40px;">
                  #
                </th>
                <th
                  v-for="col in tableColumns"
                  :key="col.name"
                  class="border-r border-b px-3 py-2 text-left font-medium whitespace-nowrap select-none"
                  style="border-color: rgba(61,24,32,0.1); color: rgb(var(--shell-sidebar)); min-width: 140px;"
                >
                  <div class="flex items-center gap-1.5">
                    <span
                      class="text-[0.6rem] font-mono px-1 py-0.5 rounded"
                      :style="`background: ${typeColor(col.type)}18; color: ${typeColor(col.type)};`"
                    >
                      {{ col.type.replace('character varying', 'text').replace('timestamp with time zone', 'timestamptz') }}
                    </span>
                    <span>{{ col.name }}</span>
                  </div>
                </th>
              </tr>
            </thead>

            <!-- Rows -->
            <tbody>
              <tr
                v-for="(row, i) in tableRows"
                :key="String(row.id ?? i)"
                class="border-b group transition-colors"
                style="border-color: rgba(61,24,32,0.06);"
                @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'rgba(61,24,32,0.025)'"
                @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = ''"
              >
                <td class="border-r px-3 py-1.5 select-none" style="border-color: rgba(61,24,32,0.06); color: rgba(61,24,32,0.25); width: 40px;">
                  {{ (rowsPage - 1) * 50 + i + 1 }}
                </td>
                <td
                  v-for="col in tableColumns"
                  :key="col.name"
                  class="border-r px-3 py-1.5 font-mono whitespace-nowrap"
                  style="border-color: rgba(61,24,32,0.06); color: rgba(61,24,32,0.75); max-width: 280px; overflow: hidden; text-overflow: ellipsis;"
                  :title="String(row[col.name] ?? '')"
                >
                  <span v-if="row[col.name] === null || row[col.name] === undefined" style="color: rgba(61,24,32,0.2); font-style: italic;">null</span>
                  <span v-else>{{ cellValue(row[col.name]) }}</span>
                </td>
              </tr>

              <!-- Empty rows state -->
              <tr v-if="tableRows.length === 0">
                <td :colspan="tableColumns.length + 1" class="px-6 py-10 text-center text-xs" style="color: rgba(61,24,32,0.3);">
                  No rows in this table yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination footer -->
      <div
        v-if="selectedTable && !rowsLoading && rowsTotal > 50"
        class="px-6 py-2.5 flex items-center justify-between shrink-0 bg-white"
        style="border-top: 1px solid rgba(61,24,32,0.08);"
      >
        <span class="text-xs" style="color: rgba(61,24,32,0.4);">
          {{ (rowsPage - 1) * 50 + 1 }}–{{ Math.min(rowsPage * 50, rowsTotal) }} of {{ rowsTotal }}
        </span>
        <div class="flex gap-2">
          <button
            :disabled="rowsPage <= 1"
            class="text-xs px-3 py-1 rounded-lg transition-all disabled:opacity-30"
            style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.6);"
            @click="rowsPage--; loadRows()"
          >
            <div class="flex items-center gap-1">
              <ArrowLeft class="w-3.5 h-3.5" /> Prev
            </div>
          </button>
          <button
            :disabled="rowsPage * 50 >= rowsTotal"
            class="text-xs px-3 py-1 rounded-lg transition-all disabled:opacity-30"
            style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.6);"
            @click="rowsPage++; loadRows()"
          >
            <div class="flex items-center gap-1">
              Next <ArrowRight class="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Presets panel (right slide-over) ───────────────────────────────── -->
    <Transition name="v">
      <aside
        v-if="showPresets"
        class="w-64 shrink-0 bg-white flex flex-col overflow-y-auto"
        style="border-left: 1px solid rgba(61,24,32,0.1);"
      >
        <div class="px-5 py-4 flex items-center justify-between shrink-0" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
          <h2 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">Presets</h2>
          <button class="text-xs transition-colors" style="color: rgba(61,24,32,0.3);" @click="showPresets = false">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="presets.length === 0" class="px-5 py-8 text-center text-xs" style="color: rgba(61,24,32,0.35);">No presets available</div>

        <div class="p-3 space-y-2">
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="rounded-xl p-4 space-y-2"
            style="background: #fdf7f2; border: 1px solid rgba(61,24,32,0.08);"
          >
            <p class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">{{ preset.name }}</p>
            <p class="text-xs" style="color: rgba(61,24,32,0.45);">{{ preset.description }}</p>
            <button
              :disabled="applyingId === preset.id"
              class="w-full py-1.5 text-xs rounded-full font-semibold transition-all disabled:opacity-50"
              style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
              @click="applyPreset(preset.id)"
            >
              {{ applyingId === preset.id ? 'Applying…' : 'Apply Preset' }}
            </button>
          </div>
        </div>
      </aside>
    </Transition>

    <!-- ── New Table slide-over ────────────────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="showNewTable"
        class="fixed inset-0 z-50 flex items-stretch justify-end"
        @click.self="showNewTable = false"
      >
        <div
          class="w-[480px] h-full bg-white flex flex-col shadow-2xl overflow-y-auto"
          style="border-left: 1px solid rgba(61,24,32,0.1);"
        >
          <div class="px-6 py-5 flex items-center justify-between shrink-0" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">New Table</h2>
            <button class="text-lg transition-colors" style="color: rgba(61,24,32,0.3);" @click="showNewTable = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="flex-1 px-6 py-5 space-y-5">
            <!-- Table name -->
            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">
                Table name
                <span class="font-normal ml-1" style="color: rgba(61,24,32,0.35);">· snake_case</span>
              </label>
              <input v-model="newTableName" class="input-warm w-full px-4 py-2.5 text-sm font-mono" placeholder="products" />
            </div>

            <!-- Normalization hints -->
            <Transition name="v">
              <div v-if="hints.length > 0" class="space-y-2">
                <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">Normalization</p>
                <div
                  v-for="(hint, i) in hints"
                  :key="i"
                  class="text-xs px-3 py-2 rounded-xl"
                  :style="hint.severity === 'warning'
                    ? 'background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.25); color: #92400e;'
                    : 'background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); color: #1d4ed8;'"
                >
                  {{ hint.message }}
                </div>
              </div>
            </Transition>

            <!-- Columns -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <label class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">Columns</label>
                <button class="text-xs font-semibold transition-colors" style="color: rgb(var(--shell-pink));" @click="addColumn">
                  <div class="flex items-center gap-1">
                    <Plus class="w-3.5 h-3.5" /> Add
                  </div>
                </button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="(col, idx) in newColumns"
                  :key="idx"
                  class="grid gap-2 items-center"
                  style="grid-template-columns: 1fr 110px auto auto;"
                >
                  <input v-model="col.name" class="input-warm px-3 py-1.5 text-sm font-mono" placeholder="column_name" />
                  <select v-model="col.type" class="input-warm px-2 py-1.5 text-xs">
                    <option v-for="t in COLUMN_TYPES" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <label class="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer" style="color: rgba(61,24,32,0.5);">
                    <input type="checkbox" v-model="col.nullable" />
                    Null
                  </label>
                  <button
                    class="text-sm transition-colors"
                    style="color: rgba(61,24,32,0.25);"
                    @click="removeColumn(idx)"
                    @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = '#dc2626'"
                    @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(61,24,32,0.25)'"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <p class="text-xs" style="color: rgba(61,24,32,0.3);">
              Every table automatically gets <span class="font-mono" style="color: rgba(61,24,32,0.5);">id</span> and <span class="font-mono" style="color: rgba(61,24,32,0.5);">created_at</span>.
            </p>
          </div>

          <div class="px-6 py-4 space-y-2 shrink-0" style="border-top: 1px solid rgba(61,24,32,0.1);">
            <div
              v-if="formError"
              class="text-xs px-3 py-2 rounded-xl"
              style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
            >
              {{ formError }}
            </div>
            <div class="flex gap-3">
              <button
                class="flex-1 py-2.5 text-sm font-medium rounded-full transition-all"
                style="border: 1.5px solid rgba(61,24,32,0.18); color: rgba(61,24,32,0.65);"
                @click="showNewTable = false"
              >
                Cancel
              </button>
              <button
                class="flex-1 py-2.5 text-sm font-semibold rounded-full transition-all disabled:opacity-40"
                style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
                :disabled="!newTableName.trim() || saving"
                @click="handleCreate"
              >
                {{ saving ? 'Creating…' : 'Create Table' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
