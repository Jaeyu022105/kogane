<script setup lang="ts">
import type { Component } from 'vue';
import BoltIcon from 'reicon-vue/icons/Bolt';
import CoffeeIcon from 'reicon-vue/icons/Coffee';
import DocumentTextIcon from 'reicon-vue/icons/DocumentText';
import DollarCircleIcon from 'reicon-vue/icons/DollarCircle';
import HeartPulseIcon from 'reicon-vue/icons/HeartPulse';
import HomeIcon from 'reicon-vue/icons/Home';
import ListCheckIcon from 'reicon-vue/icons/ListCheck';
import PackageIcon from 'reicon-vue/icons/Package';
import ShoppingBagIcon from 'reicon-vue/icons/ShoppingBag';
import TerminalSquareIcon from 'reicon-vue/icons/TerminalSquare';

const { t } = useLocale();
const { isEnabled } = useFeatureFlags();
const { isLoggedIn, hydrateSession } = useAuth();
definePageMeta({ layout: 'marketing' });

usePageSeo({
  title: () => t('seo_home_title'),
  description: () => t('seo_home_description'),
  path: '/',
  jsonLd: () => [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Kogane',
      description: t('seo_home_description'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Kogane Terminal Builder',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: t('seo_home_description'),
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
});

onMounted(() => {
  void hydrateSession();
});

/* ── Industry chip icons (Reicon outline) ─────────────────── */
const industryIcons: Record<string, Component> = {
  restaurant: CoffeeIcon,
  logistics:  PackageIcon,
  retail:     ShoppingBagIcon,
  healthcare: HeartPulseIcon,
  construct:  HomeIcon,
  finance:    DollarCircleIcon,
};

const industries = computed(() => [
  { iconKey: 'restaurant', name: t('ind_restaurant') },
  { iconKey: 'logistics',  name: t('ind_logistics')  },
  { iconKey: 'retail',     name: t('ind_retail')     },
  { iconKey: 'healthcare', name: t('ind_healthcare') },
  { iconKey: 'construct',  name: t('ind_construct')  },
  { iconKey: 'finance',    name: t('ind_finance')    },
]);

/* ── Pillar card icons (Reicon outline) ───────────────────── */
const pillarIcons: Record<string, Component> = {
  schema:   ListCheckIcon,
  builder:  BoltIcon,
  terminal: TerminalSquareIcon,
  onboard:  DocumentTextIcon,
};

const pillars = computed(() => [
  { iconKey: 'onboard',  title: t('pillar_setup_title'),    body: t('pillar_setup_body') },
  { iconKey: 'schema',   title: t('pillar_schema_title'),   body: t('pillar_schema_body') },
  { iconKey: 'builder',  title: t('pillar_builder_title'),  body: t('pillar_builder_body') },
  { iconKey: 'terminal', title: t('pillar_terminal_title'), body: t('pillar_terminal_body') },
]);

/* ── Directory & Comparison Data ─────────────────────────── */
const comparisons = computed(() => [
  {
    title: t('index_compare_1_title'),
    body: t('index_compare_1_body'),
  },
  {
    title: t('index_compare_2_title'),
    body: t('index_compare_2_body'),
  },
  {
    title: t('index_compare_3_title'),
    body: t('index_compare_3_body'),
  },
]);

const directoryRows = computed(() => [
  {
    industry: t('ind_restaurant_label'),
    presets: t('index_dir_restaurant_presets'),
    tables: t('index_dir_restaurant_tables'),
  },
  {
    industry: t('ind_logistics_label'),
    presets: t('index_dir_logistics_presets'),
    tables: t('index_dir_logistics_tables'),
  },
  {
    industry: t('ind_retail_label'),
    presets: t('index_dir_retail_presets'),
    tables: t('index_dir_retail_tables'),
  },
  {
    industry: t('ind_clinic_label'),
    presets: t('index_dir_clinic_presets'),
    tables: t('index_dir_clinic_tables'),
  },
  {
    industry: t('ind_services_label'),
    presets: t('index_dir_services_presets'),
    tables: t('index_dir_services_tables'),
  },
  {
    industry: t('ind_accounting_label'),
    presets: t('index_dir_accounting_presets'),
    tables: t('index_dir_accounting_tables'),
  },
]);
</script>

<template>
  <div class="home">
    <!-- Hero: the editorial headline split on a faded Neapolitan backdrop, then the live previews -->
    <section class="hero">
      <HomeHeroCollage>
        <div class="hero-inner">
          <div class="hero-lede">
            <div class="hero-badge">
              <span class="badge-dot" aria-hidden="true" />
              {{ t('index_hero_badge') }}
            </div>

            <p class="hero-sub">
              {{ t('index_hero_sub') }}
            </p>
          </div>

          <h1 class="hero-headline">{{ t('index_hero_headline') }}</h1>

          <ul class="hero-facts">
            <li>{{ t('index_hero_fact1') }}</li>
            <li>{{ t('index_hero_fact2') }}</li>
            <li>{{ t('index_hero_fact3') }}</li>
          </ul>

          <div class="hero-cta">
            <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary ribbon">{{ t('index_dashboard_cta') }}</NuxtLink>
            <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">{{ t('index_hero_cta1') }}</NuxtLink>
            <NuxtLink v-if="isEnabled('pricing')" to="/pricing" class="m-btn-secondary">{{ t('index_cta_btn2') }}</NuxtLink>
            <NuxtLink to="/features" class="m-btn-ghost">{{ t('index_hero_cta2') }}</NuxtLink>
          </div>
        </div>
      </HomeHeroCollage>
    </section>

    <!-- Industry strip -->
    <section class="section-industries industries-strip">
      <div class="section-inner">
        <div class="section-rule">
          <p class="m-overline">{{ t('index_industry_overline') }}</p>
        </div>
        <div class="industry-grid">
          <div v-for="ind in industries" :key="ind.name" class="industry-chip">
            <span class="chip-icon" aria-hidden="true">
              <component :is="industryIcons[ind.iconKey]" />
            </span>
            <span>{{ ind.name }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Pillars -->
    <section class="section-pillars">
      <div class="section-inner">
        <div class="section-rule">
          <p class="m-overline">{{ t('index_pillars_overline') }}</p>
        </div>
        <div class="m-label-block">
          <h2 class="m-heading">{{ t('index_pillars_heading') }}</h2>
          <p class="m-sub">{{ t('index_pillars_sub') }}</p>
        </div>
        <div class="pillar-grid">
          <div v-for="(p, pillarIndex) in pillars" :key="p.title" class="pillar-card">
            <div class="pillar-top">
              <span class="pillar-number m-mono m-tabular">{{ String(pillarIndex + 1).padStart(2, '0') }}</span>
              <span class="pillar-icon" aria-hidden="true">
                <component :is="pillarIcons[p.iconKey]" />
              </span>
            </div>
            <h3 class="pillar-title">{{ p.title }}</h3>
            <p class="pillar-body">{{ p.body }}</p>
            <NuxtLink to="/features" class="pillar-link">{{ t('index_pillars_learn_more') }}</NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive terminal preset explorer -->
    <HomePresetExplorer />

    <!-- Philosophy: statement and comparison list, then the 2x2 flavour cards -->
    <section class="section-philosophy">
      <div class="section-inner">
        <div class="section-rule">
          <p class="m-overline">{{ t('index_philosophy_overline') }}</p>
        </div>

        <div class="philosophy-inner">
          <div class="philosophy-text">
            <h2 class="m-heading">{{ t('index_philosophy_heading') }}</h2>
            <p class="m-sub">
              {{ t('index_philosophy_sub') }}
            </p>

            <NuxtLink to="/features" class="m-btn-secondary philosophy-cta">
              {{ t('index_philosophy_cta') }}
            </NuxtLink>
          </div>

          <div class="comparison-list">
            <div v-for="item in comparisons" :key="item.title" class="comparison-row">
              <h3 class="comparison-title">{{ item.title }}</h3>
              <p class="comparison-body">{{ item.body }}</p>
            </div>
          </div>
        </div>

        <div class="philosophy-badges">
          <div class="badge-card badge-plain">
            <h3 class="badge-title">{{ t('badge_preset_title') }}</h3>
            <p class="badge-body">{{ t('badge_preset_body') }}</p>
          </div>
          <div class="badge-card badge-dark">
            <h3 class="badge-title">{{ t('badge_style_title') }}</h3>
            <p class="badge-body">{{ t('badge_style_body') }}</p>
          </div>
          <div class="badge-card badge-brand">
            <h3 class="badge-title">{{ t('badge_role_title') }}</h3>
            <p class="badge-body">{{ t('badge_role_body') }}</p>
          </div>
          <div class="badge-card badge-outline">
            <h3 class="badge-title">{{ t('badge_theme_title') }}</h3>
            <p class="badge-body">{{ t('badge_theme_body') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Preset Directory Across Industries (Additive) ──────── -->
    <section class="directory-section">
      <div class="section-inner">
        <div class="section-rule">
          <p class="m-overline">{{ t('index_industry_overline') }}</p>
        </div>
        <div class="directory-header">
          <h2 class="m-heading">{{ t('index_directory_heading') }}</h2>
          <p class="m-sub">{{ t('index_directory_sub') }}</p>
        </div>

        <div class="directory-table" role="region" aria-label="Industry terminal presets">
          <div class="directory-head">
            <span>{{ t('index_dir_col_industry') }}</span>
            <span>{{ t('index_dir_col_presets') }}</span>
            <span>{{ t('index_dir_col_tables') }}</span>
          </div>
          <div v-for="row in directoryRows" :key="row.industry" class="directory-row">
            <span class="dir-industry">{{ row.industry }}</span>
            <span class="dir-presets">{{ row.presets }}</span>
            <span class="dir-tables m-mono">{{ row.tables }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Bottom CTA ────────────────────────────────────────── -->
    <section class="m-cta-strip">
      <div class="m-cta-inner">
        <h2 class="m-cta-heading">{{ t('index_cta_heading') }}</h2>
        <p class="m-cta-sub">{{ t('index_cta_sub') }}</p>
        <div class="m-cta-btns">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary ribbon">{{ t('index_dashboard_cta') }}</NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">{{ t('index_cta_btn1') }}</NuxtLink>
          <NuxtLink v-if="isEnabled('pricing')" to="/pricing" class="m-btn-secondary">{{ t('index_cta_btn2') }}</NuxtLink>
          <NuxtLink to="/features" class="m-btn-ghost">{{ t('nav_features') }} →</NuxtLink>
        </div>
      </div>
    </section>

    <!-- Closing wordmark: the name returns at full width on a chocolate field -->
    <div class="closing-wordmark" aria-hidden="true">
      <span class="closing-word">Kogane</span><span class="closing-dot" />
    </div>
  </div>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────────── */
.hero {
  position: relative;
}

.hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 3.5rem 2rem 0;
  display: grid;
  grid-template-columns: var(--home-split);
  column-gap: var(--home-gap);
  row-gap: 3rem;
  align-items: start;
}

.hero-lede {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.8rem;
  border-radius: 0.4rem;
  border: 1.5px solid rgba(255, 87, 118, 0.28);
  background: rgba(255, 87, 118, 0.07);
  font-size: 0.76rem;
  font-weight: 600;
  color: #FF5776;
  letter-spacing: 0.03em;
  margin-bottom: 1.5rem;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FF5776;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}

.hero-headline {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2.4rem, 4.4vw, 3.9rem);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: -0.015em;
  color: #68293A;
  margin: 0;
  text-decoration: none;
}
.hero-headline em { font-style: italic; color: #FF5776; text-decoration: none; }

.hero-sub {
  font-size: 1.02rem;
  line-height: 1.62;
  color: rgba(104, 41, 58, 0.8);
  max-width: 27rem;
  margin: 0;
}

.hero-cta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-bottom: 12px;
}

.hero-facts {
  list-style: none;
  padding: 0;
  margin: 0;
  align-self: end;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-family: var(--k-font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #68293A;
}

.hero-facts li {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.hero-facts li::before {
  content: '—';
  color: #FF5776;
  font-weight: 600;
}

/* ── Industries ───────────────────────────────────────── */
.section-industries {
  padding: 4.5rem 0 0;
}

/* Business types set in a row like a partner strip */
.industry-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1rem 1.5rem;
  margin-top: 2.25rem;
}

.industry-chip {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.25;
  color: #68293A;
}

.chip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: #FF5776;
  flex-shrink: 0;
}
.chip-icon svg { width: 1.35rem; height: 1.35rem; }

/* ── Pillars ──────────────────────────────────────────── */
.section-pillars {
  padding: 5.5rem 0 6.5rem;
}

.home .m-label-block {
  display: grid;
  grid-template-columns: var(--home-split);
  column-gap: var(--home-gap);
  row-gap: 1rem;
  align-items: end;
  max-width: none;
  margin: 2.25rem 0 3.5rem;
  text-align: left;
}

.home .m-label-block .m-sub {
  margin: 0;
}

.pillar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
}

.pillar-card {
  padding: 1rem 0 0;
  border-top: 1px solid var(--home-rule);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pillar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.pillar-number {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: #68293A;
}

.pillar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.55rem;
  background: #FFEBEF;
  color: #FF5776;
  flex-shrink: 0;
}
.pillar-icon svg { width: 1.1rem; height: 1.1rem; }

.pillar-title {
  font-family: 'DM Serif Display', serif;
  font-weight: 400;
  font-size: 1.5rem;
  line-height: 1.15;
  color: #68293A;
  margin: 0;
}
.pillar-body  { font-size: 0.95rem; color: rgba(104, 41, 58, 0.8); line-height: 1.6; flex: 1; margin: 0; }
.pillar-link  { font-size: 0.85rem; font-weight: 600; color: #68293A; text-decoration: underline; text-decoration-color: #FF5776; text-underline-offset: 0.25em; margin-top: 0.5rem; }
.pillar-link:hover { color: #FF5776; }

/* ── Philosophy ───────────────────────────────────────── */
.section-philosophy { padding: 5.5rem 0 6.5rem; }

/* Statement on the left, hairline comparison list on the right */
.philosophy-inner {
  display: grid;
  grid-template-columns: var(--home-split);
  column-gap: var(--home-gap);
  row-gap: 2.5rem;
  align-items: start;
  margin-top: 2.25rem;
}

.philosophy-text .m-heading {
  margin-bottom: 1.25rem;
}

.philosophy-cta {
  margin-top: 1.75rem;
}

.comparison-list {
  border-top: 1px solid var(--home-rule);
}

.comparison-row {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 1.5rem;
  padding: 1.15rem 0;
  border-bottom: 1px solid var(--home-rule);
}

.comparison-title {
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.35;
  color: #68293A;
  margin: 0;
}

.comparison-body {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(104, 41, 58, 0.8);
  margin: 0;
}

/* 2x2 flavour cards */
.philosophy-badges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 4.5rem;
}

.badge-card {
  border-radius: 0.75rem;
  padding: 1.75rem;
  min-height: 13.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.6rem;
}

.badge-plain   { background: #F6E6D7; color: #68293A; }
.badge-dark    { background: #68293A; color: #F6E6D7; }
.badge-brand   { background: #FF5776; color: #4A1A27; }
.badge-outline { background: transparent; border: 1.5px solid #E3C7B9; color: #68293A; }

.badge-title {
  font-family: 'DM Serif Display', serif;
  font-weight: 400;
  font-size: clamp(1.7rem, 2.7vw, 2.3rem);
  line-height: 1.05;
  margin: 0;
}
.badge-body  { font-size: 0.95rem; line-height: 1.55; margin: 0; max-width: 24rem; }

/* ── Industry Preset Directory ────────────────────────── */
.directory-section {
  padding: 0 0 6.5rem;
}

.directory-header {
  display: grid;
  grid-template-columns: var(--home-split);
  column-gap: var(--home-gap);
  row-gap: 1rem;
  align-items: end;
  margin: 2.25rem 0 3rem;
}

.directory-table {
  border-top: 2px solid #68293A;
}

.directory-head,
.directory-row {
  display: grid;
  grid-template-columns: 1.1fr 2fr 1.2fr;
  gap: 1.25rem;
  align-items: baseline;
  padding: 1rem 0.5rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.1);
}

.directory-row:last-child { border-bottom: none; }
.directory-row:hover { background: #FFF8FA; }

.directory-head {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(104, 41, 58, 0.55);
}

.dir-industry {
  font-family: 'DM Serif Display', serif;
  font-size: 1.12rem;
  color: #68293A;
}

.dir-presets {
  font-size: 0.88rem;
  color: #68293A;
  line-height: 1.45;
}

.dir-tables {
  font-size: 0.78rem;
  color: rgba(104, 41, 58, 0.68);
}

/* ── Closing wordmark ─────────────────────────────────── */
.closing-wordmark {
  display: flex;
  align-items: baseline;
  justify-content: center;
  padding: 1rem 2rem min(5.5vw, 5rem);
  background: #68293A;
  overflow: hidden;
}

.closing-word {
  font-family: 'DM Serif Display', serif;
  font-size: min(27vw, 26rem);
  line-height: 1;
  letter-spacing: -0.02em;
  color: #F6E6D7;
}

.closing-dot {
  width: min(2.6vw, 2.5rem);
  height: min(2.6vw, 2.5rem);
  border-radius: 50%;
  background: #FF5776;
  flex-shrink: 0;
  margin-left: 0.4vw;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .hero-inner { display: flex; flex-direction: column; gap: 1.5rem; padding: 2.5rem 2rem 2.5rem; }
  .hero-lede { display: contents; }
  .hero-badge { order: 1; margin-bottom: 0; }
  .hero-headline { order: 2; }
  .hero-sub { order: 3; max-width: 34rem; }
  .hero-cta { order: 4; }
  .hero-facts { order: 5; align-self: start; }
  .industry-grid { grid-template-columns: repeat(3, 1fr); }
  .home .m-label-block,
  .directory-header { grid-template-columns: 1fr; }
  .pillar-grid { grid-template-columns: 1fr 1fr; }
  .philosophy-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .directory-head { display: none; }
  .directory-row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}

@media (max-width: 600px) {
  .hero-inner { padding: 2rem 1.25rem 2rem; }
  .industry-grid { grid-template-columns: 1fr 1fr; }
  .comparison-row { grid-template-columns: 1fr; gap: 0.35rem; }
  .badge-card { min-height: 11rem; }
  .closing-wordmark { padding: 0.5rem 1.25rem 6vw; }
  .pillar-grid,
  .philosophy-badges {
    grid-template-columns: 1fr;
  }
}
</style>
