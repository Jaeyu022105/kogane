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
  {
    icon: '🗄️',
    title: 'Schema Editor',
    body: 'Design your database with an interactive table editor and live relational visualizer. Normalization hints included.',
  },
  {
    icon: '🎨',
    title: 'Visual UI Builder',
    body: 'Drag-and-drop interfaces with an event system, transactional branching, and hardware scanner support.',
  },
  {
    icon: '📺',
    title: 'Instant Terminals',
    body: 'Deploy staff-facing or public kiosk terminals with role-based PIN access and unique URL slugs.',
  },
  {
    icon: '⚡',
    title: 'Smart Onboarding',
    body: 'Industry presets auto-provision your schema. Go from zero to a working internal tool in minutes.',
  },
];

const stats = [
  { value: '< 5 min', label: 'Time to first terminal' },
  { value: '3.5NF',   label: 'Normalization target' },
  { value: '∞',       label: 'UI elements per layout' },
  { value: '100%',    label: 'No frontend code needed' },
];
</script>

<template>
  <!-- ── Hero ─────────────────────────────────────────────── -->
  <section class="hero">
    <div class="hero-bg-mesh" />
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
        Postfolio is a schema-driven platform for building, deploying, and managing custom internal tools — POS systems, inventory dashboards, CRM portals — without writing a single line of frontend code.
      </p>

      <div class="hero-cta">
        <NuxtLink to="/login" class="btn-hero-primary">Start building free</NuxtLink>
        <NuxtLink to="/features" class="btn-hero-ghost">See how it works →</NuxtLink>
      </div>

      <!-- Floating stat pills -->
      <div class="hero-stats">
        <div v-for="stat in stats" :key="stat.label" class="stat-pill">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- Decorative UI preview -->
    <div class="hero-preview">
      <div class="preview-card preview-card--schema">
        <div class="preview-header">
          <span class="preview-dot red" />
          <span class="preview-dot yellow" />
          <span class="preview-dot green" />
          <span class="preview-title">Schema Editor</span>
        </div>
        <div class="preview-table">
          <div class="table-row header">
            <span>Column</span><span>Type</span><span>Key</span>
          </div>
          <div class="table-row"><span>id</span><span class="type-badge">uuid</span><span class="key-badge pk">PK</span></div>
          <div class="table-row"><span>name</span><span class="type-badge">varchar</span><span /></div>
          <div class="table-row"><span>price</span><span class="type-badge">decimal</span><span /></div>
          <div class="table-row"><span>category_id</span><span class="type-badge">uuid</span><span class="key-badge fk">FK</span></div>
          <div class="table-row"><span>created_at</span><span class="type-badge">timestamp</span><span /></div>
        </div>
      </div>

      <div class="preview-card preview-card--terminal">
        <div class="preview-header">
          <span class="preview-dot red" />
          <span class="preview-dot yellow" />
          <span class="preview-dot green" />
          <span class="preview-title">POS Terminal</span>
        </div>
        <div class="terminal-mock">
          <div class="terminal-items">
            <div class="t-item"><span>Flat White</span><span>$5.50</span></div>
            <div class="t-item"><span>Croissant</span><span>$4.00</span></div>
            <div class="t-item"><span>Iced Matcha</span><span>$6.00</span></div>
          </div>
          <div class="terminal-total">
            <span>Total</span><span class="total-val">$15.50</span>
          </div>
          <div class="terminal-btn">Charge</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Industry presets ──────────────────────────────────── -->
  <section class="section-industries">
    <div class="section-inner">
      <p class="overline">Works for any business</p>
      <div class="industry-grid">
        <div v-for="ind in industries" :key="ind.name" class="industry-chip">
          <span class="industry-icon">{{ ind.icon }}</span>
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
        <p class="section-sub">Four deeply integrated modules that take you from raw data model to deployed staff terminal.</p>
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
        <NuxtLink to="/features" class="btn-maroon">Explore the platform →</NuxtLink>
      </div>

      <div class="philosophy-badges">
        <div class="badge-card badge-cream">
          <p class="badge-card-title">Schema-First</p>
          <p class="badge-card-body">Your data model is the source of truth. Postfolio handles all DDL automatically.</p>
        </div>
        <div class="badge-card badge-maroon">
          <p class="badge-card-title">UI-Driven</p>
          <p class="badge-card-body">Design staff-facing interfaces in a Figma-like canvas — no HTML required.</p>
        </div>
        <div class="badge-card badge-pink">
          <p class="badge-card-title">Terminal Isolation</p>
          <p class="badge-card-body">Deploy role-based terminals that are secure, authenticated, and purpose-built.</p>
        </div>
        <div class="badge-card badge-outline">
          <p class="badge-card-title">Dynamic Theming</p>
          <p class="badge-card-body">Your brand colors propagate instantly across every generated interface.</p>
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
        <NuxtLink to="/login" class="btn-hero-primary">Get started — it's free</NuxtLink>
        <NuxtLink to="/pricing" class="btn-hero-ghost light">View pricing →</NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Shared ─────────────────────────────────────────── */
