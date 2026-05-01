<script setup lang="ts">
import { ArrowLeft, Shield, Sparkles } from 'lucide-vue-next';
import { DEFAULT_TERMINAL_PERMISSIONS, normalizePermissions, resolveTablePermissions, TERMINAL_PERMISSION_PRESETS, type TablePermissionKey, type TerminalPermissions } from '~/lib/permissions';

definePageMeta({ layout: 'dashboard' });

const route = useRoute();
const router = useRouter();
const { authHeaders } = useAuth();
const { business } = useBusiness();
const businessId = computed(() => business.value?.id);
const { tables, fetchTables } = useSchema(businessId);

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const terminal = ref<{
  id: string;
  display_name: string;
  role: string;
  permissions: TerminalPermissions;
} | null>(null);
const permissions = ref<TerminalPermissions>(normalizePermissions(DEFAULT_TERMINAL_PERMISSIONS));

async function loadTerminal() {
  if (!route.params.id) return;
  loading.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ terminal: any; error: string | null }>(`/api/terminals/${route.params.id}`, {
      headers: authHeaders(),
    });

    if (res.error || !res.terminal) {
      error.value = res.error ?? 'Terminal not found';
      return;
    }

    terminal.value = res.terminal;
    permissions.value = normalizePermissions(res.terminal.permissions);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

function permissionValue(tableName: string, key: TablePermissionKey) {
  return resolveTablePermissions(permissions.value, tableName)[key];
}

function setPermission(tableName: string, key: TablePermissionKey, value: boolean) {
  const next = normalizePermissions(permissions.value);
  next.tables[tableName] = {
    ...resolveTablePermissions(next, tableName),
    [key]: value,
  };
  permissions.value = next;
}

function applyPreset(presetKey: string) {
  const preset = TERMINAL_PERMISSION_PRESETS.find((item) => item.key === presetKey);
  if (!preset) return;
  permissions.value = normalizePermissions(preset.permissions);
}

function setAuditVisibility(value: boolean) {
  permissions.value = {
    ...permissions.value,
    audit_log: { visible: value },
  };
}

function setReportsVisibility(value: boolean) {
  permissions.value = {
    ...permissions.value,
    reports: { visible: value },
  };
}

async function savePermissions() {
  if (!terminal.value || !business.value) return;
  saving.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>(
      `/api/terminals/${terminal.value.id}/permissions`,
      {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: {
          businessId: business.value.id,
          permissions: permissions.value,
        },
      },
    );

    if (res.error) {
      error.value = res.error;
    }
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await fetchTables();
  await loadTerminal();
});

