<script setup lang="ts">
const { t } = useLocale();
definePageMeta({ layout: 'default' });

usePageSeo({
  title: () => t('signup_title'),
  description: () => t('signup_subtitle'),
  path: '/signup',
  noindex: true,
});

await navigateTo('/login?mode=signup', { replace: true, redirectCode: 302 });
</script>

<template>
  <main class="signup-redirect-shell">
    <div class="signup-redirect-card">
      <h1 class="signup-redirect-title">{{ t('signup_title') }}</h1>
      <p class="signup-redirect-sub">{{ t('signup_subtitle') }}</p>
      <NuxtLink to="/login?mode=signup" class="m-btn-primary">
        {{ t('nav_getstarted') }}
      </NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.signup-redirect-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem;
  background: linear-gradient(160deg, var(--k-cream, #F6E6D7) 0%, var(--k-surface, #FFFFFF) 40%);
  color: var(--k-ink, #68293A);
}

.signup-redirect-card {
  max-width: 26rem;
  width: 100%;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: var(--k-radius-lg, 0.85rem);
  box-shadow: var(--k-shadow-lg, 0 8px 32px rgba(104, 41, 58, 0.1));
  padding: 2rem;
}

.signup-redirect-title {
  font-family: var(--k-font-serif, 'DM Serif Display', Georgia, serif);
  font-size: 1.65rem;
  font-weight: 400;
  margin: 0 0 0.5rem;
}

.signup-redirect-sub {
  font-size: 0.92rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0 0 1.25rem;
  line-height: 1.5;
}
</style>
