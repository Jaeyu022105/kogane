<script setup lang="ts">
/**
 * Dashboard layout — persistent sidebar + main shell.
 * Redirects to login if no session is found.
 * Shows onboarding modal on first login when no business exists.
 */

import { LayoutDashboard, Terminal, Settings, Power, Shield, BarChart3, House } from 'lucide-vue-next';

const router = useRouter();
const route  = useRoute();
const { session, isLoggedIn, logout }                      = useAuth();
const { business, fetchBusiness }                          = useBusiness();
const { showOnboarding, openOnboarding, closeOnboarding }  = useOnboarding();
const { isEnterprise }                                     = useEnterpriseAccess();
const { t }                                                = useLocale();

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  await fetchBusiness();

  if (!business.value) openOnboarding();
});

const navItems = computed(() => {
  const items = [
    { label: t('nav_overview'),  icon: LayoutDashboard, to: '/dashboard' },
    { label: t('nav_audit_log'), icon: Shield,          to: '/dashboard/audit' },
    { label: t('nav_reports'),   icon: BarChart3,       to: '/dashboard/reports' },
    { label: t('nav_settings'),  icon: Settings,        to: '/dashboard/settings' },
  ];

  if (isEnterprise.value) {
    items.splice(1, 0,
      { label: t('nav_terminals'), icon: Terminal, to: '/dashboard/terminals' },
    );
  }

  return items;
});

function isActive(to: string) {
  return route.path === to || (to !== '/dashboard' && route.path.startsWith(to));
}

function handleLogout() {
  logout();
  router.push({ path: '/login', query: { redirect: route.fullPath } });
}

function handleOnboardingDone() {
  closeOnboarding();
  // Force the current page to re-mount so fresh data is loaded after onboarding.
  router.go(0);
}
</script>

<template>
  <div class="flex h-dvh overflow-hidden" style="background: rgb(var(--shell-bg));">

    <!-- ── Sidebar ───────────────────────────────────────────────── -->
    <aside
      class="w-[200px] flex flex-col shrink-0"
      style="background: #ffffff; border-right: 1px solid rgba(61,24,32,0.08);"
    >
      <!-- Wordmark -->
      <div class="px-5 py-5" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
        <NuxtLink to="/" class="flex items-center gap-2.5 no-underline">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style="background: rgb(var(--shell-pink)); color: #fff;"
          >
            K
          </div>
          <span class="font-serif text-sm leading-none" style="color: rgb(var(--shell-sidebar));">
            <strong>Kogane</strong>
          </span>
        </NuxtLink>

        <NuxtLink
          to="/"
          class="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium no-underline transition-all hover:bg-black/5"
          style="color: rgba(61,24,32,0.58);"
        >
          <House class="w-3.5 h-3.5" />
          {{ t('nav_homepage') }}
        </NuxtLink>

        <div v-if="business?.name" class="mt-3">
          <p class="text-[10px] font-mono uppercase tracking-widest mb-0.5" style="color: rgba(61,24,32,0.4);">{{ t('nav_workspace') }}</p>
          <p class="text-xs truncate" style="color: rgb(var(--shell-sidebar));">{{ business.name }}</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-2 pt-4 space-y-0.5">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar-nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150"
          :class="isActive(item.to) ? 'sidebar-nav-active' : ''"
          style="text-decoration: none;"
        >
          <component
            :is="item.icon"
            class="w-3.5 h-3.5 shrink-0 transition-colors duration-150"
            :style="isActive(item.to) ? 'color: #fff;' : 'color: rgba(61,24,32,0.4);'"
          />
          <span
            class="transition-colors duration-150"
            :style="isActive(item.to) ? 'color: #fff; font-weight: 600;' : 'color: rgba(61,24,32,0.7);'"
          >
            {{ item.label }}
          </span>
        </NuxtLink>
      </nav>

      <!-- User footer -->
      <div class="px-4 py-4" style="border-top: 1px solid rgba(245,237,228,0.08);">
        <div class="flex items-center gap-2.5">
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
            style="background: rgba(255,87,118,0.2); color: rgb(var(--shell-pink));"
          >
            {{ session?.email?.[0]?.toUpperCase() ?? 'A' }}
          </div>
          <p class="text-[11px] flex-1 min-w-0 truncate" style="color: rgb(var(--shell-sidebar));">
            {{ session?.email ?? t('admin_fallback') }}
          </p>
          <button
            class="shrink-0 transition-colors duration-150"
            style="color: rgba(61,24,32,0.4);"
            :title="t('nav_logout')"
            @click="handleLogout"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgb(var(--shell-sidebar))'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(61,24,32,0.4)'"
          >
            <Power class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ── Main content area ──────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden" style="background: rgb(var(--shell-bg));">
      <slot />
    </div>

    <!-- Onboarding modal -->
    <OnboardingModal v-if="showOnboarding" @done="handleOnboardingDone" @close="closeOnboarding" />
  </div>
</template>

<style scoped>
.sidebar-nav-item {
  position: relative;
  overflow: hidden;
}

.sidebar-nav-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgb(var(--shell-pink)), transparent);
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 0;
}

.sidebar-nav-item:not(.sidebar-nav-active):hover::before {
  opacity: 0.15;
}

.sidebar-nav-item.sidebar-nav-active::before {
  opacity: 1;
}

.sidebar-nav-item > * {
  position: relative;
  z-index: 1;
}

.sidebar-nav-item.sidebar-nav-active span,
.sidebar-nav-item.sidebar-nav-active svg {
  color: #fff !important;
}

.sidebar-nav-item:not(.sidebar-nav-active):hover span,
.sidebar-nav-item:not(.sidebar-nav-active):hover svg {
  color: rgb(var(--shell-sidebar)) !important;
}
</style>
