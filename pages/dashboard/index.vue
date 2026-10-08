<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();
const { openOnboarding } = useOnboarding();
const { isEnterprise } = useEnterpriseAccess();
const { t } = useLocale();


import { Terminal, Settings, Shield, BarChart3, ArrowRight, Sparkles, Plus } from 'lucide-vue-next';
import TerminalCard from '~/components/TerminalCard.vue';
import { TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';

const workstationPresets = computed(() => TERMINAL_PERMISSION_PRESETS);

const now = new Date();
const hour = now.getHours();
const greeting = computed(() => (hour < 12 ? t('dashboard_greeting_morning') : hour < 18 ? t('dashboard_greeting_afternoon') : t('dashboard_greeting_evening')));
const firstName = computed(() => session.value?.email?.split('@')[0] ?? t('admin_fallback'));

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
const terminalLoading = ref(false);
const terminalError = ref('');

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
      label: t('dashboard_action_terminals_label'),
      body: t('dashboard_action_terminals_body'),
      icon: Terminal,
      to: '/dashboard/terminals',
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

  return actions.map((action, index) => ({
    ...action,
    index: String(index + 1).padStart(2, '0'),
  }));
});

function runQuickAction(action: QuickAction) {
  if (action.action === 'onboarding') openOnboarding();
}

async function loadTerminals() {
  if (!business.value) return;
  terminalLoading.value = true;
  terminalError.value = '';

  try {
    const res = await $fetch<{ terminals?: DashboardTerminal[] | null; error?: string | null }>('/api/terminals', {
      headers: authHeaders(),
      query: { businessId: business.value.id },
    });
    if (res.error) {
      terminalError.value = 'We could not load your terminals right now. Please try again.';
      return;
    }
    terminals.value = res.terminals ?? [];
  } catch {
    terminalError.value = 'We could not load your terminals right now. Please try again.';
  } finally {
    terminalLoading.value = false;
  }
}

function onTerminalDeleted(terminalId: string) {
  terminals.value = terminals.value.filter((t) => t.id !== terminalId);
}

onMounted(loadTerminals);
watch(() => business.value?.id, loadTerminals);
</script>

<template>
  <div class="dashboard-page flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Top greeting bar ───────────────────────────────────────── -->
    <div class="dashboard-greeting px-10 pt-12 pb-10" style="border-bottom: 1px solid rgba(61,24,32,0.06);">
      <div class="flex flex-col gap-6 max-w-4xl">
        <div class="flex items-center gap-3">
          <span class="status-badge">
            <span class="badge-dot" /> {{ t('dashboard_preset_mode') }}
          </span>
          <span class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md flex items-center gap-1.5" style="background: rgba(16,185,129,0.1); color: #059669;">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LAN Ready
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
    <div class="dashboard-content px-10 py-10">
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
            <div class="flex items-center gap-2">
              <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: rgba(61,24,32,0.4);">
                Workstations & Terminals
              </p>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LAN Active
              </span>
            </div>
            <h2 class="font-serif text-2xl mt-1" style="color: rgb(var(--shell-sidebar));">Your Workstations</h2>
          </div>
          <div class="flex items-center gap-3">
            <NuxtLink
              to="/dashboard/terminals"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white hover:opacity-90 transition-opacity flex items-center gap-1.5 no-underline shadow-sm"
              style="background: rgb(var(--shell-sidebar));"
            >
              <Plus class="w-3.5 h-3.5" /> New Workstation
            </NuxtLink>
            <NuxtLink to="/dashboard/terminals" class="terminal-link">
              {{ t('dashboard_terminal_manager_link') }} <ArrowRight class="w-3.5 h-3.5" />
            </NuxtLink>
          </div>
        </div>

        <div v-if="terminalLoading" class="terminal-loading">
          {{ t('dashboard_terminal_loading') }}
        </div>

        <div v-else-if="terminalError" class="terminal-empty" role="alert">
          <div>
            <p>Terminals are unavailable</p>
            <span>{{ terminalError }}</span>
          </div>
        </div>

        <div v-else-if="terminals.length === 0" class="space-y-6">
          <div class="terminal-empty">
            <Terminal class="w-10 h-10" />
            <div>
              <p>{{ t('dashboard_terminal_empty_title') }}</p>
              <span>{{ t('dashboard_terminal_empty_body') }}</span>
            </div>
            <NuxtLink
              to="/dashboard/terminals"
              class="mt-3 px-4 py-2 text-xs font-semibold rounded-lg text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 no-underline"
              style="background: rgb(var(--shell-pink));"
            >
              <Plus class="w-3.5 h-3.5" /> New Workstation
            </NuxtLink>
          </div>

          <div class="rounded-2xl p-6 bg-white/60 border border-black/5">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-serif text-lg text-[rgb(var(--shell-sidebar))]">Starter Workstations</h3>
                <p class="text-xs text-[rgba(61,24,32,0.5)]">One-click creation for all 5 official operating workstations:</p>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              <NuxtLink
                v-for="preset in workstationPresets"
                :key="preset.key"
                :to="`/dashboard/terminals?create=${preset.key}`"
                class="p-4 rounded-xl border transition-all text-left group bg-white hover:border-[#FF5776] hover:shadow-md no-underline flex flex-col justify-between"
                style="border-color: rgba(61,24,32,0.08);"
              >
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-[#68293A]">{{ preset.label }}</span>
                    <Plus class="w-4 h-4 text-[#FF5776] opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p class="text-[11px] leading-relaxed m-0 text-[rgba(61,24,32,0.6)]">{{ preset.description }}</p>
                </div>
                <div class="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-[11px] font-semibold text-[#FF5776]">
                  <span>Create station</span>
                  <ArrowRight class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <!-- Quick add strip -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[rgba(61,24,32,0.4)] shrink-0">Quick Add:</span>
            <NuxtLink
              v-for="preset in workstationPresets"
              :key="preset.key"
              :to="`/dashboard/terminals?create=${preset.key}`"
              class="px-2.5 py-1 rounded-md bg-white border border-[rgba(61,24,32,0.08)] hover:border-[#FF5776] hover:text-[#FF5776] text-[rgba(61,24,32,0.7)] text-[11px] font-medium no-underline shrink-0 transition-colors flex items-center gap-1"
            >
              <Plus class="w-3 h-3" /> {{ preset.label }}
            </NuxtLink>
          </div>

          <div class="terminal-grid">
            <TerminalCard
              v-for="terminal in terminals"
              :key="terminal.id"
              :terminal="terminal"
              @deleted="onTerminalDeleted(terminal.id)"
            />
          </div>
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
  color: rgba(61,24,32,0.7);
}

.dashboard-page [style*="color: rgba(61,24,32,0."] {
  color: rgba(61,24,32,0.7) !important;
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

@media (max-width: 768px) {
  .dashboard-greeting,
  .dashboard-content {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .dashboard-greeting {
    padding-top: 2rem;
    padding-bottom: 2rem;
  }

  .dashboard-greeting h1 {
    font-size: 2.25rem !important;
  }

  .dashboard-content {
    padding-top: 1.5rem;
    padding-bottom: 2rem;
  }

  .dash-card {
    min-height: 0;
    padding: 1.25rem;
  }

  .card-arrow {
    opacity: 1;
    transform: none;
  }

  .terminal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
