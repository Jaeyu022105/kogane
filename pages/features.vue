<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title:       'Features — Postfolio',
  description: 'Explore every module of Postfolio: Schema Editor, Visual UI Builder, Terminal Deployer, and Smart Onboarding.',
});

/* SVG path data for module icons — keeps template lean */
const icons = {
  onboarding: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M9 12h6 M9 16h4',
  schema:     'M4 7h16 M4 12h16 M4 17h10 M16 17l2 2 4-4',
  builder:    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  terminal:   'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z M8 10l2 2-2 2 M12 14h4',
};

const extraIcons = {
  lock:      'M12 2C9.24 2 7 4.24 7 7v3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3z',
  palette:   'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M8 14s.67 1 2 1 2-1 2-1 M15 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M9 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  mobile:    'M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z M12 18h.01',
  zap:       'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  database:  'M20 8c0 2.21-3.58 4-8 4S4 10.21 4 8s3.58-4 8-4 8 1.79 8 4z M4 8v8c0 2.21 3.58 4 8 4s8-1.79 8-4V8',
  link:      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
};

const modules = [
  {
    tag:    'Module 01',
    title:  'Smart Onboarding',
    body:   'Select your industry, pick the features you need, and Postfolio provisions your entire database schema in a single transactional step. No SQL. No config files.',
    points: ['Industry presets (Café, Retail, CRM, Logistics…)', 'Preset + Override feature selection', 'Instant schema provisioning via unified API', 'Re-configurable at any time from settings'],
    iconKey: 'onboarding' as keyof typeof icons,
    color:  'cream',
  },
  {
    tag:    'Module 02',
    title:  'Schema Editor',
    body:   'Design your domain model with a visual table editor. Foreign keys are drawn as live arrows. A built-in normalization analyzer targets 3.5NF / BCNF and flags issues before they become technical debt.',
    points: ['Interactive inline data editor', 'Live relational schema visualizer', 'Normalization analyzer (3.5NF / BCNF)', 'Auto-generated DDL, no raw SQL required'],
    iconKey: 'schema' as keyof typeof icons,
    color:  'maroon',
  },
  {
    tag:    'Module 03',
    title:  'Visual UI Builder',
    body:   'A Figma-inspired canvas where you drag, drop, and wire up components. An event system handles everything from database inserts to conditional branching — entirely without code.',
    points: ['Infinite panning & zooming canvas', 'Drag-and-drop elements (Tables, Carts, Inputs…)', 'No-code event system with transactional branching', 'Hardware barcode & QR scanner support', 'Smart Properties bar + advanced sidebar'],
    iconKey: 'builder' as keyof typeof icons,
    color:  'pink',
  },
  {
    tag:    'Module 04',
    title:  'Terminal Deployer',
    body:   'Publish any layout to a dedicated terminal — staff-facing, kiosk, or public. Each terminal gets a unique URL slug, PIN-based role access, and context injection via query parameters.',
    points: ['Staff terminals with PIN authentication', 'Public / kiosk mode with unique URL slugs', 'Context injection via $$session.* variables', 'Pixel-perfect scaling on any screen size'],
    iconKey: 'terminal' as keyof typeof icons,
    color:  'cream',
  },
];

const extras = [
  { iconKey: 'lock',     title: 'Role-Based Access',    body: 'Every terminal enforces staff roles through secure PIN authentication.' },
  { iconKey: 'palette',  title: 'Dynamic Theming',       body: 'Brand colors propagate instantly across every generated interface.' },
  { iconKey: 'mobile',   title: 'Responsive by Default', body: 'Layouts scale perfectly from kiosk displays to mobile browsers.' },
  { iconKey: 'zap',      title: 'Bun-Powered Runtime',   body: 'Ultra-fast server built on Bun and Nuxt 3 — cold starts in milliseconds.' },
  { iconKey: 'database', title: 'Hybrid Database',       body: 'SQLite locally, Supabase/PostgreSQL in production. Toggle with one env var.' },
  { iconKey: 'link',     title: 'URL Context Injection',  body: 'Pass contextual data (table_id, session vars) directly into terminal events.' },
];
</script>

