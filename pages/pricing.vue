<script setup lang="ts">
import { ArrowRight, Check } from 'lucide-vue-next';

definePageMeta({ layout: 'marketing' });

const { t } = useLocale();
const { isLoggedIn, hydrateSession } = useAuth();

const billingCycle = ref<'monthly' | 'annual'>('monthly');

onMounted(() => {
  void hydrateSession();
});

const plans = computed(() => {
  const annual = billingCycle.value === 'annual';
  return [
    {
      id: 'starter',
      name: t('plan_starter_name'),
      tagline: t('plan_starter_tagline'),
      price: t('plan_starter_price'),
      period: t('pricing_per_month'),
      billingNote: t('pricing_free_note'),
      ctaLabel: isLoggedIn.value ? t('pricing_cta_dashboard') : t('plan_starter_cta'),
      ctaTo: isLoggedIn.value ? '/dashboard' : '/login?mode=signup',
      featured: false,
      marker: '',
      buttonVariant: 'secondary' as const,
      features: [
        t('plan_starter_feat1'),
        t('plan_starter_feat2'),
        t('plan_starter_feat3'),
        t('plan_starter_feat4'),
      ],
    },
    {
      id: 'business',
      name: t('plan_business_name'),
      tagline: t('plan_business_tagline'),
      price: annual ? t('plan_business_price_annual') : t('plan_business_price_monthly'),
      period: t('pricing_per_month'),
      billingNote: `${annual ? t('pricing_billing_note_annual_biz') : t('pricing_billing_note_monthly')} · ${t('pricing_extra_terminal_note')}`,
      ctaLabel: isLoggedIn.value ? t('pricing_cta_terminals') : t('plan_business_cta'),
      ctaTo: isLoggedIn.value ? '/dashboard/terminals' : '/login?mode=signup',
      featured: true,
      marker: t('plan_popular'),
      buttonVariant: 'accent' as const,
      features: [
        t('plan_business_feat1'),
        t('plan_business_feat2'),
        t('plan_business_feat3'),
        t('plan_business_feat4'),
        t('plan_business_feat5'),
      ],
    },
    {
      id: 'team',
      name: t('plan_team_name'),
      tagline: t('plan_team_tagline'),
      price: annual ? t('plan_team_price_annual') : t('plan_team_price_monthly'),
      period: t('pricing_per_month'),
      billingNote: annual ? t('pricing_billing_note_annual_team') : t('pricing_billing_note_monthly'),
      ctaLabel: isLoggedIn.value ? t('pricing_cta_terminals') : t('plan_team_cta'),
      ctaTo: isLoggedIn.value ? '/dashboard/terminals' : '/login?mode=signup',
      featured: false,
      marker: '',
      buttonVariant: 'dark' as const,
      features: [
        t('plan_team_feat1'),
        t('plan_team_feat2'),
        t('plan_team_feat3'),
        t('plan_team_feat4'),
        t('plan_team_feat5'),
      ],
    },
  ];
});

const whyRows = computed(() => [
  { title: t('pricing_why_1_title'), body: t('pricing_why_1_body') },
  { title: t('pricing_why_2_title'), body: t('pricing_why_2_body') },
  { title: t('pricing_why_3_title'), body: t('pricing_why_3_body') },
]);

