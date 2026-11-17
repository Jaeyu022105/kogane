<script setup lang="ts">
import BoltIcon from 'reicon-vue/icons/Bolt';
import CheckIcon from 'reicon-vue/icons/Check';
import DatabaseIcon from 'reicon-vue/icons/Database';
import DocumentTextIcon from 'reicon-vue/icons/DocumentText';
import LinkIcon from 'reicon-vue/icons/Link';
import ListCheckIcon from 'reicon-vue/icons/ListCheck';
import LockIcon from 'reicon-vue/icons/Lock';
import MobileIcon from 'reicon-vue/icons/Mobile';
import PaletteIcon from 'reicon-vue/icons/Palette';
import StarIcon from 'reicon-vue/icons/Star';
import TerminalSquareIcon from 'reicon-vue/icons/TerminalSquare';

const { t } = useLocale();
const { isEnabled } = useFeatureFlags();
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

/* Module icons (Reicon outline) */
const icons = {
  onboarding: DocumentTextIcon,
  schema:     ListCheckIcon,
  builder:    StarIcon,
  terminal:   TerminalSquareIcon,
};

const extraIcons = {
  lock:      LockIcon,
  palette:   PaletteIcon,
  mobile:    MobileIcon,
  zap:       BoltIcon,
  database:  DatabaseIcon,
  link:      LinkIcon,
};

const modules = computed(() => [
  {
    id:     'mod-01',
    tag:    t('mod_01_tag'),
    title:  t('mod_01_title'),
    body:   t('mod_01_body'),
    points: [t('mod_01_p1'), t('mod_01_p2'), t('mod_01_p3'), t('mod_01_p4')],
    iconKey: 'onboarding' as keyof typeof icons,
    color:  'cream',
  },
  {
    id:     'mod-02',
    tag:    t('mod_02_tag'),
    title:  t('mod_02_title'),
    body:   t('mod_02_body'),
    points: [t('mod_02_p1'), t('mod_02_p2'), t('mod_02_p3'), t('mod_02_p4')],
    iconKey: 'schema' as keyof typeof icons,
    color:  'maroon',
  },
  {
    id:     'mod-03',
    tag:    t('mod_03_tag'),
    title:  t('mod_03_title'),
    body:   t('mod_03_body'),
    points: [t('mod_03_p1'), t('mod_03_p2'), t('mod_03_p3'), t('mod_03_p4')],
    iconKey: 'builder' as keyof typeof icons,
    color:  'pink',
  },
  {
    id:     'mod-04',
    tag:    t('mod_04_tag'),
    title:  t('mod_04_title'),
    body:   t('mod_04_body'),
    points: [t('mod_04_p1'), t('mod_04_p2'), t('mod_04_p3'), t('mod_04_p4')],
    iconKey: 'terminal' as keyof typeof icons,
    color:  'cream',
  },
]);

/* Interactive Guided Setup specimen (Module 01) */
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

/* Interactive Preset Schema specimen (Module 02) */
const schemaMappings = [
  { table: 'orders', station: 'TRM-POS-01 · Counter POS', version: 'v2.4' },
  { table: 'deliveries', station: 'TRM-DSP-02 · Dispatch Console', version: 'v2.4' },
  { table: 'inventory', station: 'TRM-INV-03 · Stock Receiving', version: 'v2.4' },
  { table: 'appointments', station: 'TRM-APT-04 · Intake Desk', version: 'v2.4' },
];

/* Interactive Style Preset specimen (Module 03) */
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

/* Audit Trail specimen (Module 04) */
const auditSamples = [
  { time: '14:22', actor: 'Platform', action: 'preset:sync', target: 'v2.4 across 4 terminals' },
  { time: '14:18', actor: 'Cashier 01', action: 'order:insert', target: 'ORD-108 · $19.50' },
  { time: '14:05', actor: 'Owner', action: 'terminal:layout', target: 'TRM-POS-01 saved' },
];

const extras = computed(() => [
  { iconKey: 'lock',     title: t('extra_role_title'),   body: t('extra_role_body') },
  { iconKey: 'palette',  title: t('extra_theme_title'),  body: t('extra_theme_body') },
  { iconKey: 'mobile',   title: t('extra_mobile_title'), body: t('extra_mobile_body') },
  { iconKey: 'zap',      title: t('extra_zap_title'),    body: t('extra_zap_body') },
  { iconKey: 'database', title: t('extra_data_title'),   body: t('extra_data_body') },
  { iconKey: 'link',     title: t('extra_link_title'),   body: t('extra_link_body') },
]);
</script>

