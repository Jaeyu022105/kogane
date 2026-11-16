<script setup lang="ts">
import MenuIcon from 'reicon-vue/icons/Menu';
import XIcon from 'reicon-vue/icons/X';

const { t, locale, setLocale, loadLocale, availableLocales } = useLocale();
const route = useRoute();
const { isLoggedIn, hydrateSession } = useAuth();

const navLinks = computed(() => [
  { label: t('nav_features'), to: '/features' },
  { label: t('nav_pricing'), to: '/pricing' },
]);

const scrolled = ref(false);
const mobileMenuOpen = ref(false);
// The home hero's faded pink backdrop runs up to the navbar, so the bar takes the same pink while the page sits at the top
const isHome = computed(() => route.path === '/');

function closeMobileMenu() {
  mobileMenuOpen.value = false;
}

function handleLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  setLocale(value);
}

watch(
  () => route.fullPath,
  () => {
    closeMobileMenu();
  },
);

onMounted(() => {
  loadLocale();
  void hydrateSession();
  const handler = () => { scrolled.value = window.scrollY > 24; };
  handler();
  window.addEventListener('scroll', handler, { passive: true });
  onUnmounted(() => window.removeEventListener('scroll', handler));
});
</script>

<template>
  <div class="marketing-shell">
    <!-- ── Navbar ─────────────────────────────────────────── -->
    <header class="marketing-nav" :class="{ scrolled, 'home-top': isHome && !scrolled }">
      <div class="nav-inner">
        <NuxtLink to="/" class="nav-logo" @click="closeMobileMenu">
          <KoganeIcon class="logo-icon" />
          <span class="logo-wordmark">Kogane</span>
          <span class="logo-dot" aria-hidden="true" />
        </NuxtLink>

        <nav id="marketing-menu" class="nav-links" :class="{ 'mobile-open': mobileMenuOpen }" aria-label="Main navigation">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            :class="{ active: route.path === link.to }"
            @click="closeMobileMenu"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="nav-actions">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="btn-ghost-sm">{{ t('nav_dashboard') }}</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="btn-ghost-sm">{{ t('nav_signin') }}</NuxtLink>
            <NuxtLink to="/login?mode=signup" class="btn-maroon-sm btn-ribbon" style="--ribbon-color: #68293A;">{{ t('nav_getstarted') }}</NuxtLink>
          </template>
        </div>

        <button
          type="button"
          class="mobile-menu-toggle"
          :aria-expanded="mobileMenuOpen"
          aria-controls="marketing-menu"
          :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <XIcon v-if="mobileMenuOpen" class="w-5 h-5" aria-hidden="true" />
          <MenuIcon v-else class="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </header>

    <!-- ── Page content ───────────────────────────────────── -->
    <main class="marketing-main">
      <slot />
    </main>

    <!-- ── Footer ─────────────────────────────────────────── -->
    <footer class="marketing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <NuxtLink to="/" class="nav-logo">
            <KoganeIcon class="logo-icon footer-logo-icon" />
            <span class="logo-wordmark footer-logo">Kogane</span>
            <span class="logo-dot" aria-hidden="true" />
          </NuxtLink>
          <p class="footer-tagline">{{ t('footer_tagline') }}</p>

          <div class="footer-locale">
            <label for="marketing-locale-select" class="footer-locale-label">
              {{ t('footer_language') }}
            </label>
            <select
              id="marketing-locale-select"
              :value="locale"
              class="footer-locale-select"
              @change="handleLocaleChange"
            >
              <option v-for="lang in availableLocales" :key="lang.code" :value="lang.code">
                {{ lang.nativeLabel }}
              </option>
            </select>
          </div>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">{{ t('footer_product') }}</p>
          <NuxtLink to="/features" class="footer-link">{{ t('nav_features') }}</NuxtLink>
          <NuxtLink to="/pricing" class="footer-link">{{ t('nav_pricing') }}</NuxtLink>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">{{ t('footer_account') }}</p>
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="footer-link">{{ t('nav_dashboard') }}</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="footer-link">{{ t('nav_signin') }}</NuxtLink>
            <NuxtLink to="/login?mode=signup" class="footer-link">{{ t('nav_getstarted') }}</NuxtLink>
          </template>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">{{ t('footer_legal') }}</p>
          <NuxtLink to="/privacy" class="footer-link">{{ t('footer_privacy') }}</NuxtLink>
          <NuxtLink to="/terms" class="footer-link">{{ t('footer_terms') }}</NuxtLink>
        </div>
      </div>

      <div class="footer-bottom">
        <span>&copy; {{ new Date().getFullYear() }} Kogane. {{ t('footer_rights') }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Shell ──────────────────────────────────────────── */
.marketing-shell {
  min-height: 100dvh;
  background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);
  color: #68293A;
  display: flex;
  flex-direction: column;
}

