<script setup lang="ts">
import { Building2, Terminal as TerminalIcon, Plus, ArrowRight, Eye, EyeOff, Check, Copy, Sparkles } from 'lucide-vue-next';
import { TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';
import { defaultLayoutVariantForPreset, layoutVariantsForPreset } from '~/lib/starterWorkstations';
import TerminalCard from '~/components/TerminalCard.vue';

definePageMeta({ layout: 'dashboard' });

const router = useRouter();
const route  = useRoute();
const { authHeaders } = useAuth();
const { business }    = useBusiness();
const { copyToClipboard } = useShareOrigin();


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

const form = reactive({
  displayName: '',
  pin:         '',
  resolution:  '1280x720',
  presetKey:   TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register',
  layoutVariant: defaultLayoutVariantForPreset(TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register'),
});

const currentLayoutVariants = computed(() => layoutVariantsForPreset(form.presetKey));

function openCreateModal(presetKey?: string) {
  if (presetKey) {
    form.presetKey = presetKey;
  }
  const preset = TERMINAL_PERMISSION_PRESETS.find(p => p.key === form.presetKey) ?? TERMINAL_PERMISSION_PRESETS[0];
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

  const preset = TERMINAL_PERMISSION_PRESETS.find(p => p.key === nextPresetKey);
  if (preset && (!form.displayName || TERMINAL_PERMISSION_PRESETS.some(p => form.displayName.startsWith(p.label)))) {
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

async function loadTerminals() {
  if (!business.value) return;
  loading.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ terminals?: any[]; error?: string | null }>('/api/terminals', {
      headers: authHeaders(),
      query:   { businessId: business.value.id },
    });
    if (res.error) {
      error.value = friendlyTerminalError(res.error);
      return;
    }
    terminals.value = res.terminals ?? [];
  } catch (err: any) {
    error.value = friendlyTerminalError(err?.data?.message ?? err?.data?.error ?? err?.message);
  } finally {
    loading.value = false;
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
    form.presetKey   = TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register';
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
  <div class="flex-1 flex flex-col overflow-hidden" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">
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

    <!-- ── Content area ─────────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto px-8 py-6">
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
            v-for="preset in TERMINAL_PERMISSION_PRESETS"
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

      <!-- Terminal grid -->
      <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <TerminalCard
          v-for="ip in terminals"
          :key="ip.id"
          :terminal="ip"
          @deleted="onTerminalDeleted(ip.id)"
        />
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
                <option v-for="preset in TERMINAL_PERMISSION_PRESETS" :key="preset.key" :value="preset.key">
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
  </div>
</template>


