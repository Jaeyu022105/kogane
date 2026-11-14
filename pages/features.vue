<script setup lang="ts">
const { t } = useLocale();
const { isLoggedIn } = useAuth();
definePageMeta({ layout: 'marketing' });

usePageSeo({
  title: () => t('feat_seo_title'),
  description: () => t('feat_hero_sub'),
  path: '/features',
  jsonLd: () => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('feat_seo_title'),
    description: t('feat_hero_sub'),
  }),
});

/* Interactive Guided Setup specimen */
type SampleIndustry = 'restaurant' | 'logistics' | 'retail' | 'clinic';
const selectedIndustry = ref<SampleIndustry>('restaurant');

const setupIndustryOptions = computed(() => [
  {
    id: 'restaurant' as SampleIndustry,
    label: t('ind_restaurant_label'),
    currency: 'USD $',
    stations: ['Front Counter POS', 'Menu Catalog', 'Kitchen Queue', 'Stock Room'],
  },
  {
    id: 'logistics' as SampleIndustry,
    label: t('ind_logistics_label'),
    currency: 'USD $',
    stations: ['Dispatch Console', 'Warehouse Stock', 'Driver Roster', 'Fleet Reports'],
  },
  {
    id: 'retail' as SampleIndustry,
    label: t('ind_retail_label'),
    currency: 'USD $',
    stations: ['Cashier Register', 'Product Catalog', 'Receiving Desk', 'Sales Reports'],
  },
  {
    id: 'clinic' as SampleIndustry,
    label: t('ind_clinic_label'),
    currency: 'USD $',
    stations: ['Patient Intake', 'Staff Directory', 'Supply Desk', 'Patient Billing'],
  },
]);

const activeIndustrySpec = computed(() =>
  setupIndustryOptions.value.find((opt) => opt.id === selectedIndustry.value) ?? setupIndustryOptions.value[0],
);

/* Interactive Style Preset specimen */
type StyleId = 'warm' | 'compact' | 'contrast' | 'editorial';
const activeStyle = ref<StyleId>('warm');

const styleOptions = computed(() => [
  { id: 'warm' as StyleId, label: t('style_warm_label'), desc: t('style_warm_desc') },
  { id: 'compact' as StyleId, label: t('style_compact_label'), desc: t('style_compact_desc') },
  { id: 'contrast' as StyleId, label: t('style_contrast_label'), desc: t('style_contrast_desc') },
  { id: 'editorial' as StyleId, label: t('style_editorial_label'), desc: t('style_editorial_desc') },
]);

const activeStyleSpec = computed(() =>
  styleOptions.value.find((s) => s.id === activeStyle.value) ?? styleOptions.value[0],
);

const schemaMappings = [
  { table: 'orders', station: 'TRM-POS-01 · Counter POS', version: 'v2.4' },
  { table: 'deliveries', station: 'TRM-DSP-02 · Dispatch Console', version: 'v2.4' },
  { table: 'inventory', station: 'TRM-INV-03 · Stock Receiving', version: 'v2.4' },
  { table: 'appointments', station: 'TRM-APT-04 · Intake Desk', version: 'v2.4' },
];

const auditSamples = [
  { time: '14:22', actor: 'Platform', action: 'preset:sync', target: 'v2.4 across 4 terminals' },
  { time: '14:18', actor: 'Cashier 01', action: 'order:insert', target: 'ORD-108 · $19.50' },
  { time: '14:05', actor: 'Owner', action: 'terminal:layout', target: 'TRM-POS-01 saved' },
];