<template>
  <div>
    <!-- ── Hero ─────────────────────────────────────────────── -->
    <section class="feat-hero">
      <div class="m-inner feat-hero-inner">
        <p class="m-overline">{{ t('feat_hero_overline') }}</p>
        <h1 class="m-heading-lg">{{ t('feat_hero_heading') }}</h1>
        <p class="feat-sub m-sub" style="margin: 0 auto;">
          {{ t('feat_hero_sub') }}
        </p>
        <div class="feat-hero-actions">
          <NuxtLink :to="isLoggedIn ? '/dashboard' : '/login?mode=signup'" class="m-btn-primary ribbon">
            {{ isLoggedIn ? t('nav_dashboard') : t('feat_cta_btn1') }}
          </NuxtLink>
          <NuxtLink v-if="isEnabled('pricing')" to="/pricing" class="m-btn-secondary">
            {{ t('feat_cta_btn2') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ── Module sections (cream, maroon, pink, cream) ─────── -->
    <div class="modules-wrapper">
      <section
        v-for="(mod, i) in modules"
        :key="mod.id"
        class="module-section"
        :class="`module--${mod.color}`"
      >
        <div class="module-inner" :class="{ 'module-inner--reverse': i % 2 !== 0 }">
          <div class="module-text">
            <p class="module-tag">{{ mod.tag }}</p>

            <!-- icon chip -->
            <div class="module-icon-wrap" aria-hidden="true">
              <component :is="icons[mod.iconKey]" />
            </div>

            <h2 class="module-title">{{ mod.title }}</h2>
            <p class="module-body">{{ mod.body }}</p>

            <ul class="module-points">
              <li v-for="pt in mod.points" :key="pt">
                <!-- check icon -->
                <span class="module-check" aria-hidden="true">
                  <CheckIcon />
                </span>
                {{ pt }}
              </li>
            </ul>
          </div>

          <div class="module-visual">
            <div class="visual-blob" aria-hidden="true" />
            <div class="visual-card">
              <div class="visual-card-top">
                <p class="visual-label">{{ mod.title }}</p>
                <span class="visual-badge m-mono">{{ mod.tag }}</span>
              </div>

              <!-- Interactive UI Preview 1: Guided Setup -->
              <div v-if="i === 0" class="specimen-content">
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

              <!-- Interactive UI Preview 2: Industry Presets & Schema Bindings -->
              <div v-else-if="i === 1" class="specimen-content">
                <div class="specimen-rows">
                  <div v-for="map in schemaMappings" :key="map.table" class="specimen-row">
                    <span class="m-mono specimen-code">{{ map.table }}</span>
                    <span class="specimen-station">{{ map.station }}</span>
                    <span class="m-mono specimen-ver">{{ map.version }}</span>
                  </div>
                </div>
              </div>

              <!-- Interactive UI Preview 3: Terminal Builder & Style Presets -->
              <div v-else-if="i === 2" class="specimen-content">
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

              <!-- Interactive UI Preview 4: Managed Rollout & Audit Trail -->
              <div v-else class="specimen-content">
                <div class="specimen-rows">
                  <div v-for="entry in auditSamples" :key="entry.time + entry.action" class="specimen-row">
                    <span class="m-mono m-tabular specimen-code">{{ entry.time }}</span>
                    <span class="m-mono specimen-action">{{ entry.action }}</span>
                    <span class="specimen-station">{{ entry.target }}</span>
                  </div>
                </div>
              </div>

              <!-- Signature subtle visual-lines bar accent from original design -->
              <div class="visual-lines" aria-hidden="true">
                <div
                  v-for="n in 3"
                  :key="n"
                  class="visual-line"
                  :style="{ width: `${55 + n * 12}%`, opacity: 0.7 - n * 0.12 }"
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
          <p class="m-overline">{{ t('extra_overline') }}</p>
          <h2 class="m-heading">{{ t('extra_heading') }}</h2>
          <p class="m-sub" style="margin: 0 auto;">{{ t('extra_sub') }}</p>
        </div>

        <div class="extras-grid">
          <div v-for="ex in extras" :key="ex.title" class="extra-card">
            <span class="extra-icon" aria-hidden="true">
              <component :is="extraIcons[ex.iconKey as keyof typeof extraIcons]" />
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
        <h2 class="m-cta-heading">{{ t('feat_cta_heading') }}</h2>
        <p class="m-cta-sub">{{ t('feat_cta_sub') }}</p>
        <div class="m-cta-btns">
          <NuxtLink :to="isLoggedIn ? '/dashboard' : '/login?mode=signup'" class="m-btn-primary ribbon">
            {{ isLoggedIn ? t('nav_dashboard') : t('feat_cta_btn1') }}
          </NuxtLink>
          <NuxtLink v-if="isEnabled('pricing')" to="/pricing" class="m-btn-secondary">{{ t('feat_cta_btn2') }}</NuxtLink>
          <NuxtLink to="/login" class="m-btn-ghost">{{ t('nav_signin') }} →</NuxtLink>
        </div>
      </div>
    </section>
  </div>
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

.feat-hero-actions {
  margin-top: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  padding-bottom: 12px;
}

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
.module--maroon .module-tag { color: rgba(246, 230, 215, 0.65); }
.module--pink   .module-tag { color: rgba(255, 255, 255, 0.85); }

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
  font-weight: 400;
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
.module--cream  .module-body { color: rgba(104, 41, 58, 0.68); }
.module--maroon .module-body { color: rgba(246, 230, 215, 0.78); }
.module--pink   .module-body { color: rgba(255, 255, 255, 0.9); }

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
.module--cream  .module-points li { color: rgba(104, 41, 58, 0.78); }
.module--maroon .module-points li { color: rgba(246, 230, 215, 0.85); }
.module--pink   .module-points li { color: rgba(255, 255, 255, 0.92); }

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
.module--maroon .module-check { background: rgba(246, 230, 215, 0.14); color: #F6E6D7; }
.module--pink   .module-check { background: rgba(255, 255, 255, 0.22); color: #FFFFFF; }

/* ── Module visual & interactive specimen ─────────────── */
.module-visual { position: relative; min-width: 0; }

.visual-blob {
  position: absolute;
  inset: -20px;
  border-radius: 40% 60% 55% 45% / 45% 40% 60% 55%;
  opacity: 0.08;
  filter: blur(24px);
  pointer-events: none;
}
.module--cream  .visual-blob { background: #68293A; }
.module--maroon .visual-blob { background: #F6E6D7; }
.module--pink   .visual-blob { background: #FFFFFF; }

.visual-card {
  position: relative;
  padding: 1.75rem;
  border-radius: 0.75rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.09);
  color: #68293A;
}

.visual-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.visual-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
  color: rgba(104, 41, 58, 0.55);
}

.visual-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  background: rgba(255, 87, 118, 0.1);
  color: #FF5776;
}

.specimen-content {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 1.1rem;
}

.industry-switch-grid,
.style-switch-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.45rem;
}

.spec-btn {
  padding: 0.48rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 500;
  text-align: left;
  background: #FBF4ED;
  color: #68293A;
  border: 1px solid rgba(104, 41, 58, 0.14);
  border-radius: 0.45rem;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}
.spec-btn:hover { border-color: #68293A; }
.spec-btn.active {
  background: #68293A;
  color: #F6E6D7;
  border-color: #68293A;
}

.specimen-rows {
  border-top: 1px solid rgba(104, 41, 58, 0.12);
}

.specimen-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(104, 41, 58, 0.1);
  font-size: 0.84rem;
  color: #68293A;
  flex-wrap: wrap;
}

.specimen-code { font-size: 0.76rem; color: rgba(104, 41, 58, 0.65); }
.specimen-station { flex: 1; min-width: 110px; }
.specimen-tag,
.specimen-ver,
.specimen-action { font-size: 0.75rem; color: #FF5776; font-weight: 600; }

.style-preview {
  padding: 0.9rem;
  border: 1px solid rgba(104, 41, 58, 0.14);
  border-radius: 0.5rem;
  background: #FDFAF7;
  color: #68293A;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.style-preview--compact { padding: 0.65rem 0.8rem; gap: 0.25rem; font-size: 0.82rem; }
.style-preview--contrast { background: #68293A; color: #F6E6D7; border-color: #68293A; }
.style-preview--editorial { padding: 1.15rem; gap: 0.65rem; }

.style-preview-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.86rem;
}
.style-preview-desc {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(104, 41, 58, 0.68);
  line-height: 1.45;
}
.style-preview--contrast .style-preview-desc { color: rgba(246, 230, 215, 0.78); }
.style-preview-line {
  display: flex;
  justify-content: space-between;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
  font-size: 0.82rem;
}
.style-preview--contrast .style-preview-line { border-top-color: rgba(246, 230, 215, 0.2); }

.visual-lines { display: flex; flex-direction: column; gap: 0.45rem; }

.visual-line {
  height: 6px;
  border-radius: 0.4rem;
  background: rgba(104, 41, 58, 0.08);
}

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
.extra-body  { font-size: 0.855rem; color: rgba(104, 41, 58, 0.62); line-height: 1.6; margin: 0; }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .module-section { padding: 3.5rem 1.25rem; }
  .module-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .module-inner--reverse { direction: ltr; }
  .section-extras { padding: 4rem 1.25rem; }
  .extras-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  .extras-grid,
  .industry-switch-grid,
  .style-switch-row { grid-template-columns: 1fr; }
}
</style>
