<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title:       'Pricing — Postfolio',
  description: `Simple, transparent pricing for businesses of every size. Start free, scale when you're ready.`,
});

const plans = [
  {
    name:     'Starter',
    price:    'Free',
    period:   'forever',
    tagline:  'Perfect for solo operators and small teams getting started.',
    cta:      'Get started',
    ctaStyle: 'ghost',
    popular:  false,
    features: [
      '1 business workspace',
      'Up to 5 database tables',
      '3 UI layouts',
      '2 deployed terminals',
      'Community support',
    ],
  },
  {
    name:     'Growth',
    price:    '$29',
    period:   'per month',
    tagline:  'For growing businesses that need more layouts, terminals, and team members.',
    cta:      'Start free trial',
    ctaStyle: 'maroon',
    popular:  true,
    features: [
      'Unlimited tables & layouts',
      'Unlimited terminals',
      'Up to 10 staff accounts',
      'Hardware scanner integration',
      'Dynamic theming',
      'Priority email support',
    ],
  },
  {
    name:     'Enterprise',
    price:    'Custom',
    period:   'contact us',
    tagline:  'For large organisations with custom data, compliance, and SLA requirements.',
    cta:      'Contact sales',
    ctaStyle: 'ghost',
    popular:  false,
    features: [
      'Everything in Growth',
      'Unlimited staff accounts',
      'Custom domain for terminals',
      'SSO / SAML integration',
      'Dedicated Supabase instance',
      'SLA & dedicated support',
    ],
  },
];

const faqs = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Starter plan is completely free with no credit card required. Upgrade only when you\'re ready.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes — upgrade or downgrade at any time. Changes take effect on your next billing cycle.',
  },
  {
    q: 'What\'s a "terminal"?',
    a: 'A terminal is a deployed, purpose-built interface — like a POS screen, self-serve kiosk, or staff dashboard — accessed via a unique URL.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. Production data lives in Supabase (PostgreSQL), with role-level security and no shared tenancy on Enterprise.',
  },
  {
    q: 'Can I self-host Postfolio?',
    a: 'Postfolio is open-source friendly. Contact us for Enterprise self-hosting options and Docker deployment guides.',
  },
  {
    q: 'What counts as a database table?',
    a: 'Each table you create in the Schema Editor counts. Starter supports up to 5; Growth and Enterprise have no limits.',
  },
];

const openFaq = ref<number | null>(null);
const toggle = (i: number) => { openFaq.value = openFaq.value === i ? null : i; };
</script>

<template>
  <!-- ── Hero ─────────────────────────────────────────────── -->
  <section class="pricing-hero">
    <p class="overline">Pricing</p>
    <h1 class="pricing-headline">Simple, honest pricing.<br><em>No surprises.</em></h1>
    <p class="pricing-sub">
      Start free and scale as your business grows. Every plan includes access to the full Postfolio platform.
    </p>
  </section>

  <!-- ── Plans ─────────────────────────────────────────────── -->
  <section class="section-plans">
    <div class="plans-inner">
      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="plan-card"
          :class="{ 'plan-card--popular': plan.popular }"
        >
          <div v-if="plan.popular" class="popular-badge">Most popular</div>

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
              <span class="feat-check">✓</span>
              {{ feat }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Compare toggle note ────────────────────────────────── -->
  <section class="section-note">
    <div class="note-inner">
      <span class="note-icon">💡</span>
      <p>All plans include the Schema Editor, UI Builder, Terminal Deployer, and Smart Onboarding. Limits apply only to scale, not capability.</p>
    </div>
  </section>

  <!-- ── FAQ ───────────────────────────────────────────────── -->
  <section class="section-faq">
    <div class="faq-inner">
      <div class="section-label-block">
        <p class="overline">FAQ</p>
        <h2 class="section-heading">Common questions.</h2>
      </div>

      <div class="faq-list">
        <div
          v-for="(faq, i) in faqs"
          :key="i"
          class="faq-item"
          :class="{ open: openFaq === i }"
          @click="toggle(i)"
        >
          <div class="faq-question">
            <span>{{ faq.q }}</span>
            <span class="faq-arrow">{{ openFaq === i ? '−' : '+' }}</span>
          </div>
          <div v-if="openFaq === i" class="faq-answer">{{ faq.a }}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── CTA ───────────────────────────────────────────────── -->
  <section class="section-cta">
    <div class="cta-inner">
      <h2 class="cta-heading">Still have questions?</h2>
      <p class="cta-sub">We're happy to walk you through the platform or set up a personalised demo.</p>
      <div class="cta-btns">
        <NuxtLink to="/login" class="btn-hero-primary">Start for free</NuxtLink>
        <a href="mailto:hello@postfolio.io" class="btn-hero-ghost light">Contact sales →</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.overline {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #e8748a;
  margin-bottom: 1rem;
}

.section-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.8rem, 3.5vw, 2.5rem);
  color: #3d1820;
  line-height: 1.2;
  margin: 0 0 1rem;
}

.section-label-block { text-align: center; margin-bottom: 3rem; }

/* ── Hero ─────────────────────────────────────────────── */
.pricing-hero {
  padding: 5.5rem 2rem 4rem;
  text-align: center;
  background: radial-gradient(ellipse 65% 55% at 50% 0%, rgba(232, 116, 138, 0.1) 0%, transparent 70%);
}

