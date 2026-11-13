<script setup lang="ts">
interface ErrorPayload {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
}

const props = defineProps<{
  error: ErrorPayload;
}>();

const { t, loadLocale } = useLocale();
const route = useRoute();

const statusCode = computed(() => props.error?.statusCode || 500);
const is404 = computed(() => statusCode.value === 404);

usePageSeo({
  title: () => (is404.value ? t('error_404_title') : t('error_generic_title')),
  description: () => (is404.value ? t('error_404_body') : t('error_generic_body')),
  path: route.path || '/404',
  noindex: true,
});

onMounted(() => {
  loadLocale();
});

function handleNavigate(path: string) {
  clearError({ redirect: path });
}
</script>

<template>
  <div class="error-shell">
    <header class="error-header">
      <div class="error-nav-inner">
        <a href="/" class="error-brand" @click.prevent="handleNavigate('/')">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.75" />
            <rect x="4.5" y="4.5" width="5" height="5" fill="#E84A27" />
            <path d="M11.5 6H15.5M4.5 12.5H15.5M4.5 15.5H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" />
          </svg>
          <span>Kogane</span>
        </a>

        <nav class="error-nav-links" aria-label="Main navigation">
          <a href="/features" class="error-nav-link" @click.prevent="handleNavigate('/features')">
            {{ t('nav_features') }}
          </a>
          <a href="/pricing" class="error-nav-link" @click.prevent="handleNavigate('/pricing')">
            {{ t('nav_pricing') }}
          </a>
          <a href="/login" class="error-nav-link" @click.prevent="handleNavigate('/login')">
            {{ t('nav_signin') }}
          </a>
        </nav>
      </div>
    </header>

    <main class="error-main">
      <div class="error-card">
        <div class="error-code-col">
          <span class="error-code m-tabular m-mono">HTTP {{ statusCode }}</span>
        </div>

        <div class="error-copy-col">
          <h1 class="error-title">
            {{ is404 ? t('error_404_title') : t('error_generic_title') }}
          </h1>
          <p class="error-body">
            {{ is404 ? t('error_404_body') : t('error_generic_body') }}
          </p>

          <div class="error-actions">
            <button type="button" class="m-btn-primary" @click="handleNavigate('/')">
              {{ t('error_back_home') }}
            </button>
            <a href="/features" class="m-btn-secondary" @click.prevent="handleNavigate('/features')">
              {{ t('nav_features') }}
            </a>
            <a href="/pricing" class="m-btn-secondary" @click.prevent="handleNavigate('/pricing')">
              {{ t('nav_pricing') }}
            </a>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.error-shell {
  min-height: 100vh;
  background: var(--k-bg, #F4F3EF);
  color: var(--k-ink, #141414);
  font-family: var(--k-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
  display: flex;
  flex-direction: column;
}

.error-header {
  background: var(--k-surface, #FFFFFF);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.error-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.error-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--k-ink, #141414);
  text-decoration: none;
}

.error-nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.error-nav-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--k-muted, #52524E);
  text-decoration: none;
  transition: color 0.15s ease;
}

.error-nav-link:hover {
  color: var(--k-ink, #141414);
}

.error-main {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 4.5rem 2rem;
  display: flex;
  align-items: center;
}

.error-card {
  width: 100%;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, #DCDAD3);
  padding: 3rem;
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
  gap: 2.5rem;
  align-items: start;
}

.error-code {
  display: inline-block;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--k-accent, #E84A27);
}

.error-title {
  margin: 0 0 0.875rem;
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: var(--k-ink, #141414);
}

.error-body {
  margin: 0 0 2rem;
  max-width: 56ch;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--k-muted, #52524E);
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media (max-width: 768px) {
  .error-nav-inner,
  .error-main {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }

  .error-main {
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }

  .error-card {
    grid-template-columns: minmax(0, 1fr);
    padding: 1.75rem 1.25rem;
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .error-nav-links {
    gap: 0.875rem;
  }

  .error-nav-link {
    font-size: 0.8125rem;
  }
}
</style>