const extras = computed(() => [
  { title: t('extra_role_title'), body: t('extra_role_body') },
  { title: t('extra_theme_title'), body: t('extra_theme_body') },
  { title: t('extra_mobile_title'), body: t('extra_mobile_body') },
  { title: t('extra_zap_title'), body: t('extra_zap_body') },
  { title: t('extra_data_title'), body: t('extra_data_body') },
  { title: t('extra_link_title'), body: t('extra_link_body') },
]);
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="feat-hero">
      <div class="m-inner feat-hero-grid">
        <div class="feat-hero-intro">
          <p class="m-sub">{{ t('feat_hero_sub') }}</p>
          <div class="feat-hero-actions">
            <NuxtLink :to="isLoggedIn ? '/dashboard' : '/login?mode=signup'" class="m-btn-primary">
              {{ isLoggedIn ? t('nav_dashboard') : t('feat_cta_btn1') }}
            </NuxtLink>
            <NuxtLink to="/pricing" class="m-btn-secondary">
              {{ t('feat_cta_btn2') }}
            </NuxtLink>
          </div>
        </div>
        <div>
          <h1 class="m-heading-lg">{{ t('feat_hero_heading') }}</h1>
        </div>
      </div>
    </section>

    <!-- Architecture Modules -->
    <section class="module-band module-band--surface">
      <div class="m-inner module-grid">
        <div class="module-copy">
          <h2 class="m-heading">{{ t('mod_01_title') }}</h2>
          <p class="m-sub module-body">{{ t('mod_01_body') }}</p>
          <ul class="module-list">
            <li>{{ t('mod_01_p1') }}</li>
            <li>{{ t('mod_01_p2') }}</li>
            <li>{{ t('mod_01_p3') }}</li>
            <li>{{ t('mod_01_p4') }}</li>
          </ul>
        </div>

        <div class="specimen-box">
          <div class="specimen-head">
            <span class="specimen-title">{{ t('onboarding_industry') }}</span>
            <span class="specimen-meta m-mono">{{ activeIndustrySpec.currency }} · #E84A27</span>
          </div>
          <div class="industry-switch-grid">
            <button
              v-for="opt in setupIndustryOptions"
              :key="opt.id"
              type="button"
              class="spec-btn"
              :class="{ active: selectedIndustry === opt.id }"
              @click="selectedIndustry = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
          <div class="specimen-rows">
            <div v-for="station in activeIndustrySpec.stations" :key="station" class="specimen-row">
              <span>{{ station }}</span>
              <span class="m-mono specimen-tag">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="module-band module-band--paper">
      <div class="m-inner module-grid module-grid--reverse">
        <div class="module-copy">
          <h2 class="m-heading">{{ t('mod_02_title') }}</h2>
          <p class="m-sub module-body">{{ t('mod_02_body') }}</p>
          <ul class="module-list">
            <li>{{ t('mod_02_p1') }}</li>
            <li>{{ t('mod_02_p2') }}</li>
            <li>{{ t('mod_02_p3') }}</li>
            <li>{{ t('mod_02_p4') }}</li>
          </ul>
        </div>

        <div class="specimen-box">
          <div class="specimen-head">
            <span class="specimen-title">Preset table bindings</span>
            <span class="specimen-meta m-mono">Auto-synced</span>
          </div>
          <div class="specimen-rows">
            <div v-for="map in schemaMappings" :key="map.table" class="specimen-row">
              <span class="m-mono specimen-code">{{ map.table }}</span>
              <span class="specimen-station">{{ map.station }}</span>
              <span class="m-mono specimen-ver">{{ map.version }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="module-band module-band--surface">
      <div class="m-inner module-grid">
        <div class="module-copy">
          <h2 class="m-heading">{{ t('mod_03_title') }}</h2>
          <p class="m-sub module-body">{{ t('mod_03_body') }}</p>
          <ul class="module-list">
            <li>{{ t('mod_03_p1') }}</li>
            <li>{{ t('mod_03_p2') }}</li>
            <li>{{ t('mod_03_p3') }}</li>
            <li>{{ t('mod_03_p4') }}</li>
          </ul>
        </div>

        <div class="specimen-box">
          <div class="specimen-head">
            <span class="specimen-title">Interface treatment</span>
            <span class="specimen-meta">{{ activeStyleSpec.label }}</span>
          </div>
          <div class="style-switch-row">
            <button
              v-for="style in styleOptions"
              :key="style.id"
              type="button"
              class="spec-btn"
              :class="{ active: activeStyle === style.id }"
              @click="activeStyle = style.id"
            >
              {{ style.label }}
            </button>
          </div>
          <div class="style-preview" :class="`style-preview--${activeStyle}`">
            <div class="style-preview-head">
              <strong>Front Counter · TRM-POS-01</strong>
              <span class="m-mono m-tabular">$24.50</span>
            </div>
            <p class="style-preview-desc">{{ activeStyleSpec.desc }}</p>
            <div class="style-preview-line">
              <span>2 × House Latte</span>
              <span class="m-tabular">$11.00</span>
            </div>
            <div class="style-preview-line">
              <span>1 × Almond Tart</span>
              <span class="m-tabular">$5.50</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="module-band module-band--paper">
      <div class="m-inner module-grid module-grid--reverse">
        <div class="module-copy">
          <h2 class="m-heading">{{ t('mod_04_title') }}</h2>
          <p class="m-sub module-body">{{ t('mod_04_body') }}</p>
          <ul class="module-list">
            <li>{{ t('mod_04_p1') }}</li>
            <li>{{ t('mod_04_p2') }}</li>
            <li>{{ t('mod_04_p3') }}</li>
            <li>{{ t('mod_04_p4') }}</li>
          </ul>
        </div>

        <div class="specimen-box">
          <div class="specimen-head">
            <span class="specimen-title">Live audit & rollout trail</span>
            <span class="specimen-meta m-mono">PIN + Role Scoped</span>
          </div>
          <div class="specimen-rows">
            <div v-for="entry in auditSamples" :key="entry.time + entry.action" class="specimen-row audit-sample-row">
              <span class="m-mono m-tabular specimen-code">{{ entry.time }}</span>
              <span class="m-mono specimen-action">{{ entry.action }}</span>
              <span class="specimen-station">{{ entry.target }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Operational Guarantees -->
    <section class="extras-section">
      <div class="m-inner">
        <div class="extras-header">
          <h2 class="m-heading">{{ t('extra_heading') }}</h2>
          <p class="m-sub">{{ t('extra_sub') }}</p>
        </div>

        <div class="extras-list">
          <div v-for="ex in extras" :key="ex.title" class="extra-item">
            <h3 class="extra-title">{{ ex.title }}</h3>
            <p class="extra-body">{{ ex.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Closing CTA -->
    <section class="m-cta-strip-dark">
      <div class="m-cta-inner feat-cta-layout">
        <div>
          <h2 class="m-cta-heading-light">{{ t('feat_cta_heading') }}</h2>
          <p class="m-cta-sub-light" style="margin-bottom: 0;">{{ t('feat_cta_sub') }}</p>
        </div>
        <div class="m-cta-btns">
          <NuxtLink :to="isLoggedIn ? '/dashboard' : '/login?mode=signup'" class="m-btn-primary">
            {{ isLoggedIn ? t('nav_dashboard') : t('feat_cta_btn1') }}
          </NuxtLink>
          <NuxtLink to="/pricing" class="m-btn-ghost on-dark">
            {{ t('feat_cta_btn2') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Hero */
.feat-hero {
  background: var(--k-bg, #F4F3EF);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  padding: clamp(3rem, 7vw, 5rem) 0;
}

.feat-hero-grid {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: clamp(2rem, 5vw, 4rem);
  align-items: start;
}

.feat-hero-intro {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.feat-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* Module bands */
.module-band {
  padding: clamp(3rem, 6vw, 4.75rem) 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.module-band--surface {
  background: var(--k-surface, #FFFFFF);
}

.module-band--paper {
  background: var(--k-bg, #F4F3EF);
}

.module-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 5vw, 4rem);
  align-items: center;
}

.module-grid--reverse .module-copy {
  order: 2;
}

.module-grid--reverse .specimen-box {
  order: 1;
}

.module-body {
  margin-bottom: 1.5rem;
}

.module-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.module-list li {
  padding: 0.72rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.925rem;
  line-height: 1.5;
  color: var(--k-ink, #141414);
}

/* Product Specimens */
.specimen-box {
  border: 1px solid var(--k-border, #DCDAD3);
  background: var(--k-bg, #F4F3EF);
  border-radius: 3px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.module-band--paper .specimen-box {
  background: var(--k-surface, #FFFFFF);
}

.specimen-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.specimen-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.specimen-meta {
  font-size: 0.78rem;
  color: var(--k-muted, #52524E);
}

.industry-switch-grid,
.style-switch-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.spec-btn {
  padding: 0.52rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 500;
  text-align: left;
  background: var(--k-surface, #FFFFFF);
  color: var(--k-ink, #141414);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.spec-btn:hover {
  border-color: var(--k-ink, #141414);
}

.spec-btn.active {
  background: var(--k-ink, #141414);
  color: var(--k-surface, #FFFFFF);
  border-color: var(--k-ink, #141414);
}

.spec-btn:focus-visible {
  outline: 2px solid var(--k-accent, #E84A27);
  outline-offset: 2px;
}

.specimen-rows {
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.specimen-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.86rem;
  color: var(--k-ink, #141414);
  flex-wrap: wrap;
}

.specimen-code {
  font-size: 0.78rem;
  color: var(--k-muted, #52524E);
}

.specimen-station {
  flex: 1;
  min-width: 120px;
}

.specimen-tag,
.specimen-ver {
  font-size: 0.76rem;
  color: var(--k-accent, #E84A27);
  font-weight: 600;
}

.specimen-action {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--k-accent, #E84A27);
}

/* Interactive style preview */
.style-preview {
  padding: 1rem;
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  background: var(--k-surface, #FFFFFF);
  color: var(--k-ink, #141414);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.style-preview--compact {
  padding: 0.7rem 0.85rem;
  gap: 0.3rem;
  font-size: 0.84rem;
}

.style-preview--contrast {
  background: var(--k-dark, #141414);
  color: var(--k-on-dark, #F4F3EF);
  border-color: var(--k-dark, #141414);
}

.style-preview--editorial {
  padding: 1.25rem;
  gap: 0.75rem;
}

.style-preview-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.9rem;
}

.style-preview-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--k-muted, #52524E);
  line-height: 1.45;
}

.style-preview--contrast .style-preview-desc {
  color: var(--k-on-dark-muted, #A8A69E);
}

.style-preview-line {
  display: flex;
  justify-content: space-between;
  padding-top: 0.45rem;
  border-top: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.84rem;
}

.style-preview--contrast .style-preview-line {
  border-top-color: #2E2E2B;
}

/* Operational Guarantees */
.extras-section {
  background: var(--k-surface, #FFFFFF);
  padding: clamp(3rem, 6vw, 5rem) 0;
}

.extras-header {
  max-width: 660px;
  margin-bottom: 2.5rem;
}

.extras-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--k-ink, #141414);
}

.extra-item {
  padding: 1.5rem 1.5rem 1.5rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.extra-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
  margin: 0 0 0.45rem;
}

.extra-body {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--k-muted, #52524E);
  margin: 0;
}

/* Closing layout */
.feat-cta-layout {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 900px) {
  .feat-hero-grid,
  .module-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .feat-hero-intro {
    order: 2;
  }

  .module-grid--reverse .module-copy,
  .module-grid--reverse .specimen-box {
    order: initial;
  }

  .extras-list {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 600px) {
  .extras-list {
    grid-template-columns: 1fr;
  }

  .extra-item {
    padding-right: 0;
  }

  .industry-switch-grid,
  .style-switch-row {
    grid-template-columns: 1fr;
  }
}
</style>