.pricing-headline {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2.4rem, 5vw, 3.5rem);
  color: #3d1820;
  line-height: 1.12;
  margin: 0 0 1.25rem;
}
.pricing-headline em { font-style: italic; color: #e8748a; }

.pricing-sub {
  font-size: 1.1rem;
  color: rgba(61, 24, 32, 0.6);
  line-height: 1.7;
  max-width: 520px;
  margin: 0 auto;
}

/* ── Plans ────────────────────────────────────────────── */
.section-plans { padding: 3rem 2rem 5rem; }
.plans-inner { max-width: 1060px; margin: 0 auto; }

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.plan-card {
  position: relative;
  padding: 2rem;
  border-radius: 1.5rem;
  background: #fff;
  border: 1px solid rgba(61, 24, 32, 0.1);
  box-shadow: 0 2px 12px rgba(61, 24, 32, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.plan-card:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(61, 24, 32, 0.1); }

.plan-card--popular {
  border-color: #3d1820;
  box-shadow: 0 8px 32px rgba(61, 24, 32, 0.14);
}

.popular-badge {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.3rem 1rem;
  background: #3d1820;
  color: #f5ede4;
  border-radius: 9999px;
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
  color: rgba(61, 24, 32, 0.45);
  margin: 0;
}

.plan-price-row { display: flex; align-items: baseline; gap: 0.4rem; }
.plan-price {
  font-family: 'DM Serif Display', serif;
  font-size: 2.75rem;
  color: #3d1820;
  line-height: 1;
}
.plan-period { font-size: 0.85rem; color: rgba(61, 24, 32, 0.45); }

.plan-tagline { font-size: 0.875rem; color: rgba(61, 24, 32, 0.6); line-height: 1.55; margin: 0; }

.plan-cta {
  display: block;
  text-align: center;
  padding: 0.7rem 1.25rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
  margin-top: 0.25rem;
}
.plan-cta--maroon { background: #3d1820; color: #f5ede4; box-shadow: 0 4px 14px rgba(61, 24, 32, 0.2); }
.plan-cta--maroon:hover  { opacity: 0.88; }
.plan-cta--maroon:active { transform: scale(0.97); }
.plan-cta--ghost  { border: 1.5px solid rgba(61, 24, 32, 0.2); color: #3d1820; }
.plan-cta--ghost:hover { border-color: rgba(61, 24, 32, 0.45); background: rgba(61, 24, 32, 0.03); }

.plan-divider {
  height: 1px;
  background: rgba(61, 24, 32, 0.07);
  margin: 0.5rem 0;
}

.plan-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.65rem; }
.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(61, 24, 32, 0.72);
  line-height: 1.45;
}

.feat-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(61, 24, 32, 0.08);
  color: #3d1820;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.15rem;
}

/* ── Note ─────────────────────────────────────────────── */
.section-note { padding: 0 2rem 4rem; }
.note-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1.25rem 1.5rem;
  background: rgba(232, 116, 138, 0.07);
  border: 1px solid rgba(232, 116, 138, 0.2);
  border-radius: 1rem;
  font-size: 0.9rem;
  color: rgba(61, 24, 32, 0.7);
  line-height: 1.6;
}
.note-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 0.05rem; }

/* ── FAQ ──────────────────────────────────────────────── */
.section-faq { padding: 5rem 2rem; background: #fff; }
.faq-inner { max-width: 760px; margin: 0 auto; }

.faq-list { display: flex; flex-direction: column; gap: 0; }

.faq-item {
  border-bottom: 1px solid rgba(61, 24, 32, 0.08);
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 0.5rem;
  padding: 0 0.5rem;
}
.faq-item:first-child { border-top: 1px solid rgba(61, 24, 32, 0.08); }
.faq-item:hover { background: rgba(61, 24, 32, 0.02); }

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: #3d1820;
  gap: 1rem;
  user-select: none;
}

.faq-arrow {
  font-size: 1.2rem;
  font-weight: 400;
  color: #e8748a;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.faq-answer {
  padding: 0 0 1.1rem;
  font-size: 0.9rem;
  color: rgba(61, 24, 32, 0.65);
  line-height: 1.7;
}

/* ── CTA ──────────────────────────────────────────────── */
.section-cta { padding: 5rem 2rem; background: #3d1820; text-align: center; }
.cta-inner { max-width: 580px; margin: 0 auto; }

.cta-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2rem, 4vw, 2.75rem);
  color: #f5ede4;
  margin: 0 0 1rem;
  line-height: 1.15;
}

.cta-sub { font-size: 1.05rem; color: rgba(245, 237, 228, 0.6); line-height: 1.65; margin-bottom: 2rem; }
.cta-btns { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }

.btn-hero-primary {
  padding: 0.8rem 1.85rem;
  background: #f5ede4;
  color: #3d1820;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-hero-primary:hover  { opacity: 0.88; }
.btn-hero-primary:active { transform: scale(0.97); }

.btn-hero-ghost { padding: 0.8rem 1.5rem; font-weight: 600; font-size: 0.95rem; text-decoration: none; transition: opacity 0.15s; }
.btn-hero-ghost.light { color: rgba(245, 237, 228, 0.7); }
.btn-hero-ghost.light:hover { color: #f5ede4; }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 860px) {
  .plans-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
}
</style>
