<script setup lang="ts">
const { t } = useLocale();
definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title:       `${t('pricing_hero_overline')} - Kogane`,
  description: t('pricing_hero_sub'),
});

const plans = computed(() => [
  {
    name:     t('plan_starter_name'),
    price:    t('plan_starter_price'),
    period:   t('plan_starter_period'),
    tagline:  t('plan_starter_tagline'),
    cta:      t('plan_starter_cta'),
    ctaStyle: 'ghost',
    popular:  false,
    features: [
      t('plan_starter_feat1'),
      t('plan_starter_feat2'),
      t('plan_starter_feat3'),
      t('plan_starter_feat4'),
    ],
  },
  {
    name:     t('plan_flexible_name'),
    price:    t('plan_flexible_price'),
    period:   t('plan_flexible_period'),
    tagline:  t('plan_flexible_tagline'),
    cta:      t('plan_flexible_cta'),
    ctaStyle: 'primary',
    popular:  true,
    features: [
      t('plan_flexible_feat1'),
      t('plan_flexible_feat2'),
      t('plan_flexible_feat3'),
      t('plan_flexible_feat4'),
      t('plan_flexible_feat5'),
    ],
  },
]);

const faqs = computed(() => [
  {
    q: t('faq_q1'),
    a: t('faq_a1'),
  },
  {
    q: t('faq_q2'),
    a: t('faq_a2'),
  },
  {
    q: t('faq_q3'),
    a: t('faq_a3'),
  },
  {
    q: t('faq_q4'),
    a: t('faq_a4'),
  },
  {
    q: t('faq_q5'),
    a: t('faq_a5'),
  },
  {
    q: t('faq_q6'),
    a: t('faq_a6'),
  },
]);

const openFaq = ref<number | null>(null);
const toggle = (i: number) => { openFaq.value = openFaq.value === i ? null : i; };
</script>

<template>
  <!-- —— Hero ——————————————————————————————————————————————— -->
  <section class="pricing-hero">
    <div class="m-inner pricing-hero-inner">
      <p class="m-overline">{{ t('pricing_hero_overline') }}</p>
      <h1 class="m-heading-lg" v-html="t('pricing_hero_heading')"></h1>
      <p class="m-sub" style="margin: 0 auto;">
        {{ t('pricing_hero_sub') }}
      </p>
    </div>
  </section>

  <!-- —— Plans ——————————————————————————————————————————————— -->
  <section class="section-plans">
    <div class="m-inner plans-inner">
      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="plan-card"
          :class="{ 'plan-card--popular': plan.popular }"
        >
          <div v-if="plan.popular" class="popular-badge">{{ t('plan_popular') }}</div>

          <p class="plan-name">{{ plan.name }}</p>
          <div class="plan-price-row">
            <span class="plan-price">{{ plan.price }}</span>
            <span class="plan-period">{{ plan.period }}</span>
          </div>
          <p class="plan-tagline">{{ plan.tagline }}</p>

          <NuxtLink
            to="/login"
            class="plan-cta"
            :class="`plan-cta--${plan.ctaStyle}`"
          >
            {{ plan.cta }}
          </NuxtLink>

          <div class="plan-divider" />

          <ul class="plan-features">
            <li v-for="feat in plan.features" :key="feat">
              <!-- check icon -->
              <span class="feat-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              {{ feat }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- —— Note banner —————————————————————————————————————————— -->
  <section class="section-note">
    <div class="m-inner">
      <div class="note-inner">
        <!-- info icon -->
        <span class="note-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
        </span>
        <p>{{ t('pricing_note') }}</p>
      </div>
    </div>
  </section>

  <!-- —— FAQ ————————————————————————————————————————————————— -->
  <section class="section-faq">
    <div class="faq-inner">
      <div class="m-label-block">
        <p class="m-overline">{{ t('pricing_faq_overline') }}</p>
        <h2 class="m-heading">{{ t('pricing_faq_heading') }}</h2>
      </div>

      <div class="faq-list">
        <div
          v-for="(faq, i) in faqs"
          :key="i"
          class="faq-item"
          :class="{ open: openFaq === i }"
          role="button"
          tabindex="0"
          :aria-expanded="openFaq === i"
          @click="toggle(i)"
          @keydown.enter.prevent="toggle(i)"
          @keydown.space.prevent="toggle(i)"
        >
          <div class="faq-question">
            <span>{{ faq.q }}</span>
            <!-- plus / minus icon -->
            <span class="faq-arrow">
              <svg v-if="openFaq !== i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </div>
          <div v-if="openFaq === i" class="faq-answer">{{ faq.a }}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- —— CTA ————————————————————————————————————————————————— -->
  <section class="m-cta-strip">
    <div class="m-cta-inner">
      <h2 class="m-cta-heading" v-html="t('pricing_cta_heading')"></h2>
      <p class="m-cta-sub">{{ t('pricing_cta_sub') }}</p>
      <div class="m-cta-btns">
        <NuxtLink to="/login" class="m-btn-primary ribbon">{{ t('pricing_cta_btn1') }}</NuxtLink>
        <NuxtLink to="/features" class="m-btn-ghost">{{ t('pricing_cta_btn2') }}</NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* —— Hero ——————————————————————————————————————————————— */