<template>
  <!-- ── Hero ─────────────────────────────────────────────── -->
  <section class="feat-hero">
    <div class="m-inner feat-hero-inner">
      <p class="m-overline">The Platform</p>
      <h1 class="m-heading-lg">
        Four modules.<br>
        <em>One seamless platform.</em>
      </h1>
      <p class="feat-sub m-sub" style="margin: 0 auto;">
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

          <!-- icon chip -->
          <div class="module-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path :d="icons[mod.iconKey]" />
            </svg>
          </div>

          <h2 class="module-title">{{ mod.title }}</h2>
          <p class="module-body">{{ mod.body }}</p>

          <ul class="module-points">
            <li v-for="pt in mod.points" :key="pt">
              <!-- check icon -->
              <span class="module-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              {{ pt }}
            </li>
          </ul>
        </div>

        <div class="module-visual">
          <div class="visual-blob" />
          <div class="visual-card">
            <p class="visual-label">{{ mod.title }}</p>
            <div class="visual-lines">
              <div
                v-for="n in 5"
                :key="n"
                class="visual-line"
                :style="{ width: `${55 + n * 8}%`, opacity: 0.8 - n * 0.1 }"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- ── Extra capabilities ─────────────────────────────────── -->
  <section class="section-extras">
    <div class="extras-inner">
      <div class="m-label-block">
        <p class="m-overline">And more</p>
        <h2 class="m-heading">Built for the real world.</h2>
        <p class="m-sub" style="margin: 0 auto;">Every detail of Postfolio is designed to handle the messy reality of running a business.</p>
      </div>

      <div class="extras-grid">
        <div v-for="ex in extras" :key="ex.title" class="extra-card">
          <span class="extra-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path :d="extraIcons[ex.iconKey as keyof typeof extraIcons]" />
            </svg>
          </span>
          <h3 class="extra-title">{{ ex.title }}</h3>
          <p class="extra-body">{{ ex.body }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── CTA ───────────────────────────────────────────────── -->
  <section class="m-cta-strip">
    <div class="m-cta-inner">
      <h2 class="m-cta-heading">Ready to see it <em>in action?</em></h2>
      <p class="m-cta-sub">Start building your first internal tool today. No credit card required.</p>
      <div class="m-cta-btns">
        <NuxtLink to="/login" class="m-btn-primary ribbon">Get started free</NuxtLink>
        <NuxtLink to="/pricing" class="m-btn-ghost">See pricing →</NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────────── */
.feat-hero {
  padding: 5.5rem 0 4.5rem;
  text-align: center;
  background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255, 87, 118, 0.08) 0%, transparent 70%);
}

.feat-hero-inner { max-width: 680px; }

.feat-sub { max-width: 580px; }

/* ── Module sections ──────────────────────────────────── */
.modules-wrapper { display: flex; flex-direction: column; }

