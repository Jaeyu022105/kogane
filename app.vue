<script setup lang="ts">
/**
 * Root app entry — loads auth session, syncs HTML lang & Search Console tags,
 * protects private runtime routes from indexing, and emits base Organization/WebSite JSON-LD.
 */
import { serializeJsonLd, useSiteOrigin } from '~/composables/useSeo';

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const siteOrigin = useSiteOrigin();
const { hydrateSession } = useAuth();
const { locale, loadLocale } = useLocale();

const htmlLang = computed(() => (locale.value === 'ph' ? 'fil' : locale.value || 'en'));

const isPrivateRoute = computed(() => {
  const path = route.path || '/';
  return (
    path === '/dashboard'
    || path.startsWith('/dashboard/')
    || path === '/terminal'
    || path.startsWith('/terminal/')
    || path === '/t'
    || path.startsWith('/t/')
    || path === '/signup'
    || path.startsWith('/signup/')
  );
});

const verificationMeta = computed(() => {
  const tags: Array<{ name: string; content: string }> = [];
  const google = String(runtimeConfig.public?.googleSiteVerification || '').trim();
  const bing = String(runtimeConfig.public?.bingSiteVerification || '').trim();
  if (google) tags.push({ name: 'google-site-verification', content: google });
  if (bing) tags.push({ name: 'msvalidate.01', content: bing });
  if (isPrivateRoute.value) tags.push({ name: 'robots', content: 'noindex, nofollow' });
  return tags;
});

const baseSchemas = computed(() => {
  if (isPrivateRoute.value) return [];
  const origin = siteOrigin.value;
  return [
    {
      key: 'ldjson-organization',
      type: 'application/ld+json',
      innerHTML: serializeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'Kogane',
        url: origin,
        logo: `${origin}/apple-touch-icon.png`,
        description: 'Lightweight managed Terminal Builder SaaS for everyday businesses.',
      }),
    },
    {
      key: 'ldjson-website',
      type: 'application/ld+json',
      innerHTML: serializeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'Kogane',
        url: origin,
        publisher: {
          '@id': `${origin}/#organization`,
        },
      }),
    },
  ];
});

useHead(() => ({
  htmlAttrs: {
    lang: htmlLang.value,
  },
  titleTemplate: (titleChunk?: string) => {
    const trimmed = titleChunk?.trim();
    if (!trimmed) return 'Kogane — Managed Terminal Builder';
    if (/\bkogane\b/i.test(trimmed)) return trimmed;
    return `${trimmed} — Kogane`;
  },
  meta: verificationMeta.value,
  script: baseSchemas.value,
}));

onMounted(() => {
  loadLocale();
  void hydrateSession();
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ModalHost />
</template>
