<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();

import { Building2, Database, Wrench, Palette, Terminal, Settings, Shield, BarChart3 } from 'lucide-vue-next';

const stats = computed(() => [
  { label: 'Business',  value: business.value?.name ?? '—',       icon: Building2 },
  { label: 'Schema',    value: business.value?.schemaName ?? '—', icon: Database },
  { label: 'Mode',      value: 'Development',                     icon: Wrench },
]);

const quickActions = [
  { label: 'Database Editor', body: 'Design your schema tables and columns',       icon: Database,  to: '/dashboard/database' },
  { label: 'UI Builder',      body: 'Build custom interfaces for your terminals',  icon: Palette,   to: '/dashboard/builder' },
  { label: 'Terminals',       body: 'Manage staff terminal access and roles',      icon: Terminal,  to: '/dashboard/terminals' },
  { label: 'Audit Log',       body: 'Track data mutations and terminal activity',  icon: Shield,    to: '/dashboard/audit' },
  { label: 'Reports',         body: 'Summaries, activity views, and custom queries', icon: BarChart3, to: '/dashboard/reports' },
  { label: 'Settings',        body: 'Theme, branding, and business details',       icon: Settings,  to: '/dashboard/settings' },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <!-- ── Topbar ───────────────────────────────────────────────────── -->
    <header
      class="px-8 py-5 flex items-center justify-between"
      style="border-bottom: 1px solid rgba(61,24,32,0.1);"
    >
      <div>
        <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Overview</h1>
        <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">
          Welcome back, {{ session?.email ?? 'Admin' }}
        </p>
      </div>
      <span
        class="text-xs px-3 py-1.5 font-semibold"
        style="background: rgba(61,24,32,0.07); color: rgba(61,24,32,0.55); border: 1.5px solid rgba(61,24,32,0.12); border-radius: 0.5rem;"
      >
        DEV MODE
      </span>
    </header>

    <div class="px-8 py-7 space-y-8">
      <!-- ── Stat cards ─────────────────────────────────────────────── -->
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="card rounded-xl px-5 py-5 space-y-3 animate-fade-in"
        >
          <component :is="stat.icon" class="w-5 h-5" style="color: rgba(61,24,32,0.4);" />
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest mb-1" style="color: rgba(61,24,32,0.4);">
              {{ stat.label }}
            </p>
            <p class="text-sm font-semibold truncate" style="color: rgb(var(--shell-sidebar));">
              {{ stat.value }}
            </p>
          </div>
        </div>
      </div>

      <!-- ── Quick actions ──────────────────────────────────────────── -->
      <div>
        <h2 class="text-xs font-bold uppercase tracking-widest mb-4" style="color: rgba(61,24,32,0.4);">
          Quick Actions
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <NuxtLink
            v-for="action in quickActions"
            :key="action.to"
            :to="action.to"
            class="card rounded-xl p-5 block transition-all duration-150 animate-fade-in"
            style="text-decoration: none;"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(61,24,32,0.12)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = ''"
          >
            <component :is="action.icon" class="w-6 h-6 mb-3" style="color: rgba(61,24,32,0.5);" />
            <h3 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">{{ action.label }}</h3>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">{{ action.body }}</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
