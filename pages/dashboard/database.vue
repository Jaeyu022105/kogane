<script setup lang="ts">
import type { TableDef, ColumnDef, ColumnType, NormalizationHint } from '~/lib/schemaUtils';
import { Database, Hexagon, RefreshCw, Plus, ArrowLeft, ArrowRight, X } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const businessId   = computed(() => business.value?.id);

const { tables, tableDefs, loading, error, fetchTables, createTable, dropTable, analyzeTable, fetchTableRows, updateRow } = useSchema(businessId);

const viewMode = ref<'data' | 'schema'>('data');

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
  viewMode.value      = 'data';
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

// ── Table inline editor ────────────────────────────────────────────────────

const editingCell = ref<{ rowId: string | number; col: string } | null>(null);
const editValue   = ref('');

function startEdit(row: any, col: string) {
  if (col === 'id' || col === 'created_at') return;
  editingCell.value = { rowId: row.id, col };
  editValue.value   = String(row[col] ?? '');
}

async function saveEdit() {
  if (!editingCell.value || !selectedTable.value) return;
  const { rowId, col } = editingCell.value;

  let finalVal: any = editValue.value;
  const colDef = tableColumns.value.find(c => c.name === col);
  if (colDef) {
    if (colDef.type === 'integer' || colDef.type === 'numeric') finalVal = Number(finalVal);
    else if (colDef.type === 'boolean') finalVal = finalVal === 'true';
  }

  const row = tableRows.value.find(r => r.id === rowId);
  if (row) row[col] = finalVal;

  editingCell.value = null;
  await updateRow(selectedTable.value, rowId, { [col]: finalVal });
}

// ── Create table form ──────────────────────────────────────────────────────

interface UINewColumn extends ColumnDef {
  _fkTable?: string;
}

const showNewTable = ref(false);
const newTableName = ref('');
const newColumns   = ref<UINewColumn[]>([{ name: '', type: 'text', nullable: true }]);
const hints        = ref<NormalizationHint[]>([]);
const saving       = ref(false);
const formError    = ref<string | null>(null);

const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  integer: 'Integer',
  numeric: 'Decimal',
  boolean: 'True / False',
  date: 'Date',
  timestamptz: 'Timestamp',
};
const COLUMN_TYPES = Object.keys(COLUMN_TYPE_LABELS) as ColumnType[];

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
    columns: newColumns.value.filter(c => c.name.trim()).map(c => {
      const col: ColumnDef = {
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        unique: c.unique,
      };
      if (c._fkTable) {
        col.references = { table: c._fkTable, column: 'id' };
      }
      return col;
    }),
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

// ── Schema Visualizer Helpers ──────────────────────────────────────────────

const schemaMapRef = ref<HTMLElement | null>(null);

// Pan and Zoom
const schemaZoom = ref(1);
const schemaCamX = ref(0);
const schemaCamY = ref(0);

const schemaPan = ref<{ startX: number; startY: number; origCamX: number; origCamY: number } | null>(null);

function onSchemaWheel(ev: WheelEvent) {
  if (viewMode.value !== 'schema') return;
  ev.preventDefault();
  const oldZoom = schemaZoom.value;
  const nextZoom = Math.max(0.1, Math.min(3, oldZoom + (ev.deltaY > 0 ? -0.05 : 0.05)));
  if (oldZoom === nextZoom || !schemaMapRef.value) return;

  const rect = schemaMapRef.value.getBoundingClientRect();
  const mouseX = ev.clientX - rect.left;
  const mouseY = ev.clientY - rect.top;
  const worldX = (mouseX - schemaCamX.value) / oldZoom;
  const worldY = (mouseY - schemaCamY.value) / oldZoom;

  schemaZoom.value = nextZoom;
  schemaCamX.value = mouseX - worldX * nextZoom;
  schemaCamY.value = mouseY - worldY * nextZoom;
}

