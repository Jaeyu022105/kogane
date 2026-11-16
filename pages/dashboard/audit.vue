<script setup lang="ts">
import ChevronDownIcon from 'reicon-vue/icons/ChevronDown';
import ChevronLeftIcon from 'reicon-vue/icons/ChevronLeft';
import ChevronRightIcon from 'reicon-vue/icons/ChevronRight';
import DownloadIcon from 'reicon-vue/icons/Download';
import DocumentTextIcon from 'reicon-vue/icons/DocumentText';
import FilterIcon from 'reicon-vue/icons/Filter';
import RefreshIcon from 'reicon-vue/icons/Refresh';
import SearchIcon from 'reicon-vue/icons/Search';
import ShieldIcon from 'reicon-vue/icons/Shield';
import XIcon from 'reicon-vue/icons/X';
import {
  parseAuditJson,
  parseAuditTimestamp,
  redactAuditPayload,
  summarizeAuditDiff,
  type AuditDiffSummary,
} from '~/lib/audit';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();

const defaultFromDate = () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
const defaultToDate = () => new Date().toISOString().slice(0, 10);

const loading = ref(false);
const exporting = ref<'csv' | 'json' | null>(null);
const page = ref(1);
const perPage = ref(50);
const actorType = ref('all');
const actionType = ref('');
const tableFilter = ref('');
const searchQuery = ref('');
const from = ref(defaultFromDate());
const to = ref(defaultToDate());
const total = ref(0);
const entries = ref<any[]>([]);
const errorMessage = ref('');

const expandedIds = ref<Record<string, boolean>>({});
const showUnchangedById = ref<Record<string, boolean>>({});
const viewModeById = ref<Record<string, 'diff' | 'raw'>>({});

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ACTION_META: Record<string, { label: string; bg: string; text: string }> = {
  insert: { label: 'Added', bg: 'rgba(22,163,74,0.12)', text: '#15803d' },
  update: { label: 'Updated', bg: 'rgba(234,179,8,0.14)', text: '#a16207' },
  delete: { label: 'Removed', bg: 'rgba(239,68,68,0.12)', text: '#dc2626' },
  'schema:create': { label: 'Table created', bg: 'rgba(13,148,136,0.12)', text: '#0f766e' },
  'schema:alter': { label: 'Schema altered', bg: 'rgba(14,116,144,0.12)', text: '#0e7490' },
  'schema:drop': { label: 'Table dropped', bg: 'rgba(225,29,72,0.12)', text: '#be123c' },
  'preset:create': { label: 'Preset saved', bg: 'rgba(124,58,237,0.12)', text: '#6d28d9' },
  'preset:update': { label: 'Preset updated', bg: 'rgba(109,40,217,0.12)', text: '#5b21b6' },
  'preset:delete': { label: 'Preset deleted', bg: 'rgba(220,38,38,0.12)', text: '#b91c1c' },
  'preset:apply': { label: 'Preset applied', bg: 'rgba(79,70,229,0.12)', text: '#4338ca' },
  'preset:sync': { label: 'Preset synced', bg: 'rgba(37,99,235,0.12)', text: '#1d4ed8' },
  'terminal:layout': { label: 'Layout saved', bg: 'rgba(194,65,12,0.12)', text: '#c2410c' },
  'terminal:pin': { label: 'PIN rotated', bg: 'rgba(217,119,6,0.14)', text: '#b45309' },
  'permission:denied': { label: 'Access blocked', bg: 'rgba(220,38,38,0.14)', text: '#b91c1c' },
  login: { label: 'Signed in', bg: 'rgba(5,150,105,0.12)', text: '#047857' },
  logout: { label: 'Signed out', bg: 'rgba(100,116,139,0.13)', text: '#475569' },
  upload: { label: 'Uploaded', bg: 'rgba(2,132,199,0.12)', text: '#0369a1' },
};

const AREA_LABELS: Record<string, string> = {
  orders: 'Orders',
  products: 'Catalog',
  inventory: 'Inventory',
  customers: 'Customers',
  deliveries: 'Deliveries',
  invoices: 'Invoices',
  expenses: 'Expenses',
  appointments: 'Appointments',
  staff: 'Staff',
  terminals: 'Staff workspaces',
  presets: 'Presets',
  business: 'Business',
  businesses: 'Business',
  schema: 'Schema',
  transactions: 'Sales',
  audit_log: 'Activity',
};

