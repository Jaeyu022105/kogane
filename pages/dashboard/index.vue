<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();
const { openOnboarding } = useOnboarding();
const { isEnterprise } = useEnterpriseAccess();
const { t } = useLocale();

import { Database, Palette, Terminal, Settings, Shield, BarChart3, ArrowRight, Sparkles, Link2, KeyRound, Save, Eye, EyeOff } from 'lucide-vue-next';
import TerminalThumbnail from '~/components/TerminalThumbnail.vue';

const now = new Date();
const hour = now.getHours();
const greeting = computed(() => (hour < 12 ? t('dashboard_greeting_morning') : hour < 18 ? t('dashboard_greeting_afternoon') : t('dashboard_greeting_evening')));
const firstName = session?.email?.split('@')[0] ?? t('admin_fallback');

type DashboardTerminal = {
  id: string;
  display_name: string;
  role: string;
  ui_layout: string | null;
  pin_code: string | null;
  is_public: number | boolean | null;
  public_slug: string | null;
};

const { authHeaders } = useAuth();
const terminals = ref<DashboardTerminal[]>([]);
const terminalDrafts = reactive<Record<string, { name: string; pin: string; pinRequired: boolean; showPin: boolean }>>({});
const terminalLoading = ref(false);
const savingTerminalId = ref<string | null>(null);
const copiedTerminalId = ref<string | null>(null);
const copiedPinId = ref<string | null>(null);

interface QuickAction {
  label: string;
  body: string;
  icon: any;
  to?: string;
  action?: 'onboarding';
  index: string;
}

const quickActions = computed<QuickAction[]>(() => {
  const actions: Omit<QuickAction, 'index'>[] = [
    {
      label: t('dashboard_action_preset_label'),
      body: t('dashboard_action_preset_body'),
      icon: Sparkles,
      action: 'onboarding',
    },
    {
      label: t('dashboard_action_reports_label'),
      body: t('dashboard_action_reports_body'),
      icon: BarChart3,
      to: '/dashboard/reports',
    },
    {
      label: t('dashboard_action_audit_label'),
      body: t('dashboard_action_audit_body'),
      icon: Shield,
      to: '/dashboard/audit',
    },
    {
      label: t('dashboard_action_settings_label'),
      body: t('dashboard_action_settings_body'),
      icon: Settings,
      to: '/dashboard/settings',
    },
  ];

  if (isEnterprise.value) {
    actions.splice(
      1,
      0,
      { label: t('dashboard_action_database_label'), body: t('dashboard_action_database_body'), icon: Database, to: '/dashboard/database' },
      { label: t('dashboard_action_builder_label'), body: t('dashboard_action_builder_body'), icon: Palette, to: '/dashboard/builder' },
      { label: t('dashboard_action_terminals_label'), body: t('dashboard_action_terminals_body'), icon: Terminal, to: '/dashboard/terminals' },
    );
  }

  return actions.map((action, index) => ({
    ...action,
    index: String(index + 1).padStart(2, '0'),
  }));
});