function onSchemaMousedown(ev: MouseEvent) {
  if (ev.button !== 0 && ev.button !== 1) return;
  schemaPan.value = {
    startX: ev.clientX,
    startY: ev.clientY,
    origCamX: schemaCamX.value,
    origCamY: schemaCamY.value,
  };
  window.addEventListener('mousemove', onSchemaPanMove);
  window.addEventListener('mouseup', onSchemaPanUp, { once: true });
}

function onSchemaPanMove(ev: MouseEvent) {
  if (!schemaPan.value) return;
  schemaCamX.value = schemaPan.value.origCamX + (ev.clientX - schemaPan.value.startX);
  schemaCamY.value = schemaPan.value.origCamY + (ev.clientY - schemaPan.value.startY);
}

function onSchemaPanUp() {
  schemaPan.value = null;
  window.removeEventListener('mousemove', onSchemaPanMove);
}

onMounted(() => {
  schemaMapRef.value?.addEventListener('wheel', onSchemaWheel, { passive: false });
});

onUnmounted(() => {
  schemaMapRef.value?.removeEventListener('wheel', onSchemaWheel);
});

// Table positions & dragging
const tablePositions = ref<Record<string, { x: number; y: number }>>({});

function initTablePositions() {
  if (tableDefs.value.length === 0) return;
  
  tableDefs.value.forEach((table, index) => {
    if (!tablePositions.value[table.name]) {
      const cols = Math.max(1, Math.ceil(Math.sqrt(tableDefs.value.length)));
      tablePositions.value[table.name] = {
        x: (index % cols) * 350 + 50,
        y: Math.floor(index / cols) * 300 + 50,
      };
    }
  });
}

watch(tableDefs, initTablePositions, { immediate: true });

function autoArrangeTables() {
  const cols = Math.max(1, Math.ceil(Math.sqrt(tableDefs.value.length)));
  tableDefs.value.forEach((table, index) => {
    tablePositions.value[table.name] = {
      x: (index % cols) * 350 + 50,
      y: Math.floor(index / cols) * 300 + 50,
    };
  });
  schemaCamX.value = 0;
  schemaCamY.value = 0;
  schemaZoom.value = 1;
}

