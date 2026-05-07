<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title:       'Postfolio — Schema-Driven Internal Tool Builder',
  description: 'Build, deploy, and manage beautiful internal tools without writing frontend code. POS systems, inventory trackers, staff dashboards — all from one platform.',
});

const industries = [
  { icon: '🍽️', name: 'Restaurant & Café' },
  { icon: '📦', name: 'Logistics & Shipping' },
  { icon: '🛍️', name: 'Retail & POS' },
  { icon: '🏥', name: 'Healthcare' },
  { icon: '🏗️', name: 'Construction' },
  { icon: '📊', name: 'Finance & CRM' },
];

const pillars = [
  { icon: '🗄️', title: 'Schema Editor',    body: 'Design your database with an interactive table editor and live relational visualizer.' },
  { icon: '🎨', title: 'Visual UI Builder', body: 'Drag-and-drop interfaces with an event system, transactional branching, and scanner support.' },
  { icon: '📺', title: 'Instant Terminals', body: 'Deploy staff-facing or public kiosk terminals with role-based PIN access and unique URLs.' },
  { icon: '⚡', title: 'Smart Onboarding',  body: 'Industry presets auto-provision your setup. Go from zero to a working tool in minutes.' },
];

const tableRows = [
  { col: 'id',          type: 'uuid',      key: 'PK', keyClass: 'pk' },
  { col: 'name',        type: 'varchar',   key: '',   keyClass: '' },
  { col: 'price',       type: 'decimal',   key: '',   keyClass: '' },
  { col: 'category_id', type: 'uuid',      key: 'FK', keyClass: 'fk' },
  { col: 'created_at',  type: 'timestamp', key: '',   keyClass: '' },
];
</script>

