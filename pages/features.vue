<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title:       'Features — Postfolio',
  description: 'Explore every module of Postfolio: Schema Editor, Visual UI Builder, Terminal Deployer, and Smart Onboarding.',
});

const modules = [
  {
    tag:    'Module 01',
    title:  'Smart Onboarding',
    body:   'Select your industry, pick the features you need, and Postfolio provisions your entire database schema in a single transactional step. No SQL. No config files.',
    points: ['Industry presets (Café, Retail, CRM, Logistics…)', 'Preset + Override feature selection', 'Instant schema provisioning via unified API', 'Re-configurable at any time from settings'],
    icon:   '⚡',
    color:  'cream',
  },
  {
    tag:    'Module 02',
    title:  'Schema Editor',
    body:   'Design your domain model with a visual table editor. Foreign keys are drawn as live arrows. A built-in normalization analyzer targets 3.5NF / BCNF and flags issues before they become technical debt.',
    points: ['Interactive inline data editor', 'Live relational schema visualizer', 'Normalization analyzer (3.5NF / BCNF)', 'Auto-generated DDL, no raw SQL required'],
    icon:   '🗄️',
    color:  'maroon',
  },
  {
    tag:    'Module 03',
    title:  'Visual UI Builder',
    body:   'A Figma-inspired canvas where you drag, drop, and wire up components. An event system handles everything from database inserts to conditional branching — entirely without code.',
    points: ['Infinite panning & zooming canvas', 'Drag-and-drop elements (Tables, Carts, Inputs…)', 'No-code event system with transactional branching', 'Hardware barcode & QR scanner support', 'Smart Properties bar + advanced sidebar'],
    icon:   '🎨',
    color:  'pink',
  },
  {
    tag:    'Module 04',
    title:  'Terminal Deployer',
    body:   'Publish any layout to a dedicated terminal — staff-facing, kiosk, or public. Each terminal gets a unique URL slug, PIN-based role access, and context injection via query parameters.',
    points: ['Staff terminals with PIN authentication', 'Public / kiosk mode with unique URL slugs', 'Context injection via $$session.* variables', 'Pixel-perfect scaling on any screen size'],
    icon:   '📺',
    color:  'cream',
  },
];

const extras = [
  { icon: '🔐', title: 'Role-Based Access',    body: 'Every terminal enforces staff roles through secure PIN authentication.' },
  { icon: '🎨', title: 'Dynamic Theming',       body: 'Brand colors propagate instantly across every generated interface.' },
  { icon: '📱', title: 'Responsive by Default', body: 'Layouts scale perfectly from kiosk displays to mobile browsers.' },
  { icon: '⚡', title: 'Bun-Powered Runtime',   body: 'Ultra-fast server built on Bun and Nuxt 3 — cold starts in milliseconds.' },
  { icon: '🗃️', title: 'Hybrid Database',       body: 'SQLite locally, Supabase/PostgreSQL in production. Toggle with one env var.' },
  { icon: '🔗', title: 'URL Context Injection',  body: 'Pass contextual data (table_id, session vars) directly into terminal events.' },
];
</script>

