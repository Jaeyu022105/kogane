<script setup lang="ts">
import ArrowLeftIcon from 'reicon-vue/icons/ArrowLeft';
import TrashIcon from 'reicon-vue/icons/Trash';
import Link2Icon from 'reicon-vue/icons/Link2';
import KeyIcon from 'reicon-vue/icons/Key';
import PaletteIcon from 'reicon-vue/icons/Palette';
import SlidersIcon from 'reicon-vue/icons/Sliders';
import GlobeIcon from 'reicon-vue/icons/Globe';
import SparklesIcon from 'reicon-vue/icons/Sparkles';
import CheckIcon from 'reicon-vue/icons/Check';
import RefreshIcon from 'reicon-vue/icons/Refresh';
import EyeIcon from 'reicon-vue/icons/Eye';
import EyeOffIcon from 'reicon-vue/icons/EyeOff';
import ShieldIcon from 'reicon-vue/icons/Shield';
import PlusIcon from 'reicon-vue/icons/Plus';
import { UI_LAYOUT_BUNDLES, type LayoutBundleKey } from '~/lib/workspaceBranding';
import {
  ALL_TERMINAL_PERMISSION_PRESETS,
  inferPermissionPreset,
  normalizePermissions,
  resolveTablePermissions,
  type PermissionPreset,
  type TablePermissionKey,
  type TerminalPermissions,
} from '~/lib/permissions';

definePageMeta({ layout: 'dashboard' });

const route  = useRoute();
const router = useRouter();
const { isEnterprise }  = useEnterpriseAccess();
const { authHeaders }   = useAuth();
const { business }      = useBusiness();
const { confirm, alert } = useModal();
const { buildShareUrl, copyToClipboard } = useShareOrigin();
const { t } = useLocale();
const businessId = computed(() => business.value?.id);

// ── State ───────────────────────────────────────────────────────────────────

const loading           = ref(false);
const savingBasic       = ref(false);
const savingStyle       = ref(false);
const savingPublic      = ref(false);
const savingPermissions = ref(false);
const permissionsSaved  = ref(false);
const deleting          = ref(false);
const error             = ref<string | null>(null);

const terminal = ref<{
  id: string;
  business_id?: string;
  display_name: string;
  role: string;
  pin_code: string | null;
  is_public: boolean;
  public_slug: string | null;
  ui_layout: any;
  permissions?: TerminalPermissions;
} | null>(null);

const permissionsState = ref<TerminalPermissions>(normalizePermissions());
const workspaceTables = ref<string[]>([]);
const newPermissionTable = ref('');

const PERMISSION_ACTIONS: { key: TablePermissionKey; label: string }[] = [
  { key: 'read', label: 'Read' },
  { key: 'insert', label: 'Insert' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
];

const permissionTableNames = computed(() => {
  const seen = new Set<string>();
  for (const t of workspaceTables.value) {
    if (t && t !== '*') seen.add(t);
  }
  for (const t of Object.keys(permissionsState.value.tables || {})) {
    if (t && t !== '*') seen.add(t);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
});

const activePermissionPreset = computed(() => inferPermissionPreset(permissionsState.value));

// Basic options
const optionDisplayName = ref('');
const optionPin         = ref('');
const pinVisible        = ref(false);
const copiedLink        = ref(false);
const copiedPin         = ref(false);
const publicSaved       = ref(false);

// Public access
const isPublic   = ref(false);
const publicSlug = ref('');
const publicUrl  = computed(() => {
  if (!isPublic.value || !publicSlug.value) return null;
  return buildShareUrl(`/t/${publicSlug.value}`) || `/t/${publicSlug.value}`;
});

// Style settings
const selectedBundle  = ref<LayoutBundleKey>('aurora-service');
const accentColor     = ref('#ff8ca6');
/** True while this terminal has no style override and simply follows the workspace brand kit. */
const followsWorkspaceBrand = ref(true);
const savingContent   = ref(false);

function useWorkspaceStyleDefaults() {
  const workspace = business.value?.colorPalette;
  selectedBundle.value = workspace?.layoutBundle ?? 'aurora-service';
  const bundle = UI_LAYOUT_BUNDLES.find((item) => item.key === selectedBundle.value);
  accentColor.value = workspace?.accent ?? bundle?.swatches?.[2] ?? '#ff8ca6';
}

// Terminal content preferences.
const stationConfig = reactive<{
  welcomeMessage: string;
  menuItems: string;
  language: string;
  showReceipt: boolean;
  currencySymbol: string;
}>({
  welcomeMessage: '',
  menuItems: '',
  language: 'en',
  showReceipt: true,
  currencySymbol: business.value?.currencySymbol || '$',
});

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
];

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadTerminal() {
  if (!route.params.id) return;
  loading.value = true;
  error.value   = null;

  try {
    const res = await $fetch<{ terminal: any; error: string | null }>(
      `/api/terminals/${route.params.id}`,
      { headers: authHeaders() },
    );

    if (res.error || !res.terminal) {
      error.value = friendlySaveError(res.error, 'This terminal is no longer available.');
      return;
    }

    terminal.value          = res.terminal;
    isPublic.value          = Boolean(res.terminal.is_public);
    publicSlug.value        = res.terminal.public_slug ?? '';
    optionDisplayName.value = res.terminal.display_name ?? '';
    optionPin.value         = res.terminal.pin_code ?? '';

    // Restore style from ui_layout
    let layout = res.terminal.ui_layout;
    if (typeof layout === 'string') {
      try { layout = JSON.parse(layout); } catch { layout = null; }
    }
    useWorkspaceStyleDefaults();
    followsWorkspaceBrand.value = !layout?.brandConfig || Object.keys(layout.brandConfig).length === 0;
    if (!followsWorkspaceBrand.value) {
      selectedBundle.value = layout.brandConfig.layoutBundle ?? selectedBundle.value;
      accentColor.value    = layout.brandConfig.accent ?? accentColor.value;
    }

    // Restore station config
    if (layout?.stationConfig) {
      Object.assign(stationConfig, layout.stationConfig);
    }
    if (!stationConfig.currencySymbol) {
      stationConfig.currencySymbol = business.value?.currencySymbol || '$';
    }

    permissionsState.value = normalizePermissions(res.terminal.permissions, res.terminal.role);
    await loadWorkspaceTables(res.terminal.business_id || businessId.value);
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, 'We could not load this terminal right now.');
  } finally {
    loading.value = false;
  }
}

