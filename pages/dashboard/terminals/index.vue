<script setup lang="ts">
import { Building2, Terminal as TerminalIcon, Plus, PenSquare, ArrowRight, Shield, Trash2 } from 'lucide-vue-next';
import { TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { business }    = useBusiness();
const { confirm, alert } = useModal();

const terminals  = ref<any[]>([]);
const loading    = ref(false);
const showForm   = ref(false);
const saving     = ref(false);
const deletingId = ref<string | null>(null);
const error      = ref<string | null>(null);
const pinVisible = ref(false);
const pinCopied  = ref(false);

const form = reactive({
  displayName: '',
  pin:         '',
  resolution:  '1280x720',
  presetKey:   TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register',
});

function onPinInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const digits = el.value.replace(/\D/g, '').slice(0, 8);
  form.pin = digits;
  el.value = digits;
}

function copyPin() {
  if (!form.pin) return;
  navigator.clipboard.writeText(form.pin);
  pinCopied.value = true;
  setTimeout(() => (pinCopied.value = false), 1500);
}

async function loadTerminals() {
  if (!business.value) return;
  loading.value = true;

  try {
    const res = await $fetch<{ terminals: any[] }>('/api/terminals', {
      headers: authHeaders(),
      query:   { businessId: business.value.id },
    });
    terminals.value = res.terminals ?? [];
  } finally {
    loading.value = false;
  }
}

async function createTerminal() {
  if (!business.value) return;
  if (!form.displayName.trim() || !form.pin) return;
  if (!/^\d{4,8}$/.test(form.pin)) {
    error.value = 'PIN must be 4–8 digits (numbers only)';
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
      },
    });

    if (res.error) {
      error.value = res.error;
      return;
    }

    showForm.value   = false;
    pinVisible.value = false;
    pinCopied.value  = false;
    form.displayName = '';
    form.pin         = '';
    form.presetKey   = TERMINAL_PERMISSION_PRESETS[0]?.key ?? 'cashier-register';
    await loadTerminals();
  } catch (err: any) {
    console.error('[createTerminal]', err);
    error.value = err?.data?.message ?? err?.data?.error ?? err?.message ?? 'Unknown error';
  } finally {
    saving.value = false;
  }
}