<template>
  <!-- ── Hero ─────────────────────────────────────────────── -->
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-badge">
        <span class="badge-dot" />
        Now in early access
      </div>

      <h1 class="hero-headline">
        Internal tools that
        <em>feel as good</em>
        as the products they support.
      </h1>

      <p class="hero-sub">
        Postfolio is a schema-driven platform for building and deploying custom internal tools — POS systems, inventory dashboards, CRM portals — without writing a single line of frontend code.
      </p>

      <div class="hero-cta">
        <NuxtLink to="/login" class="btn-primary btn-ribbon">Start building free</NuxtLink>
        <NuxtLink to="/features" class="btn-ghost-link">See how it works →</NuxtLink>
      </div>
    </div>

    <div class="hero-preview">
      <div class="preview-card">
        <div class="preview-header">
          <div class="preview-dots">
            <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
          </div>
          <span class="preview-title">Schema Editor</span>
        </div>
        <div class="preview-table">
          <div class="table-head">
            <span>Column</span><span>Type</span><span>Key</span>
          </div>
          <div v-for="(row, i) in tableRows" :key="row.col" class="table-row" :class="{ 'row-alt': i % 2 !== 0 }">
            <span class="col-name">{{ row.col }}</span>
            <span class="type-badge">{{ row.type }}</span>
            <span v-if="row.key" :class="['key-badge', row.keyClass]">{{ row.key }}</span>
            <span v-else />
          </div>
        </div>
      </div>

      <div class="preview-card">
        <div class="preview-header">
          <div class="preview-dots">
            <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
          </div>
          <span class="preview-title">POS Terminal</span>
        </div>
        <div class="terminal-mock">
          <div class="terminal-items">
            <div class="t-item"><span>Flat White</span><span>$5.50</span></div>
            <div class="t-item t-alt"><span>Croissant</span><span>$4.00</span></div>
            <div class="t-item"><span>Iced Matcha</span><span>$6.00</span></div>
          </div>
          <div class="terminal-total">
            <span>Total</span><span class="total-val">$15.50</span>
          </div>
          <div class="terminal-charge btn-ribbon" style="--ribbon-color: #68293A;">Charge</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Industry strip ────────────────────────────────────── -->
  <section class="section-industries">
    <div class="section-inner">
      <p class="overline">Works for any business</p>
      <div class="industry-grid">
        <div v-for="ind in industries" :key="ind.name" class="industry-chip">
          <span>{{ ind.icon }}</span>
          <span>{{ ind.name }}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Pillars ───────────────────────────────────────────── -->
  <section class="section-pillars">
    <div class="section-inner">
      <div class="section-label-block">
        <p class="overline">The Platform</p>
        <h2 class="section-heading">Everything you need,<br><em>nothing you don't.</em></h2>
        <p class="section-sub">Four integrated modules that take you from data model to deployed staff terminal.</p>
      </div>
      <div class="pillar-grid">
        <div v-for="p in pillars" :key="p.title" class="pillar-card">
          <span class="pillar-icon">{{ p.icon }}</span>
          <h3 class="pillar-title">{{ p.title }}</h3>
          <p class="pillar-body">{{ p.body }}</p>
          <NuxtLink to="/features" class="pillar-link">Learn more →</NuxtLink>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Philosophy ────────────────────────────────────────── -->
  <section class="section-philosophy">
    <div class="section-inner philosophy-inner">
      <div class="philosophy-text">
        <p class="overline">Our philosophy</p>
        <h2 class="section-heading">Most internal tools are either too rigid or too ugly.</h2>
        <p class="section-sub">
          SaaS tools lock you into their model. Custom builds look terrible and take months. Postfolio is built on the belief that internal tools should feel as premium as the products they support — and be ready in minutes.
        </p>
        <NuxtLink to="/features" class="btn-secondary" style="margin-top: 1.75rem;">Explore the platform →</NuxtLink>
      </div>
      <div class="philosophy-badges">
        <div class="badge-card badge-plain">
          <p class="badge-title">Schema-First</p>
          <p class="badge-body">Your data model is the source of truth. Postfolio handles everything else automatically.</p>
        </div>
        <div class="badge-card badge-dark">
          <p class="badge-title">UI-Driven</p>
          <p class="badge-body">Design staff-facing interfaces in a Figma-like canvas — no HTML required.</p>
        </div>
        <div class="badge-card badge-brand">
          <p class="badge-title">Terminal Isolation</p>
          <p class="badge-body">Deploy role-based terminals that are secure, authenticated, and purpose-built.</p>
        </div>
        <div class="badge-card badge-outline">
          <p class="badge-title">Dynamic Theming</p>
          <p class="badge-body">Your brand colors propagate instantly across every generated interface.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── CTA ───────────────────────────────────────────────── -->
  <section class="section-cta">
    <div class="section-inner cta-inner">
      <h2 class="cta-heading">Ready to build something <em>beautiful?</em></h2>
      <p class="cta-sub">Join forward-thinking businesses using Postfolio to manage their operations in style.</p>
      <div class="cta-btns">
        <NuxtLink to="/login" class="btn-primary btn-ribbon">Get started — it's free</NuxtLink>
        <NuxtLink to="/pricing" class="btn-ghost-link">View pricing →</NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Shared ─────────────────────────────────────────── */
.section-inner {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 2rem;
}

.overline {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #FF5776;
  margin-bottom: 0.85rem;
}