async function loadWorkspaceTables(targetBusinessId?: string) {
  const bizId = targetBusinessId || terminal.value?.business_id || businessId.value;
  if (!bizId) return;
  try {
    const res = await $fetch<{ tables: string[] | null; error: string | null }>(
      '/api/schema/tables',
      {
        query: { businessId: bizId },
        headers: authHeaders(),
      },
    );
    if (Array.isArray(res?.tables)) {
      workspaceTables.value = res.tables;
    }
  } catch {
    // Non-critical: table overrides already saved still remain visible
  }
}

watch(businessId, (nextBizId) => {
  if (nextBizId && workspaceTables.value.length === 0) {
    loadWorkspaceTables(nextBizId);
  }
});

// ── Actions ──────────────────────────────────────────────────────────────────

function selectBundle(bundleKey: LayoutBundleKey) {
  selectedBundle.value = bundleKey;
  const bundle = UI_LAYOUT_BUNDLES.find((item) => item.key === bundleKey);
  if (bundle?.swatches?.[2]) {
    accentColor.value = bundle.swatches[2];
  }
}

function resolvedTerminalLink() {
  if (!import.meta.client || !terminal.value) return '';
  const path = isPublic.value && publicSlug.value
    ? `/t/${publicSlug.value}`
    : `/terminal/${terminal.value.id}`;
  return buildShareUrl(path);
}

function friendlySaveError(message: string | null | undefined, fallback: string) {
  if (!message) return fallback;
  if (/pin/i.test(message)) return 'Use a PIN with 4 to 8 digits.';
  if (/slug/i.test(message)) return 'Use lowercase letters, numbers, and hyphens only.';
  if (/not found/i.test(message)) return 'This terminal is no longer available.';
  if (/forbidden|unauthor/i.test(message)) return 'You do not have permission to change this terminal.';
  return fallback;
}

async function copyTerminalLink() {
  const url = resolvedTerminalLink();
  if (!url) return;
  const success = await copyToClipboard(url);
  if (success) {
    copiedLink.value = true;
    setTimeout(() => (copiedLink.value = false), 1500);
  } else {
    error.value = 'We could not copy the terminal link. Please copy it from the address bar.';
  }
}

async function copyTerminalPin() {
  if (!optionPin.value) return;
  const success = await copyToClipboard(optionPin.value);
  if (success) {
    copiedPin.value = true;
    setTimeout(() => (copiedPin.value = false), 1500);
  } else {
    error.value = 'We could not copy the PIN. Please select it and copy it manually.';
  }
}

async function saveBasic() {
  if (!terminal.value || !business.value) return;
  savingBasic.value = true;
  error.value       = null;

  try {
    const res = await $fetch<{ success: boolean; error: string | null; terminal: any }>(
      `/api/terminals/${terminal.value.id}`,
      {
        method:  'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: {
          businessId:  business.value.id,
          displayName: optionDisplayName.value,
          pin:         optionPin.value || null,
        },
      },
    );

    if (res.error || !res.terminal) {
      error.value = friendlySaveError(res.error, 'We could not save the terminal details. Please try again.');
      return;
    }

    terminal.value = { ...terminal.value, ...res.terminal };
    optionDisplayName.value = res.terminal.display_name;
    optionPin.value         = res.terminal.pin_code ?? optionPin.value;
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, 'We could not save the terminal details. Please try again.');
  } finally {
    savingBasic.value = false;
  }
}