const comparisonRows = computed(() => {
  const annual = billingCycle.value === 'annual';
  return [
    {
      label: t('pricing_compare_row_price'),
      starter: `${t('plan_starter_price')} ${t('pricing_per_month')}`,
      business: `${annual ? t('plan_business_price_annual') : t('plan_business_price_monthly')} ${t('pricing_per_month')}`,
      team: `${annual ? t('plan_team_price_annual') : t('plan_team_price_monthly')} ${t('pricing_per_month')}`,
    },
    {
      label: t('pricing_compare_row_terminals'),
      starter: t('pricing_compare_val_terminals_starter'),
      business: t('pricing_compare_val_terminals_business'),
      team: t('pricing_compare_val_terminals_team'),
    },
    {
      label: t('pricing_compare_row_workspaces'),
      starter: t('pricing_compare_val_workspaces_single'),
      business: t('pricing_compare_val_workspaces_single'),
      team: t('pricing_compare_val_workspaces_unlimited'),
    },
    {
      label: t('pricing_compare_row_presets'),
      starter: t('pricing_compare_val_included'),
      business: t('pricing_compare_val_included'),
      team: t('pricing_compare_val_included'),
    },
    {
      label: t('pricing_compare_row_updates'),
      starter: t('pricing_compare_val_updates_starter'),
      business: t('pricing_compare_val_updates_business'),
      team: t('pricing_compare_val_updates_team'),
    },
    {
      label: t('pricing_compare_row_custom_presets'),
      starter: t('pricing_compare_val_none'),
      business: t('pricing_compare_val_custom_business'),
      team: t('pricing_compare_val_custom_team'),
    },
    {
      label: t('pricing_compare_row_sync'),
      starter: t('pricing_compare_val_sync_starter'),
      business: t('pricing_compare_val_sync_full'),
      team: t('pricing_compare_val_sync_full'),
    },
    {
      label: t('pricing_compare_row_audit'),
      starter: t('pricing_compare_val_audit_starter'),
      business: t('pricing_compare_val_audit_full'),
      team: t('pricing_compare_val_audit_full'),
    },
    {
      label: t('pricing_compare_row_exports'),
      starter: t('pricing_compare_val_none'),
      business: t('pricing_compare_val_exports_business'),
      team: t('pricing_compare_val_exports_team'),
    },
    {
      label: t('pricing_compare_row_roles'),
      starter: t('pricing_compare_val_none'),
      business: t('pricing_compare_val_included'),
      team: t('pricing_compare_val_included'),
    },
  ];
});

const faqs = computed(() => [
  { q: t('faq_q1'), a: t('faq_a1') },
  { q: t('faq_q2'), a: t('faq_a2') },
  { q: t('faq_q3'), a: t('faq_a3') },
  { q: t('faq_q4'), a: t('faq_a4') },
  { q: t('faq_q5'), a: t('faq_a5') },
  { q: t('faq_q6'), a: t('faq_a6') },
]);

const pricingJsonLd = computed(() => {
  const annual = billingCycle.value === 'annual';
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Kogane Terminal Builder',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: t('seo_pricing_description'),
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        highPrice: annual ? '39' : '49',
        offerCount: 3,
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: t('pricing_plans_heading'),
        itemListElement: [
          {
            '@type': 'Offer',
            name: t('plan_starter_name'),
            description: t('plan_starter_tagline'),
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
          {
            '@type': 'Offer',
            name: t('plan_business_name'),
            description: t('plan_business_tagline'),
            price: annual ? '12' : '15',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: annual ? '12' : '15',
              priceCurrency: 'USD',
              unitText: 'MONTH',
            },
            availability: 'https://schema.org/InStock',
          },
          {
            '@type': 'Offer',
            name: t('plan_team_name'),
            description: t('plan_team_tagline'),
            price: annual ? '39' : '49',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: annual ? '39' : '49',
              priceCurrency: 'USD',
              unitText: 'MONTH',
            },
            availability: 'https://schema.org/InStock',
          },
        ],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.value.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    },
  ];
});

usePageSeo({
  title: () => t('seo_pricing_title'),
  description: () => t('seo_pricing_description'),
  path: '/pricing',
  jsonLd: pricingJsonLd,
});
</script>

