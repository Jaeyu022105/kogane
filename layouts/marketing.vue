<script setup lang="ts">
const route = useRoute();
const navLinks = [
  { label: 'Features', to: '/features' },
  { label: 'Pricing',  to: '/pricing'  },
];

const scrolled = ref(false);

onMounted(() => {
  const handler = () => { scrolled.value = window.scrollY > 24; };
  window.addEventListener('scroll', handler, { passive: true });
  onUnmounted(() => window.removeEventListener('scroll', handler));
});
</script>

<template>
  <div class="marketing-shell">
    <!-- ── Navbar ─────────────────────────────────────────── -->
    <header class="marketing-nav" :class="{ scrolled }">
      <div class="nav-inner">
        <NuxtLink to="/" class="nav-logo">
          <span class="logo-wordmark">Postfolio</span>
          <span class="logo-dot" />
        </NuxtLink>

        <nav class="nav-links">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            :class="{ active: route.path === link.to }"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="nav-actions">
          <NuxtLink to="/login" class="btn-ghost-sm">Sign in</NuxtLink>
          <NuxtLink to="/login" class="btn-maroon-sm">Get started</NuxtLink>
        </div>
      </div>
    </header>

    <!-- ── Page content ───────────────────────────────────── -->
    <main>
      <slot />
    </main>

    <!-- ── Footer ─────────────────────────────────────────── -->
    <footer class="marketing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="logo-wordmark footer-logo">Postfolio</span>
          <p class="footer-tagline">Schema-driven internal tools for modern SMEs.</p>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">Product</p>
          <NuxtLink to="/features" class="footer-link">Features</NuxtLink>
          <NuxtLink to="/pricing"  class="footer-link">Pricing</NuxtLink>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">Company</p>
          <a href="#" class="footer-link">About</a>
          <a href="#" class="footer-link">Blog</a>
          <a href="#" class="footer-link">Contact</a>
        </div>

        <div class="footer-links-group">
          <p class="footer-col-title">Legal</p>
          <a href="#" class="footer-link">Privacy</a>
          <a href="#" class="footer-link">Terms</a>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© {{ new Date().getFullYear() }} Postfolio. All rights reserved.</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Shell ──────────────────────────────────────────── */
.marketing-shell {
  min-height: 100dvh;
  background: #fdf7f2;
  display: flex;
  flex-direction: column;
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
.marketing-nav.scrolled {
  background: rgba(253, 247, 242, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom-color: rgba(61, 24, 32, 0.08);
  box-shadow: 0 1px 12px rgba(61, 24, 32, 0.06);
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
  color: #3d1820;
  letter-spacing: -0.01em;
}
.footer-logo { font-size: 1.5rem; }

.logo-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e8748a;
  margin-bottom: 8px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.nav-link {
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(61, 24, 32, 0.65);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.nav-link:hover { color: #3d1820; background: rgba(61, 24, 32, 0.05); }
.nav-link.active { color: #3d1820; font-weight: 600; }

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.btn-ghost-sm {
  padding: 0.45rem 1.1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #3d1820;
  text-decoration: none;
  border: 1.5px solid rgba(61, 24, 32, 0.2);
  transition: border-color 0.15s, background 0.15s;
}
.btn-ghost-sm:hover { border-color: rgba(61, 24, 32, 0.45); background: rgba(61, 24, 32, 0.04); }

.btn-maroon-sm {
  padding: 0.45rem 1.1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #f5ede4;
  background: #3d1820;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-maroon-sm:hover  { opacity: 0.88; }
.btn-maroon-sm:active { transform: scale(0.97); }

/* ── Footer ─────────────────────────────────────────── */
.marketing-footer {
  margin-top: auto;
  border-top: 1px solid rgba(61, 24, 32, 0.1);
  background: #fff;
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
  color: rgba(61, 24, 32, 0.55);
  margin-top: 0.25rem;
  max-width: 220px;
}

.footer-links-group { display: flex; flex-direction: column; gap: 0.6rem; }

.footer-col-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(61, 24, 32, 0.4);
  margin-bottom: 0.25rem;
}

.footer-link {
  font-size: 0.9rem;
  color: rgba(61, 24, 32, 0.65);
  text-decoration: none;
  transition: color 0.15s;
}
.footer-link:hover { color: #3d1820; }

.footer-bottom {
  border-top: 1px solid rgba(61, 24, 32, 0.07);
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 2rem;
  font-size: 0.8rem;
  color: rgba(61, 24, 32, 0.4);
}

@media (max-width: 768px) {
  .footer-inner { grid-template-columns: 1fr 1fr; }
  .nav-links { display: none; }
}
</style>
