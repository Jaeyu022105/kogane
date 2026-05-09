<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();

import { Database, Palette, Terminal, Settings, Shield, BarChart3, ArrowRight } from 'lucide-vue-next';

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
const firstName = session?.email?.split('@')[0] ?? 'Admin';

const quickActions = [
  { label: 'Database Editor', body: 'Design your schema tables, columns, and relationships visually.', icon: Database,  to: '/dashboard/database',  index: '01' },
  { label: 'UI Builder',      body: 'Drag and drop interfaces for your terminals with reactive state.', icon: Palette,   to: '/dashboard/builder',   index: '02' },
  { label: 'Terminals',       body: 'Deploy and manage staff-facing terminals with role-based access.', icon: Terminal,  to: '/dashboard/terminals', index: '03' },
  { label: 'Audit Log',       body: 'Track data mutations, logins, and all terminal activity.',       icon: Shield,    to: '/dashboard/audit',     index: '04' },
  { label: 'Reports',         body: 'View summaries, analytics, and run custom SQL queries.',         icon: BarChart3, to: '/dashboard/reports',   index: '05' },
  { label: 'Settings',        body: 'Configure your branding, theme, and workspace details.',         icon: Settings,  to: '/dashboard/settings',  index: '06' },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Top greeting bar ───────────────────────────────────────── -->
    <div class="px-10 pt-12 pb-10" style="border-bottom: 1px solid rgba(61,24,32,0.06);">
      <div class="flex flex-col gap-6 max-w-4xl">
        <div class="flex items-center gap-3">
          <span class="status-badge">
            <span class="badge-dot" /> Development Mode
          </span>
          <span class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md" style="background: rgba(61,24,32,0.05); color: rgba(61,24,32,0.5);">
            Schema: {{ business?.schemaName ?? 'Not configured' }}
          </span>
        </div>

        <div>
          <p class="text-xs font-mono tracking-[0.2em] uppercase mb-3" style="color: rgba(61,24,32,0.4);">
            {{ now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }}
          </p>
          <h1 class="font-serif font-normal leading-tight" style="font-size: clamp(2.5rem, 4vw, 3.5rem); color: rgb(var(--shell-sidebar));">
            {{ greeting }}, <span style="font-weight: 500;">{{ firstName }}</span><span style="color: rgb(var(--shell-pink));">.</span>
          </h1>
          <p class="mt-4 text-[1.05rem] leading-relaxed" style="color: rgba(61,24,32,0.6); max-width: 600px;">
            Welcome to the Postfolio dashboard for <strong style="color: rgb(var(--shell-sidebar)); font-weight: 600;">{{ business?.name ?? 'your workspace' }}</strong>. Select a module below to start building your internal tools.
          </p>
        </div>
      </div>
    </div>

    <!-- ── Module Grid ────────────────────────────────────────────── -->
    <div class="px-10 py-10">
      <div class="flex items-center justify-between mb-8">
        <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: rgba(61,24,32,0.4);">
          Platform Modules
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <NuxtLink
          v-for="action in quickActions"
          :key="action.to"
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
            Open module <ArrowRight class="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </NuxtLink>
      </div>
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
  border-radius: 1.25rem;
  border: 1px solid rgba(61,24,32,0.06);
  box-shadow: 0 4px 12px rgba(61,24,32,0.02);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.3s;
  text-decoration: none;
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
</style>
