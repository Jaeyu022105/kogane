<script setup lang="ts">
/**
 * Dashboard layout — persistent sidebar + topbar shell.
 * Redirects to login if no session is found.
 */

const router  = useRouter();
const { session, isLoggedIn, logout } = useAuth();
const { business, fetchBusiness }     = useBusiness();

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.push('/login');
    return;
  }
  await fetchBusiness();
});

const navItems = [
  { label: 'Overview',  icon: '⬡', to: '/dashboard' },
  { label: 'Database',  icon: '⛁', to: '/dashboard/database' },
  { label: 'Builder',   icon: '⬛', to: '/dashboard/builder' },
  { label: 'Terminals', icon: '⬢', to: '/dashboard/terminals' },
  { label: 'Settings',  icon: '⚙', to: '/dashboard/settings' },
];

const route = useRoute();
function isActive(to: string) {
  return route.path === to || (to !== '/dashboard' && route.path.startsWith(to));
}

function handleLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-[rgb(var(--color-background))]">
    <!-- Sidebar -->
    <aside class="w-56 flex flex-col surface border-r border-white/8 shrink-0">
      <!-- Logo -->
      <div class="px-5 py-5 border-b border-white/8 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white font-bold text-sm">
          P
        </div>
        <div>
          <p class="text-sm font-semibold text-white leading-tight">Postfolio</p>
          <p class="text-xs text-white/40 truncate max-w-[100px]">{{ business?.name ?? '…' }}</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-2 py-4 space-y-0.5">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all duration-150"
          :class="{ 'nav-link-active': isActive(item.to) }"
        >
          <span class="text-base leading-none">{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User footer -->
      <div class="px-4 py-4 border-t border-white/8 flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs font-semibold text-brand-primary">
          {{ session?.email?.[0]?.toUpperCase() ?? 'A' }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-white truncate">{{ session?.email ?? 'Admin' }}</p>
        </div>
        <button
          class="text-white/30 hover:text-white/80 text-xs transition-colors"
          title="Log out"
          @click="handleLogout"
        >
          ⏻
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