.section-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

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
  font-size: clamp(2rem, 4vw, 2.75rem);
  color: #3d1820;
  line-height: 1.18;
  margin: 0 0 1rem;
}
.section-heading em { font-style: italic; color: #e8748a; }

.section-sub {
  font-size: 1.05rem;
  color: rgba(61, 24, 32, 0.6);
  line-height: 1.65;
  max-width: 540px;
}

.section-label-block {
  text-align: center;
  max-width: 600px;
  margin: 0 auto 3.5rem;
}
.section-label-block .section-sub { margin: 0 auto; }

.btn-maroon {
  display: inline-block;
  margin-top: 1.75rem;
  padding: 0.75rem 1.75rem;
  background: #3d1820;
  color: #f5ede4;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-maroon:hover  { opacity: 0.88; }
.btn-maroon:active { transform: scale(0.97); }

/* ── Hero ─────────────────────────────────────────────── */
.hero {
  position: relative;
  overflow: hidden;
  padding: 5rem 2rem 6rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.hero-bg-mesh {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 55% at 10% 0%, rgba(232, 116, 138, 0.12) 0%, transparent 70%),
    radial-gradient(ellipse 45% 40% at 90% 100%, rgba(61, 24, 32, 0.06) 0%, transparent 60%);
  pointer-events: none;
}

.hero-inner { position: relative; z-index: 1; }

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  border: 1.5px solid rgba(232, 116, 138, 0.35);
  background: rgba(232, 116, 138, 0.08);
  font-size: 0.78rem;
  font-weight: 600;
  color: #c0405a;
  letter-spacing: 0.03em;
  margin-bottom: 1.5rem;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e8748a;
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(0.85); }
}

.hero-headline {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2.4rem, 4.5vw, 3.4rem);
  line-height: 1.12;
  color: #3d1820;
  margin: 0 0 1.25rem;
}
.hero-headline em { font-style: italic; color: #e8748a; }

.hero-sub {
  font-size: 1.05rem;
  line-height: 1.7;
  color: rgba(61, 24, 32, 0.62);
  max-width: 480px;
  margin-bottom: 2rem;
}

.hero-cta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2.5rem;
}

.btn-hero-primary {
  padding: 0.8rem 1.85rem;
  background: #3d1820;
  color: #f5ede4;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 4px 18px rgba(61, 24, 32, 0.22);
}
.btn-hero-primary:hover  { opacity: 0.88; }
.btn-hero-primary:active { transform: scale(0.97); }

.btn-hero-ghost {
  padding: 0.8rem 1.5rem;
  color: #3d1820;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  transition: opacity 0.15s;
}
.btn-hero-ghost:hover { opacity: 0.65; }
.btn-hero-ghost.light { color: #f5ede4; }

.hero-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  padding: 0.65rem 1rem;
  background: #fff;
  border-radius: 0.9rem;
  border: 1px solid rgba(61, 24, 32, 0.08);
  box-shadow: 0 2px 8px rgba(61, 24, 32, 0.06);
}

.stat-value {
  font-family: 'DM Serif Display', serif;
  font-size: 1.1rem;
  color: #3d1820;
  line-height: 1.1;
}

.stat-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(61, 24, 32, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.2rem;
}

/* ── Hero preview cards ───────────────────────────────── */
.hero-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  z-index: 1;
}

