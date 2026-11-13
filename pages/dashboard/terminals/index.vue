<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue';
import { Building2, Terminal as TerminalIcon, Plus, ArrowRight, Eye, EyeOff, Check, Copy, Sparkles, RefreshCw, Layers, Pencil, Trash2, X } from 'lucide-vue-next';
import { getTerminalPresetStatus, type ApiPresetRecord } from '~/lib/builderPresets';
import { ALL_TERMINAL_PERMISSION_PRESETS, presetsForIndustry } from '~/lib/permissions';
import { defaultLayoutVariantForPreset, layoutVariantsForPreset } from '~/lib/starterWorkstations';
import TerminalCard from '~/components/TerminalCard.vue';

definePageMeta({ layout: 'dashboard' });

const router = useRouter();
const route  = useRoute();
const { authHeaders } = useAuth();
const { business }    = useBusiness();
const { copyToClipboard } = useShareOrigin();
const { confirm }     = useModal();


const terminals  = ref<Array<{
  id: string;
  display_name: string;
  role: string;
  permissions: string | null;
  ui_layout: string | null;
  pin_code: string | null;
  is_public: number | boolean | null;
  public_slug: string | null;
}>>([]);
const loading    = ref(false);
const showForm   = ref(false);
const saving     = ref(false);
const error      = ref<string | null>(null);
const pinVisible = ref(false);
const pinCopied  = ref(false);

const availablePresets = computed(() => presetsForIndustry(business.value?.colorPalette?.businessType));

const form = reactive({
  displayName: '',
  pin:         '',
  resolution:  '1280x720',
  presetKey:   ALL_TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register',
  layoutVariant: defaultLayoutVariantForPreset(ALL_TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register'),
});

const currentLayoutVariants = computed(() => layoutVariantsForPreset(form.presetKey));

function openCreateModal(presetKey?: string) {
  if (presetKey) {
    form.presetKey = presetKey as any;
  } else {
    form.presetKey = availablePresets.value[0]?.key ?? ALL_TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register';
  }
  const preset = ALL_TERMINAL_PERMISSION_PRESETS.find(p => p.key === form.presetKey) ?? ALL_TERMINAL_PERMISSION_PRESETS[0];
  const count = terminals.value.filter(t => t.role === preset.label).length + 1;
  form.displayName = `${preset.label} ${count}`;
  form.pin = String(1000 + Math.floor(Math.random() * 9000));
  form.layoutVariant = defaultLayoutVariantForPreset(form.presetKey as any);
  pinVisible.value = true;
  pinCopied.value = false;
  error.value = null;
  showForm.value = true;
}

watch(() => form.presetKey, (nextPresetKey) => {
  const preferred = business.value?.colorPalette?.terminalLayouts?.[nextPresetKey];
  const allowed = layoutVariantsForPreset(nextPresetKey).map((variant) => variant.id);

  if (preferred && allowed.includes(preferred)) {
    form.layoutVariant = preferred;
  } else if (!allowed.includes(form.layoutVariant)) {
    form.layoutVariant = defaultLayoutVariantForPreset(nextPresetKey);
  }

  const preset = ALL_TERMINAL_PERMISSION_PRESETS.find(p => p.key === nextPresetKey);
  if (preset && (!form.displayName || ALL_TERMINAL_PERMISSION_PRESETS.some(p => form.displayName.startsWith(p.label)))) {
    const count = terminals.value.filter(t => t.role === preset.label).length + 1;
    form.displayName = `${preset.label} ${count}`;
  }
}, { immediate: true });

function onPinInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const digits = el.value.replace(/\D/g, '').slice(0, 8);
  form.pin = digits;
  el.value = digits;
}

function friendlyTerminalError(value: unknown) {
  const message = String(value ?? '').toLowerCase();
  if (message.includes('pin')) return 'Use a PIN between 4 and 8 digits.';
  if (message.includes('name')) return 'Enter a name for this terminal.';
  return 'We could not create this terminal. Check the details and try again.';
}

async function copyPin() {
  if (!form.pin) return;

  const success = await copyToClipboard(form.pin);
  if (success) {
    pinCopied.value = true;
    setTimeout(() => (pinCopied.value = false), 1500);
  } else {
    error.value = 'Copying is unavailable here. You can select the PIN and copy it manually.';
  }
}

function onTerminalDeleted(terminalId: string) {
  terminals.value = terminals.value.filter((t) => t.id !== terminalId);
}