.module-section { padding: 5rem 2rem; }
.module--cream  { background: #FDFAF7; }
.module--maroon { background: #68293A; }
.module--pink   { background: #FF5776; }

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
.module--cream  .module-tag { color: #FF5776; }
.module--maroon .module-tag { color: rgba(246, 230, 215, 0.5); }
.module--pink   .module-tag { color: rgba(255, 255, 255, 0.7); }

/* icon wrap */
.module-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.65rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}
.module-icon-wrap svg { width: 1.4rem; height: 1.4rem; }

.module--cream  .module-icon-wrap { background: rgba(255, 87, 118, 0.1);   color: #FF5776; }
.module--maroon .module-icon-wrap { background: rgba(246, 230, 215, 0.12); color: #F6E6D7; }
.module--pink   .module-icon-wrap { background: rgba(255, 255, 255, 0.2);  color: #FFFFFF; }

.module-title {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  line-height: 1.15;
  margin: 0 0 1rem;
}
.module--cream  .module-title { color: #68293A; }
.module--maroon .module-title { color: #F6E6D7; }
.module--pink   .module-title { color: #FFFFFF; }

.module-body {
  font-size: 1rem;
  line-height: 1.7;
  margin-bottom: 1.5rem;
}
.module--cream  .module-body { color: rgba(104, 41, 58, 0.65); }
.module--maroon .module-body { color: rgba(246, 230, 215, 0.65); }
.module--pink   .module-body { color: rgba(255, 255, 255, 0.8); }

.module-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.module-points li {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  font-size: 0.92rem;
  line-height: 1.5;
}
.module--cream  .module-points li { color: rgba(104, 41, 58, 0.75); }
.module--maroon .module-points li { color: rgba(246, 230, 215, 0.75); }
.module--pink   .module-points li { color: rgba(255, 255, 255, 0.85); }

/* check icon */
.module-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.15rem;
}
.module-check svg { width: 10px; height: 10px; }

.module--cream  .module-check { background: rgba(104, 41, 58, 0.08); color: #68293A; }
.module--maroon .module-check { background: rgba(246, 230, 215, 0.12); color: #F6E6D7; }
.module--pink   .module-check { background: rgba(255, 255, 255, 0.2); color: #FFFFFF; }

/* ── Module visual placeholder ────────────────────────── */
.module-visual { position: relative; }

.visual-blob {
  position: absolute;
  inset: -20px;
  border-radius: 40% 60% 55% 45% / 45% 40% 60% 55%;
  opacity: 0.08;
  filter: blur(24px);
}
.module--cream  .visual-blob { background: #68293A; }
.module--maroon .visual-blob { background: #F6E6D7; }
.module--pink   .visual-blob { background: #FFFFFF; }

.visual-card {
  position: relative;
  padding: 2rem;
  border-radius: 0.75rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
.module--cream  .visual-card { background: #FFFFFF;                        border: 1px solid rgba(104, 41, 58, 0.08); }
.module--maroon .visual-card { background: rgba(246, 230, 215, 0.07);      border: 1px solid rgba(246, 230, 215, 0.12); }
.module--pink   .visual-card { background: rgba(255, 255, 255, 0.15);      border: 1px solid rgba(255, 255, 255, 0.25); }

.visual-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
}
.module--cream  .visual-label { color: rgba(104, 41, 58, 0.35); }
.module--maroon .visual-label { color: rgba(246, 230, 215, 0.35); }
.module--pink   .visual-label { color: rgba(255, 255, 255, 0.5); }

.visual-lines { display: flex; flex-direction: column; gap: 0.7rem; }

.visual-line {
  height: 10px;
  border-radius: 0.4rem;
}
.module--cream  .visual-line { background: rgba(104, 41, 58, 0.08); }
.module--maroon .visual-line { background: rgba(246, 230, 215, 0.1); }
.module--pink   .visual-line { background: rgba(255, 255, 255, 0.2); }

/* ── Extras ───────────────────────────────────────────── */
.section-extras {
  padding: 5.5rem 2rem;
  background: #FFFFFF;
}

.extras-inner { max-width: 1100px; margin: 0 auto; }

.extras-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.extra-card {
  padding: 1.75rem;
  border-radius: 0.75rem;
  background: #FDFAF7;
  border: 1px solid rgba(104, 41, 58, 0.07);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.extra-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(104, 41, 58, 0.09);
}

.extra-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.55rem;
  background: rgba(255, 87, 118, 0.1);
  color: #FF5776;
  margin-bottom: 0.25rem;
}
.extra-icon svg { width: 1.1rem; height: 1.1rem; }

.extra-title { font-weight: 700; font-size: 0.98rem; color: #68293A; margin: 0; }
.extra-body  { font-size: 0.855rem; color: rgba(104, 41, 58, 0.58); line-height: 1.6; margin: 0; }

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
