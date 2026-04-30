<script setup lang="ts">
/**
 * Database editor — create/delete tables, view normalization hints, apply presets.
 * State is managed via the useSchema composable.
 */

import type { TableDef, ColumnDef, ColumnType, NormalizationHint } from '~/lib/schemaUtils';

definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const businessId   = computed(() => business.value?.id);

const { tables, loading, error, fetchTables, createTable, dropTable, analyzeTable } = useSchema(businessId);

// ── Table create form ─────────────────────────────────────────────────────────

const showNewTable = ref(false);
const newTableName = ref('');
const newColumns   = ref<ColumnDef[]>([{ name: '', type: 'text', nullable: true }]);
const hints        = ref<NormalizationHint[]>([]);
const saving       = ref(false);
const formError    = ref<string | null>(null);

const COLUMN_TYPES: ColumnType[] = ['text', 'integer', 'numeric', 'boolean', 'date', 'timestamptz'];

// Debounced normalization analysis on form changes
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
  }

  saving.value = false;
}

async function handleDrop(tableName: string) {
  if (!confirm(`Drop table "${tableName}"? This cannot be undone.`)) return;
  const err = await dropTable(tableName);
  if (err) formError.value = err;
}

// ── Presets panel ─────────────────────────────────────────────────────────────

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
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Topbar -->
    <header class="px-8 py-5 border-b border-white/8 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Database Editor</h1>
        <p class="text-sm text-white/40 mt-0.5">
          {{ business?.schemaName ?? '—' }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-all"
          @click="showPresets = !showPresets"
        >
          ⬡ Presets
        </button>
        <button
          class="flex items-center gap-2 bg-brand-primary hover:brightness-110 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-brand-primary/20"
          @click="showNewTable = true"
        >
          + New Table
        </button>
      </div>
    </header>

    <div class="flex overflow-hidden" style="height: calc(100dvh - 73px);">
      <!-- Main table list -->
      <div class="flex-1 overflow-y-auto px-8 py-6">
        <div v-if="error" class="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {{ error }}
        </div>

        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="table in tables"
            :key="table"
            class="glass rounded-xl px-5 py-4 flex items-center justify-between group animate-slide-up"
          >
            <div class="flex items-center gap-3">
              <span class="text-brand-primary">⛁</span>
              <span class="text-white font-medium text-sm font-mono">{{ table }}</span>
            </div>
            <div class="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span class="text-xs text-white/30">id · created_at</span>
              <button
                class="text-white/20 hover:text-red-400 text-xs transition-colors"
                @click="handleDrop(table)"
              >
                Drop ✕
              </button>
            </div>
          </div>

          <div v-if="tables.length === 0" class="text-center py-16 space-y-3">
            <div class="text-4xl">⛁</div>
            <p class="text-white/30 text-sm">No tables yet</p>
            <p class="text-white/20 text-xs">Use a preset or create your first table</p>
          </div>
        </div>
      </div>

      <!-- Presets sidebar -->
      <Transition name="v">
        <aside v-if="showPresets" class="w-72 shrink-0 surface border-l border-white/10 overflow-y-auto animate-slide-in">
          <div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 class="font-semibold text-white text-sm">Presets</h2>
            <button class="text-white/30 hover:text-white text-xs" @click="showPresets = false">✕</button>
          </div>

          <div v-if="presets.length === 0" class="px-5 py-8 text-center text-white/30 text-sm">
            No presets available
          </div>

          <div class="p-3 space-y-2">
            <div
              v-for="preset in presets"
              :key="preset.id"
              class="glass rounded-xl p-4 space-y-2"
            >
              <p class="font-medium text-white text-sm">{{ preset.name }}</p>
              <p class="text-xs text-white/40">{{ preset.description }}</p>
              <button
                :disabled="applyingId === preset.id"
                class="w-full py-1.5 text-xs rounded-lg bg-brand-primary/15 border border-brand-primary/25 text-brand-primary hover:brightness-125 disabled:opacity-50 transition-all"
                @click="applyPreset(preset.id)"
              >
                {{ applyingId === preset.id ? 'Applying…' : 'Apply Preset' }}
              </button>
            </div>
          </div>
        </aside>
      </Transition>
    </div>

    <!-- New Table slide-over -->
    <Transition name="v">
      <div
        v-if="showNewTable"
        class="fixed inset-0 z-50 flex items-stretch justify-end"
        @click.self="showNewTable = false"
      >
        <div class="w-[480px] h-full surface border-l border-white/10 flex flex-col shadow-2xl overflow-y-auto animate-slide-in">
          <div class="px-6 py-5 border-b border-white/10 flex items-center justify-between">
            <h2 class="font-semibold text-white">New Table</h2>
            <button class="text-white/40 hover:text-white text-lg" @click="showNewTable = false">✕</button>
          </div>

          <div class="flex-1 px-6 py-5 space-y-5">
            <!-- Table name -->
            <div>
              <label class="text-xs text-white/50 block mb-1.5">
                Table name <span class="text-white/25">· snake_case, letters and digits only</span>
              </label>
              <input
                v-model="newTableName"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                placeholder="products"
              />
            </div>

            <!-- Normalization hints -->
            <Transition name="v">
              <div v-if="hints.length > 0" class="space-y-2">
                <p class="text-xs text-white/40 uppercase tracking-wide">Normalization</p>
                <div
                  v-for="(hint, i) in hints"
                  :key="i"
                  :class="[
                    'text-xs px-3 py-2 rounded-lg border',
                    hint.severity === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                      : 'bg-blue-500/10 border-blue-500/25 text-blue-300',
                  ]"
                >
                  {{ hint.message }}
                </div>
              </div>
            </Transition>

            <!-- Columns -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs text-white/50 uppercase tracking-wide">Columns</label>
                <button class="text-xs text-brand-primary hover:brightness-125" @click="addColumn">+ Add</button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="(col, idx) in newColumns"
                  :key="idx"
                  class="grid gap-2 items-center"
                  style="grid-template-columns: 1fr 110px auto auto;"
                >
                  <input
                    v-model="col.name"
                    class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    placeholder="column_name"
                  />
                  <select
                    v-model="col.type"
                    class="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    <option v-for="t in COLUMN_TYPES" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <label class="flex items-center gap-1 text-xs text-white/50 whitespace-nowrap cursor-pointer">
                    <input type="checkbox" v-model="col.nullable" class="accent-brand-primary" />
                    Null
                  </label>
                  <button
                    class="text-white/25 hover:text-red-400 text-sm transition-colors"
                    @click="removeColumn(idx)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <p class="text-xs text-white/25">
              Every table automatically gets <span class="font-mono text-white/40">id</span> and <span class="font-mono text-white/40">created_at</span> columns.
            </p>
          </div>

          <div class="px-6 py-4 border-t border-white/10 space-y-2">
            <div v-if="formError" class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {{ formError }}
            </div>
            <div class="flex gap-3">
              <button
                class="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-sm transition-all"
                @click="showNewTable = false"
              >
                Cancel
              </button>
              <button
                class="flex-1 py-2.5 rounded-xl bg-brand-primary hover:brightness-110 text-white font-semibold text-sm transition-all disabled:opacity-40 shadow-lg shadow-brand-primary/20"
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