async function patchTerminalLayout(body: Record<string, unknown>, fallbackMessage: string) {
  if (!terminal.value || !business.value) return false;
  error.value = null;

  try {
    const res = await $fetch<{ success: boolean; error: string | null; terminal: any }>(
      `/api/terminals/${terminal.value.id}`,
      {
        method:  'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { businessId: business.value.id, ...body },
      },
    );

    if (res.error) {
      error.value = friendlySaveError(res.error, fallbackMessage);
      return false;
    }
    if (res.terminal) {
      terminal.value = { ...terminal.value, ...res.terminal };
    }
    return true;
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, fallbackMessage);
    return false;
  }
}

/** Gives this terminal its own style (screen style + accent) on top of the workspace brand kit. */
async function saveStyle() {
  savingStyle.value = true;
  const saved = await patchTerminalLayout(
    { brandConfig: { layoutBundle: selectedBundle.value, accent: accentColor.value } },
    'We could not save the terminal appearance. Please try again.',
  );
  if (saved) followsWorkspaceBrand.value = false;
  savingStyle.value = false;
}

/** Drops this terminal's own style so it follows the workspace brand kit again. */
async function useWorkspaceBrand() {
  savingStyle.value = true;
  const saved = await patchTerminalLayout(
    { resetBrand: true },
    'We could not switch this terminal back to the workspace brand. Please try again.',
  );
  if (saved) {
    followsWorkspaceBrand.value = true;
    useWorkspaceStyleDefaults();
  }
  savingStyle.value = false;
}

/** Saves welcome message, language, receipt and menu settings without touching the terminal's style. */
async function saveContent() {
  savingContent.value = true;
  await patchTerminalLayout(
    { stationConfig: { ...stationConfig } },
    'We could not save the terminal content. Please try again.',
  );
  savingContent.value = false;
}

async function savePublicSettings() {
  if (!terminal.value || !business.value) return;
  savingPublic.value = true;
  error.value        = null;
  publicSaved.value  = false;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>(
      `/api/terminals/${terminal.value.id}/public`,
      {
        method:  'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: {
          businessId: business.value.id,
          isPublic:   isPublic.value,
          publicSlug: publicSlug.value.trim() || null,
        },
      },
    );
    if (res.error || !res.success) {
      error.value = friendlySaveError(res.error, 'We could not save public access settings. Please try again.');
      return;
    }
    publicSaved.value = true;
    setTimeout(() => (publicSaved.value = false), 2500);
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, 'We could not save public access settings. Please try again.');
  } finally {
    savingPublic.value = false;
  }
}

function applyPermissionPreset(preset: PermissionPreset) {
  permissionsState.value = normalizePermissions(preset.permissions);
  permissionsSaved.value = false;
}

function isTableOverridden(tableName: string): boolean {
  return tableName !== '*' && Boolean(permissionsState.value.tables?.[tableName]);
}

function tablePermissionValue(tableName: string, key: TablePermissionKey): boolean {
  const effective = resolveTablePermissions(permissionsState.value, tableName, terminal.value?.role);
  return Boolean(effective[key]);
}

function toggleTablePermission(tableName: string, key: TablePermissionKey, checked: boolean) {
  const current = resolveTablePermissions(permissionsState.value, tableName, terminal.value?.role);
  permissionsState.value = {
    ...permissionsState.value,
    tables: {
      ...permissionsState.value.tables,
      [tableName]: {
        ...current,
        [key]: checked,
      },
    },
  };
  permissionsSaved.value = false;
}

function resetTablePermission(tableName: string) {
  if (tableName === '*') return;
  const nextTables = { ...permissionsState.value.tables };
  delete nextTables[tableName];
  permissionsState.value = {
    ...permissionsState.value,
    tables: nextTables,
  };
  permissionsSaved.value = false;
}

function addCustomPermissionTable() {
  const cleaned = newPermissionTable.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!cleaned || cleaned === '*') return;
  if (!permissionsState.value.tables[cleaned]) {
    const inherited = resolveTablePermissions(permissionsState.value, cleaned, terminal.value?.role);
    permissionsState.value = {
      ...permissionsState.value,
      tables: {
        ...permissionsState.value.tables,
        [cleaned]: { ...inherited },
      },
    };
  }
  newPermissionTable.value = '';
  permissionsSaved.value = false;
}