function runQuickAction(action: QuickAction) {
  if (action.action === 'onboarding') openOnboarding();
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function terminalSlug(terminal: DashboardTerminal) {
  return terminal.public_slug || normalizeSlug(`${terminal.display_name}-${terminal.id.slice(0, 6)}`);
}

function terminalUrl(terminal: DashboardTerminal, pinRequired = !terminal.is_public) {
  if (!import.meta.client) return '';
  const path = pinRequired ? `/terminal/${terminal.id}` : `/t/${terminalSlug(terminal)}`;
  return new URL(path, window.location.origin).toString();
}

function syncTerminalDrafts() {
  for (const terminal of terminals.value) {
    terminalDrafts[terminal.id] = {
      name: terminalDrafts[terminal.id]?.name ?? terminal.display_name,
      pin: terminalDrafts[terminal.id]?.pin ?? terminal.pin_code ?? '',
      pinRequired: terminalDrafts[terminal.id]?.pinRequired ?? !Boolean(terminal.is_public),
      showPin: terminalDrafts[terminal.id]?.showPin ?? false,
    };
  }
}

async function loadTerminals() {
  if (!business.value) return;
  terminalLoading.value = true;

  try {
    const res = await $fetch<{ terminals: DashboardTerminal[] | null }>('/api/terminals', {
      headers: authHeaders(),
      query: { businessId: business.value.id },
    });
    terminals.value = res.terminals ?? [];
    syncTerminalDrafts();
  } finally {
    terminalLoading.value = false;
  }
}

async function copyTerminalLink(terminal: DashboardTerminal) {
  const draft = terminalDrafts[terminal.id];
  const target = terminalUrl(terminal, draft?.pinRequired ?? !terminal.is_public);
  if (!target) return;

  await navigator.clipboard.writeText(target);
  copiedTerminalId.value = terminal.id;
  setTimeout(() => {
    if (copiedTerminalId.value === terminal.id) copiedTerminalId.value = null;
  }, 1500);
}

async function copyTerminalPin(terminal: DashboardTerminal) {
  const pin = terminalDrafts[terminal.id]?.pin;
  if (!pin) return;

  await navigator.clipboard.writeText(pin);
  copiedPinId.value = terminal.id;
  setTimeout(() => {
    if (copiedPinId.value === terminal.id) copiedPinId.value = null;
  }, 1500);
}

async function saveTerminalSettings(terminal: DashboardTerminal) {
  const draft = terminalDrafts[terminal.id];
  if (!business.value || !draft) return;
  savingTerminalId.value = terminal.id;

  try {
    const res = await $fetch<{ terminal: DashboardTerminal | null; error: string | null }>(`/api/terminals/${terminal.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessId: business.value.id,
        displayName: draft.name,
        pin: draft.pin || null,
      },
    });

    if (res.terminal) {
      terminal.display_name = res.terminal.display_name;
      terminal.pin_code = res.terminal.pin_code;
      draft.name = res.terminal.display_name;
      draft.pin = res.terminal.pin_code ?? draft.pin;
    }

    const publicSlug = terminalSlug({ ...terminal, display_name: draft.name });
    await $fetch<{ success: boolean; error: string | null }>(`/api/terminals/${terminal.id}/public`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessId: business.value.id,
        isPublic: !draft.pinRequired,
        publicSlug: draft.pinRequired ? null : publicSlug,
      },
    });

    terminal.is_public = !draft.pinRequired;
    terminal.public_slug = draft.pinRequired ? null : publicSlug;
  } finally {
    savingTerminalId.value = null;
  }
}

onMounted(loadTerminals);
watch(() => business.value?.id, loadTerminals);
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Top greeting bar ───────────────────────────────────────── -->
    <div class="px-10 pt-12 pb-10" style="border-bottom: 1px solid rgba(61,24,32,0.06);">
      <div class="flex flex-col gap-6 max-w-4xl">
        <div class="flex items-center gap-3">
          <span class="status-badge">
            <span class="badge-dot" /> {{ t('dashboard_preset_mode') }}
          </span>
          <span v-if="isEnterprise" class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md" style="background: rgba(61,24,32,0.05); color: rgba(61,24,32,0.5);">
            {{ t('dashboard_enterprise_enabled') }}
          </span>
        </div>

        <div>
          <p class="text-xs font-mono tracking-[0.2em] uppercase mb-3" style="color: rgba(61,24,32,0.4);">
            {{ now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }}
          </p>
          <h1 class="font-serif font-normal leading-tight" style="font-size: clamp(2.5rem, 4vw, 3.5rem); color: rgb(var(--shell-sidebar));">
            {{ greeting }}, <span style="font-weight: 500;">{{ firstName }}</span><span style="color: rgb(var(--shell-pink));">.</span>
          </h1>
          <p class="mt-4 text-[1.05rem] leading-relaxed" style="color: rgba(61,24,32,0.6); max-width: 600px;">
            {{ t('dashboard_welcome_prefix') }} <strong style="color: rgb(var(--shell-sidebar)); font-weight: 600;">{{ business?.name ?? t('dashboard_workspace_fallback') }}</strong>. {{ t('dashboard_welcome_suffix') }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Module Grid ────────────────────────────────────────────── -->
    <div class="px-10 py-10">
      <div class="flex items-center justify-between mb-8">
        <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: rgba(61,24,32,0.4);">
          {{ t('dashboard_platform_modules') }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <template v-for="action in quickActions" :key="action.label">
          <NuxtLink
            v-if="action.to"
            :to="action.to"
            class="dash-card group"
          >
            <div class="flex items-start justify-between mb-5">
              <div class="icon-chip">
                <component :is="action.icon" class="w-6 h-6" />
              </div>
              <span class="text-xs font-mono font-bold tracking-widest transition-opacity duration-300 opacity-30 group-hover:opacity-100" style="color: rgb(var(--shell-sidebar));">
                {{ action.index }}
              </span>
            </div>
            <div class="flex-1">
              <h3 class="font-serif text-xl mb-1.5" style="color: rgb(var(--shell-sidebar));">{{ action.label }}</h3>
              <p class="text-sm leading-relaxed" style="color: rgba(61,24,32,0.55);">{{ action.body }}</p>
            </div>
            <div class="card-arrow">
              {{ t('dashboard_open_module') }} <ArrowRight class="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </NuxtLink>

          <button
            v-else
            type="button"
            class="dash-card group"
            @click="runQuickAction(action)"
          >
            <div class="flex items-start justify-between mb-5">
              <div class="icon-chip">
                <component :is="action.icon" class="w-6 h-6" />
              </div>
              <span class="text-xs font-mono font-bold tracking-widest transition-opacity duration-300 opacity-30 group-hover:opacity-100" style="color: rgb(var(--shell-sidebar));">
                {{ action.index }}
              </span>
            </div>
            <div class="flex-1">
              <h3 class="font-serif text-xl mb-1.5" style="color: rgb(var(--shell-sidebar));">{{ action.label }}</h3>
              <p class="text-sm leading-relaxed" style="color: rgba(61,24,32,0.55);">{{ action.body }}</p>
            </div>
            <div class="card-arrow">
              {{ t('dashboard_open_setup') }} <ArrowRight class="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </button>
        </template>
      </div>

      <section v-if="business" class="mt-12 terminal-section">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: rgba(61,24,32,0.4);">
              Terminals
            </p>
            <h2 class="font-serif text-2xl mt-2" style="color: rgb(var(--shell-sidebar));">Your preset terminals</h2>
          </div>
          <NuxtLink v-if="isEnterprise" to="/dashboard/terminals" class="terminal-link">
            {{ t('dashboard_terminal_manager_link') }} <ArrowRight class="w-3.5 h-3.5" />
          </NuxtLink>
        </div>

        <div v-if="terminalLoading" class="terminal-loading">
          {{ t('dashboard_terminal_loading') }}
        </div>

        <div v-else-if="terminals.length === 0" class="terminal-empty">
          <Terminal class="w-10 h-10" />
          <div>
            <p>{{ t('dashboard_terminal_empty_title') }}</p>
            <span>{{ t('dashboard_terminal_empty_body') }}</span>
          </div>
        </div>

        <div v-else class="terminal-grid">
          <article v-for="terminal in terminals" :key="terminal.id" class="terminal-card">
            <div class="terminal-card-head">
              <div>
                <p class="terminal-label">{{ t('dashboard_terminal_name') }}</p>
                <h3>{{ terminal.display_name }}</h3>
                <span>{{ terminal.role }}</span>
              </div>
              <NuxtLink :to="`/dashboard/terminals/${terminal.id}`" class="terminal-icon-link" :title="t('dashboard_terminal_settings')">
                <Settings class="w-4 h-4" />
              </NuxtLink>
            </div>

            <div>
              <p class="terminal-label mb-2">{{ t('dashboard_terminal_preview') }}</p>
              <TerminalThumbnail :layout="terminal.ui_layout" :title="terminal.display_name" />
            </div>

            <div class="terminal-settings">
              <div>
                <label :for="`terminal-name-${terminal.id}`">{{ t('dashboard_terminal_change_name') }}</label>
                <input
                  :id="`terminal-name-${terminal.id}`"
                  v-model="terminalDrafts[terminal.id].name"
                  class="input-warm w-full px-3 py-2 text-sm"
                />
              </div>

              <div class="terminal-toggle-row">
                <div>
                  <p>{{ t('dashboard_terminal_pin') }}</p>
                  <span>{{ terminalDrafts[terminal.id].pinRequired ? t('dashboard_terminal_pin_enabled') : t('dashboard_terminal_pin_disabled') }}</span>
                </div>
                <label class="terminal-toggle">
                  <input v-model="terminalDrafts[terminal.id].pinRequired" type="checkbox" />
                  <span />
                </label>
              </div>

              <div v-if="terminalDrafts[terminal.id].pinRequired">
                <label :for="`terminal-pin-${terminal.id}`">{{ t('dashboard_terminal_pin_change') }}</label>
                <div class="terminal-pin-row">
                  <input
                    :id="`terminal-pin-${terminal.id}`"
                    v-model="terminalDrafts[terminal.id].pin"
                    :type="terminalDrafts[terminal.id].showPin ? 'text' : 'password'"
                    inputmode="numeric"
                    maxlength="8"
                    class="input-warm w-full px-3 py-2 text-sm font-mono"
                    placeholder="1234"
                    @input="terminalDrafts[terminal.id].pin = terminalDrafts[terminal.id].pin.replace(/\D/g, '').slice(0, 8)"
                  />
                  <button type="button" :title="terminalDrafts[terminal.id].showPin ? t('dashboard_terminal_pin_hide') : t('dashboard_terminal_pin_show')" @click="terminalDrafts[terminal.id].showPin = !terminalDrafts[terminal.id].showPin">
                    <EyeOff v-if="terminalDrafts[terminal.id].showPin" class="w-4 h-4" />
                    <Eye v-else class="w-4 h-4" />
                  </button>
                  <button type="button" :disabled="!terminalDrafts[terminal.id].pin" @click="copyTerminalPin(terminal)">
                    <KeyRound class="w-4 h-4" />
                    {{ copiedPinId === terminal.id ? t('dashboard_terminal_copied') : t('dashboard_terminal_copy') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="terminal-actions">
              <button type="button" @click="copyTerminalLink(terminal)">
                <Link2 class="w-4 h-4" />
                {{ copiedTerminalId === terminal.id ? t('dashboard_terminal_copied_link') : t('dashboard_terminal_copy_link') }}
              </button>
              <button
                type="button"
                :disabled="savingTerminalId === terminal.id || (terminalDrafts[terminal.id].pinRequired && !/^\d{4,8}$/.test(terminalDrafts[terminal.id].pin))"
                @click="saveTerminalSettings(terminal)"
              >
                <Save class="w-4 h-4" />
                {{ savingTerminalId === terminal.id ? t('dashboard_terminal_saving') : t('dashboard_terminal_save') }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.75rem;
  border-radius: 99px;
  border: 1.5px solid rgba(255, 87, 118, 0.25);
  background: rgba(255, 87, 118, 0.08);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--shell-pink));
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--shell-pink));
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}

.dash-card {
  display: flex;
  flex-direction: column;
  padding: 2rem;
  background: #FFFFFF;
  width: 100%;
  text-align: left;
  border-radius: 1.25rem;
  border: 1px solid rgba(61,24,32,0.06);
  box-shadow: 0 4px 12px rgba(61,24,32,0.02);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.3s;
  text-decoration: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  min-height: 220px;
}

.dash-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(61,24,32,0.06), 0 2px 8px rgba(61,24,32,0.04);
  border-color: rgba(255, 87, 118, 0.3);
}

.icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.85rem;
  background: rgba(255, 87, 118, 0.08);
  color: rgb(var(--shell-pink));
  transition: background 0.3s, color 0.3s, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dash-card:hover .icon-chip {
  background: rgb(var(--shell-pink));
  color: #FFFFFF;
  transform: scale(1.05);
}

.card-arrow {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 1.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(var(--shell-pink));
  opacity: 0;
  transform: translateX(-12px);
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dash-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(0);
  color: rgb(var(--shell-sidebar));
}

.dash-card:active {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(61,24,32,0.04);
}

.dash-card:active .icon-chip {
  transform: scale(0.95);
  background: rgb(var(--shell-pink));
}

.dash-card:active .card-arrow {
  color: rgb(var(--shell-sidebar));
}

/* Subtle background accent on hover */
.dash-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle at top right, rgba(255,87,118,0.06), transparent 70%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.dash-card:hover::before {
  opacity: 1;
}

.terminal-section {
  border-top: 1px solid rgba(61,24,32,0.08);
  padding-top: 2.5rem;
}

.terminal-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(var(--shell-sidebar));
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 700;
}

.terminal-loading,
.terminal-empty {
  border: 1px solid rgba(61,24,32,0.08);
  background: #fff;
  border-radius: 0.75rem;
  padding: 1.25rem;
  color: rgba(61,24,32,0.5);
}

.terminal-empty {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.terminal-empty p {
  margin: 0;
  color: rgb(var(--shell-sidebar));
  font-weight: 700;
}

.terminal-empty span {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.85rem;
}

.terminal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.terminal-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid rgba(61,24,32,0.08);
  border-radius: 0.75rem;
  background: #fff;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(61,24,32,0.02);
}

.terminal-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.terminal-card h3 {
  margin: 0.1rem 0 0;
  color: rgb(var(--shell-sidebar));
  font-size: 1rem;
  font-weight: 700;
}

.terminal-card-head span {
  display: block;
  margin-top: 0.2rem;
  color: rgba(61,24,32,0.42);
  font-size: 0.75rem;
}

.terminal-label,
.terminal-settings label {
  margin: 0;
  color: rgba(61,24,32,0.42);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.terminal-icon-link {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: rgba(61,24,32,0.55);
  background: rgba(61,24,32,0.05);
  text-decoration: none;
}

.terminal-settings {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.terminal-settings label {
  display: block;
  margin-bottom: 0.35rem;
}

.terminal-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(61,24,32,0.08);
  border-radius: 0.65rem;
  padding: 0.75rem;
}

.terminal-toggle-row p {
  margin: 0;
  color: rgb(var(--shell-sidebar));
  font-size: 0.85rem;
  font-weight: 700;
}

.terminal-toggle-row span {
  display: block;
  margin-top: 0.12rem;
  color: rgba(61,24,32,0.45);
  font-size: 0.72rem;
}

.terminal-toggle {
  position: relative;
  display: inline-flex;
  width: 2.7rem;
  height: 1.5rem;
  cursor: pointer;
}

.terminal-toggle input {
  position: absolute;
  opacity: 0;
}

.terminal-toggle span {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(61,24,32,0.12);
  transition: background 0.18s;
}

.terminal-toggle span::after {
  content: '';
  position: absolute;
  top: 0.18rem;
  left: 0.18rem;
  width: 1.14rem;
  height: 1.14rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(61,24,32,0.18);
  transition: transform 0.18s;
}

.terminal-toggle input:checked + span {
  background: rgb(var(--shell-sidebar));
}

.terminal-toggle input:checked + span::after {
  transform: translateX(1.2rem);
}

.terminal-pin-row,
.terminal-actions {
  display: flex;
  gap: 0.5rem;
}

.terminal-pin-row button,
.terminal-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 0.5rem;
  background: rgba(61,24,32,0.06);
  color: rgb(var(--shell-sidebar));
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.5rem 0.65rem;
  transition: opacity 0.15s;
}

.terminal-pin-row button:disabled,
.terminal-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.terminal-actions {
  margin-top: auto;
}

.terminal-actions button {
  flex: 1;
}
</style>
