<script setup lang="ts">
import MonitorIcon from 'reicon-vue/icons/Monitor';
import ShieldCheckIcon from 'reicon-vue/icons/ShieldCheck';
import WifiOffIcon from 'reicon-vue/icons/WifiOff';
import UsersIcon from 'reicon-vue/icons/Users';
import ArrowRightIcon from 'reicon-vue/icons/ArrowRight';
import CheckCircleIcon from 'reicon-vue/icons/CheckCircle';
import CheckIcon from 'reicon-vue/icons/Check';

definePageMeta({ layout: 'marketing', feature: 'pricing' });

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

const workstationModels = [
  {
    name: 'Cashier Register',
    badge: 'Front Counter',
    description: 'Fast counter sales, order entry, custom ticket totals, receipt generation, and payment processing.',
    details: ['Table & queue management', 'Payment method logging', 'Instant receipt printing'],
  },
  {
    name: 'Inventory Manager',
    badge: 'Stock Operations',
    description: 'Stock level tracking, catalog synchronisation, inbound supply shipments, and receiving records.',
    details: ['Inbound stock logs', 'Reorder threshold alerts', 'Direct inventory ledger'],
  },
  {
    name: 'Kitchen Display',
    badge: 'Prep Line',
    description: 'Live order board and ticket queues for kitchen and prep staff to coordinate food & drink preparation.',
    details: ['Real-time status updates', 'Order fulfill actions', 'Dedicated pass-through display'],
  },
  {
    name: 'Catalog Registrar',
    badge: 'Product Desk',
    description: 'Dedicated catalog maintenance terminal for item descriptions, pricing, and category setup.',
    details: ['Item catalog registry', 'Price configuration', 'Category categorization'],
  },
  {
    name: 'Reports & Analytics',
    badge: 'Back Office',
    description: 'Full business sales ledgers, compliance records, tax audit views, and operational performance trends.',
    details: ['Audit logs & daily ledger', 'Sales forecast schedules', 'Tax compliance exports'],
  },
];

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
    <!-- ── Hero Section (Restored main .pricing-hero + Billing Toggle) ── -->
    <section class="pricing-hero">
      <div class="m-inner pricing-hero-inner">
        <p class="m-overline">{{ t('pricing_hero_overline') }}</p>
        <h1 class="m-heading-lg">{{ t('pricing_hero_heading') }}</h1>
        <p class="m-sub" style="margin: 0 auto; max-width: 680px;">
          {{ t('pricing_hero_sub') }}
        </p>

        <div class="hero-cta-wrap">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary ribbon">
            {{ t('pricing_cta_dashboard') }} <ArrowRightIcon class="w-4 h-4 ml-1" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">
            {{ t('pricing_cta_btn1') }} <ArrowRightIcon class="w-4 h-4 ml-1" aria-hidden="true" />
          </NuxtLink>
        </div>

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
    </section>

    <!-- ── SaaS Pricing Plans Grid (Additive) ─────────────────── -->
    <section class="plans-section">
      <div class="m-inner">
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
              :class="[`plan-btn--${plan.buttonVariant}`, { ribbon: plan.featured || plan.buttonVariant === 'dark' }]"
            >
              <span>{{ plan.ctaLabel }}</span>
              <ArrowRightIcon class="plan-btn-icon" aria-hidden="true" />
            </NuxtLink>

            <ul class="plan-features">
              <li v-for="feat in plan.features" :key="feat" class="plan-feature-item">
                <CheckIcon class="plan-check-icon" aria-hidden="true" />
                <span>{{ feat }}</span>
              </li>
            </ul>
          </article>
        </div>

        <p class="plans-footnote">{{ t('pricing_note') }}</p>
      </div>
    </section>

    <!-- ── Core Pillars (Restored from main) ──────────────────── -->
    <section class="section-pillars">
      <div class="m-inner">
        <div class="section-header text-center">
          <p class="m-overline">{{ t('index_pillars_overline') }}</p>
          <h2 class="m-heading-md">{{ t('pricing_why_heading') }}</h2>
          <p class="m-sub" style="margin: 0 auto; max-width: 580px;">
            {{ t('pricing_why_sub') }}
          </p>
        </div>

        <div class="pillars-grid">
          <div class="pillar-card">
            <div class="pillar-icon-wrap" aria-hidden="true">
              <ShieldCheckIcon class="w-6 h-6 text-[#FF5776]" />
            </div>
            <h3 class="pillar-title">{{ t('pricing_why_1_title') }}</h3>
            <p class="pillar-text">
              {{ t('pricing_why_1_body') }}
            </p>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-wrap" aria-hidden="true">
              <WifiOffIcon class="w-6 h-6 text-[#FF5776]" />
            </div>
            <h3 class="pillar-title">Cloud Sync &amp; Local Ready</h3>
            <p class="pillar-text">
              {{ t('pricing_why_2_body') }}
            </p>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-wrap" aria-hidden="true">
              <UsersIcon class="w-6 h-6 text-[#FF5776]" />
            </div>
            <h3 class="pillar-title">Scalable Workstations</h3>
            <p class="pillar-text">
              {{ t('pricing_why_3_body') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Included Workstations (Restored 5 Station Cards from main) ── -->
    <section class="section-workstations">
      <div class="m-inner">
        <div class="section-header text-center">
          <p class="m-overline">Included Workstations</p>
          <h2 class="m-heading-md">Equip Your Entire Floor</h2>
          <p class="m-sub" style="margin: 0 auto; max-width: 580px;">
            Every standard workspace includes full configuration for all 5 official workstation roles.
          </p>
        </div>

        <div class="workstations-grid">
          <div
            v-for="station in workstationModels"
            :key="station.name"
            class="station-card"
          >
            <div class="station-header">
              <div class="station-icon" aria-hidden="true">
                <MonitorIcon class="w-5 h-5 text-[#68293A]" />
              </div>
              <span class="station-badge">{{ station.badge }}</span>
            </div>
            <h3 class="station-name">{{ station.name }}</h3>
            <p class="station-desc">{{ station.description }}</p>
            <ul class="station-details">
              <li v-for="d in station.details" :key="d" class="station-detail-item">
                <CheckCircleIcon class="w-4 h-4 text-[#FF5776] shrink-0" aria-hidden="true" />
                <span>{{ d }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature Comparison Table (Additive) ────────────────── -->
    <section class="compare-section">
      <div class="m-inner">
        <div class="section-header text-center">
          <p class="m-overline">{{ t('pricing_hero_overline') }}</p>
          <h2 class="m-heading-md">{{ t('pricing_compare_heading') }}</h2>
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

    <!-- ── FAQ Section ────────────────────────────────────────── -->
    <section class="faq-section">
      <div class="m-inner faq-layout">
        <div class="faq-header">
          <p class="m-overline">{{ t('pricing_faq_overline') }}</p>
          <h2 class="m-heading-md">{{ t('pricing_faq_heading') }}</h2>
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

    <!-- ── Bottom CTA ─────────────────────────────────────────── -->
    <section class="m-cta-strip">
      <div class="m-cta-inner">
        <h2 class="m-cta-heading">{{ t('pricing_cta_heading') }}</h2>
        <p class="m-cta-sub">
          {{ t('pricing_cta_sub') }}
        </p>
        <div class="m-cta-btns">
          <NuxtLink v-if="isLoggedIn" to="/dashboard/terminals" class="m-btn-primary ribbon">
            {{ t('pricing_cta_terminals') }}
          </NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">
            {{ t('pricing_cta_btn1') }}
          </NuxtLink>
          <NuxtLink to="/features" class="m-btn-ghost">
            {{ t('pricing_cta_btn2') }} →
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pricing-page {
  color: #68293A;
}

/* ── Hero ─────────────────────────────────────────────── */
.pricing-hero {
  padding: 5.5rem 0 3.5rem;
  text-align: center;
  background: radial-gradient(ellipse at 50% 20%, rgba(255, 87, 118, 0.08) 0%, transparent 70%);
}

.hero-cta-wrap {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  padding-bottom: 12px;
}

.billing-row {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.billing-control {
  display: inline-flex;
  flex-wrap: wrap;
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.14);
  border-radius: 0.6rem;
  padding: 4px;
  gap: 4px;
  max-width: 100%;
  box-shadow: 0 4px 16px rgba(104, 41, 58, 0.06);
}

.billing-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.95rem;
  border: none;
  border-radius: 0.45rem;
  background: transparent;
  color: rgba(104, 41, 58, 0.72);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.billing-btn:hover { color: #68293A; }
.billing-btn.active {
  background: #68293A;
  color: #F6E6D7;
}

.billing-save {
  font-size: 0.78rem;
  font-weight: 600;
  color: #B8294B;
  font-variant-numeric: tabular-nums;
}
.billing-btn.active .billing-save { color: #FFA3B5; }

/* ── Pricing Plans Grid ───────────────────────────────── */
.plans-section {
  padding: 2rem 0 4rem;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
  align-items: stretch;
}

.plan-col {
  min-width: 0;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.1);
  border-radius: 1rem;
  box-shadow: 0 6px 24px rgba(104, 41, 58, 0.05);
}

.plan-col--featured {
  background: #68293A;
  border-color: #68293A;
  color: #F6E6D7;
  box-shadow: 0 16px 40px rgba(104, 41, 58, 0.18), inset 0 4px 0 0 #FF5776;
}

.plan-top { margin-bottom: 1.5rem; }

.plan-name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.plan-name {
  font-family: 'DM Serif Display', serif;
  font-size: 1.45rem;
  font-weight: 400;
  line-height: 1.2;
  color: #68293A;
  margin: 0;
}
.plan-col--featured .plan-name { color: #F6E6D7; }

.plan-marker {
  font-size: 0.75rem;
  font-weight: 700;
  color: #FFD6DE;
  background: rgba(255, 87, 118, 0.22);
  border: 1px solid rgba(255, 163, 181, 0.42);
  border-radius: 99px;
  padding: 0.15rem 0.6rem;
  white-space: nowrap;
}

.plan-tagline {
  font-size: 0.9rem;
  line-height: 1.55;
  color: rgba(104, 41, 58, 0.68);
  margin: 0;
  min-height: 2.9em;
}
.plan-col--featured .plan-tagline { color: rgba(246, 230, 215, 0.82); }

.plan-price-block {
  padding: 1.25rem 0;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
  border-bottom: 1px solid rgba(104, 41, 58, 0.12);
  margin-bottom: 1.5rem;
  font-variant-numeric: tabular-nums;
}
.plan-col--featured .plan-price-block {
  border-top-color: rgba(246, 230, 215, 0.2);
  border-bottom-color: rgba(246, 230, 215, 0.2);
}

.plan-price-line {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.plan-price {
  font-family: 'DM Serif Display', serif;
  font-size: 2.4rem;
  font-weight: 400;
  line-height: 1;
  color: #68293A;
  font-variant-numeric: tabular-nums;
}
.plan-col--featured .plan-price { color: #F6E6D7; }

.plan-period {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(104, 41, 58, 0.68);
}
.plan-col--featured .plan-period { color: rgba(246, 230, 215, 0.8); }

.plan-billing-note {
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgba(104, 41, 58, 0.68);
  margin: 0.5rem 0 0;
  font-variant-numeric: tabular-nums;
}
.plan-col--featured .plan-billing-note { color: rgba(246, 230, 215, 0.78); }

.plan-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.82rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.925rem;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: 1.75rem;
  overflow: visible;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.plan-btn:active { transform: scale(0.985); }
.plan-btn.ribbon { margin-bottom: 2rem; }

.plan-btn.ribbon::after {
  content: '';
  position: absolute;
  bottom: -10px;
  right: 16px;
  width: 24px;
  height: 11px;
  background: var(--ribbon-color, #FF5776);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 52%, 0 100%);
  pointer-events: none;
  z-index: 1;
}

.plan-btn-icon { width: 1rem; height: 1rem; flex-shrink: 0; }

.plan-btn--accent {
  background: #FF5776;
  color: #FFFFFF;
  border: 1px solid #FF5776;
  --ribbon-color: #FF5776;
  box-shadow: 0 4px 16px rgba(255, 87, 118, 0.28);
}
.plan-btn--accent:hover { opacity: 0.9; }

.plan-btn--dark {
  background: #68293A;
  color: #F6E6D7;
  border: 1px solid #68293A;
  --ribbon-color: #68293A;
}
.plan-btn--dark:hover { opacity: 0.9; }

.plan-btn--secondary {
  background: #FFFFFF;
  color: #68293A;
  border: 1.5px solid rgba(104, 41, 58, 0.25);
}
.plan-btn--secondary:hover {
  background: #F6E6D7;
  border-color: #68293A;
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
  color: #68293A;
  font-variant-numeric: tabular-nums;
}
.plan-col--featured .plan-feature-item { color: #F6E6D7; }

.plan-check-icon {
  width: 1rem;
  height: 1rem;
  color: #FF5776;
  flex-shrink: 0;
  margin-top: 0.18rem;
}

.plans-footnote {
  margin: 1.5rem 0 0;
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.55;
  color: rgba(104, 41, 58, 0.65);
}

/* ── Core Pillars (Restored from main) ────────────────── */
.section-pillars {
  padding: 3.5rem 0 4rem;
  background: #FDFAF7;
  border-top: 1px solid rgba(104, 41, 58, 0.07);
  border-bottom: 1px solid rgba(104, 41, 58, 0.07);
}

.section-header {
  margin-bottom: 3rem;
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.pillar-card {
  padding: 2rem;
  border-radius: 1.25rem;
  background: #ffffff;
  border: 1px solid rgba(61, 24, 32, 0.08);
  box-shadow: 0 4px 16px rgba(61, 24, 32, 0.03);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pillar-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(61, 24, 32, 0.06);
}

.pillar-icon-wrap {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: rgba(255, 87, 118, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.pillar-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: #68293A;
  margin: 0 0 0.5rem;
}

.pillar-text {
  font-size: 0.92rem;
  line-height: 1.6;
  color: rgba(61, 24, 32, 0.68);
  margin: 0;
}

/* ── Workstations Section (Restored from main) ────────── */
.section-workstations {
  padding: 4.5rem 0;
}

.workstations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.station-card {
  padding: 1.75rem;
  border-radius: 1.25rem;
  background: #ffffff;
  border: 1px solid rgba(61, 24, 32, 0.08);
  box-shadow: 0 4px 12px rgba(61, 24, 32, 0.02);
  display: flex;
  flex-direction: column;
}

.station-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.station-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.6rem;
  background: rgba(104, 41, 58, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.station-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem;
  border-radius: 99px;
  background: rgba(104, 41, 58, 0.06);
  color: #68293A;
}

.station-name {
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: #68293A;
  margin: 0 0 0.5rem;
}

.station-desc {
  font-size: 0.88rem;
  line-height: 1.55;
  color: rgba(61, 24, 32, 0.65);
  margin: 0 0 1.25rem;
  flex-grow: 1;
}

.station-details {
  list-style: none;
  padding: 1rem 0 0;
  margin: 0;
  border-top: 1px solid rgba(61, 24, 32, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.station-detail-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.84rem;
  color: rgba(61, 24, 32, 0.78);
}

/* ── Feature Comparison Table ─────────────────────────── */
.compare-section {
  background: #FDFAF7;
  border-top: 1px solid rgba(104, 41, 58, 0.07);
  padding: 4.5rem 0;
}

.table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.12);
  border-radius: 0.75rem;
  box-shadow: 0 8px 28px rgba(104, 41, 58, 0.05);
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
  border-bottom: 1px solid rgba(104, 41, 58, 0.12);
  font-size: 0.875rem;
  line-height: 1.45;
  vertical-align: top;
}

.compare-table thead th {
  font-size: 0.9rem;
  font-weight: 600;
  color: #68293A;
  background: #FFFFFF;
  border-bottom: 1.5px solid #E3C7B9;
}

.compare-table tbody th.row-label {
  font-weight: 500;
  color: #68293A;
  width: 34%;
}

.compare-table tbody td {
  color: rgba(104, 41, 58, 0.72);
  width: 22%;
}

.compare-table tbody tr:last-child th,
.compare-table tbody tr:last-child td {
  border-bottom: none;
}

.compare-table .col-business {
  background: #FBF4ED;
  color: #68293A;
}

.compare-table thead th.col-business {
  box-shadow: inset 0 3px 0 0 #FF5776;
}

/* ── FAQ Section ──────────────────────────────────────── */
.faq-section {
  background: #F6E6D7;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
  padding: 4.5rem 0;
}

.faq-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr);
  gap: 3.5rem;
  align-items: start;
}

.faq-list {
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.12);
  border-radius: 0.75rem;
  padding: 0.35rem 1.75rem;
  box-shadow: 0 8px 28px rgba(104, 41, 58, 0.06);
}

.faq-item {
  border-bottom: 1px solid rgba(104, 41, 58, 0.12);
}
.faq-item:last-child { border-bottom: none; }

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
  color: #68293A;
}
.faq-summary::-webkit-details-marker { display: none; }
.faq-summary:hover { color: #B8294B; }

.faq-indicator {
  position: relative;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: #FF5776;
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
.faq-indicator::before { width: 12px; height: 1.5px; }
.faq-indicator::after { width: 1.5px; height: 12px; }
.faq-item[open] .faq-indicator::after { opacity: 0; }

.faq-answer {
  margin: 0 0 1.25rem;
  padding-right: 2rem;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: rgba(104, 41, 58, 0.72);
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 960px) {
  .plans-grid,
  .faq-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
  .plan-tagline { min-height: 0; }
}

@media (max-width: 640px) {
  .pricing-hero { padding: 3.5rem 0 2.5rem; }
  .plan-col { padding: 1.5rem 1.25rem; }
  .faq-list { padding: 0.25rem 1.25rem; }
  .faq-answer { padding-right: 0; }
}
</style>
