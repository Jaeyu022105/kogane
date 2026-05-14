<script setup lang="ts">
const { t } = useLocale();
definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title:       `${t('terms_title')} - Kogane`,
  description: t('terms_agreement_body'),
});
</script>

<template>
  <div class="legal-page">
    <div class="legal-header">
      <div class="legal-container">
        <h1 class="m-heading">{{ t('terms_title') }}</h1>
        <p class="m-sub">{{ t('terms_last_updated') }}</p>
      </div>
    </div>
    
    <div class="legal-container legal-content">
      <h2>{{ t('terms_agreement_title') }}</h2>
      <p>{{ t('terms_agreement_body') }}</p>
      
      <h2>{{ t('terms_license_title') }}</h2>
      <p>{{ t('terms_license_body') }}</p>
      <ul>
        <li>{{ t('terms_license_p1') }}</li>
        <li>{{ t('terms_license_p2') }}</li>
        <li>{{ t('terms_license_p3') }}</li>
        <li>{{ t('terms_license_p4') }}</li>
        <li>{{ t('terms_license_p5') }}</li>
      </ul>
      <p>{{ t('terms_license_footer') }}</p>
      
      <h2>{{ t('terms_disclaimer_title') }}</h2>
      <p>{{ t('terms_disclaimer_body') }}</p>
      
      <h2>{{ t('terms_limitations_title') }}</h2>
      <p>{{ t('terms_limitations_body') }}</p>

      <h2>{{ t('terms_limits_title') }}</h2>
      <p>{{ t('terms_limits_body') }}</p>
      
      <h2>{{ t('terms_revisions_title') }}</h2>
      <p>{{ t('terms_revisions_body') }}</p>
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
}

.legal-content p {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(104, 41, 58, 0.7);
  margin-bottom: 1.2rem;
}

.legal-content ul {
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
}

.legal-content li {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(104, 41, 58, 0.7);
  margin-bottom: 0.5rem;
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
  color: rgba(104, 41, 58, 0.5);
  margin: 0;
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
