<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { business } = useBusiness();
const { session }  = useAuth();

// Quick stat cards shown on the overview
const stats = computed(() => [
  { label: 'Business',  value: business.value?.name ?? '—',      icon: '🏢' },
  { label: 'Schema',    value: business.value?.schemaName ?? '—', icon: '⛁' },
  { label: 'Mode',      value: 'Development',                     icon: '🔧' },
]);
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Topbar -->
    <header class="px-8 py-5 border-b border-white/8 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Overview</h1>
        <p class="text-sm text-white/40 mt-0.5">Welcome back, {{ session?.email ?? 'Admin' }}</p>
      </div>
      <div class="text-xs text-white/30 px-3 py-1.5 rounded-full border border-white/10">
        DEV MODE
      </div>
    </header>

    <div class="px-8 py-6 space-y-8">
      <!-- Stat cards -->
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="glass rounded-2xl px-5 py-4 space-y-2 animate-fade-in"
        >
          <div class="text-2xl">{{ stat.icon }}</div>
          <p class="text-xs text-white/40 uppercase tracking-wide">{{ stat.label }}</p>
          <p class="text-sm font-semibold text-white truncate">{{ stat.value }}</p>
        </div>
      </div>

      <!-- Quick actions -->
      <div>
        <h2 class="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div class="grid grid-cols-2 gap-3">
          <NuxtLink
            to="/dashboard/database"
            class="glass rounded-xl p-5 hover:bg-white/8 transition-all group"
          >
            <div class="text-3xl mb-3">⛁</div>
            <h3 class="font-semibold text-white text-sm">Database Editor</h3>
            <p class="text-xs text-white/40 mt-1">Design your schema tables and columns</p>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/builder"
            class="glass rounded-xl p-5 hover:bg-white/8 transition-all group"
          >
            <div class="text-3xl mb-3">🎨</div>
            <h3 class="font-semibold text-white text-sm">UI Builder</h3>
            <p class="text-xs text-white/40 mt-1">Build custom interfaces for your terminals</p>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/terminals"
            class="glass rounded-xl p-5 hover:bg-white/8 transition-all group"
          >
            <div class="text-3xl mb-3">⬢</div>
            <h3 class="font-semibold text-white text-sm">Terminals</h3>
            <p class="text-xs text-white/40 mt-1">Manage staff in-point access and roles</p>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/settings"
            class="glass rounded-xl p-5 hover:bg-white/8 transition-all group"
          >
            <div class="text-3xl mb-3">⚙️</div>
            <h3 class="font-semibold text-white text-sm">Settings</h3>
            <p class="text-xs text-white/40 mt-1">Theme, branding, and business details</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
