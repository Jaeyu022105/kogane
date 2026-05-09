<script setup lang="ts">
import { Filter, Shield } from 'lucide-vue-next';
import { parseAuditJson } from '~/lib/audit';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();

const loading = ref(false);
const page = ref(1);
const perPage = ref(50);
const actorType = ref('all');
const actionType = ref('');
const tableFilter = ref('');
const from = ref(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));
const total = ref(0);
const entries = ref<any[]>([]);

async function loadEntries() {
  loading.value = true;
  try {
    const res = await $fetch<{ entries: any[]; total: number; error: string | null }>('/api/audit-log', {
      headers: authHeaders(),
      query: {
        page: page.value,
        per_page: perPage.value,
        actor_type: actorType.value,
        action_type: actionType.value || undefined,
        table: tableFilter.value || undefined,
        from: from.value,
        to: to.value,
      },
    });
    entries.value = res.entries ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
}

onMounted(loadEntries);
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <header class="px-8 py-5" style="border-bottom: 1px solid rgba(61,24,32,0.1);">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="font-serif text-2xl font-normal flex items-center gap-3" style="color: rgb(var(--shell-sidebar));">
            <Shield class="w-6 h-6" /> Audit Log
          </h1>
          <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">Append-only activity across runtime mutations, uploads, and schema changes</p>
        </div>
      </div>
    </header>

    <div class="px-8 py-7 space-y-6">
      <div class="bg-white rounded-xl p-5 shadow-warm">
        <div class="flex items-center gap-2 mb-4">
          <Filter class="w-4 h-4" style="color: rgba(61,24,32,0.45);" />
          <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Filters</p>
        </div>
        <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select v-model="actorType" class="input-warm px-3 py-2 text-sm">
            <option value="all">All actors</option>
            <option value="admin">Admin</option>
            <option value="inpoint">In-point</option>
          </select>
          <input v-model="actionType" class="input-warm px-3 py-2 text-sm" placeholder="Action type" />
          <input v-model="tableFilter" class="input-warm px-3 py-2 text-sm" placeholder="Target table" />
          <input v-model="from" type="date" class="input-warm px-3 py-2 text-sm" />
          <input v-model="to" type="date" class="input-warm px-3 py-2 text-sm" />
          <button class="rounded-lg px-4 py-2 text-sm font-semibold" style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));" @click="loadEntries">
            Apply
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-warm overflow-hidden">
        <div class="px-5 py-4 flex items-center justify-between" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
          <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ total }} events</p>
          <p class="text-xs" style="color: rgba(61,24,32,0.4);">Newest first</p>
        </div>

        <div v-if="loading" class="px-5 py-8 text-sm" style="color: rgba(61,24,32,0.45);">Loading audit log...</div>

        <div v-else-if="entries.length === 0" class="px-5 py-8 text-sm" style="color: rgba(61,24,32,0.45);">No audit entries for the selected filters.</div>

        <div v-else class="divide-y" style="divide-color: rgba(61,24,32,0.06);">
          <div v-for="entry in entries" :key="entry.id" class="px-5 py-4 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style="background: rgba(61,24,32,0.08); color: rgba(61,24,32,0.6);">{{ entry.action_type }}</span>
              <span class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ entry.actor_name }}</span>
              <span class="text-xs" style="color: rgba(61,24,32,0.4);">{{ entry.actor_type }}</span>
              <span class="text-xs" style="color: rgba(61,24,32,0.4);">{{ new Date(entry.created_at).toLocaleString() }}</span>
            </div>
            <div class="text-sm" style="color: rgba(61,24,32,0.55);">
              <span v-if="entry.target_table" class="font-mono">{{ entry.target_table }}</span>
              <span v-if="entry.target_id" class="font-mono"> / {{ entry.target_id }}</span>
            </div>
            <div v-if="entry.metadata" class="rounded-lg bg-[#f7f1eb] px-4 py-3 text-xs font-mono overflow-auto" style="color: rgba(61,24,32,0.62);">
              {{ JSON.stringify(parseAuditJson(entry.metadata), null, 2) }}
            </div>
          </div>
        </div>

        <div class="px-5 py-4 flex items-center justify-between" style="border-top: 1px solid rgba(61,24,32,0.08);">
          <button class="rounded-lg px-4 py-2 text-sm" style="border: 1px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.6);" :disabled="page <= 1" @click="page--; loadEntries()">
            Previous
          </button>
          <span class="text-xs" style="color: rgba(61,24,32,0.45);">Page {{ page }}</span>
          <button class="rounded-lg px-4 py-2 text-sm" style="border: 1px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.6);" :disabled="page * perPage >= total" @click="page++; loadEntries()">
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