<template>
  <div class="pricing-page">
    <!-- Hero & Billing Cycle -->
    <section class="pricing-hero">
      <div class="p-container hero-grid">
        <div class="hero-intro">
          <p class="hero-kicker">{{ t('pricing_hero_overline') }}</p>
          <h1 class="hero-title">{{ t('pricing_hero_heading') }}</h1>
        </div>

        <div class="hero-aside">
          <p class="hero-sub">{{ t('pricing_hero_sub') }}</p>
          <div class="billing-row">
            <div class="billing-control" role="group" :aria-label="t('pricing_billing_label')">
              <button
                type="button"
                class="billing-btn"
                :class="{ active: billingCycle === 'monthly' }"
                :aria-pressed="billingCycle === 'monthly'"
                @click="billingCycle = 'monthly'"
              >
                {{ t('pricing_billing_monthly') }}
              </button>
              <button
                type="button"
                class="billing-btn"
                :class="{ active: billingCycle === 'annual' }"
                :aria-pressed="billingCycle === 'annual'"
                @click="billingCycle = 'annual'"
              >
                <span>{{ t('pricing_billing_annual') }}</span>
                <span class="billing-save">{{ t('pricing_billing_save') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Plans -->
    <section class="plans-section">
      <div class="p-container">
        <h2 class="sr-only">{{ t('pricing_plans_heading') }}</h2>

        <div class="plans-grid">
          <article
            v-for="plan in plans"
            :key="plan.id"
            class="plan-col"
            :class="{ 'plan-col--featured': plan.featured }"
          >
            <div class="plan-top">
              <div class="plan-name-row">
                <h3 class="plan-name">{{ plan.name }}</h3>
                <span v-if="plan.marker" class="plan-marker">{{ plan.marker }}</span>
              </div>
              <p class="plan-tagline">{{ plan.tagline }}</p>
            </div>

            <div class="plan-price-block">
              <div class="plan-price-line">
                <span class="plan-price">{{ plan.price }}</span>
                <span class="plan-period">{{ plan.period }}</span>
              </div>
              <p class="plan-billing-note">{{ plan.billingNote }}</p>
            </div>

            <NuxtLink
              :to="plan.ctaTo"
              class="plan-btn"
              :class="`plan-btn--${plan.buttonVariant}`"
            >
              <span>{{ plan.ctaLabel }}</span>
              <ArrowRight class="plan-btn-icon" aria-hidden="true" />
            </NuxtLink>

            <ul class="plan-features">
              <li v-for="feat in plan.features" :key="feat" class="plan-feature-item">
                <Check class="plan-check-icon" aria-hidden="true" />
                <span>{{ feat }}</span>
              </li>
            </ul>
          </article>
        </div>

        <p class="plans-footnote">{{ t('pricing_note') }}</p>
      </div>
    </section>

    <!-- Why SaaS Beats One-Off Agency Software -->
    <section class="why-section">
      <div class="p-container">
        <div class="section-intro">
          <h2 class="section-title">{{ t('pricing_why_heading') }}</h2>
          <p class="section-sub">{{ t('pricing_why_sub') }}</p>
        </div>

        <div class="why-list">
          <div v-for="row in whyRows" :key="row.title" class="why-row">
            <h3 class="why-row-title">{{ row.title }}</h3>
            <p class="why-row-body">{{ row.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Hairline-Ruled Feature Comparison Table -->
    <section class="compare-section">
      <div class="p-container">
        <div class="section-intro">
          <h2 class="section-title">{{ t('pricing_compare_heading') }}</h2>
        </div>

        <div class="table-scroll">
          <table class="compare-table">
            <caption class="sr-only">{{ t('pricing_compare_heading') }}</caption>
            <thead>
              <tr>
                <th scope="col" class="col-feature">{{ t('pricing_compare_feature_col') }}</th>
                <th scope="col">{{ t('plan_starter_name') }}</th>
                <th scope="col" class="col-business">{{ t('plan_business_name') }}</th>
                <th scope="col">{{ t('plan_team_name') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisonRows" :key="row.label">
                <th scope="row" class="row-label">{{ row.label }}</th>
                <td>{{ row.starter }}</td>
                <td class="col-business">{{ row.business }}</td>
                <td>{{ row.team }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="faq-section">
      <div class="p-container faq-layout">
        <div class="faq-header">
          <p class="section-kicker">{{ t('pricing_faq_overline') }}</p>
          <h2 class="section-title">{{ t('pricing_faq_heading') }}</h2>
        </div>

        <div class="faq-list">
          <details v-for="item in faqs" :key="item.q" class="faq-item">
            <summary class="faq-summary">
              <span class="faq-question">{{ item.q }}</span>
              <span class="faq-indicator" aria-hidden="true" />
            </summary>
            <p class="faq-answer">{{ item.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="m-cta-strip-dark">
      <div class="m-cta-inner">
        <h2 class="m-cta-heading-light">{{ t('pricing_cta_heading') }}</h2>
        <p class="m-cta-sub-light">{{ t('pricing_cta_sub') }}</p>
        <div class="m-cta-btns">
          <NuxtLink v-if="isLoggedIn" to="/dashboard/terminals" class="m-btn-primary">
            {{ t('pricing_cta_terminals') }}
          </NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary">
            {{ t('pricing_cta_btn1') }}
          </NuxtLink>
          <NuxtLink to="/features" class="m-btn-ghost on-dark">
            {{ t('pricing_cta_btn2') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pricing-page {
  background: var(--k-bg, #F4F3EF);
  color: var(--k-ink, #141414);
  font-family: var(--k-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
}

.p-container {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* ── Hero ───────────────────────────────────────────────── */
.pricing-hero {
  background: var(--k-bg, #F4F3EF);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  padding: 4.5rem 0 3.25rem;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 3rem;
  align-items: end;
}

.hero-kicker {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--k-muted, #52524E);
  margin: 0 0 0.75rem;
}

.hero-title {
  font-family: var(--k-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
  font-size: clamp(2.1rem, 4vw, 3.25rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: var(--k-ink, #141414);
  margin: 0;
}

.hero-aside {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero-sub {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--k-muted, #52524E);
  margin: 0;
}

.billing-row {
  display: flex;
  align-items: center;
}

.billing-control {
  display: inline-flex;
  flex-wrap: wrap;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 2px;
  padding: 3px;
  gap: 2px;
  max-width: 100%;
}

.billing-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.9rem;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--k-muted, #52524E);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.billing-btn:hover {
  color: var(--k-ink, #141414);
}

.billing-btn.active {
  background: var(--k-ink, #141414);
  color: var(--k-surface, #FFFFFF);
}

.billing-save {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--k-accent-hover, #CC3B1B);
  font-variant-numeric: tabular-nums;
}

.billing-btn.active .billing-save {
  color: #FF8E73;
}

/* ── Pricing Plans Grid ─────────────────────────────────── */
.plans-section {
  background: var(--k-bg, #F4F3EF);
  padding: 3.25rem 0 4rem;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, #DCDAD3);
}

.plan-col {
  min-width: 0;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--k-border, #DCDAD3);
}

.plan-col:last-child {
  border-right: none;
}

.plan-col--featured {
  box-shadow: inset 0 3px 0 0 var(--k-accent, #E84A27);
}

.plan-top {
  margin-bottom: 1.5rem;
}

.plan-name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.plan-name {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--k-ink, #141414);
  margin: 0;
}

.plan-marker {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--k-accent-hover, #CC3B1B);
  white-space: nowrap;
}

.plan-tagline {
  font-size: 0.925rem;
  line-height: 1.55;
  color: var(--k-muted, #52524E);
  margin: 0;
  min-height: 2.9em;
}

.plan-price-block {
  padding: 1.25rem 0;
  border-top: 1px solid var(--k-border, #DCDAD3);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  margin-bottom: 1.5rem;
  font-variant-numeric: tabular-nums;
}

.plan-price-line {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.plan-price {
  font-size: 2.35rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.025em;
  color: var(--k-ink, #141414);
  font-variant-numeric: tabular-nums;
}

.plan-period {
  font-size: 0.925rem;
  font-weight: 500;
  color: var(--k-muted, #52524E);
}

.plan-billing-note {
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--k-muted, #52524E);
  margin: 0.5rem 0 0;
  font-variant-numeric: tabular-nums;
}

.plan-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.78rem 1.25rem;
  border-radius: 2px;
  font-size: 0.925rem;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: 1.75rem;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.plan-btn-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.plan-btn--accent {
  background: var(--k-accent, #E84A27);
  color: var(--k-on-accent, #FFFFFF);
  border: 1px solid var(--k-accent, #E84A27);
}

.plan-btn--accent:hover {
  background: var(--k-accent-hover, #CC3B1B);
  border-color: var(--k-accent-hover, #CC3B1B);
}

.plan-btn--dark {
  background: var(--k-ink, #141414);
  color: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-ink, #141414);
}

.plan-btn--dark:hover {
  background: #2B2B28;
  border-color: #2B2B28;
}

.plan-btn--secondary {
  background: transparent;
  color: var(--k-ink, #141414);
  border: 1px solid var(--k-ink, #141414);
}

.plan-btn--secondary:hover {
  background: var(--k-bg, #F4F3EF);
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.plan-feature-item {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--k-ink, #141414);
  font-variant-numeric: tabular-nums;
}

.plan-check-icon {
  width: 1rem;
  height: 1rem;
  color: var(--k-accent-hover, #CC3B1B);
  flex-shrink: 0;
  margin-top: 0.18rem;
}

.plans-footnote {
  margin: 1.25rem 0 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--k-muted, #52524E);
}

/* ── Shared Section Headers ─────────────────────────────── */
.section-intro {
  margin-bottom: 2.25rem;
  max-width: 660px;
}

.section-kicker {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--k-muted, #52524E);
  margin: 0 0 0.5rem;
}

.section-title {
  font-family: var(--k-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
  font-size: clamp(1.6rem, 2.8vw, 2.2rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--k-ink, #141414);
  margin: 0;
}

.section-sub {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--k-muted, #52524E);
  margin: 0.75rem 0 0;
}

/* ── Why SaaS Breakdown ─────────────────────────────────── */
.why-section {
  background: var(--k-surface, #FFFFFF);
  border-top: 1px solid var(--k-border, #DCDAD3);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  padding: 4.5rem 0;
}

.why-list {
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.why-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  gap: 2.5rem;
  padding: 1.75rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  align-items: start;
}

.why-row-title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--k-ink, #141414);
  margin: 0;
}

.why-row-body {
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--k-muted, #52524E);
  margin: 0;
  font-variant-numeric: tabular-nums;
}

/* ── ONBOX-style Feature Comparison Table ───────────────── */
.compare-section {
  background: var(--k-bg, #F4F3EF);
  padding: 4.5rem 0;
}

.table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, #DCDAD3);
}

.compare-table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.compare-table th,
.compare-table td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.875rem;
  line-height: 1.45;
  vertical-align: top;
}

.compare-table thead th {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
  background: var(--k-surface, #FFFFFF);
  border-bottom: 1px solid var(--k-ink, #141414);
}

.compare-table tbody th.row-label {
  font-weight: 500;
  color: var(--k-ink, #141414);
  width: 34%;
}

.compare-table tbody td {
  color: var(--k-muted, #52524E);
  width: 22%;
}

.compare-table tbody tr:last-child th,
.compare-table tbody tr:last-child td {
  border-bottom: none;
}

.compare-table .col-business {
  background: #FAF9F6;
  color: var(--k-ink, #141414);
}

.compare-table thead th.col-business {
  color: var(--k-accent-hover, #CC3B1B);
}

/* ── FAQ ────────────────────────────────────────────────── */
.faq-section {
  background: var(--k-surface, #FFFFFF);
  border-top: 1px solid var(--k-border, #DCDAD3);
  padding: 4.5rem 0;
}

.faq-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr);
  gap: 3.5rem;
  align-items: start;
}

.faq-list {
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.faq-item {
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.faq-summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 0;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--k-ink, #141414);
}

.faq-summary::-webkit-details-marker {
  display: none;
}

.faq-summary:hover {
  color: var(--k-accent-hover, #CC3B1B);
}

.faq-indicator {
  position: relative;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.faq-indicator::before,
.faq-indicator::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  background: currentColor;
  transform: translate(-50%, -50%);
  transition: opacity 0.15s ease;
}

.faq-indicator::before {
  width: 12px;
  height: 1.5px;
}

.faq-indicator::after {
  width: 1.5px;
  height: 12px;
}

.faq-item[open] .faq-indicator::after {
  opacity: 0;
}

.faq-answer {
  margin: 0 0 1.25rem;
  padding-right: 2rem;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--k-muted, #52524E);
  font-variant-numeric: tabular-nums;
}

/* ── Responsive Breakpoints (Mobile-safe down to 320px) ─── */
.billing-btn:focus-visible,
.plan-btn:focus-visible,
.faq-summary:focus-visible {
  outline: 2px solid var(--k-accent, #E84A27);
  outline-offset: 2px;
}

@media (max-width: 960px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.75rem;
  }

  .plans-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .plan-col {
    border-right: none;
    border-bottom: 1px solid var(--k-border, #DCDAD3);
  }

  .plan-col:last-child {
    border-bottom: none;
  }

  .plan-tagline {
    min-height: 0;
  }

  .faq-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }
}

@media (max-width: 768px) {
  .why-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.65rem;
  }
}

@media (max-width: 640px) {
  .p-container {
    padding: 0 1rem;
  }

  .pricing-hero {
    padding: 3rem 0 2.5rem;
  }

  .plans-section {
    padding: 2.25rem 0 3rem;
  }

  .plan-col {
    padding: 1.5rem 1.25rem;
  }

  .why-section,
  .compare-section,
  .faq-section {
    padding: 3rem 0;
  }

  .billing-btn {
    padding: 0.45rem 0.7rem;
    font-size: 0.8125rem;
  }

  .compare-table th,
  .compare-table td {
    padding: 0.8rem 0.85rem;
    font-size: 0.8125rem;
  }

  .faq-answer {
    padding-right: 0;
  }
}
</style>