<template>
  <!-- ── Hero ─────────────────────────────────────────────── -->
  <section class="feat-hero">
    <div class="feat-hero-inner">
      <p class="overline">The Platform</p>
      <h1 class="feat-heading">Four modules.<br><em>One seamless platform.</em></h1>
      <p class="feat-sub">
        Postfolio is built from four deeply integrated modules that take you from a blank slate to a fully deployed internal tool — without touching frontend code.
      </p>
    </div>
  </section>

  <!-- ── Module sections ──────────────────────────────────── -->
  <div class="modules-wrapper">
    <section
      v-for="(mod, i) in modules"
      :key="mod.tag"
      class="module-section"
      :class="`module--${mod.color}`"
    >
      <div class="module-inner" :class="{ 'module-inner--reverse': i % 2 !== 0 }">
        <div class="module-text">
          <p class="module-tag">{{ mod.tag }}</p>
          <span class="module-icon">{{ mod.icon }}</span>
          <h2 class="module-title">{{ mod.title }}</h2>
          <p class="module-body">{{ mod.body }}</p>
          <ul class="module-points">
            <li v-for="pt in mod.points" :key="pt">
              <span class="check">✓</span> {{ pt }}
            </li>
          </ul>
        </div>

        <div class="module-visual">
          <div class="visual-blob" />
          <div class="visual-card">
            <p class="visual-label">{{ mod.title }}</p>
            <div class="visual-lines">
              <div v-for="n in 5" :key="n" class="visual-line" :style="{ width: `${55 + n * 8}%`, opacity: 0.8 - n * 0.1 }" />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- ── Extra capabilities ─────────────────────────────────── -->
  <section class="section-extras">
    <div class="extras-inner">
      <div class="section-label-block">
        <p class="overline">And more</p>
        <h2 class="section-heading">Built for the real world.</h2>
        <p class="section-sub">Every detail of Postfolio is designed to handle the messy reality of running a business.</p>
      </div>

      <div class="extras-grid">
        <div v-for="ex in extras" :key="ex.title" class="extra-card">
          <span class="extra-icon">{{ ex.icon }}</span>
          <h3 class="extra-title">{{ ex.title }}</h3>
          <p class="extra-body">{{ ex.body }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── CTA ───────────────────────────────────────────────── -->
  <section class="section-cta">
    <div class="cta-inner">
      <h2 class="cta-heading">Ready to see it in action?</h2>
      <p class="cta-sub">Start building your first internal tool today. No credit card required.</p>
      <div class="cta-btns">
        <NuxtLink to="/login" class="btn-hero-primary">Get started free</NuxtLink>
        <NuxtLink to="/pricing" class="btn-hero-ghost light">See pricing →</NuxtLink>
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

.section-sub {
  font-size: 1.05rem;
  color: rgba(61, 24, 32, 0.6);
  line-height: 1.65;
  max-width: 520px;
}

.section-label-block {
  text-align: center;
  max-width: 580px;
  margin: 0 auto 3.5rem;
}
.section-label-block .section-sub { margin: 0 auto; }

/* ── Hero ─────────────────────────────────────────────── */
.feat-hero {
  padding: 5.5rem 2rem 4.5rem;
  text-align: center;
  background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(232, 116, 138, 0.1) 0%, transparent 70%);
}

.feat-hero-inner { max-width: 680px; margin: 0 auto; }

