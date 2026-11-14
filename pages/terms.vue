<script setup lang="ts">
const { t } = useLocale();
definePageMeta({ layout: 'marketing' });

usePageSeo({
  title: () => t('terms_title'),
  description: () => t('terms_agreement_body'),
  path: '/terms',
  ogType: 'article',
});

const licenseItems = computed(() => [
  t('terms_license_p1'),
  t('terms_license_p2'),
  t('terms_license_p3'),
  t('terms_license_p4'),
  t('terms_license_p5'),
]);
</script>

<template>
  <div class="legal-page">
    <header class="legal-header">
      <div class="m-inner">
        <div class="legal-hero-grid">
          <div>
            <h1 class="m-heading">{{ t('terms_title') }}</h1>
          </div>
          <div class="legal-hero-meta">
            <p class="legal-updated">{{ t('terms_last_updated') }}</p>
            <p class="legal-lead">{{ t('terms_agreement_body') }}</p>
          </div>
        </div>
      </div>
    </header>

    <article class="legal-body">
      <div class="m-inner">
        <section class="legal-section">
          <h2>{{ t('terms_agreement_title') }}</h2>
          <div class="legal-prose">
            <p>{{ t('terms_agreement_body') }}</p>
          </div>
        </section>

        <section class="legal-section">
          <h2>{{ t('terms_license_title') }}</h2>
          <div class="legal-prose">
            <p>{{ t('terms_license_body') }}</p>
            <ul class="legal-list">
              <li v-for="(item, idx) in licenseItems" :key="idx">{{ item }}</li>
            </ul>
            <p class="legal-prose-after">{{ t('terms_license_footer') }}</p>
          </div>
        </section>

        <section class="legal-section">
          <h2>{{ t('terms_disclaimer_title') }}</h2>
          <div class="legal-prose">
            <p>{{ t('terms_disclaimer_body') }}</p>
          </div>
        </section>

        <section class="legal-section">
          <h2>{{ t('terms_limitations_title') }}</h2>
          <div class="legal-prose">
            <p>{{ t('terms_limitations_body') }}</p>
          </div>
        </section>

        <section class="legal-section">
          <h2>{{ t('terms_limits_title') }}</h2>
          <div class="legal-prose">
            <p>{{ t('terms_limits_body') }}</p>
          </div>
        </section>

        <section class="legal-section">
          <h2>{{ t('terms_revisions_title') }}</h2>
          <div class="legal-prose">
            <p>{{ t('terms_revisions_body') }}</p>
          </div>
        </section>

        <nav class="legal-cross-nav" aria-label="Related documentation">
          <NuxtLink to="/privacy" class="legal-cross-link">{{ t('footer_privacy') }} →</NuxtLink>
          <NuxtLink to="/features" class="legal-cross-link">{{ t('nav_features') }} →</NuxtLink>
          <NuxtLink to="/pricing" class="legal-cross-link">{{ t('nav_pricing') }} →</NuxtLink>
        </nav>
      </div>
    </article>
  </div>
</template>

<style scoped>
.legal-page {
  background: var(--k-surface, #FFFFFF);
  color: var(--k-ink, #68293A);
}

.legal-header {
  background: linear-gradient(180deg, var(--k-cream, #F6E6D7) 0%, var(--k-surface-alt, #FBF4ED) 100%);
  border-bottom: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  padding: 4.5rem 0 3.25rem;
}

.legal-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 2.5rem;
  align-items: end;
}

.legal-updated {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
}

.legal-lead {
  margin: 0;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

.legal-body {
  background: var(--k-surface, #FFFFFF);
  padding: 2rem 0 5rem;
}

.legal-section {
  display: grid;
  grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
  gap: 2.5rem;
  padding: 2.25rem 0;
  border-bottom: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  align-items: start;
}

.legal-section h2 {
  margin: 0;
  font-family: var(--k-font-serif, 'DM Serif Display', Georgia, serif);
  font-size: 1.35rem;
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: -0.005em;
  color: var(--k-ink, #68293A);
}

.legal-prose p {
  margin: 0 0 1rem;
  max-width: 66ch;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

.legal-prose p:last-child {
  margin-bottom: 0;
}

.legal-prose-after {
  margin-top: 1.25rem !important;
}

.legal-list {
  margin: 1rem 0 0;
  padding-left: 1.25rem;
  max-width: 66ch;
}

.legal-list li {
  font-size: 0.96875rem;
  line-height: 1.68;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin-bottom: 0.65rem;
}

.legal-list li:last-child {
  margin-bottom: 0;
}

.legal-cross-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-top: 2.25rem;
}

.legal-cross-link {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
  text-decoration: none;
  border-bottom: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  padding-bottom: 2px;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.legal-cross-link:hover {
  color: var(--k-accent, #FF5776);
  border-color: var(--k-accent, #FF5776);
}

@media (max-width: 768px) {
  .legal-header {
    padding: 3rem 0 2.25rem;
  }

  .legal-hero-grid,
  .legal-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .legal-section {
    padding: 1.75rem 0;
  }
}
</style>
