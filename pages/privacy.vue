<script setup lang="ts">
const { t } = useLocale();
const { isEnabled } = useFeatureFlags();
definePageMeta({ layout: 'marketing' });

usePageSeo({
  title: () => t('privacy_title'),
  description: () => t('privacy_intro_body'),
  path: '/privacy',
  ogType: 'article',
});

interface TextSegment {
  text: string;
  strong: boolean;
}

function parseStrongSegments(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<strong>([\s\S]*?)<\/strong>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index), strong: false });
    }
    segments.push({ text: match[1], strong: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex), strong: false });
  }

  return segments.length > 0 ? segments : [{ text: raw, strong: false }];
}

const dataItems = computed(() => [
  parseStrongSegments(t('privacy_data_identity')),
  parseStrongSegments(t('privacy_data_contact')),
  parseStrongSegments(t('privacy_data_financial')),
  parseStrongSegments(t('privacy_data_technical')),
]);

const usageItems = computed(() => [
  t('privacy_usage_c1'),
  t('privacy_usage_c2'),
  t('privacy_usage_c3'),
]);
</script>

<template>
  <div class="legal-page">
    <div class="legal-header">
      <div class="legal-container">
        <h1 class="m-heading">{{ t('privacy_title') }}</h1>
        <p class="m-sub">{{ t('privacy_last_updated') }}</p>
      </div>
    </div>

    <div class="legal-container legal-content">
      <h2>{{ t('privacy_intro_title') }}</h2>
      <p>{{ t('privacy_intro_body') }}</p>

      <h2>{{ t('privacy_data_title') }}</h2>
      <p>{{ t('privacy_data_body') }}</p>
      <ul>
        <li v-for="(segments, idx) in dataItems" :key="idx">
          <template v-for="(seg, segIdx) in segments" :key="segIdx">
            <strong v-if="seg.strong">{{ seg.text }}</strong>
            <template v-else>{{ seg.text }}</template>
          </template>
        </li>
      </ul>

      <h2>{{ t('privacy_usage_title') }}</h2>
      <p>{{ t('privacy_usage_body') }}</p>
      <ul>
        <li v-for="(item, idx) in usageItems" :key="idx">{{ item }}</li>
      </ul>

      <h2>{{ t('privacy_security_title') }}</h2>
      <p>{{ t('privacy_security_body') }}</p>

      <h2>{{ t('privacy_retention_title') }}</h2>
      <p>{{ t('privacy_retention_body') }}</p>

      <h2>{{ t('privacy_rights_title') }}</h2>
      <p>{{ t('privacy_rights_body') }}</p>

      <nav class="legal-cross-nav" aria-label="Related documentation">
        <NuxtLink to="/terms" class="legal-cross-link">{{ t('footer_terms') }} &rarr;</NuxtLink>
        <NuxtLink to="/features" class="legal-cross-link">{{ t('nav_features') }} &rarr;</NuxtLink>
        <NuxtLink v-if="isEnabled('pricing')" to="/pricing" class="legal-cross-link">{{ t('nav_pricing') }} &rarr;</NuxtLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  padding-bottom: 6rem;
}

.legal-header {
  background: linear-gradient(180deg, rgba(104, 41, 58, 0.03) 0%, transparent 100%);
  padding: 4rem 0 2.5rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.06);
  margin-bottom: 3rem;
}

.legal-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;
}

.legal-content h2 {
  font-family: 'DM Serif Display', serif;
  font-size: 1.6rem;
  color: #68293A;
  margin: 2.5rem 0 1rem;
  font-weight: 400;
}

.legal-content p {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(104, 41, 58, 0.72);
  margin-bottom: 1.2rem;
}

.legal-content ul {
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
}

.legal-content li {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(104, 41, 58, 0.72);
  margin-bottom: 0.5rem;
}

.legal-content li strong {
  color: #68293A;
}

.m-heading {
  font-family: 'DM Serif Display', serif;
  font-size: 2.5rem;
  color: #68293A;
  margin-bottom: 0.5rem;
  font-weight: 400;
}

.m-sub {
  font-size: 1rem;
  color: rgba(104, 41, 58, 0.65);
  margin: 0;
}

.legal-cross-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-top: 2.25rem;
  margin-top: 2.5rem;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
}

.legal-cross-link {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #68293A;
  text-decoration: none;
  border-bottom: 1px solid rgba(104, 41, 58, 0.14);
  padding-bottom: 2px;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.legal-cross-link:hover {
  color: #FF5776;
  border-color: #FF5776;
}

@media (max-width: 768px) {
  .legal-header {
    padding: 3rem 0 2rem;
  }
  .m-heading {
    font-size: 2.2rem;
  }
  .legal-content h2 {
    font-size: 1.4rem;
  }
}
</style>
