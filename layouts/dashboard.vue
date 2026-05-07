<script setup lang="ts">
/**
 * Dashboard layout — persistent sidebar + main shell.
 * Redirects to login if no session is found.
 * Shows onboarding modal on first login when no business exists.
 */

const router  = useRouter();
const { session, isLoggedIn, logout }   = useAuth();
const { business, fetchBusiness }       = useBusiness();
const { showOnboarding, openOnboarding, closeOnboarding } = useOnboarding();

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.push({
      path: '/login',
      query: {
        redirect: route.fullPath,
      },
    });
    return;
  }

  await fetchBusiness();

  if (!business.value) openOnboarding();
});

import { LayoutDashboard, Database, Terminal, Settings, Power, Shield, BarChart3 } from 'lucide-vue-next';

const navItems = [
  { label: 'Overview',  icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Database',  icon: Database, to: '/dashboard/database' },
  { label: 'Terminals', icon: Terminal, to: '/dashboard/terminals' },
  { label: 'Audit Log', icon: Shield, to: '/dashboard/audit' },
  { label: 'Reports',   icon: BarChart3, to: '/dashboard/reports' },
  { label: 'Settings',  icon: Settings, to: '/dashboard/settings' },
];

const route = useRoute();
function isActive(to: string) {
  return route.path === to || (to !== '/dashboard' && route.path.startsWith(to));
}

function handleLogout() {
  logout();
  router.push({
    path: '/login',
    query: {
      redirect: route.fullPath,
    },
  });
}
</script>

<template>
  <div class="flex h-dvh overflow-hidden" style="background: rgb(var(--shell-bg));">
    <!-- Sidebar -->
    <aside
      class="w-52 flex flex-col shrink-0"
      style="background: rgb(var(--shell-sidebar));"
    >
      <!-- Logo -->
      <div class="px-5 py-5 flex items-center gap-3" style="border-bottom: 1px solid rgba(245,237,228,0.1);">
        <div
          class="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm"
          style="background: rgb(var(--shell-pink)); color: #fff;"
        >
          P
        </div>
        <span class="font-serif text-base leading-none" style="color: rgb(var(--shell-sidebar-text));">
          <span style="color: rgb(var(--shell-pink));">Post</span><strong>folio</strong>
        </span>
      </div>

      <!-- Business name chip -->
      <div v-if="business?.name" class="mx-3 mt-3 px-3 py-1.5 rounded-lg text-xs truncate" style="background: rgba(245,237,228,0.08); color: rgba(245,237,228,0.55);">
        {{ business.name }}
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-2 py-4 space-y-0.5">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
          :class="isActive(item.to) ? 'nav-link-active font-medium' : ''"
          :style="isActive(item.to) ? '' : 'color: rgba(245,237,228,0.5);'"
          @mouseenter="(e: MouseEvent) => { if (!isActive(item.to)) (e.currentTarget as HTMLElement).style.color = 'rgba(245,237,228,0.85)'; (e.currentTarget as HTMLElement).style.background = 'rgba(245,237,228,0.07)' }"
          @mouseleave="(e: MouseEvent) => { if (!isActive(item.to)) (e.currentTarget as HTMLElement).style.color = 'rgba(245,237,228,0.5)'; (e.currentTarget as HTMLElement).style.background = '' }"
        >
          <component :is="item.icon" class="w-4 h-4 opacity-70" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User footer -->
      <div class="px-4 py-4 flex items-center gap-3" style="border-top: 1px solid rgba(245,237,228,0.1);">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
          style="background: rgba(232,116,138,0.25); color: rgb(var(--shell-pink));"
        >
          {{ session?.email?.[0]?.toUpperCase() ?? 'A' }}
        </div>
        <p class="text-xs flex-1 min-w-0 truncate" style="color: rgba(245,237,228,0.55);">
          {{ session?.email ?? 'Admin' }}
        </p>
        <button
          class="text-xs transition-colors"
          style="color: rgba(245,237,228,0.3);"
          title="Log out"
          @click="handleLogout"
          @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(245,237,228,0.75)'"
          @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(245,237,228,0.3)'"
        >
          <Power class="w-4 h-4" />
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden" style="background: rgb(var(--shell-bg));">
      <slot />
    </div>

    <!-- Onboarding modal (first-time + re-opened from settings) -->
    <OnboardingModal v-if="showOnboarding" @done="closeOnboarding" />
  </div>
</template>