.preview-card {
  background: #fff;
  border-radius: 1.25rem;
  border: 1px solid rgba(61, 24, 32, 0.08);
  box-shadow: 0 8px 32px rgba(61, 24, 32, 0.1), 0 2px 6px rgba(61, 24, 32, 0.06);
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(61, 24, 32, 0.07);
  background: #fdf7f2;
}
.preview-dot { width: 10px; height: 10px; border-radius: 50%; }
.preview-dot.red    { background: #ff5f56; }
.preview-dot.yellow { background: #ffbd2e; }
.preview-dot.green  { background: #27c93f; }
.preview-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(61, 24, 32, 0.5);
  margin-left: 0.35rem;
  letter-spacing: 0.02em;
}

/* Schema preview */
.preview-table { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.table-row {
  display: grid;
  grid-template-columns: 2fr 1.2fr 0.8fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: rgba(61, 24, 32, 0.65);
}
.table-row.header {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(61, 24, 32, 0.35);
  padding-bottom: 0.5rem;
}
.table-row:not(.header):hover { background: #fdf7f2; }

.type-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: rgba(232, 116, 138, 0.1);
  color: #c0405a;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.key-badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.key-badge.pk { background: rgba(61, 24, 32, 0.1); color: #3d1820; }
.key-badge.fk { background: rgba(61, 24, 32, 0.05); color: rgba(61, 24, 32, 0.55); border: 1px solid rgba(61, 24, 32, 0.15); }

/* Terminal preview */
.terminal-mock { padding: 1rem; }
.terminal-items { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem; }
.t-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgba(61, 24, 32, 0.7);
  padding: 0.4rem 0.6rem;
  border-radius: 0.5rem;
  background: #fdf7f2;
}
.terminal-total {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.6rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: #3d1820;
  border-top: 1px solid rgba(61, 24, 32, 0.1);
  margin-bottom: 0.85rem;
}
.total-val { font-family: 'DM Serif Display', serif; font-size: 1.1rem; }
.terminal-btn {
  text-align: center;
  padding: 0.7rem;
  background: #3d1820;
  color: #f5ede4;
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.terminal-btn:hover { opacity: 0.88; }

/* ── Industries ───────────────────────────────────────── */
.section-industries {
  padding: 2rem 0 3.5rem;
  text-align: center;
}

.section-industries .section-inner { display: flex; flex-direction: column; align-items: center; }

.industry-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.industry-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.1rem;
  background: #fff;
  border: 1px solid rgba(61, 24, 32, 0.1);
  border-radius: 9999px;
  font-size: 0.88rem;
  font-weight: 500;
  color: #3d1820;
  box-shadow: 0 1px 4px rgba(61, 24, 32, 0.06);
  transition: border-color 0.15s, transform 0.15s;
}
.industry-chip:hover { border-color: rgba(61, 24, 32, 0.25); transform: translateY(-1px); }
.industry-icon { font-size: 1rem; }

/* ── Pillars ──────────────────────────────────────────── */
.section-pillars {
  padding: 5rem 0;
  background: #fff;
}

.pillar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

.pillar-card {
  padding: 1.75rem;
  background: #fdf7f2;
  border-radius: 1.25rem;
  border: 1px solid rgba(61, 24, 32, 0.07);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.pillar-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(61, 24, 32, 0.1);
}

.pillar-icon { font-size: 1.75rem; }
.pillar-title { font-weight: 700; font-size: 1.05rem; color: #3d1820; margin: 0; }
.pillar-body  { font-size: 0.875rem; color: rgba(61, 24, 32, 0.6); line-height: 1.6; flex: 1; margin: 0; }
.pillar-link  { font-size: 0.82rem; font-weight: 600; color: #e8748a; text-decoration: none; margin-top: 0.5rem; }
.pillar-link:hover { text-decoration: underline; }

/* ── Philosophy ───────────────────────────────────────── */
.section-philosophy {
  padding: 5rem 0;
}

.philosophy-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
}

.philosophy-badges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.badge-card {
  border-radius: 1.15rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.badge-cream   { background: #fdf7f2; border: 1px solid rgba(61, 24, 32, 0.08); }
.badge-maroon  { background: #3d1820; color: #f5ede4; }
.badge-pink    { background: #e8748a; color: #fff; }
.badge-outline { background: #fff; border: 1.5px solid rgba(61, 24, 32, 0.12); }

.badge-card-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin: 0;
}
.badge-card-body {
  font-size: 0.83rem;
  line-height: 1.55;
  margin: 0;
  opacity: 0.75;
}
.badge-maroon .badge-card-body,
.badge-pink   .badge-card-body { opacity: 0.8; }

/* ── CTA ──────────────────────────────────────────────── */
.section-cta {
  padding: 5rem 0;
  background: #3d1820;
}

.cta-inner {
  text-align: center;
  max-width: 680px;
}

.cta-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2rem, 4vw, 2.85rem);
  color: #f5ede4;
  line-height: 1.15;
  margin: 0 0 1rem;
}
.cta-heading em { font-style: italic; color: #e8748a; }

.cta-sub {
  font-size: 1.05rem;
  color: rgba(245, 237, 228, 0.65);
  line-height: 1.65;
  margin-bottom: 2rem;
}

.cta-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
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