watch(businessId, fetchTables);
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <header class="px-8 py-6 flex items-center justify-between sticky top-0 z-50 bg-[#fdf7f2]/80 backdrop-blur-xl border-b border-black/[0.03]">
      <div class="flex items-center gap-6">
        <button class="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-black/5" style="color: rgba(61,24,32,0.5);" @click="router.push('/dashboard/terminals')">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style="color: rgba(61,24,32,0.4);">
            Security & Access
          </div>
          <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">
            {{ terminal?.display_name ?? 'Loading Terminal...' }}
          </h1>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="group relative text-sm font-semibold px-6 py-2.5 rounded-2xl transition-all disabled:opacity-40 overflow-hidden shadow-warm"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
          :disabled="saving || !terminal"
          @click="savePermissions"
        >
          <div class="relative z-10 flex items-center gap-2">
            <Sparkles v-if="!saving" class="w-4 h-4 transition-transform group-hover:rotate-12" />
            <div v-else class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            {{ saving ? 'Syncing...' : 'Save Permissions' }}
          </div>
        </button>
      </div>
    </header>

    <div class="px-8 py-7 space-y-6">
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" style="color: rgb(var(--shell-sidebar)); opacity: 0.2;"></div>
        <p class="text-sm font-medium" style="color: rgba(61,24,32,0.45);">Fetching terminal configuration...</p>
      </div>

      <div v-else-if="error" class="rounded-2xl bg-white px-6 py-5 shadow-sm border border-red-100 flex items-center gap-4">
        <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <Shield class="w-5 h-5 text-red-500" />
        </div>
        <div>
          <p class="text-sm font-semibold text-red-900">Failed to load configuration</p>
          <p class="text-xs text-red-600 mt-0.5">{{ error }}</p>
        </div>
      </div>

      <template v-else-if="terminal">
        <!-- ── Configuration Header ─────────────────────────────────────────── -->
        <div class="grid gap-6 md:grid-cols-[1fr_320px]">
          <div class="space-y-6">
            <div class="bg-white rounded-3xl p-8 shadow-warm border border-black/[0.03]">
              <div class="flex items-start justify-between gap-6">
                <div>
                  <div class="flex items-center gap-3 mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg bg-black/5" style="color: rgba(61,24,32,0.5);">Global Configuration</span>
                    <span v-if="saving" class="text-[10px] font-bold uppercase tracking-wider animate-pulse" style="color: rgb(var(--shell-sidebar));">Saving changes...</span>
                  </div>
                  <h2 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Table Permissions</h2>
                  <p class="text-sm mt-1.5 leading-relaxed" style="color: rgba(61,24,32,0.45);">
                    Define how this terminal interacts with your business data. Wildcard permissions <code class="bg-black/5 px-1 rounded font-mono text-xs">*</code> apply to all tables unless explicitly overridden.
                  </p>
                </div>
                <div class="shrink-0 flex flex-col items-end gap-3">
                   <p class="text-[10px] font-bold uppercase tracking-wider text-right" style="color: rgba(61,24,32,0.35);">Quick Presets</p>
                   <select class="input-warm px-4 py-2.5 text-sm min-w-56" @change="applyPreset(($event.target as HTMLSelectElement).value)">
                    <option value="" disabled selected>Apply preset...</option>
                    <option v-for="preset in TERMINAL_PERMISSION_PRESETS" :key="preset.key" :value="preset.key">
                      {{ preset.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="mt-10 overflow-hidden rounded-2xl border border-black/[0.05]">
                <table class="w-full text-sm">
                  <thead>
                    <tr style="background: rgba(61,24,32,0.02);">
                      <th class="text-left py-4 px-6 font-semibold" style="color: rgba(61,24,32,0.55);">Data Resource</th>
                      <th class="text-center py-4 px-4 font-semibold" style="color: rgba(61,24,32,0.55);">Read</th>
                      <th class="text-center py-4 px-4 font-semibold" style="color: rgba(61,24,32,0.55);">Insert</th>
                      <th class="text-center py-4 px-4 font-semibold" style="color: rgba(61,24,32,0.55);">Update</th>
                      <th class="text-center py-4 px-4 font-semibold" style="color: rgba(61,24,32,0.55);">Delete</th>
                      <th class="text-right py-4 px-6 font-semibold" style="color: rgba(61,24,32,0.55);">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-black/[0.04]">
                    <!-- Wildcard Row -->
                    <tr class="group transition-colors hover:bg-black/[0.01]">
                      <td class="py-4 px-6">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center font-mono text-xs font-bold" style="color: rgb(var(--shell-sidebar));">*</div>
                          <div>
                            <p class="font-bold text-sm" style="color: rgb(var(--shell-sidebar));">All Tables (Default)</p>
                            <p class="text-[10px] uppercase tracking-wider font-semibold opacity-40">Wildcard Scope</p>
                          </div>
                        </div>
                      </td>
                      <td v-for="key in ['read','insert','update','delete']" :key="`wildcard-${key}`" class="py-4 px-4 text-center">
                        <label class="inline-flex items-center justify-center w-8 h-8 cursor-pointer rounded-lg transition-all hover:bg-black/5">
                          <input type="checkbox" class="sr-only" :checked="permissionValue('*', key as TablePermissionKey)" @change="setPermission('*', key as TablePermissionKey, ($event.target as HTMLInputElement).checked)" />
                          <div class="w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center" :class="permissionValue('*', key as TablePermissionKey) ? 'bg-[#3d1820] border-[#3d1820]' : 'border-black/10 bg-white'">
                            <svg v-if="permissionValue('*', key as TablePermissionKey)" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        </label>
                      </td>
                      <td class="py-4 px-6 text-right">
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/5" style="color: rgba(61,24,32,0.4);">Base Role</span>
                      </td>
                    </tr>

                    <!-- Specific Table Rows -->
                    <tr v-for="tableName in tables" :key="tableName" class="group transition-colors hover:bg-black/[0.01]">
                      <td class="py-4 px-6">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center font-mono text-xs" style="color: rgba(61,24,32,0.5);">#</div>
                          <p class="font-mono text-sm font-medium" style="color: rgb(var(--shell-sidebar));">{{ tableName }}</p>
                        </div>
                      </td>
                      <td v-for="key in ['read','insert','update','delete']" :key="`${tableName}-${key}`" class="py-4 px-4 text-center">
                        <label class="inline-flex items-center justify-center w-8 h-8 cursor-pointer rounded-lg transition-all hover:bg-black/5">
                          <input type="checkbox" class="sr-only" :checked="permissionValue(tableName, key as TablePermissionKey)" @change="setPermission(tableName, key as TablePermissionKey, ($event.target as HTMLInputElement).checked)" />
                          <div class="w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center" :class="permissionValue(tableName, key as TablePermissionKey) ? 'bg-[#3d1820] border-[#3d1820]' : 'border-black/10 bg-white'">
                            <svg v-if="permissionValue(tableName, key as TablePermissionKey)" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        </label>
                      </td>
                      <td class="py-4 px-6 text-right">
                        <div v-if="permissions.tables[tableName]" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                          <div class="w-1 h-1 rounded-full bg-amber-500"></div> Overridden
                        </div>
                        <span v-else class="text-[10px] font-bold uppercase tracking-wider text-black/20 italic">Inherited</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <!-- ── Administrative Access ──────────────────────────────────────── -->
            <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-6">
              <div>
                <h3 class="font-serif text-lg font-normal mb-1" style="color: rgb(var(--shell-sidebar));">Admin Views</h3>
                <p class="text-xs leading-relaxed" style="color: rgba(61,24,32,0.4);">Control visibility of administrative dashboards on this terminal.</p>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between p-3.5 rounded-2xl border transition-all" :class="permissions.audit_log.visible ? 'bg-[#3d1820]/[0.02] border-[#3d1820]/10' : 'bg-transparent border-black/[0.06]'">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-black/5" style="color: rgba(61,24,32,0.6);">
                      <Shield class="w-4 h-4" />
                    </div>
                    <div>
                      <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Audit Log</p>
                      <p class="text-[10px] font-medium" style="color: rgba(61,24,32,0.4);">View change history</p>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" :checked="permissions.audit_log.visible" @change="setAuditVisibility(($event.target as HTMLInputElement).checked)" />
                    <div class="w-11 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3d1820]"></div>
                  </label>
                </div>

                <div class="flex items-center justify-between p-3.5 rounded-2xl border transition-all" :class="permissions.reports.visible ? 'bg-[#3d1820]/[0.02] border-[#3d1820]/10' : 'bg-transparent border-black/[0.06]'">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-black/5" style="color: rgba(61,24,32,0.6);">
                      <Sparkles class="w-4 h-4" />
                    </div>
                    <div>
                      <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Reports</p>
                      <p class="text-[10px] font-medium" style="color: rgba(61,24,32,0.4);">View analytics</p>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" :checked="permissions.reports.visible" @change="setReportsVisibility(($event.target as HTMLInputElement).checked)" />
                    <div class="w-11 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3d1820]"></div>
                  </label>
                </div>
              </div>
            </div>

            <!-- ── Terminal Stats ────────────────────────────────────────────── -->
            <div class="rounded-3xl p-7 border border-black/[0.06] bg-[#fdfaf8] space-y-4">
              <h4 class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: rgba(61,24,32,0.4);">Information</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: rgba(61,24,32,0.5);">Terminal ID</span>
                  <span class="font-mono text-[10px] font-bold" style="color: rgb(var(--shell-sidebar));">{{ terminal.id }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: rgba(61,24,32,0.5);">Assigned Role</span>
                  <span class="text-xs font-bold" style="color: rgb(var(--shell-sidebar));">{{ terminal.role }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color: rgba(61,24,32,0.5);">Active Tables</span>
                  <span class="text-xs font-bold" style="color: rgb(var(--shell-sidebar));">{{ tables.length }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
