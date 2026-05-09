<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();

import { Database, Palette, Terminal, Settings, Shield, BarChart3, ArrowUpRight } from 'lucide-vue-next';

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

const quickActions = [
  { label: 'Database Editor', body: 'Design your schema tables and columns',          icon: Database,  to: '/dashboard/database',  index: '01' },
  { label: 'UI Builder',      body: 'Build custom interfaces for your terminals',     icon: Palette,   to: '/dashboard/builder',   index: '02' },
  { label: 'Terminals',       body: 'Manage staff terminal access and roles',         icon: Terminal,  to: '/dashboard/terminals', index: '03' },
  { label: 'Audit Log',       body: 'Track data mutations and terminal activity',     icon: Shield,    to: '/dashboard/audit',     index: '04' },
  { label: 'Reports',         body: 'Summaries, activity views, and custom queries',  icon: BarChart3, to: '/dashboard/reports',   index: '05' },
  { label: 'Settings',        body: 'Theme, branding, and business details',          icon: Settings,  to: '/dashboard/settings',  index: '06' },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Top greeting bar ───────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <div class="flex items-end justify-between gap-6">
        <div>
          <p class="text-xs font-mono tracking-widest uppercase mb-2" style="color: rgba(61,24,32,0.35);">
            {{ now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }}
          </p>
          <h1 class="font-serif font-normal leading-none" style="font-size: clamp(2rem, 3vw, 2.75rem); color: rgb(var(--shell-sidebar));">
            {{ greeting }}<span style="color: rgba(61,24,32,0.25);">.</span>
          </h1>
          <p class="mt-2 text-sm" style="color: rgba(61,24,32,0.4);">
            {{ session?.email ?? 'Admin' }} &nbsp;·&nbsp; {{ business?.name ?? 'No business yet' }}
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span
            class="text-[10px] font-mono tracking-[0.15em] uppercase px-3 py-1.5"
            style="border: 1px solid rgba(61,24,32,0.15); color: rgba(61,24,32,0.4); border-radius: 0.25rem; letter-spacing: 0.12em;"
          >
            Dev&thinsp;Mode
          </span>
        </div>
      </div>
    </div>

    <!-- ── Module list ────────────────────────────────────────────── -->
    <div class="px-10 py-8">
      <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-6" style="color: rgba(61,24,32,0.3);">
        Modules
      </p>

      <div class="space-y-0">
        <NuxtLink
          v-for="action in quickActions"
          :key="action.to"
          :to="action.to"
          class="dash-row group flex items-center gap-5 py-4 transition-all duration-150"
          style="border-bottom: 1px solid rgba(61,24,32,0.07); text-decoration: none;"
        >
          <span
            class="text-[10px] font-mono shrink-0 w-6 tabular-nums transition-colors duration-150"
            style="color: rgba(61,24,32,0.25);"
          >
            {{ action.index }}
          </span>

          <div
            class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
            style="background: rgba(61,24,32,0.05);"
          >
            <component :is="action.icon" class="w-3.5 h-3.5" style="color: rgba(61,24,32,0.45);" />
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ action.label }}</p>
            <p class="text-xs mt-0.5 truncate" style="color: rgba(61,24,32,0.4);">{{ action.body }}</p>
          </div>

          <ArrowUpRight
            class="w-4 h-4 shrink-0 transition-all duration-150 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"
            style="color: rgba(61,24,32,0.35);"
          />
        </NuxtLink>
      </div>

      <!-- ── Workspace status strip ─────────────────────────────── -->
      <div class="mt-10 flex items-center gap-8">
        <div>
          <p class="text-[10px] font-mono uppercase tracking-widest mb-1" style="color: rgba(61,24,32,0.3);">Schema</p>
          <p class="text-sm font-mono" style="color: rgba(61,24,32,0.65);">{{ business?.schemaName ?? '—' }}</p>
        </div>
        <div style="width: 1px; height: 28px; background: rgba(61,24,32,0.1);"></div>
        <div>
          <p class="text-[10px] font-mono uppercase tracking-widest mb-1" style="color: rgba(61,24,32,0.3);">Mode</p>
          <p class="text-sm font-mono" style="color: rgba(61,24,32,0.65);">Development</p>
        </div>
        <div style="width: 1px; height: 28px; background: rgba(61,24,32,0.1);"></div>
        <div>
          <p class="text-[10px] font-mono uppercase tracking-widest mb-1" style="color: rgba(61,24,32,0.3);">Business</p>
          <p class="text-sm font-mono" style="color: rgba(61,24,32,0.65);">{{ business?.name ?? '—' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-row:hover .dash-row-icon {
  background: rgba(61,24,32,0.09);
}
</style>