const ACTION_FILTERS = [
  { value: 'insert', label: 'Added' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Removed' },
  { value: 'schema:create', label: 'Table created' },
  { value: 'schema:alter', label: 'Schema altered' },
  { value: 'schema:drop', label: 'Table dropped' },
  { value: 'preset:create', label: 'Preset saved' },
  { value: 'preset:update', label: 'Preset updated' },
  { value: 'preset:apply', label: 'Preset applied' },
  { value: 'preset:sync', label: 'Preset synced' },
  { value: 'terminal:layout', label: 'Layout saved' },
  { value: 'terminal:pin', label: 'PIN rotated' },
  { value: 'permission:denied', label: 'Access blocked' },
  { value: 'login', label: 'Signed in' },
  { value: 'logout', label: 'Signed out' },
  { value: 'upload', label: 'Uploaded' },
];

const AREA_FILTERS = [
  { value: 'orders', label: 'Orders' },
  { value: 'products', label: 'Catalog' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'customers', label: 'Customers' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'staff', label: 'Staff' },
  { value: 'terminals', label: 'Staff workspaces' },
  { value: 'presets', label: 'Presets' },
  { value: 'business', label: 'Business' },
  { value: 'schema', label: 'Schema' },
];

const hasActiveFilters = computed(() =>
  actorType.value !== 'all'
  || actionType.value !== ''
  || tableFilter.value !== ''
  || searchQuery.value.trim() !== '',
);

const pageRangeLabel = computed(() => {
  if (total.value === 0) return '0 events';
  const start = (page.value - 1) * perPage.value + 1;
  const end = Math.min(total.value, page.value * perPage.value);
  return `${start}–${end} of ${total.value} events`;
});

function buildFilterQuery(includePaging = true) {
  return {
    ...(includePaging ? { page: page.value, per_page: perPage.value, limit: perPage.value } : {}),
    actor_type: actorType.value,
    action_type: actionType.value || undefined,
    table: tableFilter.value || undefined,
    q: searchQuery.value.trim() || undefined,
    from: from.value || undefined,
    to: to.value || undefined,
  };
}

async function loadEntries() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await $fetch<{ entries: any[]; total: number; error: string | null }>('/api/audit-log', {
      headers: authHeaders(),
      query: buildFilterQuery(true),
    });
    entries.value = res.entries ?? [];
    total.value = res.total ?? 0;
    expandedIds.value = {};
    errorMessage.value = res.error ? 'Some activity could not be refreshed. Please try again.' : '';
  } catch {
    entries.value = [];
    total.value = 0;
    errorMessage.value = 'We could not load activity right now. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function exportEntries(format: 'csv' | 'json') {
  if (!import.meta.client || exporting.value) return;
  exporting.value = format;
  errorMessage.value = '';
  try {
    const blob = await $fetch<Blob>('/api/audit-log', {
      headers: authHeaders(),
      query: {
        ...buildFilterQuery(false),
        format,
      },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const fromLabel = from.value || 'start';
    const toLabel = to.value || 'now';
    anchor.download = `audit-log-${fromLabel}-to-${toLabel}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch {
    errorMessage.value = `Failed to export ${format.toUpperCase()} audit trail. Please try again.`;
  } finally {
    exporting.value = null;
  }
}

onMounted(loadEntries);

function actionColor(type: string) {
  return ACTION_META[type?.toLowerCase()]?.bg ?? 'rgba(61,24,32,0.08)';
}

function actionText(type: string) {
  return ACTION_META[type?.toLowerCase()]?.text ?? 'rgba(61,24,32,0.72)';
}

function actionLabel(type: string) {
  return ACTION_META[type?.toLowerCase()]?.label ?? (type || 'Activity recorded');
}

function actorLabel(type: string) {
  const actor = type?.toLowerCase();
  return actor === 'admin' ? 'Owner workspace' : actor === 'inpoint' ? 'Staff terminal' : 'Workspace';
}

function areaLabel(value: string | null | undefined) {
  const area = String(value ?? '').toLowerCase();
  if (!area) return 'Workspace';
  return AREA_LABELS[area] ?? String(value);
}

function parsedMetadata(entry: any): Record<string, unknown> | null {
  const parsed = parseAuditJson<Record<string, unknown>>(entry?.metadata);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return redactAuditPayload(parsed);
}

function summarizeDetails(entry: any, meta: Record<string, unknown> | null, diff: AuditDiffSummary) {
  const action = String(entry.action_type ?? '').toLowerCase();
  const area = areaLabel(entry.target_table);

  if (action === 'terminal:pin' || meta?.pinRotated) {
    const targetName = meta?.terminal_name || meta?.displayName || entry.target_id;
    return targetName ? `Rotated PIN for ${targetName}` : 'Rotated terminal PIN';
  }
  if (action === 'terminal:layout') {
    const targetName = meta?.terminal_name || meta?.displayName || entry.target_id;
    return targetName ? `Saved layout for ${targetName}` : 'Saved terminal UI layout';
  }
  if (action.startsWith('preset:')) {
    const presetName = meta?.presetName || meta?.preset_name || meta?.preset || meta?.name;
    const version = meta?.presetVersion ?? meta?.preset_version ?? meta?.version;
    const base = actionLabel(action);
    const namePart = presetName ? `: ${presetName}` : '';
    const verPart = version != null ? ` (v${version})` : '';
    return `${base}${namePart}${verPart}`;
  }
  if (meta?.event === 'business:onboard') {
    return meta?.override ? 'Reconfigured business workspace' : 'Completed business onboarding';
  }
  if (action === 'schema:create') return `Created table ${entry.target_table || 'schema'}`;
  if (action === 'schema:alter') return `Added columns to ${entry.target_table || 'table'}`;
  if (action === 'schema:drop') return `Dropped table ${entry.target_table || 'schema'}`;
  if (action === 'login') {
    return meta?.role ? `Signed in (${meta.role})` : 'Signed in to the workspace';
  }
  if (action === 'logout') return 'Signed out of the workspace';
  if (action === 'upload') {
    return meta?.filename ? `Uploaded ${meta.filename}` : 'Uploaded a file';
  }
  if (action === 'permission:denied') {
    const blockedAction = (meta?.action as Record<string, unknown> | undefined)?.type;
    return blockedAction
      ? `Blocked ${blockedAction} request on ${area}`
      : `Blocked access request on ${area}`;
  }
  if (action === 'update') {
    if (diff.changed.length > 0) {
      const preview = diff.changed.slice(0, 3).join(', ');
      const extra = diff.changed.length > 3 ? ` +${diff.changed.length - 3}` : '';
      return `Updated ${area} · changed ${preview}${extra}`;
    }
    return `Updated ${area}`;
  }
  if (action === 'insert') {
    const afterObj = redactAuditPayload(parseAuditJson<Record<string, unknown>>(entry.payload_after));
    const labelHint = afterObj?.display_name || afterObj?.name || afterObj?.full_name || afterObj?.items || afterObj?.tracking_code || afterObj?.invoice_number;
    return labelHint ? `Added to ${area}: ${String(labelHint).slice(0, 48)}` : `Added an item to ${area}`;
  }
  if (action === 'delete') {
    const beforeObj = redactAuditPayload(parseAuditJson<Record<string, unknown>>(entry.payload_before));
    const labelHint = beforeObj?.display_name || beforeObj?.name || beforeObj?.full_name || beforeObj?.tracking_code || beforeObj?.invoice_number;
    return labelHint ? `Removed from ${area}: ${String(labelHint).slice(0, 48)}` : `Removed an item from ${area}`;
  }

  return 'Workspace settings were updated';
}

const enrichedEntries = computed(() =>
  entries.value.map((entry) => {
    const meta = parsedMetadata(entry);
    const metaList = meta
      ? Object.entries(meta)
          .filter(([, val]) => val !== null && val !== undefined && val !== '')
          .map(([key, val]) => ({
            key,
            value: typeof val === 'object' ? JSON.stringify(val) : String(val),
          }))
      : [];
    const diff = summarizeAuditDiff(entry?.payload_before, entry?.payload_after);
    const details = summarizeDetails(entry, meta, diff);
    return {
      entry,
      metaList,
      diff,
      details,
    };
  }),
);

function visibleDiffEntries(id: string, diff: AuditDiffSummary) {
  if (showUnchangedById.value[id]) {
    return diff.entries;
  }
  const changedOnly = diff.entries.filter((item) => item.kind !== 'unchanged');
  return changedOnly.length > 0 ? changedOnly : diff.entries;
}

function hasAnyPayload(entry: any): boolean {
  return Boolean(entry?.payload_before || entry?.payload_after);
}

function relativeTime(iso: string) {
  const parsed = parseAuditTimestamp(iso);
  if (!parsed) return iso || '—';
  const diff = Date.now() - parsed.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return parsed.toLocaleDateString();
}

function formatFullTime(iso: string) {
  const parsed = parseAuditTimestamp(iso);
  if (!parsed) return iso || '—';
  return parsed.toLocaleString();
}

function formatDiffValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value === '' ? '""' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatRawPayload(raw: unknown): string {
  if (raw == null || raw === '') return 'null';
  if (typeof raw === 'string' || typeof raw === 'object') {
    const parsed = parseAuditJson(raw);
    if (parsed !== null) {
      return JSON.stringify(redactAuditPayload(parsed), null, 2);
    }
  }
  return String(raw);
}

function isExpanded(id: string): boolean {
  return Boolean(expandedIds.value[id]);
}

function toggleExpanded(id: string) {
  expandedIds.value = {
    ...expandedIds.value,
    [id]: !expandedIds.value[id],
  };
}

function viewMode(id: string): 'diff' | 'raw' {
  return viewModeById.value[id] ?? 'diff';
}

function setViewMode(id: string, mode: 'diff' | 'raw') {
  viewModeById.value = {
    ...viewModeById.value,
    [id]: mode,
  };
}

function toggleShowUnchanged(id: string) {
  showUnchangedById.value = {
    ...showUnchangedById.value,
    [id]: !showUnchangedById.value[id],
  };
}

function applyFilters() {
  page.value = 1;
  loadEntries();
}

function resetFilters() {
  actorType.value = 'all';
  actionType.value = '';
  tableFilter.value = '';
  searchQuery.value = '';
  from.value = defaultFromDate();
  to.value = defaultToDate();
  page.value = 1;
  loadEntries();
}

function clearSearch() {
  searchQuery.value = '';
  applyFilters();
}
</script>

<template>
  <div class="dashboard-readable relative flex-1 min-h-0 overflow-y-auto overscroll-contain" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8 flex flex-wrap items-end justify-between gap-4" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <ShieldIcon class="w-4 h-4" style="color: rgba(61,24,32,0.35);" />
          <p class="text-[10px] font-mono uppercase tracking-[0.18em]" style="color: rgba(61,24,32,0.35);">Audit Log</p>
        </div>
        <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Activity trail</h1>
        <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">A clear record of important workspace activity, record diffs, and exports</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium btn-ghost disabled:opacity-40"
          :disabled="loading"
          @click="loadEntries"
        >
          <RefreshIcon class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
          Refresh
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium btn-ghost disabled:opacity-40"
          :disabled="exporting !== null"
          @click="exportEntries('csv')"
        >
          <DocumentTextIcon class="w-3.5 h-3.5" />
          {{ exporting === 'csv' ? 'Exporting…' : 'Export CSV' }}
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium btn-ghost disabled:opacity-40"
          :disabled="exporting !== null"
          @click="exportEntries('json')"
        >
          <DownloadIcon class="w-3.5 h-3.5" />
          {{ exporting === 'json' ? 'Exporting…' : 'Export JSON' }}
        </button>
      </div>
    </div>

    <div class="px-10 py-7 space-y-6">

      <!-- ── Filter bar ─────────────────────────────────────────── -->
      <div class="relative flex flex-wrap items-end gap-3">
        <div class="flex items-center gap-1.5 shrink-0 pb-2" style="color: rgba(61,24,32,0.35);">
          <FilterIcon class="w-3.5 h-3.5" />
          <span class="text-[10px] font-mono uppercase tracking-widest">Filters</span>
        </div>

        <div class="relative flex-1 min-w-[210px] max-w-xs">
          <label for="audit-search" class="sr-only">Search audit logs</label>
          <SearchIcon class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(61,24,32,0.45);" />
          <input
            id="audit-search"
            v-model="searchQuery"
            type="search"
            placeholder="Search actor, record ID, table, payload…"
            class="input-warm w-full pl-8 pr-7 py-2 text-xs"
            @keydown.enter="applyFilters"
          />
          <button
            v-if="searchQuery"
            type="button"
            aria-label="Clear search"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/5"
            @click="clearSearch"
          >
            <XIcon class="w-3 h-3" />
          </button>
        </div>

        <label for="audit-actor" class="sr-only">Filter by person</label>
        <select id="audit-actor" v-model="actorType" class="input-warm px-3 py-2 text-xs" @change="applyFilters">
          <option value="all">All actors</option>
          <option value="admin">Owner workspace</option>
          <option value="inpoint">Staff terminal</option>
        </select>

        <label for="audit-action" class="sr-only">Activity</label>
        <select id="audit-action" v-model="actionType" class="input-warm px-3 py-2 text-xs" @change="applyFilters">
          <option value="">All activity</option>
          <option v-for="filter in ACTION_FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</option>
        </select>

        <label for="audit-target" class="sr-only">Area</label>
        <select id="audit-target" v-model="tableFilter" class="input-warm px-3 py-2 text-xs" @change="applyFilters">
          <option value="">All areas</option>
          <option v-for="filter in AREA_FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</option>
        </select>

        <label for="audit-from" class="sr-only">Start date</label>
        <input id="audit-from" v-model="from" type="date" class="input-warm px-3 py-2 text-xs" />

        <label for="audit-to" class="sr-only">End date</label>
        <input id="audit-to" v-model="to" type="date" class="input-warm px-3 py-2 text-xs" />

        <label for="audit-per-page" class="sr-only">Rows per page</label>
        <select id="audit-per-page" v-model.number="perPage" class="input-warm px-3 py-2 text-xs" @change="applyFilters">
          <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }} / page</option>
        </select>

        <button
          type="button"
          class="px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon"
          @click="applyFilters"
        >
          Apply
        </button>

        <button
          v-if="hasActiveFilters"
          type="button"
          class="px-3 py-2 text-xs font-medium btn-ghost"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>

      <!-- ── Log table ──────────────────────────────────────────── -->
      <div class="audit-table-shell" style="border: 1px solid rgba(61,24,32,0.09); border-radius: 0.75rem; overflow-x: auto; overflow-y: hidden;">

        <!-- Table head -->
        <div
          class="audit-table-grid grid text-[10px] font-mono uppercase tracking-widest px-5 py-3 items-center gap-3"
          style="grid-template-columns: 120px minmax(140px, 0.9fr) minmax(110px, 0.8fr) minmax(180px, 1.4fr) 110px 28px; min-width: 780px; background: rgba(61,24,32,0.03); border-bottom: 1px solid rgba(61,24,32,0.07); color: rgba(61,24,32,0.45);"
        >
          <span>Action</span>
          <span>Actor</span>
          <span>Area</span>
          <span class="audit-details-header">Details</span>
          <span class="audit-when-header text-right">When</span>
          <span class="sr-only">Inspect</span>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.45);">
          Fetching entries…
        </div>

        <!-- Empty -->
        <div v-else-if="entries.length === 0" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.45);">
          {{ errorMessage || 'No activity matches the current filters.' }}
        </div>

        <!-- Rows -->
        <div v-else>
          <div
            v-for="{ entry, metaList, diff, details } in enrichedEntries"
            :key="entry.id"
            class="audit-entry-group"
            style="border-bottom: 1px solid rgba(61,24,32,0.06);"
          >
            <div
              role="button"
              tabindex="0"
              :aria-expanded="isExpanded(entry.id)"
              class="audit-row grid px-5 py-3.5 items-start gap-3 cursor-pointer transition-colors duration-100 select-text"
              style="grid-template-columns: 120px minmax(140px, 0.9fr) minmax(110px, 0.8fr) minmax(180px, 1.4fr) 110px 28px; min-width: 780px;"
              @click="toggleExpanded(entry.id)"
              @keydown.enter.prevent="toggleExpanded(entry.id)"
              @keydown.space.prevent="toggleExpanded(entry.id)"
            >
              <!-- Action badge -->
              <div class="audit-action-cell">
                <span
                  class="inline-block text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded whitespace-nowrap"
                  :style="{ background: actionColor(entry.action_type), color: actionText(entry.action_type) }"
                >
                  {{ actionLabel(entry.action_type) }}
                </span>
              </div>

              <!-- Actor -->
              <div class="audit-actor-cell min-w-0">
                <p class="text-xs font-medium truncate" style="color: rgb(var(--shell-sidebar));">{{ entry.actor_name }}</p>
                <p class="text-[10px] font-mono mt-0.5 truncate" style="color: rgba(61,24,32,0.5);">{{ actorLabel(entry.actor_type) }}</p>
              </div>

              <!-- Area & Target ID -->
              <div class="audit-area-cell min-w-0">
                <p class="text-xs font-mono truncate" style="color: rgba(61,24,32,0.7);">{{ areaLabel(entry.target_table) }}</p>
                <p v-if="entry.target_id" class="text-[10px] font-mono mt-0.5 truncate" style="color: rgba(61,24,32,0.45);" :title="entry.target_id">
                  #{{ entry.target_id }}
                </p>
              </div>

              <!-- Details -->
              <div class="audit-details min-w-0 pr-2">
                <p class="text-xs leading-snug truncate" style="color: rgba(61,24,32,0.75);">
                  {{ details }}
                </p>
                <p
                  v-if="diff.hasChanges"
                  class="text-[10px] font-mono mt-0.5"
                  style="color: rgba(61,24,32,0.45);"
                >
                  <span v-if="diff.changed.length">{{ diff.changed.length }} changed</span>
                  <span v-if="diff.changed.length && (diff.added.length || diff.removed.length)"> · </span>
                  <span v-if="diff.added.length">{{ diff.added.length }} added</span>
                  <span v-if="diff.added.length && diff.removed.length"> · </span>
                  <span v-if="diff.removed.length">{{ diff.removed.length }} removed</span>
                </p>
              </div>

              <!-- Time -->
              <div
                class="audit-when text-[10px] font-mono text-right whitespace-nowrap"
                style="color: rgba(61,24,32,0.55);"
                :title="formatFullTime(entry.created_at)"
              >
                {{ relativeTime(entry.created_at) }}
              </div>

              <!-- Expand Chevron -->
              <div class="audit-chevron-cell flex justify-end pt-0.5" style="color: rgba(61,24,32,0.45);">
                <ChevronDownIcon
                  class="w-4 h-4 transition-transform duration-150"
                  :class="{ 'rotate-180': isExpanded(entry.id) }"
                />
              </div>
            </div>

            <!-- ── Expandable Detail & Diff Inspector ─────────────── -->
            <div
              v-if="isExpanded(entry.id)"
              class="audit-inspector px-5 py-4 space-y-4"
              style="background: rgba(246,230,215,0.22); border-top: 1px dashed rgba(61,24,32,0.12);"
            >
              <!-- Record & Event Context -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div class="rounded-lg px-3 py-2" style="background: rgba(255,255,255,0.75); border: 1px solid rgba(61,24,32,0.08);">
                  <p class="text-[10px] font-mono uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">Event ID</p>
                  <p class="font-mono text-[11px] mt-0.5 break-all" style="color: rgb(var(--shell-sidebar));">{{ entry.id }}</p>
                </div>
                <div class="rounded-lg px-3 py-2" style="background: rgba(255,255,255,0.75); border: 1px solid rgba(61,24,32,0.08);">
                  <p class="text-[10px] font-mono uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">Timestamp</p>
                  <p class="font-mono text-[11px] mt-0.5" style="color: rgb(var(--shell-sidebar));">{{ formatFullTime(entry.created_at) }}</p>
                </div>
                <div class="rounded-lg px-3 py-2" style="background: rgba(255,255,255,0.75); border: 1px solid rgba(61,24,32,0.08);">
                  <p class="text-[10px] font-mono uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">Action / Table</p>
                  <p class="font-mono text-[11px] mt-0.5 break-all" style="color: rgb(var(--shell-sidebar));">
                    {{ entry.action_type }} · {{ entry.target_table || '—' }}
                  </p>
                </div>
                <div class="rounded-lg px-3 py-2" style="background: rgba(255,255,255,0.75); border: 1px solid rgba(61,24,32,0.08);">
                  <p class="text-[10px] font-mono uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">Target Record ID</p>
                  <p class="font-mono text-[11px] mt-0.5 break-all" style="color: rgb(var(--shell-sidebar));">{{ entry.target_id || '—' }}</p>
                </div>
                <div class="rounded-lg px-3 py-2" style="background: rgba(255,255,255,0.75); border: 1px solid rgba(61,24,32,0.08);">
                  <p class="text-[10px] font-mono uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">Actor ID</p>
                  <p class="font-mono text-[11px] mt-0.5 break-all" style="color: rgb(var(--shell-sidebar));">{{ entry.actor_id || '—' }}</p>
                </div>
              </div>

              <!-- Metadata -->
              <div v-if="metaList.length > 0" class="rounded-lg p-3" style="background: rgba(255,255,255,0.78); border: 1px solid rgba(61,24,32,0.08);">
                <p class="text-[10px] font-mono uppercase tracking-wider mb-2" style="color: rgba(61,24,32,0.5);">Metadata</p>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="item in metaList"
                    :key="item.key"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono max-w-full"
                    style="background: rgba(61,24,32,0.05); color: rgb(var(--shell-sidebar));"
                  >
                    <span class="font-semibold" style="color: rgba(61,24,32,0.6);">{{ item.key }}:</span>
                    <span class="break-all">{{ item.value }}</span>
                  </div>
                </div>
              </div>

              <!-- Payload Diff Inspector -->
              <div class="rounded-lg p-3 space-y-3" style="background: rgba(255,255,255,0.85); border: 1px solid rgba(61,24,32,0.09);">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[10px] font-mono uppercase tracking-wider font-semibold" style="color: rgb(var(--shell-sidebar));">
                      Payload diff
                    </span>
                    <span v-if="diff.changed.length" class="text-[10px] font-mono px-2 py-0.5 rounded" style="background: rgba(234,179,8,0.14); color: #a16207;">
                      ~{{ diff.changed.length }} changed
                    </span>
                    <span v-if="diff.added.length" class="text-[10px] font-mono px-2 py-0.5 rounded" style="background: rgba(22,163,74,0.12); color: #15803d;">
                      +{{ diff.added.length }} added
                    </span>
                    <span v-if="diff.removed.length" class="text-[10px] font-mono px-2 py-0.5 rounded" style="background: rgba(239,68,68,0.12); color: #dc2626;">
                      -{{ diff.removed.length }} removed
                    </span>
                    <span v-if="diff.unchangedCount" class="text-[10px] font-mono px-2 py-0.5 rounded" style="background: rgba(61,24,32,0.06); color: rgba(61,24,32,0.6);">
                      {{ diff.unchangedCount }} unchanged
                    </span>
                  </div>

                  <div v-if="hasAnyPayload(entry)" class="flex items-center gap-2">
                    <button
                      v-if="viewMode(entry.id) === 'diff' && diff.hasChanges && diff.unchangedCount > 0"
                      type="button"
                      class="text-[10px] font-mono px-2.5 py-1 rounded border transition-colors"
                      style="border-color: rgba(61,24,32,0.16); color: rgb(var(--shell-sidebar));"
                      @click.stop="toggleShowUnchanged(entry.id)"
                    >
                      {{ showUnchangedById[entry.id] ? 'Hide unchanged' : 'Show unchanged' }}
                    </button>

                    <div class="inline-flex rounded overflow-hidden border" style="border-color: rgba(61,24,32,0.16);">
                      <button
                        type="button"
                        class="text-[10px] font-mono px-2.5 py-1 transition-colors"
                        :style="viewMode(entry.id) === 'diff'
                          ? { background: 'rgb(var(--shell-sidebar))', color: 'rgb(var(--shell-sidebar-text))' }
                          : { background: 'transparent', color: 'rgb(var(--shell-sidebar))' }"
                        @click.stop="setViewMode(entry.id, 'diff')"
                      >
                        Field diff
                      </button>
                      <button
                        type="button"
                        class="text-[10px] font-mono px-2.5 py-1 transition-colors"
                        :style="viewMode(entry.id) === 'raw'
                          ? { background: 'rgb(var(--shell-sidebar))', color: 'rgb(var(--shell-sidebar-text))' }
                          : { background: 'transparent', color: 'rgb(var(--shell-sidebar))' }"
                        @click.stop="setViewMode(entry.id, 'raw')"
                      >
                        Raw JSON
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="!hasAnyPayload(entry)" class="text-xs font-mono py-2" style="color: rgba(61,24,32,0.5);">
                  No before/after record payload captured for this event.
                </div>

                <!-- Field-by-field diff -->
                <div v-else-if="viewMode(entry.id) === 'diff'" class="space-y-1.5">
                  <div v-if="visibleDiffEntries(entry.id, diff).length === 0" class="text-xs font-mono py-2" style="color: rgba(61,24,32,0.5);">
                    Payload objects are empty or fully redacted.
                  </div>

                  <div
                    v-else
                    class="audit-diff-row hidden md:grid text-[10px] font-mono uppercase tracking-wider px-2.5 py-1.5 rounded"
                    style="grid-template-columns: minmax(140px, 0.9fr) minmax(0, 1fr) minmax(0, 1fr); gap: 0.75rem; background: rgba(61,24,32,0.04); color: rgba(61,24,32,0.55);"
                  >
                    <span>Field</span>
                    <span>Before</span>
                    <span>After</span>
                  </div>

                  <div
                    v-for="item in visibleDiffEntries(entry.id, diff)"
                    :key="item.key"
                    class="audit-diff-row grid px-2.5 py-2 rounded text-xs items-start"
                    style="grid-template-columns: minmax(140px, 0.9fr) minmax(0, 1fr) minmax(0, 1fr); gap: 0.75rem; border: 1px solid rgba(61,24,32,0.06);"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        class="text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded shrink-0"
                        :style="item.kind === 'added'
                          ? { background: 'rgba(22,163,74,0.12)', color: '#15803d' }
                          : item.kind === 'removed'
                            ? { background: 'rgba(239,68,68,0.12)', color: '#dc2626' }
                            : item.kind === 'changed'
                              ? { background: 'rgba(234,179,8,0.16)', color: '#a16207' }
                              : { background: 'rgba(61,24,32,0.06)', color: 'rgba(61,24,32,0.55)' }"
                      >
                        {{ item.kind }}
                      </span>
                      <span class="font-mono text-[11px] font-medium break-all" style="color: rgb(var(--shell-sidebar));">
                        {{ item.key }}
                      </span>
                    </div>

                    <div
                      class="font-mono text-[11px] rounded px-2 py-1 break-all"
                      :style="item.kind === 'changed' || item.kind === 'removed'
                        ? { background: 'rgba(239,68,68,0.08)', color: '#991b1b' }
                        : { background: 'rgba(61,24,32,0.03)', color: 'rgba(61,24,32,0.55)' }"
                    >
                      <span class="md:hidden text-[9px] uppercase tracking-wider mr-1 opacity-60">Before:</span>
                      {{ formatDiffValue(item.before) }}
                    </div>

                    <div
                      class="font-mono text-[11px] rounded px-2 py-1 break-all"
                      :style="item.kind === 'changed' || item.kind === 'added'
                        ? { background: 'rgba(22,163,74,0.09)', color: '#166534' }
                        : { background: 'rgba(61,24,32,0.03)', color: 'rgba(61,24,32,0.55)' }"
                    >
                      <span class="md:hidden text-[9px] uppercase tracking-wider mr-1 opacity-60">After:</span>
                      {{ formatDiffValue(item.after) }}
                    </div>
                  </div>
                </div>

                <!-- Side-by-side raw JSON -->
                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p class="text-[10px] font-mono uppercase tracking-wider mb-1" style="color: #991b1b;">Before</p>
                    <pre class="text-[11px] font-mono p-3 rounded overflow-x-auto max-h-64" style="background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.14); color: rgb(var(--shell-sidebar));">{{ formatRawPayload(entry.payload_before) }}</pre>
                  </div>
                  <div>
                    <p class="text-[10px] font-mono uppercase tracking-wider mb-1" style="color: #166534;">After</p>
                    <pre class="text-[11px] font-mono p-3 rounded overflow-x-auto max-h-64" style="background: rgba(22,163,74,0.05); border: 1px solid rgba(22,163,74,0.16); color: rgb(var(--shell-sidebar));">{{ formatRawPayload(entry.payload_after) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3" style="background: rgba(61,24,32,0.02); border-top: 1px solid rgba(61,24,32,0.07);">
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded transition-all disabled:opacity-30 btn-ghost"
            :disabled="page <= 1 || loading"
            @click="page--; loadEntries()"
          >
            <ChevronLeftIcon class="w-3 h-3" /> Prev
          </button>

          <span class="text-[10px] font-mono" style="color: rgba(61,24,32,0.55);">
            pg {{ page }} · {{ pageRangeLabel }}
          </span>

          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded transition-all disabled:opacity-30 btn-ghost"
            :disabled="page * perPage >= total || loading"
            @click="page++; loadEntries()"
          >
            Next <ChevronRightIcon class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-row:hover {
  background: rgba(61,24,32,0.025);
}

.dashboard-readable [style*="color: rgba(61,24,32,0."] {
  color: rgba(61,24,32,0.72) !important;
}

@media (max-width: 768px) {
  .audit-table-shell {
    overflow-x: visible !important;
  }

  .audit-table-grid {
    min-width: 0 !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
  }

  .audit-table-grid > span:nth-child(2),
  .audit-table-grid > span:nth-child(3),
  .audit-details-header {
    display: none;
  }

  .audit-when-header {
    display: block;
    text-align: right;
  }

  .audit-row {
    min-width: 0 !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    gap: 0.45rem 0.75rem !important;
  }

  .audit-action-cell {
    grid-column: 1;
    grid-row: 1;
  }

  .audit-when {
    display: block !important;
    grid-column: 2;
    grid-row: 1;
    text-align: right;
  }

  .audit-actor-cell {
    grid-column: 1;
    grid-row: 2;
  }

  .audit-area-cell {
    grid-column: 2;
    grid-row: 2;
    text-align: right;
  }

  .audit-details {
    display: block;
    grid-column: 1;
    grid-row: 3;
    padding-right: 0;
  }

  .audit-chevron-cell {
    grid-column: 2;
    grid-row: 3;
    align-self: center;
  }

  .audit-diff-row {
    grid-template-columns: 1fr !important;
    gap: 0.4rem !important;
  }
}
</style>
