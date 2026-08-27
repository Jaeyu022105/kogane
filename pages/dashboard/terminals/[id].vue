<script setup lang="ts">
import { ArrowLeft, Trash2, Link2, KeyRound, Palette, Sliders, Globe, Sparkles, Check, RefreshCw } from 'lucide-vue-next';
import { UI_LAYOUT_BUNDLES, type LayoutBundleKey } from '~/lib/workspaceBranding';

definePageMeta({ layout: 'dashboard' });

const route  = useRoute();
const router = useRouter();
const { isEnterprise }  = useEnterpriseAccess();
const { authHeaders }   = useAuth();
const { business }      = useBusiness();
const { confirm, alert } = useModal();
const { buildShareUrl } = useShareOrigin();
const businessId = computed(() => business.value?.id);

// ── State ───────────────────────────────────────────────────────────────────

const loading       = ref(false);
const savingBasic   = ref(false);
const savingStyle   = ref(false);
const savingPublic  = ref(false);
const deleting      = ref(false);
const error         = ref<string | null>(null);

const terminal = ref<{
  id: string;
  display_name: string;
  role: string;
  pin_code: string | null;
  is_public: boolean;
  public_slug: string | null;
  ui_layout: any;
} | null>(null);

// Basic options
const optionDisplayName = ref('');
const optionPin         = ref('');
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
  currencySymbol: '$',
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
    const layout = res.terminal.ui_layout;
    if (layout?.brandConfig) {
      selectedBundle.value = layout.brandConfig.layoutBundle ?? 'aurora-service';
      accentColor.value    = layout.brandConfig.accent ?? '#ff8ca6';
    }

    // Restore station config
    if (layout?.stationConfig) {
      Object.assign(stationConfig, layout.stationConfig);
    }
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, 'We could not load this terminal right now.');
  } finally {
    loading.value = false;
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

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
  try {
    await navigator.clipboard.writeText(url);
    copiedLink.value = true;
    setTimeout(() => (copiedLink.value = false), 1500);
  } catch {
    error.value = 'We could not copy the terminal link. Please copy it from the address bar.';
  }
}

async function copyTerminalPin() {
  if (!optionPin.value) return;
  try {
    await navigator.clipboard.writeText(optionPin.value);
    copiedPin.value = true;
    setTimeout(() => (copiedPin.value = false), 1500);
  } catch {
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

async function saveStyle() {
  if (!terminal.value || !business.value) return;
  savingStyle.value = true;
  error.value       = null;

  try {
    const res = await $fetch<{ success: boolean; error: string | null; terminal: any }>(
      `/api/terminals/${terminal.value.id}`,
      {
        method:  'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: {
          businessId:   business.value.id,
          brandConfig:  { layoutBundle: selectedBundle.value, accent: accentColor.value },
          stationConfig: { ...stationConfig },
        },
      },
    );

    if (res.error) {
      error.value = friendlySaveError(res.error, 'We could not save the terminal appearance. Please try again.');
    } else if (res.terminal) {
      terminal.value = { ...terminal.value, ...res.terminal };
    }
  } catch (err) {
    error.value = friendlySaveError((err as Error).message, 'We could not save the terminal appearance. Please try again.');
  } finally {
    savingStyle.value = false;
  }
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
  if (!isEnterprise.value) {
    router.replace('/dashboard');
    return;
  }
  await loadTerminal();
});
</script>

<template>
  <div v-if="isEnterprise" class="terminal-settings-page flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

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
          <ArrowLeft class="w-4 h-4" />
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
          <Trash2 v-else class="w-3.5 h-3.5" />
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
                <input
                  id="terminal-pin"
                  v-model="optionPin"
                  class="input-warm w-full px-3 py-2.5 text-sm font-mono"
                  inputmode="numeric"
                  maxlength="8"
                  placeholder="4–8 digits"
                />
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
                    <Check v-if="copiedLink" class="w-3.5 h-3.5 text-green-500" />
                    <Link2 v-else class="w-3.5 h-3.5" />
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
                    <Check v-if="copiedPin" class="w-3.5 h-3.5 text-green-500" />
                    <KeyRound v-else class="w-3.5 h-3.5" />
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
                <Sparkles v-else class="w-4 h-4" />
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
                <Globe v-else class="w-4 h-4" />
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
              <Palette class="w-4 h-4" />
            </div>
            <div>
              <h2 class="font-serif text-lg font-normal leading-none" style="color: rgb(var(--shell-sidebar));">Appearance</h2>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">Choose a visual theme and accent colour for this terminal.</p>
            </div>
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
                @click="selectedBundle = bundle.key"
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
                  <Check class="w-3 h-3 text-white" />
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
              <RefreshCw v-else class="w-4 h-4" />
              {{ savingStyle ? 'Applying…' : 'Apply Appearance' }}
            </div>
          </button>
        </div>

        <!-- ── Row 3: Terminal content ────────────────────────────────────── -->
        <div class="bg-white rounded-3xl p-7 shadow-warm border border-black/[0.03] space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(61,24,32,0.05); color: rgba(61,24,32,0.6);">
              <Sliders class="w-4 h-4" />
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
            :disabled="savingStyle"
            @click="saveStyle"
          >
            <div class="flex items-center justify-center gap-2">
              <div v-if="savingStyle" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <Sparkles v-else class="w-4 h-4" />
              {{ savingStyle ? 'Saving…' : 'Save Terminal Content' }}
            </div>
          </button>
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
