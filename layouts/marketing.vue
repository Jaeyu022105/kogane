<script setup lang="ts">
import { Menu, X } from 'lucide-vue-next';

const { t, locale, setLocale, loadLocale, availableLocales } = useLocale();
const route = useRoute();
const { isLoggedIn, hydrateSession } = useAuth();

const navLinks = computed(() => [
  { label: t('nav_features'), to: '/features' },
  { label: t('nav_pricing'), to: '/pricing' },
]);

const scrolled = ref(false);
const mobileMenuOpen = ref(false);

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
  const handler = () => {
    scrolled.value = window.scrollY > 12;
  };
  window.addEventListener('scroll', handler, { passive: true });
  onUnmounted(() => window.removeEventListener('scroll', handler));
});
</script>

<template>
  <div class="marketing-shell">
    <!-- Header Navigation -->
    <header class="marketing-nav" :class="{ scrolled }">
      <div class="nav-inner">
        <NuxtLink to="/" class="nav-logo" @click="closeMobileMenu">
          <span class="logo-wordmark">Kogane</span>
          <span class="logo-dot" aria-hidden="true" />
        </NuxtLink>

        <nav
          id="marketing-menu"
          class="nav-links"
          :class="{ 'mobile-open': mobileMenuOpen }"
          aria-label="Main navigation"
        >
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

          <div class="mobile-drawer-actions">
            <NuxtLink
              v-if="isLoggedIn"
              to="/dashboard"
              class="nav-link"
              @click="closeMobileMenu"
            >
              {{ t('nav_dashboard') }}
            </NuxtLink>
            <template v-else>
              <NuxtLink to="/login" class="nav-link" @click="closeMobileMenu">
                {{ t('nav_signin') }}
              </NuxtLink>
              <NuxtLink to="/login?mode=signup" class="nav-link nav-link-accent" @click="closeMobileMenu">
                {{ t('nav_getstarted') }}
              </NuxtLink>
            </template>
          </div>
        </nav>

        <div class="nav-actions">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="nav-btn-primary">
            {{ t('nav_dashboard') }}
          </NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="nav-btn-ghost">
              {{ t('nav_signin') }}
            </NuxtLink>
            <NuxtLink to="/login?mode=signup" class="nav-btn-primary">
              {{ t('nav_getstarted') }}
            </NuxtLink>
          </template>

          <button
            type="button"
            class="mobile-menu-toggle"
            :aria-expanded="mobileMenuOpen"
            aria-controls="marketing-menu"
            :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <X v-if="mobileMenuOpen" class="w-4 h-4" aria-hidden="true" />
            <Menu v-else class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <main class="marketing-main">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="marketing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <NuxtLink to="/" class="nav-logo footer-brand-link">
            <span class="logo-wordmark">Kogane</span>
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
/* Shell */
.marketing-shell {
  min-height: 100dvh;
  background: linear-gradient(180deg, var(--k-cream, #F6E6D7) 0%, var(--k-surface, #FFFFFF) 18%);
  color: var(--k-ink, #68293A);
  font-family: var(--k-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
  display: flex;
  flex-direction: column;
}

.marketing-main {
  flex: 1;
}

/* Navbar */
.marketing-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: transparent;
  border-bottom: 1px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.marketing-nav.scrolled {
  background: rgba(255, 253, 251, 0.97);
  border-bottom-color: var(--k-border, rgba(104, 41, 58, 0.14));
  box-shadow: 0 1px 12px rgba(104, 41, 58, 0.06);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 clamp(1.25rem, 4vw, 2.5rem);
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.nav-logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--k-ink, #68293A);
  text-decoration: none;
  flex-shrink: 0;
}

.nav-logo:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 4px;
}

.logo-wordmark {
  font-family: var(--k-font-serif, 'DM Serif Display', Georgia, serif);
  font-size: 1.4rem;
  font-weight: 400;
  line-height: 1;
  color: var(--k-ink, #68293A);
  letter-spacing: -0.01em;
}

.logo-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--k-accent, #FF5776);
  margin-bottom: 9px;
  flex-shrink: 0;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.mobile-drawer-actions {
  display: none;
}

.nav-link {
  position: relative;
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  text-decoration: none;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--k-ink, #68293A);
  background: rgba(104, 41, 58, 0.06);
}

.nav-link.active {
  color: var(--k-ink, #68293A);
  font-weight: 600;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  left: 0.85rem;
  right: 0.85rem;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--k-accent, #FF5776);
}

.nav-link:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 3px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.nav-btn-ghost {
  padding: 0.48rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--k-ink, #68293A);
  background: transparent;
  border: 1.5px solid rgba(104, 41, 58, 0.2);
  border-radius: 0.55rem;
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
}

.nav-btn-ghost:hover {
  border-color: var(--k-ink, #68293A);
  background: var(--k-surface, #FFFFFF);
}

.nav-btn-primary {
  padding: 0.48rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--k-on-dark, #F6E6D7);
  background: var(--k-dark, #68293A);
  border: 1px solid var(--k-dark, #68293A);
  border-radius: 0.55rem;
  text-decoration: none;
  box-shadow: 0 2px 10px rgba(104, 41, 58, 0.18);
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  white-space: nowrap;
}

.nav-btn-primary:hover {
  background: var(--k-dark-deep, #4A1A27);
  border-color: var(--k-dark-deep, #4A1A27);
}

.nav-btn-primary:active {
  transform: scale(0.97);
}

.nav-btn-ghost:focus-visible,
.nav-btn-primary:focus-visible,
.mobile-menu-toggle:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 2px;
}

.mobile-menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  color: var(--k-ink, #68293A);
  background: var(--k-surface, #FFFFFF);
  cursor: pointer;
}

/* Footer */
.marketing-footer {
  margin-top: auto;
  border-top: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  background: var(--k-surface, #FFFFFF);
  color: var(--k-ink, #68293A);
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 3.75rem) clamp(1.25rem, 4vw, 2.5rem);
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 2.5rem;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.footer-tagline {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0;
  max-width: 30ch;
}

.footer-locale {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.35rem;
}

.footer-locale-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

.footer-locale-select {
  padding: 0.32rem 0.6rem;
  font-family: var(--k-font-sans, 'Inter', sans-serif);
  font-size: 0.8125rem;
  color: var(--k-ink, #68293A);
  background: var(--k-surface-alt, #FBF4ED);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  cursor: pointer;
}

.footer-locale-select:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 2px;
}

.footer-links-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.footer-col-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
  margin: 0 0 0.25rem;
}

.footer-link {
  font-size: 0.875rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  text-decoration: none;
  transition: color 0.15s ease;
}

.footer-link:hover {
  color: var(--k-accent, #FF5776);
}

.footer-link:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 2px;
}

.footer-bottom {
  border-top: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem clamp(1.25rem, 4vw, 2.5rem);
  font-size: 0.8125rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

@media (max-width: 768px) {
  .nav-inner {
    gap: 0.75rem;
    position: relative;
  }

  .mobile-menu-toggle {
    display: inline-flex;
  }

  .nav-links {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 0.5rem clamp(1.25rem, 4vw, 2.5rem) 1rem;
    background: var(--k-surface, #FFFFFF);
    border-bottom: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
    box-shadow: 0 10px 20px rgba(104, 41, 58, 0.08);
  }

  .nav-links.mobile-open {
    display: flex;
  }

  .nav-link {
    padding: 0.75rem 0.25rem;
    border-radius: 0;
    border-bottom: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  }

  .nav-link.active::after {
    display: none;
  }

  .mobile-drawer-actions {
    display: flex;
    flex-direction: column;
  }

  .mobile-drawer-actions .nav-link:last-child {
    border-bottom: none;
  }

  .nav-link-accent {
    color: var(--k-accent, #FF5776);
    font-weight: 600;
  }

  .footer-inner {
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .footer-brand {
    grid-column: span 2;
  }
}

@media (max-width: 540px) {
  .nav-btn-ghost {
    display: none;
  }

  .nav-btn-primary {
    padding: 0.42rem 0.75rem;
    font-size: 0.8125rem;
  }

  .footer-inner {
    grid-template-columns: 1fr;
  }

  .footer-brand {
    grid-column: span 1;
  }
}
</style>
