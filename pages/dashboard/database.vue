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
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <!-- Topbar -->
    <header
      class="px-8 py-5 flex items-center justify-between shrink-0"
      style="border-bottom: 1px solid rgba(61,24,32,0.1);"
    >
      <div>
        <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Database Editor</h1>
        <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">
          {{ business?.schemaName ?? '—' }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="text-sm font-medium px-4 py-2 rounded-full transition-all"
          style="border: 1.5px solid rgba(61,24,32,0.18); color: rgba(61,24,32,0.65);"
          @click="showPresets = !showPresets"
        >
          ⬡ Presets
        </button>
        <button
          class="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
          @click="showNewTable = true"
        >
          + New Table
        </button>
      </div>
    </header>

    <div class="flex overflow-hidden" style="height: calc(100dvh - 73px);">
      <!-- Main table list -->
      <div class="flex-1 overflow-y-auto px-8 py-6">
        <div
          v-if="error"
          class="mb-4 text-sm px-4 py-3 rounded-2xl"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
        >
          {{ error }}
        </div>

        <div v-if="loading" class="flex justify-center py-16">
          <div
            class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style="border-color: rgba(61,24,32,0.2); border-top-color: transparent;"
          />
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="table in tables"
            :key="table"
            class="bg-white rounded-xl px-5 py-4 flex items-center justify-between group animate-slide-up shadow-warm-sm"
          >
            <div class="flex items-center gap-3">
              <span style="color: rgb(var(--shell-pink));">⛁</span>
              <span class="text-sm font-medium font-mono" style="color: rgb(var(--shell-sidebar));">{{ table }}</span>
            </div>
            <div class="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span class="text-xs font-mono" style="color: rgba(61,24,32,0.3);">id · created_at</span>
              <button
                class="text-xs transition-colors font-medium"
                style="color: rgba(61,24,32,0.25);"
                @click="handleDrop(table)"
                @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = '#dc2626'"
                @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(61,24,32,0.25)'"
              >
                Drop ✕
              </button>
            </div>
          </div>

          <div v-if="tables.length === 0">
            <EmptyState
              icon="⛁"
              title="No tables yet"
              message="Use a preset or create your first table"
            />
          </div>
        </div>
      </div>

      <!-- Presets sidebar -->
      <Transition name="v">
        <aside
          v-if="showPresets"
          class="w-72 shrink-0 bg-white border-l overflow-y-auto animate-slide-in shadow-warm"
          style="border-color: rgba(61,24,32,0.1);"
        >
          <div
            class="px-5 py-4 flex items-center justify-between"
            style="border-bottom: 1px solid rgba(61,24,32,0.1);"
          >
            <h2 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">Presets</h2>
            <button
              class="text-xs transition-colors"
              style="color: rgba(61,24,32,0.3);"
              @click="showPresets = false"
            >
              ✕
            </button>
          </div>

          <div
            v-if="presets.length === 0"
            class="px-5 py-8 text-center text-sm"
            style="color: rgba(61,24,32,0.35);"
          >
            No presets available
          </div>

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
    </div>

    <!-- New Table slide-over -->
    <Transition name="v">
      <div
        v-if="showNewTable"
        class="fixed inset-0 z-50 flex items-stretch justify-end"
        @click.self="showNewTable = false"
      >
        <div
          class="w-[480px] h-full bg-white flex flex-col shadow-warm-lg overflow-y-auto animate-slide-in"
          style="border-left: 1px solid rgba(61,24,32,0.1);"
        >
          <div
            class="px-6 py-5 flex items-center justify-between"
            style="border-bottom: 1px solid rgba(61,24,32,0.1);"
          >
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">New Table</h2>
            <button
              class="text-lg transition-colors"
              style="color: rgba(61,24,32,0.3);"
              @click="showNewTable = false"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 px-6 py-5 space-y-5">
            <!-- Table name -->
            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">
                Table name
                <span class="font-normal ml-1" style="color: rgba(61,24,32,0.35);">· snake_case</span>
              </label>
              <input
                v-model="newTableName"
                class="input-warm w-full px-4 py-2.5 text-sm font-mono"
                placeholder="products"
              />
            </div>

            <!-- Normalization hints -->
            <Transition name="v">
              <div v-if="hints.length > 0" class="space-y-2">
                <p class="text-xs font-bold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">Normalization</p>
                <div
                  v-for="(hint, i) in hints"
                  :key="i"
                  :class="['text-xs px-3 py-2 rounded-xl']"
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
                <button
                  class="text-xs font-semibold transition-colors"
                  style="color: rgb(var(--shell-pink));"
                  @click="addColumn"
                >
                  + Add
                </button>
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
                    class="input-warm px-3 py-1.5 text-sm font-mono"
                    placeholder="column_name"
                  />
                  <select
                    v-model="col.type"
                    class="input-warm px-2 py-1.5 text-xs"
                  >
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
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <p class="text-xs" style="color: rgba(61,24,32,0.3);">
              Every table automatically gets <span class="font-mono" style="color: rgba(61,24,32,0.5);">id</span> and <span class="font-mono" style="color: rgba(61,24,32,0.5);">created_at</span>.
            </p>
          </div>

          <div
            class="px-6 py-4 space-y-2"
            style="border-top: 1px solid rgba(61,24,32,0.1);"
          >
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
