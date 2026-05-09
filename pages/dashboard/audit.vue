<script setup lang="ts">
import { Filter, Shield, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { parseAuditJson } from '~/lib/audit';

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

async function loadEntries() {
  loading.value = true;
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
  } finally {
    loading.value = false;
  }
}

onMounted(loadEntries);

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

function actionColor(type: string) {
  return ACTION_COLORS[type?.toUpperCase()] ?? 'rgba(61,24,32,0.07)';
}

function actionText(type: string) {
  return ACTION_TEXT[type?.toUpperCase()] ?? 'rgba(61,24,32,0.55)';
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
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div class="flex items-center gap-3 mb-1">
        <Shield class="w-4 h-4" style="color: rgba(61,24,32,0.35);" />
        <p class="text-[10px] font-mono uppercase tracking-[0.18em]" style="color: rgba(61,24,32,0.35);">Audit Log</p>
      </div>
      <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Activity trail</h1>
      <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">Append-only record of runtime mutations, uploads, and schema changes</p>
    </div>

    <div class="px-10 py-7 space-y-6">

      <!-- ── Filter bar ─────────────────────────────────────────── -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex items-center gap-1.5 shrink-0" style="color: rgba(61,24,32,0.35);">
          <Filter class="w-3.5 h-3.5" />
          <span class="text-[10px] font-mono uppercase tracking-widest">Filters</span>
        </div>

        <select v-model="actorType" class="input-warm px-3 py-2 text-xs">
          <option value="all">All actors</option>
          <option value="admin">Admin</option>
          <option value="inpoint">In-point</option>
        </select>

        <input v-model="actionType"  class="input-warm px-3 py-2 text-xs w-32" placeholder="Action type" />
        <input v-model="tableFilter" class="input-warm px-3 py-2 text-xs w-32" placeholder="Table" />
        <input v-model="from" type="date" class="input-warm px-3 py-2 text-xs" />
        <input v-model="to"   type="date" class="input-warm px-3 py-2 text-xs" />

        <button
          class="px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] btn-primary btn-ribbon"
          @click="loadEntries"
        >
          Apply
        </button>
      </div>

      <!-- ── Log table ──────────────────────────────────────────── -->
      <div style="border: 1px solid rgba(61,24,32,0.09); border-radius: 0.75rem; overflow: hidden;">

        <!-- Table head -->
        <div
          class="grid text-[10px] font-mono uppercase tracking-widest px-5 py-3"
          style="grid-template-columns: 90px 1fr 1fr 1fr 120px; background: rgba(61,24,32,0.03); border-bottom: 1px solid rgba(61,24,32,0.07); color: rgba(61,24,32,0.35);"
        >
          <span>Action</span>
          <span>Actor</span>
          <span>Target</span>
          <span>Payload</span>
          <span class="text-right">When</span>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          Fetching entries…
        </div>

        <!-- Empty -->
        <div v-else-if="entries.length === 0" class="px-5 py-10 text-xs text-center font-mono" style="color: rgba(61,24,32,0.35);">
          No entries match the current filters.
        </div>

        <!-- Rows -->
        <div v-else>
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="audit-row grid px-5 py-3.5 items-start transition-colors duration-100"
            style="grid-template-columns: 90px 1fr 1fr 1fr 120px; border-bottom: 1px solid rgba(61,24,32,0.05);"
          >
            <!-- Action badge -->
            <div>
              <span
                class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded"
                :style="{ background: actionColor(entry.action_type), color: actionText(entry.action_type) }"
              >
                {{ entry.action_type }}
              </span>
            </div>

            <!-- Actor -->
            <div>
              <p class="text-xs font-medium" style="color: rgb(var(--shell-sidebar));">{{ entry.actor_name }}</p>
              <p class="text-[10px] font-mono mt-0.5" style="color: rgba(61,24,32,0.35);">{{ entry.actor_type }}</p>
            </div>

            <!-- Target -->
            <div class="text-xs font-mono" style="color: rgba(61,24,32,0.55);">
              <span v-if="entry.target_table">{{ entry.target_table }}</span>
              <span v-if="entry.target_id" style="color: rgba(61,24,32,0.35);"> / {{ entry.target_id }}</span>
            </div>

            <!-- Payload -->
            <div v-if="entry.metadata" class="text-[10px] font-mono leading-relaxed truncate pr-4" style="color: rgba(61,24,32,0.4);">
              {{ JSON.stringify(parseAuditJson(entry.metadata)) }}
            </div>
            <div v-else class="text-[10px] font-mono" style="color: rgba(61,24,32,0.2);">—</div>

            <!-- Time -->
            <div class="text-[10px] font-mono text-right" style="color: rgba(61,24,32,0.35);">
              {{ relativeTime(entry.created_at) }}
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-5 py-3" style="background: rgba(61,24,32,0.02); border-top: 1px solid rgba(61,24,32,0.07);">
          <button
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
</style>