.pricing-hero {
  padding: 5.5rem 0 4rem;
  text-align: center;
  background: radial-gradient(ellipse 65% 55% at 50% 0%, rgba(255, 87, 118, 0.08) 0%, transparent 70%);
}

.pricing-hero-inner { max-width: 640px; }

/* —— Plans —————————————————————————————————————————————— */
.section-plans { padding: 3rem 0 5rem; }
.plans-inner { max-width: 1060px; }

.plans-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.plan-card {
  position: relative;
  padding: 2rem;
  border-radius: 0.75rem;
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.1);
  box-shadow: 0 2px 12px rgba(104, 41, 58, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.plan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(104, 41, 58, 0.1);
}

.plan-card--popular {
  border-color: #68293A;
  box-shadow: 0 8px 32px rgba(104, 41, 58, 0.14);
}

.popular-badge {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.3rem 1rem;
  background: #68293A;
  color: #F6E6D7;
  border-radius: 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.plan-name {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(104, 41, 58, 0.45);
  margin: 0;
}

.plan-price-row { display: flex; align-items: baseline; gap: 0.4rem; }
.plan-price {
  font-family: 'DM Serif Display', serif;
  font-size: 2.75rem;
  color: #68293A;
  line-height: 1;
}
.plan-period { font-size: 0.85rem; color: rgba(104, 41, 58, 0.45); }

.plan-tagline { font-size: 0.875rem; color: rgba(104, 41, 58, 0.6); line-height: 1.55; margin: 0; }

.plan-cta {
  display: block;
  text-align: center;
  padding: 0.7rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s, border-color 0.15s, background 0.15s;
  margin-top: 0.25rem;
}

.plan-cta--primary {
  background: #68293A;
  color: #F6E6D7;
  box-shadow: 0 4px 14px rgba(104, 41, 58, 0.22);
}
.plan-cta--primary:hover  { opacity: 0.88; }
.plan-cta--primary:active { transform: scale(0.97); }

.plan-cta--ghost {
  border: 1.5px solid rgba(104, 41, 58, 0.2);
  color: #68293A;
}
.plan-cta--ghost:hover {
  border-color: rgba(104, 41, 58, 0.45);
  background: rgba(104, 41, 58, 0.03);
}

.plan-divider {
  height: 1px;
  background: rgba(104, 41, 58, 0.07);
  margin: 0.5rem 0;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(104, 41, 58, 0.72);
  line-height: 1.45;
}

.feat-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(104, 41, 58, 0.08);
  color: #68293A;
  margin-top: 0.15rem;
}
.feat-check svg { width: 9px; height: 9px; }

/* —— Note banner ———————————————————————————————————————— */
.section-note { padding: 0 0 4rem; }

.note-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1.25rem 1.5rem;
  background: rgba(255, 87, 118, 0.06);
  border: 1px solid rgba(255, 87, 118, 0.18);
  border-radius: 0.75rem;
  font-size: 0.9rem;
  color: rgba(104, 41, 58, 0.7);
  line-height: 1.6;
}

.note-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  color: #FF5776;
  margin-top: 0.1rem;
}
.note-icon svg { width: 1.1rem; height: 1.1rem; }

.note-inner p { margin: 0; }

/* —— FAQ ———————————————————————————————————————————————— */
.section-faq { padding: 5rem 2rem; background: #FFFFFF; }
.faq-inner { max-width: 760px; margin: 0 auto; }

.faq-list { display: flex; flex-direction: column; gap: 0; }

.faq-item {
  border-bottom: 1px solid rgba(104, 41, 58, 0.08);
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 0.5rem;
  padding: 0 0.5rem;
}
.faq-item:first-child { border-top: 1px solid rgba(104, 41, 58, 0.08); }
.faq-item:hover { background: rgba(104, 41, 58, 0.02); }

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: #68293A;
  gap: 1rem;
  user-select: none;
}

.faq-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.2rem;
  height: 1.2rem;
  color: #FF5776;
  transition: transform 0.15s;
}
.faq-arrow svg { width: 1rem; height: 1rem; }

.faq-answer {
  padding: 0 0 1.1rem;
  font-size: 0.9rem;
  color: rgba(104, 41, 58, 0.65);
  line-height: 1.7;
}

/* —— Responsive ———————————————————————————————————————— */
@media (max-width: 860px) {
  .plans-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
}
</style>
