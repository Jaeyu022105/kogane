<script setup lang="ts">
import { Filter, Shield, ChevronLeft, ChevronRight } from 'lucide-vue-next';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();

const loading    = ref(false);
const page       = ref(1);
const perPage    = ref(50);
const actorType  = ref('all');
const actionType = ref('');
const tableFilter = ref('');
const from       = ref(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
const to         = ref(new Date().toISOString().slice(0, 10));
const total      = ref(0);
const entries    = ref<any[]>([]);
const errorMessage = ref('');

const ACTION_LABELS: Record<string, string> = {
  insert: 'Added',
  update: 'Updated',
  delete: 'Removed',
  login: 'Signed in',
  logout: 'Signed out',
  upload: 'Uploaded',
  'permission:denied': 'Access blocked',
  'schema:create': 'Workspace updated',
  'schema:alter': 'Workspace updated',
  'schema:drop': 'Workspace updated',
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'rgba(22,163,74,0.12)',
  UPDATE: 'rgba(234,179,8,0.12)',
  DELETE: 'rgba(239,68,68,0.12)',
};

const ACTION_TEXT: Record<string, string> = {
  INSERT: '#15803d',
  UPDATE: '#a16207',
  DELETE: '#dc2626',
};

const AREA_LABELS: Record<string, string> = {
  products: 'Catalog',
  orders: 'Orders',
  inventory: 'Inventory',
  transactions: 'Sales',
  appointments: 'Appointments',
  customers: 'Customers',
  terminals: 'Staff workspaces',
  audit_log: 'Activity',
};

const ACTION_FILTERS = [
  { value: 'insert', label: 'Added' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Removed' },
  { value: 'login', label: 'Signed in' },
  { value: 'logout', label: 'Signed out' },
  { value: 'upload', label: 'Uploaded' },
  { value: 'permission:denied', label: 'Access blocked' },
];

const AREA_FILTERS = [
  { value: 'products', label: 'Catalog' },
  { value: 'orders', label: 'Orders' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'transactions', label: 'Sales' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'customers', label: 'Customers' },
  { value: 'terminals', label: 'Staff workspaces' },
];

async function loadEntries() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await $fetch<{ entries: any[]; total: number; error: string | null }>('/api/audit-log', {
      headers: authHeaders(),
      query: {
        page:       page.value,
        per_page:   perPage.value,
        actor_type: actorType.value,
        action_type: actionType.value || undefined,
        table:      tableFilter.value || undefined,
        from:       from.value,
        to:         to.value,
      },
    });
    entries.value = res.entries ?? [];
    total.value   = res.total ?? 0;
    errorMessage.value = res.error ? 'Some activity could not be refreshed. Please try again.' : '';
  } catch {
    entries.value = [];
    total.value = 0;
    errorMessage.value = 'We could not load activity right now. Please try again.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadEntries);

function actionColor(type: string) {
  return ACTION_COLORS[type?.toUpperCase()] ?? 'rgba(61,24,32,0.07)';
}

function actionText(type: string) {
  return ACTION_TEXT[type?.toUpperCase()] ?? 'rgba(61,24,32,0.55)';
}

function actionLabel(type: string) {
  return ACTION_LABELS[type?.toLowerCase()] ?? 'Activity recorded';
}

function actorLabel(type: string) {
  const actor = type?.toLowerCase();
  return actor === 'admin' ? 'Owner workspace' : actor === 'inpoint' ? 'Staff terminal' : 'Workspace';
}

function areaLabel(value: string | null | undefined) {
  const area = String(value ?? '').toLowerCase();
  return AREA_LABELS[area] ?? (area ? 'Workspace records' : 'Workspace');
}

function activityDetails(entry: any) {
  const action = entry.action_type?.toLowerCase();
  const area = areaLabel(entry.target_table);
  if (action === 'insert') return `Added an item to ${area}`;
  if (action === 'update') return `Updated ${area}`;
  if (action === 'delete') return `Removed an item from ${area}`;
  if (action === 'login') return 'Signed in to the workspace';
  if (action === 'logout') return 'Signed out of the workspace';
  if (action === 'upload') return 'Uploaded a file';
  if (action === 'permission:denied') return 'An access request was blocked';
  return 'Workspace settings were updated';
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function applyFilters() {
  page.value = 1;
  loadEntries();
}
</script>

<template>
  <div class="dashboard-readable flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div class="flex items-center gap-3 mb-1">
        <Shield class="w-4 h-4" style="color: rgba(61,24,32,0.35);" />
        <p class="text-[10px] font-mono uppercase tracking-[0.18em]" style="color: rgba(61,24,32,0.35);">Audit Log</p>
      </div>
      <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Activity trail</h1>
      <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">A clear record of important workspace activity</p>
    </div>

    <div class="px-10 py-7 space-y-6">

      <!-- ── Filter bar ─────────────────────────────────────────── -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex items-center gap-1.5 shrink-0" style="color: rgba(61,24,32,0.35);">
          <Filter class="w-3.5 h-3.5" />
          <span class="text-[10px] font-mono uppercase tracking-widest">Filters</span>
        </div>

        <label for="audit-actor" class="sr-only">Filter by person</label>
        <select id="audit-actor" v-model="actorType" class="input-warm px-3 py-2 text-xs">
          <option value="all">All actors</option>
          <option value="admin">Owner workspace</option>
          <option value="inpoint">Staff terminal</option>
        </select>

        <label for="audit-action" class="sr-only">Activity</label>
        <select id="audit-action" v-model="actionType" class="input-warm px-3 py-2 text-xs">
          <option value="">All activity</option>
          <option v-for="filter in ACTION_FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</option>
        </select>
        <label for="audit-target" class="sr-only">Area</label>
        <select id="audit-target" v-model="tableFilter" class="input-warm px-3 py-2 text-xs">
          <option value="">All areas</option>
          <option v-for="filter in AREA_FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</option>
        </select>
        <label for="audit-from" class="sr-only">Start date</label>
        <input id="audit-from" v-model="from" type="date" class="input-warm px-3 py-2 text-xs" />
        <label for="audit-to" class="sr-only">End date</label>
        <input id="audit-to" v-model="to"   type="date" class="input-warm px-3 py-2 text-xs" />

        <button
          type="button"
          class="px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon"
          @click="applyFilters"
        >
          Apply
        </button>
      </div>

      <!-- ── Log table ──────────────────────────────────────────── -->
      <div class="audit-table-shell" style="border: 1px solid rgba(61,24,32,0.09); border-radius: 0.75rem; overflow-x: auto; overflow-y: hidden;">

        <!-- Table head -->
        <div
          class="audit-table-grid grid text-[10px] font-mono uppercase tracking-widest px-5 py-3"
          style="grid-template-columns: 90px 1fr 1fr 1fr 120px; min-width: 720px; background: rgba(61,24,32,0.03); border-bottom: 1px solid rgba(61,24,32,0.07); color: rgba(61,24,32,0.35);"
        >
          <span>Action</span>
          <span>Actor</span>
          <span>Area</span>
          <span class="audit-details-header">Details</span>
          <span class="audit-when-header text-right">When</span>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          Fetching entries…
        </div>

        <!-- Empty -->
        <div v-else-if="entries.length === 0" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          {{ errorMessage || 'No activity matches the current filters.' }}
        </div>

        <!-- Rows -->
        <div v-else>
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="audit-row grid px-5 py-3.5 items-start transition-colors duration-100"
            style="grid-template-columns: 90px 1fr 1fr 1fr 120px; min-width: 720px; border-bottom: 1px solid rgba(61,24,32,0.05);"
          >
            <!-- Action badge -->
            <div>
              <span
                class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded"
                :style="{ background: actionColor(entry.action_type), color: actionText(entry.action_type) }"
              >
                {{ actionLabel(entry.action_type) }}
              </span>
            </div>

            <!-- Actor -->
            <div>
              <p class="text-xs font-medium" style="color: rgb(var(--shell-sidebar));">{{ entry.actor_name }}</p>
              <p class="text-[10px] font-mono mt-0.5" style="color: rgba(61,24,32,0.35);">{{ actorLabel(entry.actor_type) }}</p>
            </div>

            <!-- Target -->
            <div class="text-xs font-mono" style="color: rgba(61,24,32,0.55);">
              {{ areaLabel(entry.target_table) }}
            </div>

            <!-- Payload -->
            <div class="audit-details text-[10px] leading-relaxed truncate pr-4" style="color: rgba(61,24,32,0.4);">
              {{ activityDetails(entry) }}
            </div>

            <!-- Time -->
            <div class="audit-when text-[10px] font-mono text-right" style="color: rgba(61,24,32,0.35);">
              {{ relativeTime(entry.created_at) }}
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-5 py-3" style="background: rgba(61,24,32,0.02); border-top: 1px solid rgba(61,24,32,0.07);">
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded transition-all disabled:opacity-30 btn-ghost"
            :disabled="page <= 1"
            @click="page--; loadEntries()"
          >
            <ChevronLeft class="w-3 h-3" /> Prev
          </button>

          <span class="text-[10px] font-mono" style="color: rgba(61,24,32,0.35);">
            pg {{ page }} · {{ total }} events
          </span>

          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded transition-all disabled:opacity-30 btn-ghost"
            :disabled="page * perPage >= total"
            @click="page++; loadEntries()"
          >
            Next <ChevronRight class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-row:hover {
  background: rgba(61,24,32,0.02);
}

.dashboard-readable [style*="color: rgba(61,24,32,0."] {
  color: rgba(61,24,32,0.7) !important;
}

@media (max-width: 768px) {
  .audit-table-shell {
    overflow-x: visible !important;
  }

  .audit-table-grid,
  .audit-row {
    min-width: 0 !important;
    grid-template-columns: 80px minmax(0, 1fr) minmax(0, 1fr) !important;
  }

  .audit-details-header,
  .audit-details,
  .audit-when-header,
  .audit-when {
    display: none;
  }
}
</style>
