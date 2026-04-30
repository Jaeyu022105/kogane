<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();

import { Building2, Database, Wrench, Palette, Terminal, Settings } from 'lucide-vue-next';

const stats = computed(() => [
  { label: 'Business',  value: business.value?.name ?? '—',       icon: Building2 },
  { label: 'Schema',    value: business.value?.schemaName ?? '—', icon: Database },
  { label: 'Mode',      value: 'Development',                     icon: Wrench },
]);
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <!-- Topbar -->
    <header
      class="px-8 py-5 flex items-center justify-between"
      style="border-bottom: 1px solid rgba(61,24,32,0.1);"
    >
      <div>
        <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Overview</h1>
        <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">
          Welcome back, {{ session?.email ?? 'Admin' }} 👋
        </p>
      </div>
      <span
        class="text-xs px-3 py-1.5 rounded-full font-medium"
        style="background: rgba(61,24,32,0.07); color: rgba(61,24,32,0.55); border: 1.5px solid rgba(61,24,32,0.12);"
      >
        DEV MODE
      </span>
    </header>

    <div class="px-8 py-7 space-y-8">
      <!-- Stat cards -->
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="card rounded-2xl px-5 py-5 space-y-3 animate-fade-in"
        >
          <component :is="stat.icon" class="w-6 h-6" />
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

      <!-- Quick actions -->
      <div>
        <h2 class="text-xs font-bold uppercase tracking-widest mb-4" style="color: rgba(61,24,32,0.4);">
          Quick Actions
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <NuxtLink
            to="/dashboard/database"
            class="card rounded-2xl p-5 block transition-all duration-150 animate-fade-in group"
            style="text-decoration: none;"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(61,24,32,0.12)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = ''"
          >
            <Database class="w-8 h-8 mb-3" />
            <h3 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">Database Editor</h3>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Design your schema tables and columns</p>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/builder"
            class="card rounded-2xl p-5 block transition-all duration-150 animate-fade-in group"
            style="text-decoration: none;"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(61,24,32,0.12)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = ''"
          >
            <Palette class="w-8 h-8 mb-3" />
            <h3 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">UI Builder</h3>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Build custom interfaces for your terminals</p>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/terminals"
            class="card rounded-2xl p-5 block transition-all duration-150 animate-fade-in group"
            style="text-decoration: none;"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(61,24,32,0.12)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = ''"
          >
            <Terminal class="w-8 h-8 mb-3" />
            <h3 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">Terminals</h3>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Manage staff in-point access and roles</p>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/settings"
            class="card rounded-2xl p-5 block transition-all duration-150 animate-fade-in group"
            style="text-decoration: none;"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(61,24,32,0.12)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.boxShadow = ''"
          >
            <Settings class="w-8 h-8 mb-3" />
            <h3 class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">Settings</h3>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Theme, branding, and business details</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