async function savePermissions() {
  const effectiveBusinessId = business.value?.id || terminal.value?.business_id;
  if (!terminal.value || !effectiveBusinessId) return;

  savingPermissions.value = true;
  error.value = null;
  permissionsSaved.value = false;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>(
      `/api/terminals/${terminal.value.id}/permissions`,
      {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: {
          businessId: effectiveBusinessId,
          permissions: permissionsState.value,
        },
      },
    );

    if (!res.success || res.error) {
      error.value = friendlySaveError(res.error, 'We could not save terminal permissions. Please try again.');
      return;
    }

    terminal.value = {
      ...terminal.value,
      permissions: normalizePermissions(permissionsState.value, terminal.value.role),
    };
    permissionsSaved.value = true;
    setTimeout(() => (permissionsSaved.value = false), 2500);
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, 'We could not save terminal permissions. Please try again.');
  } finally {
    savingPermissions.value = false;
  }
}

async function deleteTerminal() {
  if (!terminal.value) return;

  const approved = await confirm({
    title:          'Delete terminal?',
    description:    `Remove ${terminal.value.display_name} and its layout from this business.`,
    confirmLabel:   'Delete Terminal',
    confirmVariant: 'danger',
  });

  if (!approved) return;
  deleting.value = true;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>(
      `/api/terminals/${terminal.value.id}`,
      { method: 'DELETE', headers: authHeaders() },
    );

    if (res.error) {
      await alert({ title: 'Unable to delete terminal', description: friendlySaveError(res.error, 'We could not delete this terminal. Please try again.'), confirmLabel: 'Close' });
      return;
    }

    router.push('/dashboard/terminals');
  } catch (err) {
    await alert({ title: 'Unable to delete terminal', description: friendlySaveError((err as Error).message, 'We could not delete this terminal. Please try again.'), confirmLabel: 'Close' });
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await loadTerminal();
});
</script>