const presets              = ref<ApiPresetRecord[]>([]);
const latestPresetVersions = ref<Record<string, number>>({});
const presetActionError    = ref<string | null>(null);
const presetActionNotice   = ref<string | null>(null);
const syncingAll           = ref(false);
const syncingPresetId      = ref<string | null>(null);
const deletingPresetId     = ref<string | null>(null);

// Save terminal as custom preset modal
const showSavePresetModal  = ref(false);
const savingCustomPreset   = ref(false);
const savePresetForm = reactive({
  terminalId: '',
  name: '',
  description: '',
  linkTerminal: true,
});

// Edit custom preset modal
const editingPreset        = ref<ApiPresetRecord | null>(null);
const updatingCustomPreset = ref(false);
const editPresetForm = reactive({
  name: '',
  description: '',
  syncLinkedTerminals: true,
});

// Apply preset to terminal / new workstation modal
const applyingPreset       = ref<ApiPresetRecord | null>(null);
const applyingPresetBusy   = ref(false);
const applyPresetForm = reactive({
  mode: 'terminal' as 'terminal' | 'new',
  terminalId: '',
  displayName: '',
  pin: '1234',
});

const customPresetsList = computed(() => presets.value.filter((p) => p.is_custom));
const systemPresetsList = computed(() => presets.value.filter((p) => !p.is_custom));
const outdatedTerminalIds = computed(() =>
  terminals.value
    .filter((t) => getTerminalPresetStatus(t, latestPresetVersions.value).updateAvailable)
    .map((t) => t.id),
);

async function loadPresets() {
  if (!business.value) return;
  try {
    const res = await $fetch<{
      presets?: ApiPresetRecord[];
      latestVersions?: Record<string, number>;
    }>('/api/presets', {
      headers: authHeaders(),
      query: { businessId: business.value.id },
    });
    presets.value = res.presets ?? [];
    latestPresetVersions.value = res.latestVersions ?? {};
  } catch {
    presets.value = [];
  }
}

async function loadTerminals() {
  if (!business.value) return;
  loading.value = true;
  error.value = null;

  try {
    const [termRes] = await Promise.all([
      $fetch<{ terminals?: any[]; error?: string | null }>('/api/terminals', {
        headers: authHeaders(),
        query: { businessId: business.value.id },
      }),
      loadPresets(),
    ]);
    if (termRes.error) {
      error.value = friendlyTerminalError(termRes.error);
      return;
    }
    terminals.value = termRes.terminals ?? [];
  } catch (err: any) {
    error.value = friendlyTerminalError(err?.data?.message ?? err?.data?.error ?? err?.message);
  } finally {
    loading.value = false;
  }
}

function openSavePresetModal(defaultTerminalId?: string) {
  const sourceId = defaultTerminalId || terminals.value[0]?.id || '';
  const sourceTerm = terminals.value.find((t) => t.id === sourceId);
  savePresetForm.terminalId = sourceId;
  savePresetForm.name = sourceTerm ? `${sourceTerm.display_name} Template` : '';
  savePresetForm.description = sourceTerm ? `Custom layout & permissions based on ${sourceTerm.display_name}` : '';
  savePresetForm.linkTerminal = true;
  presetActionError.value = null;
  showSavePresetModal.value = true;
}

async function submitSavePreset() {
  if (!business.value || !savePresetForm.terminalId || !savePresetForm.name.trim()) return;
  savingCustomPreset.value = true;
  presetActionError.value = null;
  presetActionNotice.value = null;

  try {
    await $fetch('/api/presets/create', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessId: business.value.id,
        terminalId: savePresetForm.terminalId,
        name: savePresetForm.name.trim(),
        description: savePresetForm.description.trim() || null,
        linkTerminal: savePresetForm.linkTerminal,
      },
    });
    showSavePresetModal.value = false;
    presetActionNotice.value = `Saved custom preset "${savePresetForm.name.trim()}".`;
    await loadTerminals();
  } catch (err: any) {
    presetActionError.value = err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? 'Could not save custom preset.';
  } finally {
    savingCustomPreset.value = false;
  }
}

function openEditPresetModal(preset: ApiPresetRecord) {
  editingPreset.value = preset;
  editPresetForm.name = preset.name;
  editPresetForm.description = preset.description ?? '';
  editPresetForm.syncLinkedTerminals = preset.linked_terminal_count > 0;
  presetActionError.value = null;
}