.section-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.9rem, 3.6vw, 2.5rem);
  color: #68293A;
  line-height: 1.18;
  margin: 0 0 0.9rem;
  text-decoration: none;
}
.section-heading em { font-style: italic; color: #FF5776; text-decoration: none; }

.section-sub {
  font-size: 1rem;
  color: rgba(104, 41, 58, 0.58);
  line-height: 1.7;
  max-width: 520px;
}

.section-label-block {
  text-align: center;
  max-width: 560px;
  margin: 0 auto 3.5rem;
}
.section-label-block .section-sub { margin: 0 auto; }

/* ── Buttons ─────────────────────────────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1.6rem;
  background: #68293A;
  color: #F6E6D7;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.925rem;
  text-decoration: none;
  overflow: visible;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 3px 14px rgba(104, 41, 58, 0.22);
}
.btn-primary:hover  { opacity: 0.88; }
.btn-primary:active { transform: scale(0.97); }

.btn-light {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1.6rem;
  background: #F6E6D7;
  color: #68293A;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.925rem;
  text-decoration: none;
  overflow: visible;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.1);
}
.btn-light:hover  { opacity: 0.88; }
.btn-light:active { transform: scale(0.97); }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1.6rem;
  background: transparent;
  color: #68293A;
  border: 1.5px solid rgba(104, 41, 58, 0.25);
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.925rem;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
.btn-secondary:hover { border-color: rgba(104, 41, 58, 0.5); background: rgba(104, 41, 58, 0.04); }

.btn-ghost-link {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1rem;
  color: #68293A;
  font-weight: 600;
  font-size: 0.925rem;
  text-decoration: none;
  transition: opacity 0.15s;
}
.btn-ghost-link:hover { opacity: 0.55; }
.btn-ghost-link.ghost-light { color: rgba(246, 230, 215, 0.75); }
.btn-ghost-link.ghost-light:hover { opacity: 0.8; }

/* ── Hero ─────────────────────────────────────────────── */
.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  max-width: 1160px;
  margin: 0 auto;
  padding: 5.5rem 2rem 6rem;
  overflow: visible;
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
  font-size: clamp(2.2rem, 4vw, 3rem);
  line-height: 1.12;
  color: #68293A;
  margin: 0 0 1.2rem;
  text-decoration: none;
}
.hero-headline em { font-style: italic; color: #FF5776; text-decoration: none; }

.hero-sub {
  font-size: 1rem;
  line-height: 1.72;
  color: rgba(104, 41, 58, 0.58);
  max-width: 440px;
  margin-bottom: 2rem;
}

.hero-inner   { position: relative; z-index: 1; }

.hero-cta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ── Hero preview cards ───────────────────────────────── */
.hero-preview {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-card {
  background: #FFFFFF;
  border-radius: 0.75rem;
  border: 1px solid rgba(104, 41, 58, 0.09);
  box-shadow: 0 6px 24px rgba(104, 41, 58, 0.08), 0 1px 4px rgba(104, 41, 58, 0.05);
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.07);
  background: #F6E6D7;
}

.preview-dots { display: flex; align-items: center; gap: 0.32rem; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-red    { background: #FF5F56; }
.dot-yellow { background: #FFBD2E; }
.dot-green  { background: #27C93F; }

.preview-title {
  font-size: 0.74rem;
  font-weight: 600;
  color: rgba(104, 41, 58, 0.45);
  margin-left: 0.2rem;
}

/* Schema table */
.preview-table { padding: 0.6rem; display: flex; flex-direction: column; }

.table-head {
  display: grid;
  grid-template-columns: 2fr 1.4fr 0.7fr;
  gap: 0.5rem;
  padding: 0 0.6rem 0.4rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(104, 41, 58, 0.32);
  border-bottom: 1px solid rgba(104, 41, 58, 0.08);
  margin-bottom: 0.2rem;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1.4fr 0.7fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.36rem 0.6rem;
  border-radius: 0.35rem;
  font-size: 0.78rem;
  color: rgba(104, 41, 58, 0.7);
}
.row-alt { background: #F6E6D7; }

.col-name { font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; }

.type-badge {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  background: rgba(255, 87, 118, 0.1);
  color: #FF5776;
  border-radius: 3px;
  font-size: 0.66rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.key-badge {
  display: inline-block;
  padding: 0.1rem 0.38rem;
  border-radius: 3px;
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.key-badge.pk { background: rgba(104, 41, 58, 0.1); color: #68293A; }
.key-badge.fk { background: transparent; color: rgba(104, 41, 58, 0.5); border: 1px solid rgba(104, 41, 58, 0.18); }

/* Terminal preview */
.terminal-mock { padding: 0.85rem; }
.terminal-items { display: flex; flex-direction: column; margin-bottom: 0.7rem; }

.t-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: rgba(104, 41, 58, 0.7);
  padding: 0.36rem 0.55rem;
  border-radius: 0.35rem;
}
.t-alt { background: #F6E6D7; }

.terminal-total {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.55rem;
  font-weight: 600;
  font-size: 0.86rem;
  color: #68293A;
  border-top: 1px solid rgba(104, 41, 58, 0.1);
  margin-bottom: 0.7rem;
}
.total-val { font-family: 'DM Serif Display', serif; font-size: 1rem; }

.terminal-charge {
  text-align: center;
  padding: 0.55rem;
  background: #68293A;
  color: #F6E6D7;
  border-radius: 0.5rem;
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  overflow: visible;
  transition: opacity 0.15s;
}
.terminal-charge:hover { opacity: 0.88; }

/* ── Industries ───────────────────────────────────────── */
.section-industries {
  padding: 1rem 0 3rem;
  text-align: center;
}
.section-industries .section-inner { display: flex; flex-direction: column; align-items: center; }

.industry-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.55rem;
}

.industry-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.42rem 0.95rem;
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.1);
  border-radius: 0.45rem;
  font-size: 0.855rem;
  font-weight: 500;
  color: #68293A;
  transition: border-color 0.15s, transform 0.15s;
}
.industry-chip:hover { border-color: rgba(255, 87, 118, 0.3); transform: translateY(-1px); }

/* ── Pillars ──────────────────────────────────────────── */
.section-pillars {
  padding: 5rem 0;
}

.pillar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.1rem;
}

.pillar-card {
  padding: 1.5rem;
  background: #FFFFFF;
  border-radius: 0.75rem;
  border: 1px solid rgba(104, 41, 58, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.pillar-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(104, 41, 58, 0.09);
}

.pillar-icon  { font-size: 1.5rem; }
.pillar-title { font-weight: 700; font-size: 0.98rem; color: #68293A; margin: 0; }
.pillar-body  { font-size: 0.845rem; color: rgba(104, 41, 58, 0.58); line-height: 1.6; flex: 1; margin: 0; }
.pillar-link  { font-size: 0.79rem; font-weight: 600; color: #FF5776; text-decoration: none; margin-top: 0.3rem; }
.pillar-link:hover { text-decoration: underline; }

/* ── Philosophy ───────────────────────────────────────── */
.section-philosophy { padding: 5rem 0; }

.philosophy-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
}

.philosophy-badges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.badge-card {
  border-radius: 0.75rem;
  padding: 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.badge-plain   { background: #FFFFFF; border: 1px solid rgba(104, 41, 58, 0.09); }
.badge-dark    { background: #68293A; color: #F6E6D7; }
.badge-brand   { background: #FF5776; color: #FFFFFF; }
.badge-outline { background: transparent; border: 1.5px solid rgba(104, 41, 58, 0.14); }

.badge-title { font-weight: 700; font-size: 0.9rem; margin: 0; }
.badge-body  { font-size: 0.81rem; line-height: 1.55; margin: 0; opacity: 0.74; }
.badge-dark .badge-body, .badge-brand .badge-body { opacity: 0.82; }

/* ── CTA ──────────────────────────────────────────────── */
.section-cta {
  padding: 5.5rem 0;
  background: #FFFFFF;
  border-top: 1px solid rgba(104, 41, 58, 0.07);
}

.cta-inner {
  text-align: center;
  max-width: 620px;
}

.cta-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.85rem, 3.6vw, 2.6rem);
  color: #68293A;
  line-height: 1.15;
  margin: 0 0 0.85rem;
  text-decoration: none;
}
.cta-heading em { font-style: italic; color: #FF5776; text-decoration: none; }

.cta-sub {
  font-size: 1rem;
  color: rgba(104, 41, 58, 0.52);
  line-height: 1.65;
  margin-bottom: 2rem;
}

.cta-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; gap: 3rem; padding: 3.5rem 1.5rem 4rem; }
  .hero-preview { display: none; }
  .pillar-grid { grid-template-columns: 1fr 1fr; }
  .philosophy-inner { grid-template-columns: 1fr; gap: 3rem; }
}

@media (max-width: 600px) {
  .pillar-grid { grid-template-columns: 1fr; }
  .philosophy-badges { grid-template-columns: 1fr; }
}
</style>
