<script setup lang="ts">
import { Menu, X } from 'lucide-vue-next';

const { t, loadLocale } = useLocale();
const route = useRoute();
const { isLoggedIn, loadDevSession } = useAuth();

const navLinks = computed(() => [
  { label: t('nav_features'), to: '/features' },
  { label: t('nav_pricing'),  to: '/pricing'  },
]);

const scrolled = ref(false);
const mobileMenuOpen = ref(false);

function closeMobileMenu() {
  mobileMenuOpen.value = false;
}

onMounted(() => {
  loadLocale();
  loadDevSession();
  const handler = () => { scrolled.value = window.scrollY > 24; };
  window.addEventListener('scroll', handler, { passive: true });
  onUnmounted(() => window.removeEventListener('scroll', handler));
});
</script>

<template>
  <div class="marketing-shell">
    <!-- â”€â”€ Navbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <header class="marketing-nav" :class="{ scrolled }">
      <div class="nav-inner">
        <NuxtLink to="/" class="nav-logo" @click="closeMobileMenu">
          <span class="logo-wordmark">Kogane</span>
          <span class="logo-dot" />
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
            <NuxtLink to="/login?mode=signup" class="btn-maroon-sm">{{ t('nav_getstarted') }}</NuxtLink>
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
          <X v-if="mobileMenuOpen" class="w-5 h-5" />
          <Menu v-else class="w-5 h-5" />
        </button>
      </div>
    </header>

    <!-- â”€â”€ Page content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <main>
      <slot />
    </main>

    <!-- â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <footer class="marketing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="logo-wordmark footer-logo">Kogane</span>
          <p class="footer-tagline">{{ t('footer_tagline') }}</p>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">{{ t('footer_product') }}</p>
          <NuxtLink to="/features" class="footer-link">{{ t('nav_features') }}</NuxtLink>
          <NuxtLink to="/pricing"  class="footer-link">{{ t('nav_pricing') }}</NuxtLink>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">{{ t('footer_company') }}</p>
          <span class="footer-link footer-link-disabled">{{ t('footer_about') }}</span>
          <span class="footer-link footer-link-disabled">{{ t('footer_blog') }}</span>
          <span class="footer-link footer-link-disabled">{{ t('footer_contact') }}</span>
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
/* â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.marketing-shell {
  min-height: 100dvh;
  background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);
  display: flex;
  flex-direction: column;
}

/* â”€â”€ Navbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.marketing-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 2rem;
  transition: background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  background: transparent;
  border-bottom: 1px solid transparent;
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
}

.nav-link {
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(104, 41, 58, 0.6);
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
}
.btn-ghost-sm:hover { border-color: rgba(104, 41, 58, 0.45); background: rgba(104, 41, 58, 0.05); }

.btn-maroon-sm {
  padding: 0.42rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #F6E6D7;
  background: #68293A;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-maroon-sm:hover  { opacity: 0.88; }
.btn-maroon-sm:active { transform: scale(0.97); }

/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  color: rgba(104, 41, 58, 0.55);
  margin-top: 0.25rem;
  max-width: 220px;
}

.footer-links-group { display: flex; flex-direction: column; gap: 0.6rem; }

.footer-col-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(104, 41, 58, 0.4);
  margin-bottom: 0.25rem;
}

.footer-link {
  font-size: 0.9rem;
  color: rgba(104, 41, 58, 0.6);
  text-decoration: none;
  transition: color 0.15s;
}
.footer-link:hover { color: #68293A; }
.footer-link-disabled { cursor: default; }

.footer-bottom {
  border-top: 1px solid rgba(104, 41, 58, 0.07);
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 2rem;
  font-size: 0.8rem;
  color: rgba(104, 41, 58, 0.4);
}

@media (max-width: 768px) {
  .footer-inner { grid-template-columns: 1fr 1fr; }
  .nav-inner { position: relative; }
  .mobile-menu-toggle { display: inline-flex; }
  .nav-links {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
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
  .nav-actions { gap: 0.35rem; }
  .btn-ghost-sm,
  .btn-maroon-sm { padding: 0.38rem 0.62rem; font-size: 0.75rem; }
}
</style>