async function deleteTerminal(terminalId: string, displayName: string) {
  const approved = await confirm({
    title: 'Delete terminal?',
    description: `Remove ${displayName} and its assigned layout from this business.`,
    confirmLabel: 'Delete Terminal',
    confirmVariant: 'danger',
  });

  if (!approved) return;

  deletingId.value = terminalId;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>(`/api/terminals/${terminalId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    if (res.error) {
      await alert({
        title: 'Unable to delete terminal',
        description: res.error,
        confirmLabel: 'Close',
      });
      return;
    }

    terminals.value = terminals.value.filter((terminal) => terminal.id !== terminalId);
  } catch (err: any) {
    await alert({
      title: 'Unable to delete terminal',
      description: err?.data?.message ?? err?.data?.error ?? err?.message ?? 'Unknown error',
      confirmLabel: 'Close',
    });
  } finally {
    deletingId.value = null;
  }
}

onMounted(loadTerminals);
watch(() => business.value?.id, loadTerminals);
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
          Staff terminals · {{ terminals.length }} registered
        </p>
      </div>

      <button
        class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 btn-primary btn-ribbon"
        :disabled="!business"
        :title="!business ? 'Please create a business in Settings first' : 'Create new terminal'"
        @click="showForm = true"
        @mouseenter="(e: MouseEvent) => !(!business) && ((e.currentTarget as HTMLElement).style.opacity = '0.85')"
        @mouseleave="(e: MouseEvent) => !(!business) && ((e.currentTarget as HTMLElement).style.opacity = '1')"
      >
        <Plus class="w-4 h-4" />
        New Terminal
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
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <TerminalIcon class="w-12 h-12 mb-4" style="color: rgba(61,24,32,0.1);" />
        <p class="text-base font-semibold" style="color: rgba(61,24,32,0.35);">No terminals yet</p>
        <p class="text-sm mt-1" style="color: rgba(61,24,32,0.25);">Create one and share the PIN with your staff.</p>
      </div>

      <!-- Terminal grid -->
      <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <div
          v-for="ip in terminals"
          :key="ip.id"
          class="group rounded-xl p-5 flex flex-col gap-4 transition-all"
          style="background: white; border: 1px solid rgba(61,24,32,0.08);"
          @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(61,24,32,0.18)'"
          @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(61,24,32,0.08)'"
        >
          <!-- Avatar + name -->
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
              style="background: rgba(61,24,32,0.07); color: rgb(var(--shell-sidebar));"
            >
              {{ ip.display_name?.[0]?.toUpperCase() ?? '?' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate" style="color: rgb(var(--shell-sidebar));">
                {{ ip.display_name }}
              </p>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.35);">Terminal</p>
            </div>
            <button
              class="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-all"
              style="background: rgba(239,68,68,0.06); color: #b42318;"
              :disabled="deletingId === ip.id"
              :title="deletingId === ip.id ? 'Deleting...' : 'Delete terminal'"
              @click="deleteTerminal(ip.id, ip.display_name)"
            >
              <div v-if="deletingId === ip.id" class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              <Trash2 v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 mt-auto">
            <NuxtLink
              :to="`/dashboard/builder?terminal=${ip.id}`"
              class="flex-1 text-center text-xs font-medium px-3 py-1.5 rounded-md transition-all"
              style="color: rgba(61,24,32,0.5); background: rgba(61,24,32,0.06); text-decoration: none;"
            >
              <div class="flex items-center justify-center gap-1.5">
                <PenSquare class="w-3.5 h-3.5" /> Edit Layout
              </div>
            </NuxtLink>
            <NuxtLink
              :to="`/dashboard/terminals/${ip.id}`"
              class="flex-1 text-center text-xs font-medium px-3 py-1.5 rounded-md transition-all"
              style="color: rgba(61,24,32,0.6); background: rgba(61,24,32,0.06); text-decoration: none;"
            >
              <div class="flex items-center justify-center gap-1.5">
                <Shield class="w-3.5 h-3.5" /> Permissions
              </div>
            </NuxtLink>
            <NuxtLink
              :to="`/terminal/${ip.id}`"
              class="text-center text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
              style="color: rgb(var(--shell-pink)); background: rgba(232,116,138,0.1); text-decoration: none;"
            >
              <div class="flex items-center justify-center gap-1.5">
                Open <ArrowRight class="w-3.5 h-3.5" />
              </div>
            </NuxtLink>
          </div>
        </div>
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
        <div class="w-full max-w-sm bg-white rounded-xl p-7 space-y-5 shadow-2xl">
          <div>
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">New Terminal</h2>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Give it a name and share the PIN with your staff.</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Display Name</label>
              <input
                v-model="form.displayName"
                class="input-warm w-full px-4 py-2.5 text-sm"
                placeholder="Cash Register 1"
              />
            </div>

            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">PIN (4–8 digits)</label>
              <div class="relative">
                <input
                  :value="form.pin"
                  type="text"
                  inputmode="numeric"
                  maxlength="8"
                  autocomplete="off"
                  class="input-warm w-full px-4 py-2.5 text-sm pr-20"
                  :style="pinVisible ? '' : '-webkit-text-security: disc;'"
                  placeholder="••••"
                  @input="onPinInput"
                />
                <div class="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
                  <button
                    type="button"
                    class="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style="color: rgba(61,24,32,0.4);"
                    :title="pinCopied ? 'Copied!' : 'Copy PIN'"
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
                    @click="pinVisible = !pinVisible"
                  >
                    <svg v-if="!pinVisible" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Initial Layout Size</label>
              <select v-model="form.resolution" class="input-warm w-full px-4 py-2.5 text-sm">
                <option value="1280x720">Landscape (1280x720)</option>
                <option value="1920x1080">Landscape 1080p (1920x1080)</option>
                <option value="1024x768">Tablet (1024x768)</option>
                <option value="720x1280">Portrait (720x1280)</option>
                <option value="1080x1920">Portrait 1080p (1080x1920)</option>
              </select>
            </div>

            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Permission Preset</label>
              <select v-model="form.presetKey" class="input-warm w-full px-4 py-2.5 text-sm">
                <option v-for="preset in TERMINAL_PERMISSION_PRESETS" :key="preset.key" :value="preset.key">
                  {{ preset.label }}
                </option>
              </select>
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
              class="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all"
              style="border: 1.5px solid rgba(61,24,32,0.18); color: rgba(61,24,32,0.65);"
              @click="showForm = false"
            >
              Cancel
            </button>
            <button
              class="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 btn-primary btn-ribbon"
              :disabled="!form.displayName || !form.pin || saving"
              @click="createTerminal"
            >
              {{ saving ? 'Creating…' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