async function submitEditPreset() {
  if (!editingPreset.value || !editPresetForm.name.trim()) return;
  updatingCustomPreset.value = true;
  presetActionError.value = null;
  presetActionNotice.value = null;

  try {
    const res = await $fetch<{ syncedCount?: number }>(`/api/presets/${editingPreset.value.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        name: editPresetForm.name.trim(),
        description: editPresetForm.description.trim() || null,
        syncLinkedTerminals: editPresetForm.syncLinkedTerminals,
      },
    });
    const syncNote = editPresetForm.syncLinkedTerminals && (res.syncedCount ?? 0) > 0
      ? ` and synced ${res.syncedCount} linked terminal(s)`
      : '';
    presetActionNotice.value = `Updated "${editPresetForm.name.trim()}"${syncNote}.`;
    editingPreset.value = null;
    await loadTerminals();
  } catch (err: any) {
    presetActionError.value = err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? 'Could not update preset.';
  } finally {
    updatingCustomPreset.value = false;
  }
}

async function syncPresetToLinked(preset: ApiPresetRecord) {
  syncingPresetId.value = preset.id;
  presetActionError.value = null;
  presetActionNotice.value = null;
  try {
    const res = await $fetch<{ syncedCount?: number }>(`/api/presets/${preset.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: { syncLinkedTerminals: true },
    });
    presetActionNotice.value = `Synced "${preset.name}" across ${res.syncedCount ?? 0} linked terminal(s).`;
    await loadTerminals();
  } catch (err: any) {
    presetActionError.value = err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? 'Could not sync preset.';
  } finally {
    syncingPresetId.value = null;
  }
}

async function syncAllOutdated() {
  if (!outdatedTerminalIds.value.length) return;
  syncingAll.value = true;
  presetActionError.value = null;
  presetActionNotice.value = null;
  let updatedCount = 0;

  try {
    for (const termId of outdatedTerminalIds.value) {
      const res = await $fetch<{ updated?: boolean }>('/api/presets/sync', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { terminalId: termId },
      });
      if (res.updated) updatedCount += 1;
    }
    presetActionNotice.value = `Synced ${updatedCount} terminal(s) to latest preset version.`;
    await loadTerminals();
  } catch (err: any) {
    presetActionError.value = err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? 'Could not sync all terminals.';
  } finally {
    syncingAll.value = false;
  }
}