.marketing-main {
  flex: 1;
}

/* ── Navbar ─────────────────────────────────────────── */
.marketing-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 2rem;
  transition: background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  background: transparent;
  border-bottom: 1px solid transparent;
}
.marketing-nav.home-top {
  background: var(--k-strawberry-soft);
}
.marketing-nav.scrolled {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom-color: rgba(104, 41, 58, 0.1);
  box-shadow: 0 1px 12px rgba(104, 41, 58, 0.06);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  flex-shrink: 0;
}
.logo-wordmark {
  font-family: 'DM Serif Display', serif;
  font-size: 1.35rem;
  color: #68293A;
  letter-spacing: -0.01em;
}
.footer-logo { font-size: 1.5rem; }

/* Kogane mark, chocolate brown to match the wordmark */
.logo-icon {
  width: 30px;
  height: auto;
  color: #68293A;
  flex-shrink: 0;
  margin-right: 4px;
}
.footer-logo-icon { width: 34px; }

.logo-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FF5776;
  margin-bottom: 8px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.mobile-menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(104, 41, 58, 0.18);
  border-radius: 0.5rem;
  color: #68293A;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  flex-shrink: 0;
}

.nav-link {
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(104, 41, 58, 0.65);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.nav-link:hover { color: #68293A; background: rgba(104, 41, 58, 0.07); }
.nav-link.active { color: #68293A; font-weight: 600; }

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.btn-ghost-sm {
  padding: 0.42rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #68293A;
  text-decoration: none;
  border: 1.5px solid rgba(104, 41, 58, 0.2);
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}
.btn-ghost-sm:hover { border-color: rgba(104, 41, 58, 0.45); background: rgba(104, 41, 58, 0.05); }

.btn-maroon-sm {
  position: relative;
  overflow: visible;
  padding: 0.42rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #F6E6D7;
  background: #68293A;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}
.btn-maroon-sm:hover  { opacity: 0.88; }
.btn-maroon-sm:active { transform: scale(0.97); }

/* ── Footer ─────────────────────────────────────────── */
.marketing-footer {
  margin-top: auto;
  border-top: 1px solid rgba(104, 41, 58, 0.1);
  background: #FFFFFF;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 3rem 2rem;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 2.5rem;
}

.footer-brand { display: flex; flex-direction: column; gap: 0.5rem; }
.footer-tagline {
  font-size: 0.875rem;
  color: rgba(104, 41, 58, 0.6);
  margin: 0.25rem 0 0;
  max-width: 260px;
  line-height: 1.55;
}

.footer-locale {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.footer-locale-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(104, 41, 58, 0.55);
}

.footer-locale-select {
  padding: 0.3rem 0.6rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: #68293A;
  background: #FDFAF7;
  border: 1px solid rgba(104, 41, 58, 0.15);
  border-radius: 0.45rem;
  cursor: pointer;
}

.footer-links-group { display: flex; flex-direction: column; gap: 0.6rem; }

.footer-col-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(104, 41, 58, 0.45);
  margin: 0 0 0.25rem;
}

.footer-link {
  font-size: 0.9rem;
  color: rgba(104, 41, 58, 0.65);
  text-decoration: none;
  transition: color 0.15s;
}
.footer-link:hover { color: #68293A; }

.footer-bottom {
  border-top: 1px solid rgba(104, 41, 58, 0.07);
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 2rem;
  font-size: 0.8rem;
  color: rgba(104, 41, 58, 0.45);
}

@media (max-width: 768px) {
  .marketing-nav { padding: 0 1rem; }
  .footer-inner { grid-template-columns: 1fr 1fr; padding: 2.5rem 1.25rem; }
  .footer-bottom { padding: 1.25rem; }
  .nav-inner { position: relative; gap: 0.75rem; justify-content: space-between; }
  .mobile-menu-toggle { display: inline-flex; }
  .nav-links {
    display: none;
    position: absolute;
    top: 64px;
    left: -1rem;
    right: -1rem;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
    padding: 0.75rem 1rem 1rem;
    background: rgba(255,255,255,0.98);
    border-bottom: 1px solid rgba(104, 41, 58, 0.1);
    box-shadow: 0 10px 20px rgba(104, 41, 58, 0.08);
  }
  .nav-links.mobile-open { display: flex; }
  .nav-link { padding: 0.7rem 0.85rem; }
  .nav-actions { gap: 0.35rem; margin-left: auto; }
  .btn-ghost-sm,
  .btn-maroon-sm { padding: 0.38rem 0.62rem; font-size: 0.75rem; }
}

@media (max-width: 480px) {
  .footer-inner { grid-template-columns: 1fr; }
}
</style>