<template>
  <div class="terminal-settings-page relative flex-1 min-h-0 overflow-y-auto overscroll-contain" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="px-8 py-5 flex items-center justify-between sticky top-0 z-50 bg-[#fdf7f2]/80 backdrop-blur-xl border-b border-black/[0.03]">
      <div class="flex items-center gap-5">
        <button
          type="button"
          aria-label="Back to terminal manager"
          class="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-black/5"
          style="color: rgba(61,24,32,0.5);"
          @click="router.push('/dashboard/terminals')"
        >
          <ArrowLeftIcon class="w-4 h-4" />
        </button>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5" style="color: rgba(61,24,32,0.4);">
            Terminal settings
          </p>
          <h1 class="font-serif text-xl font-normal leading-none" style="color: rgb(var(--shell-sidebar));">
            {{ terminal?.display_name ?? 'Loading…' }}
          </h1>
        </div>
      </div>

      <button
        type="button"
        aria-label="Delete terminal"
        class="text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-40"
        style="background: rgba(239,68,68,0.07); color: #b42318; border: 1px solid rgba(239,68,68,0.14);"
        :disabled="deleting || !terminal"
        @click="deleteTerminal"
      >
        <div class="flex items-center gap-2">
          <div v-if="deleting" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <TrashIcon v-else class="w-3.5 h-3.5" />
          {{ deleting ? 'Deleting…' : 'Delete' }}
        </div>
      </button>
    </header>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="px-8 py-7 max-w-4xl mx-auto space-y-6">

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <div class="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" style="color: rgb(var(--shell-sidebar)); opacity: 0.2;" />
        <p class="text-sm" style="color: rgba(61,24,32,0.4);">Loading terminal…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error && !terminal" class="rounded-2xl bg-white px-6 py-5 border border-red-100 flex items-center gap-4">
        <p class="text-sm font-semibold text-red-900">{{ error }}</p>
      </div>

      <template v-else-if="terminal">

        <!-- ── Row 1: Basic + Public ──────────────────────────────────────── -->
        <div class="grid gap-6 md:grid-cols-2">

          <!-- Basic options -->
          <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-5">
            <div>
              <h2 class="font-serif text-lg font-normal mb-1" style="color: rgb(var(--shell-sidebar));">General</h2>
            <p class="text-xs leading-relaxed" style="color: rgba(61,24,32,0.4);">Name this terminal and set the staff sign-in PIN.</p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="terminal-display-name" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Terminal name</label>
                <input id="terminal-display-name" v-model="optionDisplayName" class="input-warm w-full px-3 py-2.5 text-sm" placeholder="Front Counter" />
              </div>

              <div>
                <label for="terminal-pin" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Staff PIN</label>
                <div class="relative flex items-center">
                  <input
                    id="terminal-pin"
                    v-model="optionPin"
                    :type="pinVisible ? 'text' : 'password'"
                    class="input-warm w-full px-3 py-2.5 text-sm font-mono pr-10"
                    inputmode="numeric"
                    maxlength="8"
                    placeholder="4–8 digits"
                  />
                  <button
                    type="button"
                    class="absolute right-2.5 p-1 text-[rgba(61,24,32,0.45)] hover:text-[rgb(var(--shell-sidebar))] transition-colors bg-transparent border-0 cursor-pointer flex items-center justify-center"
                    :title="pinVisible ? 'Hide PIN' : 'Show PIN'"
                    :aria-label="pinVisible ? 'Hide PIN' : 'Show PIN'"
                    @click="pinVisible = !pinVisible"
                  >
                    <EyeOffIcon v-if="pinVisible" class="w-4 h-4" />
                    <EyeIcon v-else class="w-4 h-4" />
                  </button>
                </div>
                <p id="terminal-pin-help" class="text-[10px] mt-1" style="color: rgba(61,24,32,0.35);">Takes effect on the next sign-in.</p>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border"
                  style="background: rgba(61,24,32,0.03); color: rgb(var(--shell-sidebar)); border-color: rgba(61,24,32,0.08);"
                  aria-label="Copy terminal link"
                  @click="copyTerminalLink"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <CheckIcon v-if="copiedLink" class="w-3.5 h-3.5 text-green-500" />
                    <Link2Icon v-else class="w-3.5 h-3.5" />
                    {{ copiedLink ? 'Copied' : 'Copy Link' }}
                  </div>
                </button>
                <button
                  type="button"
                  class="text-xs font-semibold px-3 py-2 rounded-xl transition-all border disabled:opacity-40"
                  style="background: rgba(61,24,32,0.03); color: rgb(var(--shell-sidebar)); border-color: rgba(61,24,32,0.08);"
                  :disabled="!optionPin"
                  aria-label="Copy terminal PIN"
                  @click="copyTerminalPin"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <CheckIcon v-if="copiedPin" class="w-3.5 h-3.5 text-green-500" />
                    <KeyIcon v-else class="w-3.5 h-3.5" />
                    {{ copiedPin ? 'Copied' : 'Copy PIN' }}
                  </div>
                </button>
              </div>
            </div>

            <p v-if="error" class="text-xs text-red-600" role="alert">{{ error }}</p>

            <button
              class="w-full text-sm font-semibold py-2.5 rounded-2xl transition-all disabled:opacity-40 btn-primary btn-ribbon"
              :disabled="savingBasic"
              @click="saveBasic"
            >
              <div class="flex items-center justify-center gap-2">
                <div v-if="savingBasic" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <SparklesIcon v-else class="w-4 h-4" />
                {{ savingBasic ? 'Saving…' : 'Save General' }}
              </div>
            </button>
          </div>

          <!-- Public access -->
          <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-5">
            <div>
              <h2 class="font-serif text-lg font-normal mb-1" style="color: rgb(var(--shell-sidebar));">Public Access</h2>
              <p class="text-xs leading-relaxed" style="color: rgba(61,24,32,0.4);">Allow customers to open this terminal from a QR code or URL without a PIN.</p>
            </div>

            <div
              class="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
              :class="isPublic ? 'bg-[#3d1820]/[0.02] border-[#3d1820]/10' : 'bg-transparent border-black/[0.06]'"
            >
              <div>
                <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Enable Public Mode</p>
                <p class="text-[10px] font-medium" style="color: rgba(61,24,32,0.4);">No PIN required for guests</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" aria-label="Enable public access" :checked="isPublic" @change="isPublic = ($event.target as HTMLInputElement).checked" />
                <div class="w-11 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3d1820]" />
              </label>
            </div>

            <div v-if="isPublic" class="space-y-3">
              <div>
                <label for="terminal-public-slug" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Custom URL slug</label>
                <div class="flex gap-0">
                  <span class="flex items-center px-3 text-xs rounded-l-xl border border-r-0" style="background: rgba(61,24,32,0.03); border-color: rgba(61,24,32,0.1); color: rgba(61,24,32,0.4);">/t/</span>
                  <input id="terminal-public-slug" v-model="publicSlug" class="input-warm flex-1 px-3 py-2 text-sm rounded-l-none" placeholder="kiosk-lobby" pattern="[a-z0-9-]+" />
                </div>
                <p class="text-[10px] mt-1" style="color: rgba(61,24,32,0.35);">Lowercase letters, numbers, hyphens only.</p>
              </div>

              <div v-if="publicUrl" class="p-3 rounded-xl font-mono text-xs break-all" style="background: rgba(61,24,32,0.03); color: rgba(61,24,32,0.6); border: 1px solid rgba(61,24,32,0.08);">
                {{ publicUrl }}
              </div>
            </div>

            <!-- spacer to push button down when public panel is short -->
            <div class="flex-1" />

            <button
              class="w-full text-sm font-semibold py-2.5 rounded-2xl transition-all disabled:opacity-40 btn-primary btn-ribbon"
              :disabled="savingPublic"
              @click="savePublicSettings"
            >
              <div class="flex items-center justify-center gap-2">
                <div v-if="savingPublic" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <GlobeIcon v-else class="w-4 h-4" />
                {{ savingPublic ? 'Saving…' : 'Save Access' }}
              </div>
            </button>
            <p v-if="publicSaved" class="text-xs text-center" style="color: #15803d;" role="status">Public access settings saved.</p>
          </div>
        </div>

        <!-- ── Row 2: Style ───────────────────────────────────────────────── -->
        <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(61,24,32,0.05); color: rgba(61,24,32,0.6);">
              <PaletteIcon class="w-4 h-4" />
            </div>
            <div>
              <h2 class="font-serif text-lg font-normal leading-none" style="color: rgb(var(--shell-sidebar));">Appearance</h2>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">Choose a visual theme and accent colour for this terminal.</p>
            </div>
          </div>

          <div
            class="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-xs"
            :style="followsWorkspaceBrand
              ? 'background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.18); color: #047857;'
              : 'background: rgba(255,87,118,0.07); border: 1px solid rgba(255,87,118,0.2); color: rgb(var(--shell-sidebar));'"
            role="status"
          >
            <span class="flex-1 min-w-[12rem] leading-relaxed">
              {{ followsWorkspaceBrand ? t('terminal_brand_follows') : t('terminal_brand_custom') }}
            </span>
            <NuxtLink
              v-if="followsWorkspaceBrand"
              to="/dashboard/settings"
              class="font-semibold underline underline-offset-2"
              style="color: inherit;"
            >
              {{ t('terminal_brand_edit_kit') }}
            </NuxtLink>
            <button
              v-else
              type="button"
              class="px-3 py-1.5 rounded-lg font-semibold btn-ghost disabled:opacity-40"
              :disabled="savingStyle"
              @click="useWorkspaceBrand"
            >
              {{ t('terminal_brand_reset') }}
            </button>
          </div>

          <!-- Theme bundles -->
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider mb-3" style="color: rgba(61,24,32,0.45);">Theme</p>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="bundle in UI_LAYOUT_BUNDLES"
                :key="bundle.key"
                type="button"
                :aria-pressed="selectedBundle === bundle.key"
                class="relative p-4 rounded-2xl text-left transition-all border-2"
                :style="selectedBundle === bundle.key
                  ? 'border-color: rgb(var(--shell-sidebar)); background: rgba(61,24,32,0.03);'
                  : 'border-color: rgba(61,24,32,0.08); background: white;'"
                @click="selectBundle(bundle.key)"
              >
                <div class="flex gap-1.5 mb-3">
                  <span
                    v-for="swatch in bundle.swatches"
                    :key="swatch"
                    class="w-5 h-5 rounded-full border border-white/20 shrink-0"
                    :style="`background: ${swatch};`"
                  />
                </div>
                <p class="text-xs font-bold" style="color: rgb(var(--shell-sidebar));">{{ bundle.label }}</p>
                <p class="text-[10px] mt-0.5 leading-snug" style="color: rgba(61,24,32,0.45);">{{ bundle.description }}</p>

                <div
                  v-if="selectedBundle === bundle.key"
                  class="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style="background: rgb(var(--shell-sidebar));"
                >
                  <CheckIcon class="w-3 h-3 text-white" />
                </div>
              </button>
            </div>
          </div>

          <!-- Accent colour -->
          <div class="flex items-center gap-4">
            <div>
              <label for="terminal-accent-color" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Accent colour</label>
              <p class="text-xs" style="color: rgba(61,24,32,0.4);">Buttons, highlights, and active states on this terminal.</p>
            </div>
            <div class="ml-auto flex items-center gap-3">
              <input
                type="color"
                id="terminal-accent-color"
                aria-label="Terminal accent colour"
                v-model="accentColor"
                class="w-12 h-10 rounded-xl border cursor-pointer"
                style="border-color: rgba(61,24,32,0.12); padding: 2px;"
              />
              <span class="font-mono text-sm" style="color: rgb(var(--shell-sidebar));">{{ accentColor }}</span>
            </div>
          </div>

          <button
            class="w-full text-sm font-semibold py-2.5 rounded-2xl transition-all disabled:opacity-40 btn-primary btn-ribbon"
            :disabled="savingStyle"
            @click="saveStyle"
          >
            <div class="flex items-center justify-center gap-2">
              <div v-if="savingStyle" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <RefreshIcon v-else class="w-4 h-4" />
              {{ savingStyle ? 'Applying…' : 'Apply Appearance' }}
            </div>
          </button>
        </div>

        <!-- ── Row 3: Terminal content ────────────────────────────────────── -->
        <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(61,24,32,0.05); color: rgba(61,24,32,0.6);">
              <SlidersIcon class="w-4 h-4" />
            </div>
            <div>
              <h2 class="font-serif text-lg font-normal leading-none" style="color: rgb(var(--shell-sidebar));">Terminal content</h2>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">Optional content and behavior for this terminal.</p>
            </div>
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <!-- Welcome message -->
            <div class="md:col-span-2">
              <label for="terminal-welcome-message" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Welcome message</label>
              <input
                id="terminal-welcome-message"
                v-model="stationConfig.welcomeMessage"
                class="input-warm w-full px-3 py-2.5 text-sm"
                placeholder="Welcome! Tap below to start your order."
              />
              <p class="text-[10px] mt-1" style="color: rgba(61,24,32,0.35);">Shown on the kiosk idle screen. Leave blank to use the default.</p>
            </div>

            <!-- Menu / items list -->
            <div class="md:col-span-2">
              <label for="terminal-menu-items" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Optional items (one per line)</label>
              <textarea
                id="terminal-menu-items"
                v-model="stationConfig.menuItems"
                rows="4"
                class="input-warm w-full px-3 py-2.5 text-sm resize-none"
                placeholder="Burger – $9.90&#10;Fries – $3.50&#10;Soft Drink – $2.00"
              />
              <p class="text-[10px] mt-1" style="color: rgba(61,24,32,0.35);">Optional — use these items instead of the connected catalog.</p>
            </div>

            <!-- Language -->
            <div>
              <label for="terminal-display-language" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Display language</label>
              <select id="terminal-display-language" v-model="stationConfig.language" class="input-warm w-full px-3 py-2.5 text-sm">
                <option v-for="lang in LANGUAGES" :key="lang.value" :value="lang.value">{{ lang.label }}</option>
              </select>
            </div>

            <!-- Currency -->
            <div>
              <label for="terminal-currency" class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style="color: rgba(61,24,32,0.45);">Currency symbol</label>
              <input
                id="terminal-currency"
                v-model="stationConfig.currencySymbol"
                class="input-warm w-full px-3 py-2.5 text-sm font-mono"
                placeholder="$"
                maxlength="4"
              />
            </div>

            <!-- Receipt toggle -->
            <div class="md:col-span-2">
              <div
                class="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                :class="stationConfig.showReceipt ? 'bg-[#3d1820]/[0.02] border-[#3d1820]/10' : 'bg-transparent border-black/[0.06]'"
              >
                <div>
                  <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Print / Email Receipt</p>
                  <p class="text-[10px] font-medium mt-0.5" style="color: rgba(61,24,32,0.4);">Show a receipt prompt after each completed order.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" class="sr-only peer" aria-label="Show a receipt after each order" :checked="stationConfig.showReceipt" @change="stationConfig.showReceipt = ($event.target as HTMLInputElement).checked" />
                  <div class="w-11 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3d1820]" />
                </label>
              </div>
            </div>
          </div>

          <button
            class="w-full text-sm font-semibold py-2.5 rounded-2xl transition-all disabled:opacity-40 btn-primary btn-ribbon"
            :disabled="savingContent"
            @click="saveContent"
          >
            <div class="flex items-center justify-center gap-2">
              <div v-if="savingContent" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <SparklesIcon v-else class="w-4 h-4" />
              {{ savingContent ? 'Saving…' : 'Save Terminal Content' }}
            </div>
          </button>
        </div>

        <!-- ── Row 4: Role & Table Permissions ────────────────────────────── -->
        <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-6">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(61,24,32,0.05); color: rgba(61,24,32,0.6);">
                <ShieldIcon class="w-4 h-4" />
              </div>
              <div>
                <h2 class="font-serif text-lg font-normal leading-none" style="color: rgb(var(--shell-sidebar));">Role &amp; Table Permissions</h2>
                <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">Control which business tables and operational views this terminal can access.</p>
              </div>
            </div>
            <span
              v-if="activePermissionPreset"
              class="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
              style="background: rgba(61,24,32,0.04); border-color: rgba(61,24,32,0.1); color: rgb(var(--shell-sidebar));"
            >
              Preset: {{ activePermissionPreset.label }}
            </span>
          </div>

          <!-- Quick Role Presets -->
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider mb-2" style="color: rgba(61,24,32,0.45);">Apply permission preset</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in ALL_TERMINAL_PERMISSION_PRESETS"
                :key="preset.key"
                type="button"
                class="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                :class="activePermissionPreset?.key === preset.key
                  ? 'bg-[#3d1820] text-white border-[#3d1820]'
                  : 'bg-[#fdfaf7] text-[#3d1820] border-black/[0.08] hover:border-[#3d1820]/30'"
                :title="preset.description"
                @click="applyPermissionPreset(preset)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <!-- Operational Views -->
          <div class="grid gap-3 md:grid-cols-2">
            <div
              class="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
              :class="permissionsState.reports.visible ? 'bg-[#3d1820]/[0.02] border-[#3d1820]/10' : 'bg-transparent border-black/[0.06]'"
            >
              <div>
                <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Reports &amp; Analytics</p>
                <p class="text-[10px] font-medium mt-0.5" style="color: rgba(61,24,32,0.4);">Allow charts and aggregate metrics on this terminal.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  aria-label="Allow reports access"
                  :checked="permissionsState.reports.visible"
                  @change="permissionsState.reports.visible = ($event.target as HTMLInputElement).checked; permissionsSaved = false"
                />
                <div class="w-11 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3d1820]" />
              </label>
            </div>

            <div
              class="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
              :class="permissionsState.audit_log.visible ? 'bg-[#3d1820]/[0.02] border-[#3d1820]/10' : 'bg-transparent border-black/[0.06]'"
            >
              <div>
                <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Audit Log Access</p>
                <p class="text-[10px] font-medium mt-0.5" style="color: rgba(61,24,32,0.4);">Allow querying activity audit entries from this station.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  aria-label="Allow audit log access"
                  :checked="permissionsState.audit_log.visible"
                  @change="permissionsState.audit_log.visible = ($event.target as HTMLInputElement).checked; permissionsSaved = false"
                />
                <div class="w-11 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3d1820]" />
              </label>
            </div>
          </div>

          <!-- Per-Table Matrix -->
          <div class="overflow-x-auto rounded-2xl border border-black/[0.06]">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-black/[0.06] bg-[#faf5f0]">
                  <th class="px-4 py-2.5 font-semibold" style="color: rgb(var(--shell-sidebar));">Table</th>
                  <th
                    v-for="act in PERMISSION_ACTIONS"
                    :key="act.key"
                    class="px-3 py-2.5 text-center font-semibold"
                    style="color: rgb(var(--shell-sidebar));"
                  >
                    {{ act.label }}
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold" style="color: rgba(61,24,32,0.45);">Rule</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-black/[0.05] bg-[#fdfaf7]">
                  <td class="px-4 py-2.5 font-medium" style="color: rgb(var(--shell-sidebar));">
                    Default (all other tables) <code class="text-[10px] opacity-60">*</code>
                  </td>
                  <td v-for="act in PERMISSION_ACTIONS" :key="`wild-${act.key}`" class="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      :aria-label="`Default ${act.label} permission`"
                      class="w-4 h-4 accent-[#3d1820] cursor-pointer"
                      :checked="tablePermissionValue('*', act.key)"
                      @change="toggleTablePermission('*', act.key, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td class="px-3 py-2.5 text-right text-[10px]" style="color: rgba(61,24,32,0.4);">Base fallback</td>
                </tr>

                <tr
                  v-for="tableName in permissionTableNames"
                  :key="tableName"
                  class="border-b last:border-b-0 border-black/[0.04]"
                >
                  <td class="px-4 py-2.5 font-mono text-[11px]" style="color: rgb(var(--shell-sidebar));">
                    {{ tableName }}
                  </td>
                  <td v-for="act in PERMISSION_ACTIONS" :key="`${tableName}-${act.key}`" class="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      :aria-label="`${tableName} ${act.label} permission`"
                      class="w-4 h-4 accent-[#3d1820] cursor-pointer"
                      :checked="tablePermissionValue(tableName, act.key)"
                      @change="toggleTablePermission(tableName, act.key, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    <button
                      v-if="isTableOverridden(tableName)"
                      type="button"
                      class="text-[10px] font-semibold text-[#3d1820]/70 hover:text-[#3d1820] underline"
                      @click="resetTablePermission(tableName)"
                    >
                      Inherit *
                    </button>
                    <span v-else class="text-[10px]" style="color: rgba(61,24,32,0.35);">Inherited</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="newPermissionTable"
              class="input-warm flex-1 px-3 py-2 text-xs font-mono"
              placeholder="Add custom table rule (e.g. orders, inventory)"
              @keydown.enter.prevent="addCustomPermissionTable"
            />
            <button
              type="button"
              class="px-3.5 py-2 rounded-xl text-xs font-semibold border border-black/[0.08] bg-[#faf5f0] hover:bg-[#f2ebe3] flex items-center gap-1.5"
              style="color: rgb(var(--shell-sidebar));"
              @click="addCustomPermissionTable"
            >
              <PlusIcon class="w-3.5 h-3.5" /> Add rule
            </button>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex-1 text-sm font-semibold py-2.5 rounded-2xl transition-all disabled:opacity-40 btn-primary btn-ribbon"
              :disabled="savingPermissions"
              @click="savePermissions"
            >
              <div class="flex items-center justify-center gap-2">
                <div v-if="savingPermissions" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <ShieldIcon v-else class="w-4 h-4" />
                {{ savingPermissions ? 'Saving Permissions…' : 'Save Permissions' }}
              </div>
            </button>
            <span
              v-if="permissionsSaved"
              class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
            >
              <CheckIcon class="w-3.5 h-3.5" /> Saved
            </span>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
.terminal-settings-page [style*="color: rgba(61,24,32,0."] {
  color: rgba(61,24,32,0.7) !important;
}
</style>