.feat-heading {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2.4rem, 5vw, 3.5rem);
  color: #3d1820;
  line-height: 1.12;
  margin: 0 0 1.25rem;
}
.feat-heading em { font-style: italic; color: #e8748a; }

.feat-sub {
  font-size: 1.1rem;
  color: rgba(61, 24, 32, 0.6);
  line-height: 1.7;
}

/* ── Modules ──────────────────────────────────────────── */
.modules-wrapper { display: flex; flex-direction: column; }

.module-section { padding: 5rem 2rem; }
.module--cream  { background: #fdf7f2; }
.module--maroon { background: #3d1820; }
.module--pink   { background: #e8748a; }

.module-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}
.module-inner--reverse { direction: rtl; }
.module-inner--reverse > * { direction: ltr; }

.module-tag {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}
.module--cream  .module-tag { color: #e8748a; }
.module--maroon .module-tag { color: rgba(245, 237, 228, 0.5); }
.module--pink   .module-tag { color: rgba(255, 255, 255, 0.7); }

.module-icon { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }

.module-title {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  line-height: 1.15;
  margin: 0 0 1rem;
}
.module--cream  .module-title { color: #3d1820; }
.module--maroon .module-title { color: #f5ede4; }
.module--pink   .module-title { color: #fff; }

.module-body { font-size: 1rem; line-height: 1.7; margin-bottom: 1.5rem; }
.module--cream  .module-body { color: rgba(61, 24, 32, 0.65); }
.module--maroon .module-body { color: rgba(245, 237, 228, 0.65); }
.module--pink   .module-body { color: rgba(255, 255, 255, 0.8); }

.module-points { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.55rem; }
.module-points li { display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.92rem; line-height: 1.5; }
.module--cream  .module-points li { color: rgba(61, 24, 32, 0.75); }
.module--maroon .module-points li { color: rgba(245, 237, 228, 0.75); }
.module--pink   .module-points li { color: rgba(255, 255, 255, 0.85); }

.check {
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 0.2rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.module--cream  .check { background: rgba(61, 24, 32, 0.08); color: #3d1820; }
.module--maroon .check { background: rgba(245, 237, 228, 0.12); color: #f5ede4; }
.module--pink   .check { background: rgba(255, 255, 255, 0.2); color: #fff; }

/* ── Module visual placeholder ────────────────────────── */
.module-visual { position: relative; }

.visual-blob {
  position: absolute;
  inset: -20px;
  border-radius: 40% 60% 55% 45% / 45% 40% 60% 55%;
  opacity: 0.08;
  filter: blur(24px);
}
.module--cream  .visual-blob { background: #3d1820; }
.module--maroon .visual-blob { background: #f5ede4; }
.module--pink   .visual-blob { background: #fff; }

.visual-card {
  position: relative;
  padding: 2rem;
  border-radius: 1.5rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
.module--cream  .visual-card { background: #fff; border: 1px solid rgba(61, 24, 32, 0.08); }
.module--maroon .visual-card { background: rgba(245, 237, 228, 0.07); border: 1px solid rgba(245, 237, 228, 0.12); }
.module--pink   .visual-card { background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); }

.visual-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
}
.module--cream  .visual-label { color: rgba(61, 24, 32, 0.35); }
.module--maroon .visual-label { color: rgba(245, 237, 228, 0.35); }
.module--pink   .visual-label { color: rgba(255, 255, 255, 0.5); }

.visual-lines { display: flex; flex-direction: column; gap: 0.7rem; }

.visual-line {
  height: 10px;
  border-radius: 9999px;
}
.module--cream  .visual-line { background: rgba(61, 24, 32, 0.08); }
.module--maroon .visual-line { background: rgba(245, 237, 228, 0.1); }
.module--pink   .visual-line { background: rgba(255, 255, 255, 0.2); }

/* ── Extras ───────────────────────────────────────────── */
.section-extras { padding: 5.5rem 2rem; background: #fff; }
.extras-inner { max-width: 1100px; margin: 0 auto; }

.extras-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.extra-card {
  padding: 1.75rem;
  border-radius: 1.15rem;
  background: #fdf7f2;
  border: 1px solid rgba(61, 24, 32, 0.07);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.extra-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(61, 24, 32, 0.09); }

.extra-icon  { font-size: 1.6rem; }
.extra-title { font-weight: 700; font-size: 1rem; color: #3d1820; margin: 0; }
.extra-body  { font-size: 0.875rem; color: rgba(61, 24, 32, 0.58); line-height: 1.6; margin: 0; }

/* ── CTA ──────────────────────────────────────────────── */
.section-cta { padding: 5rem 2rem; background: #3d1820; text-align: center; }
.cta-inner { max-width: 620px; margin: 0 auto; }

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

.btn-hero-ghost {
  padding: 0.8rem 1.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  transition: opacity 0.15s;
}
.btn-hero-ghost.light { color: rgba(245, 237, 228, 0.75); }
.btn-hero-ghost.light:hover { color: #f5ede4; }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .module-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .module-inner--reverse { direction: ltr; }
  .module-visual { display: none; }
  .extras-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  .extras-grid { grid-template-columns: 1fr; }
}
</style>