async function deleteCustomPreset(preset: ApiPresetRecord) {
  const approved = await confirm({
    title: `Delete "${preset.name}"?`,
    description: 'This deletes the custom template. Existing terminals stay intact.',
    confirmLabel: 'Delete preset',
    confirmVariant: 'danger',
  });
  if (!approved) return;

  deletingPresetId.value = preset.id;
  presetActionError.value = null;
  presetActionNotice.value = null;
  try {
    await $fetch(`/api/presets/${preset.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    presetActionNotice.value = `Deleted "${preset.name}".`;
    await loadTerminals();
  } catch (err: any) {
    presetActionError.value = err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? 'Could not delete preset.';
  } finally {
    deletingPresetId.value = null;
  }
}

function openApplyPresetModal(preset: ApiPresetRecord, defaultMode: 'terminal' | 'new' = 'terminal') {
  applyingPreset.value = preset;
  applyPresetForm.mode = terminals.value.length > 0 ? defaultMode : 'new';
  applyPresetForm.terminalId = terminals.value[0]?.id ?? '';
  applyPresetForm.displayName = `${preset.name} ${terminals.value.length + 1}`;
  applyPresetForm.pin = String(1000 + Math.floor(Math.random() * 9000));
  presetActionError.value = null;
}

async function submitApplyPreset() {
  if (!business.value || !applyingPreset.value) return;
  applyingPresetBusy.value = true;
  presetActionError.value = null;
  presetActionNotice.value = null;

  try {
    const body = applyPresetForm.mode === 'new'
      ? {
          businessId: business.value.id,
          presetId: applyingPreset.value.id,
          createTerminal: true,
          displayName: applyPresetForm.displayName.trim() || applyingPreset.value.name,
          pin: applyPresetForm.pin.trim() || '1234',
        }
      : {
          businessId: business.value.id,
          presetId: applyingPreset.value.id,
          terminalId: applyPresetForm.terminalId,
        };

    const res = await $fetch<{ terminal?: { display_name?: string } | null; appliedTables?: string[] }>('/api/presets/apply', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body,
    });

    const tableSuffix = res.appliedTables?.length ? ` (${res.appliedTables.length} table(s) verified)` : '';
    presetActionNotice.value = res.terminal?.display_name
      ? `Applied "${applyingPreset.value.name}" to ${res.terminal.display_name}${tableSuffix}.`
      : `Applied "${applyingPreset.value.name}"${tableSuffix}.`;
    applyingPreset.value = null;
    await loadTerminals();
  } catch (err: any) {
    presetActionError.value = err?.data?.statusMessage ?? err?.data?.message ?? err?.message ?? 'Could not apply preset.';
  } finally {
    applyingPresetBusy.value = false;
  }
}

async function createTerminal() {
  if (!business.value) return;
  if (!form.displayName.trim()) {
    error.value = 'Enter a name for this terminal.';
    return;
  }
  if (!form.pin) {
    error.value = 'Enter a PIN for staff sign-in.';
    return;
  }
  if (!/^\d{4,8}$/.test(form.pin)) {
    error.value = 'PIN must be 4-8 digits (numbers only)';
    return;
  }

  saving.value = true;
  error.value  = null;

  try {
    const res = await $fetch<{ error: string | null }>('/api/terminals/create', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    {
        businessId:  business.value.id,
        displayName: form.displayName.trim(),
        pin:         form.pin,
        resolution:  form.resolution,
        presetKey:   form.presetKey,
        layoutVariant: form.layoutVariant,
      },
    });

    if (res.error) {
      error.value = friendlyTerminalError(res.error);
      return;
    }

    showForm.value   = false;
    pinVisible.value = false;
    pinCopied.value  = false;
    form.displayName = '';
    form.pin         = '';
    form.presetKey   = availablePresets.value[0]?.key ?? ALL_TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register';
    form.layoutVariant = defaultLayoutVariantForPreset(form.presetKey);
    await loadTerminals();
  } catch (err: any) {
    console.error('[createTerminal]', err);
    error.value = friendlyTerminalError(err?.data?.message ?? err?.data?.error ?? err?.message);
  } finally {
    saving.value = false;
  }
}


onMounted(() => {
  loadTerminals();
  const createPreset = route.query.create as string;
  if (createPreset) {
    openCreateModal(createPreset === 'true' || createPreset === '1' ? undefined : createPreset);
  }
});
watch(() => business.value?.id, loadTerminals);
watch(() => route.query.create, (nextPreset) => {
  if (nextPreset) {
    openCreateModal(nextPreset === 'true' || nextPreset === '1' ? undefined : (nextPreset as string));
  }
});
</script>

<template>
  <div class="relative flex-1 min-h-0 flex flex-col overflow-hidden" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">
    <!-- ── Page header ──────────────────────────────────────────────────────── -->
    <div
      class="px-8 py-5 flex items-center justify-between shrink-0"
      style="background: white; border-bottom: 1px solid rgba(61,24,32,0.08);"
    >
      <div>
        <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Terminals</h1>
        <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">
          Staff & workstation terminals - {{ terminals.length }} configured
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          v-if="terminals.length > 0"
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer bg-white disabled:opacity-50"
          style="border-color: rgba(61,24,32,0.14); color: rgb(var(--shell-sidebar));"
          :disabled="!business"
          @click="openSavePresetModal()"
        >
          <Layers class="w-3.5 h-3.5" />
          Save as Preset
        </button>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 btn-primary btn-ribbon"
          :disabled="!business"
          :title="!business ? 'Please create a business in Settings first' : 'Create new workstation'"
          @click="openCreateModal()"
        >
          <Plus class="w-4 h-4" />
          New Workstation
        </button>
      </div>
    </div>

    <!-- ── Content area ─────────────────────────────────────────────────────── -->
    <div class="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-8 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-20">
        <div
          class="w-6 h-6 rounded-full border-2 animate-spin"
          style="border-color: rgba(61,24,32,0.12); border-top-color: rgb(var(--shell-sidebar));"
        />
      </div>

      <div
        v-else-if="error && !showForm"
        class="mb-5 rounded-xl px-4 py-3 text-sm"
        style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #b42318;"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- Empty state / No business -->
      <div
        v-else-if="!business"
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <Building2 class="w-12 h-12 mb-4" style="color: rgba(61,24,32,0.1);" />
        <p class="text-base font-semibold" style="color: rgba(61,24,32,0.35);">No business configured</p>
        <p class="text-sm mt-1 mb-4" style="color: rgba(61,24,32,0.25);">You need to set up your business before creating terminals.</p>
        <NuxtLink
          to="/dashboard/settings"
          class="px-4 py-2 text-sm font-medium rounded-xl transition-all"
          style="background: rgba(61,24,32,0.06); color: rgba(61,24,32,0.65); text-decoration: none;"
        >
          <div class="flex items-center justify-center gap-1.5">
            Go to Settings <ArrowRight class="w-3.5 h-3.5" />
          </div>
        </NuxtLink>
      </div>

      <!-- Empty state / No terminals -->
      <div
        v-else-if="terminals.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto"
      >
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style="background: rgba(255, 87, 118, 0.1); color: rgb(var(--shell-pink));">
          <TerminalIcon class="w-7 h-7" />
        </div>
        <h2 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">No workstations yet</h2>
        <p class="text-sm mt-1 mb-6" style="color: rgba(61,24,32,0.5);">Choose a workstation preset below to provision it with starter layout and tables immediately:</p>

        <!-- Starter Presets Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full text-left mb-6">
          <button
            v-for="preset in availablePresets"
            :key="preset.key"
            type="button"
            class="p-4 rounded-xl border transition-all text-left group bg-white cursor-pointer hover:border-[#FF5776] hover:shadow-md"
            style="border-color: rgba(61,24,32,0.08);"
            @click="openCreateModal(preset.key)"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-[#68293A]">{{ preset.label }}</span>
              <Plus class="w-4 h-4 text-[#FF5776] opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p class="text-[11px] leading-relaxed m-0 text-[rgba(61,24,32,0.6)]">{{ preset.description }}</p>
          </button>
        </div>
      </div>

      <!-- Terminal grid & preset management -->
      <div v-else class="space-y-8">
        <div
          v-if="outdatedTerminalIds.length > 0"
          class="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3);"
        >
          <div class="flex items-center gap-2 text-xs font-semibold" style="color: #92400e;">
            <RefreshCw class="w-4 h-4" />
            <span>{{ outdatedTerminalIds.length }} workstation(s) are behind their linked preset template version.</span>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all disabled:opacity-50"
            style="background: #92400e; color: white;"
            :disabled="syncingAll"
            @click="syncAllOutdated"
          >
            {{ syncingAll ? 'Syncing all...' : 'Sync All Outdated' }}
          </button>
        </div>

        <div
          v-if="presetActionNotice"
          class="rounded-xl px-4 py-3 flex items-center justify-between text-xs font-medium"
          style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #047857;"
        >
          <span>{{ presetActionNotice }}</span>
          <button type="button" class="border-none bg-transparent cursor-pointer text-current" @click="presetActionNotice = null">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          v-if="presetActionError"
          class="rounded-xl px-4 py-3 flex items-center justify-between text-xs font-medium"
          style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: #b42318;"
        >
          <span>{{ presetActionError }}</span>
          <button type="button" class="border-none bg-transparent cursor-pointer text-current" @click="presetActionError = null">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
          <TerminalCard
            v-for="ip in terminals"
            :key="ip.id"
            :terminal="ip"
            :latest-preset-versions="latestPresetVersions"
            @deleted="onTerminalDeleted(ip.id)"
            @synced="loadTerminals"
          />
        </div>

        <!-- Preset Templates Library -->
        <section class="pt-6 border-t space-y-5" style="border-color: rgba(61,24,32,0.08);">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Preset Templates</h2>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.5);">
                Save reusable workstation layouts, push updates to linked terminals, or provision all 9 official station presets.
              </p>
            </div>
            <button
              v-if="terminals.length > 0"
              type="button"
              class="px-3.5 py-2 text-xs font-semibold rounded-lg border bg-white cursor-pointer transition-all flex items-center gap-1.5"
              style="border-color: rgba(61,24,32,0.14); color: rgb(var(--shell-sidebar));"
              @click="openSavePresetModal()"
            >
              <Plus class="w-3.5 h-3.5" /> Save Terminal as Preset
            </button>
          </div>

          <!-- Custom Presets -->
          <div class="space-y-2.5">
            <h3 class="text-[11px] font-bold uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">
              Custom Business Presets ({{ customPresetsList.length }})
            </h3>

            <div
              v-if="customPresetsList.length === 0"
              class="rounded-xl p-5 bg-white border text-xs"
              style="border-color: rgba(61,24,32,0.08); color: rgba(61,24,32,0.55);"
            >
              No custom presets yet. Save any customized terminal above to reuse and sync changes across your fleet.
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="preset in customPresetsList"
                :key="preset.id"
                class="rounded-xl bg-white p-4 border flex flex-col gap-3"
                style="border-color: rgba(61,24,32,0.08);"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="font-semibold text-sm truncate" style="color: rgb(var(--shell-sidebar));">{{ preset.name }}</p>
                    <div class="flex items-center gap-1.5 mt-1">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" style="background: rgba(255,87,118,0.12); color: #be123c;">
                        Custom v{{ preset.version }}
                      </span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono" style="background: rgba(61,24,32,0.06); color: rgba(61,24,32,0.6);">
                        {{ preset.linked_terminal_count }} linked
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      class="p-1.5 rounded-lg hover:bg-black/5 border-none bg-transparent cursor-pointer"
                      style="color: rgba(61,24,32,0.5);"
                      title="Edit custom preset"
                      @click="openEditPresetModal(preset)"
                    >
                      <Pencil class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      :disabled="deletingPresetId === preset.id"
                      class="p-1.5 rounded-lg hover:bg-red-50 border-none bg-transparent cursor-pointer"
                      style="color: #b42318;"
                      title="Delete custom preset"
                      @click="deleteCustomPreset(preset)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p class="text-xs line-clamp-2" style="color: rgba(61,24,32,0.55);">
                  {{ preset.description || 'Reusable custom workstation layout & permissions.' }}
                </p>

                <div class="flex flex-wrap items-center gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    class="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary btn-ribbon cursor-pointer border-none"
                    @click="openApplyPresetModal(preset, terminals.length ? 'terminal' : 'new')"
                  >
                    Apply Preset
                  </button>
                  <button
                    v-if="preset.linked_terminal_count > 0"
                    type="button"
                    :disabled="syncingPresetId === preset.id"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    style="border-color: rgba(61,24,32,0.14); color: rgb(var(--shell-sidebar));"
                    @click="syncPresetToLinked(preset)"
                  >
                    <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': syncingPresetId === preset.id }" />
                    Sync Linked
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Official System Presets -->
          <div class="space-y-2.5">
            <h3 class="text-[11px] font-bold uppercase tracking-wider" style="color: rgba(61,24,32,0.45);">
              Official System Presets ({{ systemPresetsList.length }})
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="preset in systemPresetsList"
                :key="preset.id"
                class="rounded-xl bg-white p-4 border flex flex-col gap-2.5"
                style="border-color: rgba(61,24,32,0.08);"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="font-semibold text-sm truncate" style="color: rgb(var(--shell-sidebar));">{{ preset.name }}</p>
                    <div class="flex items-center gap-1.5 mt-1">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase" style="background: rgba(61,24,32,0.06); color: rgba(61,24,32,0.6);">
                        {{ preset.category }} · v{{ preset.version }}
                      </span>
                      <span v-if="preset.linked_terminal_count > 0" class="px-1.5 py-0.5 rounded text-[10px] font-mono" style="background: rgba(16,185,129,0.1); color: #047857;">
                        {{ preset.linked_terminal_count }} linked
                      </span>
                    </div>
                  </div>
                </div>
                <p class="text-xs line-clamp-2" style="color: rgba(61,24,32,0.55);">{{ preset.description }}</p>
                <div class="flex items-center gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    class="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white cursor-pointer hover:border-[#FF5776]"
                    style="border-color: rgba(61,24,32,0.12); color: rgb(var(--shell-sidebar));"
                    @click="openApplyPresetModal(preset, 'terminal')"
                  >
                    Apply to Terminal
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer"
                    style="background: rgba(232,116,138,0.12); color: rgb(var(--shell-pink));"
                    @click="openApplyPresetModal(preset, 'new')"
                  >
                    + New
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ── Create form modal ─────────────────────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        style="background: rgba(15,5,7,0.4); backdrop-filter: blur(8px);"
        @click.self="showForm = false"
      >
        <div class="w-full max-w-sm bg-white rounded-xl p-7 space-y-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="new-terminal-title">
          <div>
            <h2 id="new-terminal-title" class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">New Terminal</h2>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Give it a name, set a PIN, and Kogane will create the starter layout automatically.</p>
          </div>

          <div class="space-y-4">
            <div>
              <label for="new-terminal-name" class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.7);">Terminal name</label>
              <input
                id="new-terminal-name"
                v-model="form.displayName"
                class="input-warm w-full px-4 py-2.5 text-sm"
                placeholder="Cash Register 1"
              />
            </div>

            <div>
              <label for="new-terminal-pin" class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">PIN (4-8 digits)</label>
              <div class="relative">
                <input
                  id="new-terminal-pin"
                  :value="form.pin"
                  :type="pinVisible ? 'text' : 'password'"
                  inputmode="numeric"
                  maxlength="8"
                  autocomplete="off"
                  class="input-warm w-full px-4 py-2.5 text-sm pr-20"
                  :style="pinVisible ? '' : '-webkit-text-security: disc;'"
                  placeholder="0000"
                  @input="onPinInput"
                />
                <div class="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
                  <button
                    type="button"
                    class="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style="color: rgba(61,24,32,0.4);"
                    :title="pinCopied ? 'Copied!' : 'Copy PIN'"
                    :aria-label="pinCopied ? 'PIN copied' : 'Copy PIN'"
                    @click="copyPin"
                  >
                    <svg v-if="!pinCopied" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #22c55e;">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style="color: rgba(61,24,32,0.4);"
                    :title="pinVisible ? 'Hide PIN' : 'Show PIN'"
                    :aria-label="pinVisible ? 'Hide PIN' : 'Show PIN'"
                    @click="pinVisible = !pinVisible"
                  >
                    <EyeOff v-if="pinVisible" class="w-4 h-4" />
                    <Eye v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label for="new-terminal-resolution" class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.7);">Screen size</label>
              <select id="new-terminal-resolution" v-model="form.resolution" class="input-warm w-full px-4 py-2.5 text-sm">
                <option value="1280x720">Landscape (1280x720)</option>
                <option value="1920x1080">Landscape 1080p (1920x1080)</option>
                <option value="1024x768">Tablet (1024x768)</option>
                <option value="720x1280">Portrait (720x1280)</option>
                <option value="1080x1920">Portrait 1080p (1080x1920)</option>
              </select>
            </div>

            <div>
              <label for="new-terminal-permission" class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.7);">Staff access</label>
              <select id="new-terminal-permission" v-model="form.presetKey" class="input-warm w-full px-4 py-2.5 text-sm">
                <option v-for="preset in availablePresets" :key="preset.key" :value="preset.key">
                  {{ preset.label }}
                </option>
              </select>
            </div>

            <div v-if="currentLayoutVariants.length > 0">
              <label for="new-terminal-layout" class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.7);">Workspace style</label>
              <select id="new-terminal-layout" v-model="form.layoutVariant" class="input-warm w-full px-4 py-2.5 text-sm">
                <option v-for="variant in currentLayoutVariants" :key="variant.id" :value="variant.id">
                  {{ variant.label }}
                </option>
              </select>
              <p class="text-[11px] mt-1" style="color: rgba(61,24,32,0.42);">
                {{ currentLayoutVariants.find((variant) => variant.id === form.layoutVariant)?.description }}
              </p>
            </div>
          </div>

          <div
            v-if="error"
            class="text-xs px-3 py-2 rounded-md"
            style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
          >
            {{ error }}
          </div>

          <div class="flex gap-3 pt-1">
            <button
              type="button"
              class="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all"
              style="border: 1.5px solid rgba(61,24,32,0.18); color: rgba(61,24,32,0.65);"
              @click="showForm = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 btn-primary btn-ribbon"
              :disabled="!form.displayName || !form.pin || saving"
              @click="createTerminal"
            >
              {{ saving ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Save Terminal as Preset modal ─────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="showSavePresetModal"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        style="background: rgba(15,5,7,0.4); backdrop-filter: blur(8px);"
        @click.self="showSavePresetModal = false"
      >
        <div class="w-full max-w-md bg-white rounded-xl p-7 space-y-4 shadow-2xl" role="dialog" aria-modal="true">
          <div>
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Save Terminal as Preset</h2>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.5);">Capture a terminal's layout and permissions as a reusable business template.</p>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">Source terminal</label>
              <select v-model="savePresetForm.terminalId" class="input-warm w-full px-3 py-2 text-sm">
                <option v-for="t in terminals" :key="t.id" :value="t.id">{{ t.display_name }} ({{ t.role }})</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">Preset name</label>
              <input v-model="savePresetForm.name" type="text" placeholder="e.g. Branch Register v1" class="input-warm w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">Description</label>
              <textarea v-model="savePresetForm.description" rows="2" class="input-warm w-full px-3 py-2 text-sm" placeholder="Optional notes about this workstation setup" />
            </div>
            <label class="flex items-center gap-2 text-xs cursor-pointer" style="color: rgba(61,24,32,0.75);">
              <input v-model="savePresetForm.linkTerminal" type="checkbox" class="rounded" />
              Link source terminal to this preset so future updates sync automatically
            </label>
          </div>
          <div class="flex gap-2.5 pt-2">
            <button type="button" class="flex-1 py-2 text-sm font-medium rounded-lg border-none cursor-pointer" style="color: rgba(61,24,32,0.6); background: rgba(61,24,32,0.06);" @click="showSavePresetModal = false">
              Cancel
            </button>
            <button type="button" class="flex-1 py-2 text-sm font-semibold rounded-lg btn-primary btn-ribbon cursor-pointer border-none disabled:opacity-40" :disabled="savingCustomPreset || !savePresetForm.name.trim() || !savePresetForm.terminalId" @click="submitSavePreset">
              {{ savingCustomPreset ? 'Saving...' : 'Save Preset' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Edit Custom Preset modal ──────────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="editingPreset"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        style="background: rgba(15,5,7,0.4); backdrop-filter: blur(8px);"
        @click.self="editingPreset = null"
      >
        <div class="w-full max-w-md bg-white rounded-xl p-7 space-y-4 shadow-2xl" role="dialog" aria-modal="true">
          <div>
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Edit Custom Preset</h2>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.5);">Updating increments the preset version to v{{ editingPreset.version + 1 }}.</p>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">Preset name</label>
              <input v-model="editPresetForm.name" type="text" class="input-warm w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">Description</label>
              <textarea v-model="editPresetForm.description" rows="2" class="input-warm w-full px-3 py-2 text-sm" />
            </div>
            <label v-if="editingPreset.linked_terminal_count > 0" class="flex items-center gap-2 text-xs cursor-pointer" style="color: rgba(61,24,32,0.75);">
              <input v-model="editPresetForm.syncLinkedTerminals" type="checkbox" class="rounded" />
              Sync updates immediately to {{ editingPreset.linked_terminal_count }} linked terminal(s)
            </label>
          </div>
          <div class="flex gap-2.5 pt-2">
            <button type="button" class="flex-1 py-2 text-sm font-medium rounded-lg border-none cursor-pointer" style="color: rgba(61,24,32,0.6); background: rgba(61,24,32,0.06);" @click="editingPreset = null">
              Cancel
            </button>
            <button type="button" class="flex-1 py-2 text-sm font-semibold rounded-lg btn-primary btn-ribbon cursor-pointer border-none disabled:opacity-40" :disabled="updatingCustomPreset || !editPresetForm.name.trim()" @click="submitEditPreset">
              {{ updatingCustomPreset ? 'Updating...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Apply Preset modal ────────────────────────────────────────────── -->
    <Transition name="v">
      <div
        v-if="applyingPreset"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        style="background: rgba(15,5,7,0.4); backdrop-filter: blur(8px);"
        @click.self="applyingPreset = null"
      >
        <div class="w-full max-w-md bg-white rounded-xl p-7 space-y-4 shadow-2xl" role="dialog" aria-modal="true">
          <div>
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Apply "{{ applyingPreset.name }}"</h2>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.5);">Apply this template's layout, permissions, and starter tables while preserving terminal branding.</p>
          </div>
          <div class="flex gap-2">
            <button
              v-if="terminals.length > 0"
              type="button"
              class="flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
              :style="applyPresetForm.mode === 'terminal' ? 'background: rgba(255,87,118,0.1); border-color: #FF5776; color: #be123c;' : 'background: white; border-color: rgba(61,24,32,0.12); color: rgba(61,24,32,0.6);'"
              @click="applyPresetForm.mode = 'terminal'"
            >
              Existing Terminal
            </button>
            <button
              type="button"
              class="flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
              :style="applyPresetForm.mode === 'new' ? 'background: rgba(255,87,118,0.1); border-color: #FF5776; color: #be123c;' : 'background: white; border-color: rgba(61,24,32,0.12); color: rgba(61,24,32,0.6);'"
              @click="applyPresetForm.mode = 'new'"
            >
              Create New Terminal
            </button>
          </div>

          <div v-if="applyPresetForm.mode === 'terminal' && terminals.length > 0" class="space-y-2">
            <label class="text-xs font-semibold block" style="color: rgba(61,24,32,0.7);">Target terminal</label>
            <select v-model="applyPresetForm.terminalId" class="input-warm w-full px-3 py-2 text-sm">
              <option v-for="t in terminals" :key="t.id" :value="t.id">{{ t.display_name }} ({{ t.role }})</option>
            </select>
          </div>

          <div v-else class="space-y-3">
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">New terminal name</label>
              <input v-model="applyPresetForm.displayName" type="text" class="input-warm w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1" style="color: rgba(61,24,32,0.7);">Access PIN</label>
              <input v-model="applyPresetForm.pin" type="text" maxlength="12" class="input-warm w-full px-3 py-2 text-sm font-mono" />
            </div>
          </div>

          <div class="flex gap-2.5 pt-2">
            <button type="button" class="flex-1 py-2 text-sm font-medium rounded-lg border-none cursor-pointer" style="color: rgba(61,24,32,0.6); background: rgba(61,24,32,0.06);" @click="applyingPreset = null">
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 py-2 text-sm font-semibold rounded-lg btn-primary btn-ribbon cursor-pointer border-none disabled:opacity-40"
              :disabled="applyingPresetBusy || (applyPresetForm.mode === 'terminal' ? !applyPresetForm.terminalId : !applyPresetForm.displayName.trim())"
              @click="submitApplyPreset"
            >
              {{ applyingPresetBusy ? 'Applying...' : 'Apply Preset' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>