const tableDrag = ref<{ name: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

function onTableMousedown(ev: MouseEvent, tableName: string) {
  ev.stopPropagation();
  const pos = tablePositions.value[tableName] || { x: 0, y: 0 };
  tableDrag.value = {
    name: tableName,
    startX: ev.clientX,
    startY: ev.clientY,
    origX: pos.x,
    origY: pos.y,
  };
  window.addEventListener('mousemove', onTableMousemove);
  window.addEventListener('mouseup', onTableMouseup, { once: true });
}

function onTableMousemove(ev: MouseEvent) {
  if (!tableDrag.value) return;
  const dx = (ev.clientX - tableDrag.value.startX) / schemaZoom.value;
  const dy = (ev.clientY - tableDrag.value.startY) / schemaZoom.value;
  tablePositions.value[tableDrag.value.name] = {
    x: tableDrag.value.origX + dx,
    y: tableDrag.value.origY + dy,
  };
}

function onTableMouseup() {
  tableDrag.value = null;
  window.removeEventListener('mousemove', onTableMousemove);
}

function getTableDef(name: string) {
  return tableDefs.value.find(t => t.name === name);
}

function getTablePositionSafe(name: string) {
  return tablePositions.value[name] || { x: 0, y: 0 };
}

</script>

<template>
  <div class="flex-1 flex overflow-hidden" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">
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
        >
          <div class="flex items-center gap-1">
            <Plus class="w-3 h-3" /> New
          </div>
        </button>
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
          <div class="flex bg-gray-100 rounded-lg p-1 mr-4" style="background: rgba(61,24,32,0.06);">
            <button
              class="text-xs px-3 py-1.5 rounded-md transition-all font-semibold"
              :style="viewMode === 'data' ? 'background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: rgb(var(--shell-sidebar));' : 'color: rgba(61,24,32,0.5);'"
              @click="viewMode = 'data'"
            >
              Data
            </button>
            <button
              class="text-xs px-3 py-1.5 rounded-md transition-all font-semibold"
              :style="viewMode === 'schema' ? 'background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: rgb(var(--shell-sidebar));' : 'color: rgba(61,24,32,0.5);'"
              @click="viewMode = 'schema'"
            >
              Schema
            </button>
          </div>

          <button
            v-if="viewMode === 'schema'"
            class="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style="border: 1.5px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.6); background: white;"
            @click="autoArrangeTables"
          >
            Auto Arrange
          </button>

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
            class="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all btn-primary btn-ribbon"
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
              class="mt-2 text-xs font-semibold px-4 py-2 rounded-full transition-all btn-primary btn-ribbon"
              @click="showNewTable = true"
            >
              <div class="flex items-center justify-center gap-1.5">
                <Plus class="w-3.5 h-3.5" /> New Table
              </div>
            </button>
          </div>
        </div>

        <!-- Loading rows -->
        <div v-else-if="rowsLoading && viewMode === 'data'" class="flex items-center justify-center h-32">
          <div
            class="w-6 h-6 rounded-full border-2 animate-spin"
            style="border-color: rgba(61,24,32,0.15); border-top-color: rgb(var(--shell-sidebar));"
          />
        </div>

        <!-- Schema Visualizer -->
        <div
          v-else-if="viewMode === 'schema'"
          class="h-full relative overflow-hidden bg-[#f8f5f2]"
          ref="schemaMapRef"
          @mousedown="onSchemaMousedown"
        >
          <!-- Grid background -->
          <svg class="absolute inset-0 pointer-events-none opacity-20" width="100%" height="100%">
            <defs>
              <pattern id="schema-grid" width="16" height="16" patternUnits="userSpaceOnUse" :patternTransform="`translate(${schemaCamX}, ${schemaCamY}) scale(${schemaZoom})`">
                <circle cx="1" cy="1" r="1" fill="rgba(61,24,32,0.5)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#schema-grid)" />
          </svg>

          <!-- Transform wrapper -->
          <div
            class="absolute pointer-events-none"
            :style="{ transform: `translate(${schemaCamX}px, ${schemaCamY}px) scale(${schemaZoom})`, transformOrigin: '0 0' }"
          >
            <!-- Relationships SVG -->
            <svg class="absolute inset-0 overflow-visible pointer-events-none" style="z-index: 1;">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(61,24,32,0.3)" />
                </marker>
              </defs>
              <template v-for="table in tableDefs" :key="'lines-'+table.name">
                <template v-for="col in table.columns" :key="col.name">
                  <path
                    v-if="col.references"
                    :d="`M ${getTablePositionSafe(table.name).x + 280} ${getTablePositionSafe(table.name).y + 60} C ${getTablePositionSafe(table.name).x + 350} ${getTablePositionSafe(table.name).y + 60}, ${getTablePositionSafe(col.references.table).x - 50} ${getTablePositionSafe(col.references.table).y + 40}, ${getTablePositionSafe(col.references.table).x} ${getTablePositionSafe(col.references.table).y + 40}`"
                    fill="none"
                    stroke="rgba(61,24,32,0.3)"
                    stroke-width="2"
                    marker-end="url(#arrowhead)"
                  />
                </template>
              </template>
            </svg>

            <!-- Table Cards -->
            <div
              v-for="table in tableDefs"
              :key="'box-'+table.name"
              class="absolute bg-white rounded-xl shadow-lg border z-10 w-[280px] flex flex-col pointer-events-auto"
              :style="{
                left: `${getTablePositionSafe(table.name).x}px`,
                top: `${getTablePositionSafe(table.name).y}px`,
                borderColor: 'rgba(61,24,32,0.1)'
              }"
            >
              <!-- Card Header (Draggable) -->
              <div
                class="px-4 py-3 bg-[#fdf7f2] rounded-t-xl border-b flex items-center gap-2 cursor-grab active:cursor-grabbing"
                style="borderColor: rgba(61,24,32,0.1);"
                @mousedown="onTableMousedown($event, table.name)"
              >
                <Database class="w-4 h-4 opacity-50" />
                <span class="font-mono font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">{{ table.name }}</span>
              </div>
              <div class="flex flex-col py-2">
                <div v-for="col in table.columns" :key="col.name" class="px-4 py-1.5 flex items-center justify-between hover:bg-gray-50">
                  <div class="flex items-center gap-2">
                    <span v-if="col.name === 'id'" class="text-[0.6rem] bg-yellow-100 text-yellow-800 px-1 rounded font-bold">PK</span>
                    <span v-if="col.references" class="text-[0.6rem] bg-blue-100 text-blue-800 px-1 rounded font-bold">FK</span>
                    <span class="text-xs font-mono" style="color: rgba(61,24,32,0.8);">{{ col.name }}</span>
                  </div>
                  <span class="text-[0.65rem] font-mono" :style="`color: ${typeColor(col.type)};`">{{ col.type }}</span>
                </div>
              </div>
            </div>
          </div>
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
                  class="border-r px-3 py-1.5 font-mono whitespace-nowrap cursor-text"
                  style="border-color: rgba(61,24,32,0.06); color: rgba(61,24,32,0.75); max-width: 280px; overflow: hidden; text-overflow: ellipsis;"
                  :title="String(row[col.name] ?? '')"
                  @click="startEdit(row, col.name)"
                >
                  <input
                    v-if="editingCell?.rowId === row.id && editingCell?.col === col.name"
                    v-model="editValue"
                    class="w-full bg-transparent border-none outline-none font-mono text-sm"
                    style="color: rgb(var(--shell-sidebar));"
                    @blur="saveEdit"
                    @keyup.enter="saveEdit"
                    @keyup.escape="editingCell = null"
                    autofocus
                  />
                  <template v-else>
                    <span v-if="row[col.name] === null || row[col.name] === undefined" style="color: rgba(61,24,32,0.2); font-style: italic;">null</span>
                    <span v-else>{{ cellValue(row[col.name]) }}</span>
                  </template>
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
        v-if="selectedTable && !rowsLoading && viewMode === 'data' && rowsTotal > 50"
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
              class="w-full py-1.5 text-xs rounded-full font-semibold transition-all disabled:opacity-50 btn-primary btn-ribbon"
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
                  class="flex flex-col gap-2.5 p-3 rounded-xl transition-all"
                  style="border: 1px solid rgba(61,24,32,0.1); background: rgba(61,24,32,0.015);"
                >
                  <div class="grid gap-2 items-center" style="grid-template-columns: 1fr 110px auto auto;">
                    <input v-model="col.name" class="input-warm px-3 py-1.5 text-sm font-mono" placeholder="column_name" />
                    <select v-model="col.type" class="input-warm px-2 py-1.5 text-xs">
                      <option v-for="t in COLUMN_TYPES" :key="t" :value="t">{{ COLUMN_TYPE_LABELS[t] }}</option>
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

                  <div class="flex items-center gap-4 pl-1">
                    <label class="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer" style="color: rgba(61,24,32,0.5);">
                      <input type="checkbox" v-model="col.unique" />
                      Unique
                    </label>
                    <div class="flex items-center gap-2">
                      <span class="text-xs" style="color: rgba(61,24,32,0.4);">Foreign Key:</span>
                      <select v-model="col._fkTable" class="input-warm px-2 py-1 text-xs" style="min-width: 120px;">
                        <option value="">None</option>
                        <option v-for="t in tables" :key="t" :value="t">{{ t }}</option>
                      </select>
                    </div>
                  </div>
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
                class="flex-1 py-2.5 text-sm font-semibold rounded-full transition-all disabled:opacity-40 btn-primary btn-ribbon"
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
