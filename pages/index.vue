<script setup lang="ts">
const { t } = useLocale();
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

/* ── Original Hero Preview Cards Data & Interactive POS Mock ── */
const tableRows = computed(() => [
  { col: t('table_orders'),    type: t('table_cashier'), key: t('table_ready'), keyClass: 'pk' },
  { col: t('table_inventory'), type: t('table_ops'),     key: '',               keyClass: '' },
  { col: t('table_customers'), type: t('table_crm'),     key: '',               keyClass: '' },
  { col: t('table_reports'),   type: t('table_manager'), key: t('table_live'),  keyClass: 'fk' },
  { col: t('table_brand'),     type: t('table_warm'),    key: '',               keyClass: '' },
]);

const heroPosQtys = ref<[number, number, number]>([1, 1, 1]);
const heroPosCharged = ref(false);

const heroPosItems = computed(() => [
  { idx: 0 as const, label: t('index_mock_item1'), unitPrice: 5.5, qty: heroPosQtys.value[0], alt: false },
  { idx: 1 as const, label: t('index_mock_item2'), unitPrice: 4.0, qty: heroPosQtys.value[1], alt: true },
  { idx: 2 as const, label: t('index_mock_item3'), unitPrice: 6.0, qty: heroPosQtys.value[2], alt: false },
]);

const heroPosTotal = computed(() =>
  heroPosItems.value.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
);

function bumpHeroPosItem(idx: 0 | 1 | 2) {
  heroPosCharged.value = false;
  const next: [number, number, number] = [...heroPosQtys.value];
  next[idx] = (next[idx] % 4) + 1;
  heroPosQtys.value = next;
}

function triggerHeroCharge() {
  if (heroPosCharged.value) {
    heroPosQtys.value = [1, 1, 1];
    heroPosCharged.value = false;
  } else {
    heroPosCharged.value = true;
  }
}

/* ── Original SVG path strings for industry chips ─────────── */
const industryIcons: Record<string, string> = {
  restaurant: 'M18 8h1a4 4 0 0 1 0 8h-1 M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3',
  logistics:  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  retail:     'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
  healthcare: 'M22 12h-4l-3 9L9 3l-3 9H2',
  construct:  'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  finance:    'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
};

const industries = computed(() => [
  { iconKey: 'restaurant', name: t('ind_restaurant') },
  { iconKey: 'logistics',  name: t('ind_logistics')  },
  { iconKey: 'retail',     name: t('ind_retail')     },
  { iconKey: 'healthcare', name: t('ind_healthcare') },
  { iconKey: 'construct',  name: t('ind_construct')  },
  { iconKey: 'finance',    name: t('ind_finance')    },
]);

/* ── Original SVG path strings for pillar cards ───────────── */
const pillarIcons: Record<string, string> = {
  schema:   'M4 7h16 M4 12h16 M4 17h10 M16 17l2 2 4-4',
  builder:  'M12 2L3 14h9l-1 8 10-12h-9l1-8z',
  terminal: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z M8 10l2 2-2 2 M12 14h4',
  onboard:  'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M9 12h6 M9 16h4',
};

const pillars = computed(() => [
  { iconKey: 'onboard',  title: t('pillar_setup_title'),    body: t('pillar_setup_body') },
  { iconKey: 'schema',   title: t('pillar_schema_title'),   body: t('pillar_schema_body') },
  { iconKey: 'builder',  title: t('pillar_builder_title'),  body: t('pillar_builder_body') },
  { iconKey: 'terminal', title: t('pillar_terminal_title'), body: t('pillar_terminal_body') },
]);

/* ── Interactive 4-Preset Terminal Explorer State ─────────── */
type PresetId = 'pos' | 'dispatch' | 'stock' | 'appt';

const activePreset = ref<PresetId>('pos');
const platformV24 = ref(true);
const latestAuditEvent = ref('Synced v2.4 across 4 connected stations');

const presetTabs = computed(() => [
  {
    id: 'pos' as PresetId,
    code: 'TRM-POS-01',
    name: t('index_preset_pos_name'),
    role: t('index_preset_pos_role'),
  },
  {
    id: 'dispatch' as PresetId,
    code: 'TRM-DSP-02',
    name: t('index_preset_dispatch_name'),
    role: t('index_preset_dispatch_role'),
  },
  {
    id: 'stock' as PresetId,
    code: 'TRM-INV-03',
    name: t('index_preset_stock_name'),
    role: t('index_preset_stock_role'),
  },
  {
    id: 'appt' as PresetId,
    code: 'TRM-APT-04',
    name: t('index_preset_appt_name'),
    role: t('index_preset_appt_role'),
  },
]);

const currentTab = computed(() =>
  presetTabs.value.find((tab) => tab.id === activePreset.value) ?? presetTabs.value[0],
);

function togglePlatformVersion() {
  platformV24.value = !platformV24.value;
  latestAuditEvent.value = platformV24.value
    ? 'Platform update v2.4 applied to TRM-POS-01, TRM-DSP-02, TRM-INV-03, TRM-APT-04'
    : 'Switched preview to v2.3 baseline preset layout';
}

/* 1. Counter POS interactive state */
interface PosMenuItem {
  id: string;
  name: string;
  sku: string;
  price: number;
}

const posMenu: PosMenuItem[] = [
  { id: 'cap', name: 'Cappuccino', sku: 'BEV-01', price: 5.5 },
  { id: 'cro', name: 'Butter Croissant', sku: 'BAK-04', price: 4.0 },
  { id: 'cld', name: 'Cold Brew', sku: 'BEV-09', price: 6.0 },
  { id: 'mtc', name: 'Matcha Loaf', sku: 'BAK-11', price: 4.75 },
];

const posCart = ref<Record<string, number>>({
  cap: 1,
  cro: 1,
  cld: 1,
});
const posPayment = ref<'Cash' | 'Card' | 'QR'>('Card');
const posDiscountApplied = ref(false);
const posLastOrder = ref<{ orderNo: string; total: number; payment: string } | null>(null);
const posOrderSeq = ref(104);

const posTicketLines = computed(() =>
  posMenu
    .filter((item) => (posCart.value[item.id] ?? 0) > 0)
    .map((item) => ({
      ...item,
      qty: posCart.value[item.id] ?? 0,
      lineTotal: (posCart.value[item.id] ?? 0) * item.price,
    })),
);

const posSubtotal = computed(() =>
  posTicketLines.value.reduce((sum, item) => sum + item.lineTotal, 0),
);

const posDiscountAmount = computed(() =>
  platformV24.value && posDiscountApplied.value ? posSubtotal.value * 0.1 : 0,
);

const posTotal = computed(() => Math.max(0, posSubtotal.value - posDiscountAmount.value));

function addPosItem(id: string) {
  posCart.value = { ...posCart.value, [id]: (posCart.value[id] ?? 0) + 1 };
}

function stepPosItem(id: string, delta: number) {
  const next = Math.max(0, (posCart.value[id] ?? 0) + delta);
  const copy = { ...posCart.value };
  if (next === 0) delete copy[id];
  else copy[id] = next;
  posCart.value = copy;
}

function submitPosOrder() {
  if (posTicketLines.value.length === 0) return;
  const orderNo = `ORD-${posOrderSeq.value}`;
  const total = posTotal.value;
  posLastOrder.value = { orderNo, total, payment: posPayment.value };
  posOrderSeq.value += 1;
  posCart.value = {};
  latestAuditEvent.value = `TRM-POS-01 · ${orderNo} submitted ($${total.toFixed(2)} via ${posPayment.value})`;
}

/* 2. Logistics Dispatch interactive state */
type DispatchStatus = 'Pending' | 'Dispatched' | 'In transit' | 'Delivered';

interface WaybillRow {
  code: string;
  destination: string;
  driver: string;
  status: DispatchStatus;
  eta: string;
}

const dispatchStatuses: DispatchStatus[] = ['Pending', 'Dispatched', 'In transit', 'Delivered'];

const waybills = ref<WaybillRow[]>([
  { code: 'TRK-1042', destination: 'North Pier Hub', driver: 'M. Santos', status: 'In transit', eta: '14:20' },
  { code: 'TRK-1043', destination: 'Cedar Clinic', driver: 'R. Tan', status: 'Dispatched', eta: '14:45' },
  { code: 'TRK-1044', destination: 'Harbor Market', driver: 'K. Diaz', status: 'Pending', eta: '15:10' },
]);

const newWaybillDestination = ref('');
const waybillSeq = ref(1045);

function advanceWaybill(code: string) {
  const row = waybills.value.find((item) => item.code === code);
  if (!row) return;
  const idx = dispatchStatuses.indexOf(row.status);
  row.status = dispatchStatuses[(idx + 1) % dispatchStatuses.length];
  latestAuditEvent.value = `TRM-DSP-02 · ${row.code} status updated to ${row.status}`;
}

function addWaybill() {
  const dest = newWaybillDestination.value.trim() || 'West Depot';
  const code = `TRK-${waybillSeq.value}`;
  waybillSeq.value += 1;
  waybills.value.unshift({
    code,
    destination: dest,
    driver: 'Unassigned',
    status: 'Pending',
    eta: '15:40',
  });
  newWaybillDestination.value = '';
  latestAuditEvent.value = `TRM-DSP-02 · Waybill ${code} created for ${dest}`;
}

/* 3. Stock Receiving interactive state */
interface StockRow {
  sku: string;
  name: string;
  qty: number;
  unit: string;
  reorderAt: number;
}

const stockRows = ref<StockRow[]>([
  { sku: 'INV-101', name: 'Oat Milk 1L', qty: 8, unit: 'btl', reorderAt: 10 },
  { sku: 'INV-204', name: 'Espresso Beans 1kg', qty: 18, unit: 'bag', reorderAt: 8 },
  { sku: 'INV-309', name: 'Shipping Box M', qty: 14, unit: 'box', reorderAt: 15 },
  { sku: 'INV-412', name: 'Thermal Receipt Roll', qty: 24, unit: 'roll', reorderAt: 12 },
]);

const poDraftCreated = ref(false);

const lowStockCount = computed(() =>
  stockRows.value.filter((item) => item.qty <= item.reorderAt).length,
);

function adjustStock(sku: string, delta: number) {
  const row = stockRows.value.find((item) => item.sku === sku);
  if (!row) return;
  row.qty = Math.max(0, row.qty + delta);
  poDraftCreated.value = false;
  latestAuditEvent.value = `TRM-INV-03 · ${row.sku} adjusted to ${row.qty} ${row.unit}`;
}

function createPoDraft() {
  poDraftCreated.value = true;
  latestAuditEvent.value = `TRM-INV-03 · Reorder PO drafted for ${lowStockCount.value} low-stock items`;
}

/* 4. Appointment Desk interactive state */
type ApptStatus = 'Booked' | 'Checked in' | 'Completed';

interface ApptRow {
  id: string;
  time: string;
  client: string;
  service: string;
  room: string;
  status: ApptStatus;
}

const apptStatuses: ApptStatus[] = ['Booked', 'Checked in', 'Completed'];

const appointments = ref<ApptRow[]>([
  { id: 'APT-01', time: '09:30', client: 'Maya Lin', service: 'Follow-up', room: 'Room A', status: 'Checked in' },
  { id: 'APT-02', time: '10:15', client: 'Carlo Reyes', service: 'Intake consult', room: 'Room B', status: 'Booked' },
  { id: 'APT-03', time: '11:00', client: 'Hana Sato', service: 'Checkup', room: 'Room A', status: 'Booked' },
]);

const walkInName = ref('');
const apptSeq = ref(4);

function cycleApptStatus(id: string) {
  const row = appointments.value.find((item) => item.id === id);
  if (!row) return;
  const idx = apptStatuses.indexOf(row.status);
  row.status = apptStatuses[(idx + 1) % apptStatuses.length];
  latestAuditEvent.value = `TRM-APT-04 · ${row.client} marked ${row.status}`;
}

function checkInWalkIn() {
  const name = walkInName.value.trim() || 'Walk-in Guest';
  const id = `APT-0${apptSeq.value}`;
  apptSeq.value += 1;
  appointments.value.unshift({
    id,
    time: 'Now',
    client: name,
    service: 'Walk-in',
    room: 'Room C',
    status: 'Checked in',
  });
  walkInName.value = '';
  latestAuditEvent.value = `TRM-APT-04 · Checked in ${name}`;
}

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
  <div>
    <!-- ── Hero ─────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <span class="badge-dot" aria-hidden="true" />
          {{ t('index_hero_badge') }}
        </div>

        <h1 class="hero-headline">{{ t('index_hero_headline') }}</h1>

        <p class="hero-sub">
          {{ t('index_hero_sub') }}
        </p>

        <div class="hero-cta">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary ribbon">{{ t('index_dashboard_cta') }}</NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">{{ t('index_hero_cta1') }}</NuxtLink>
          <NuxtLink to="/pricing" class="m-btn-secondary">{{ t('index_cta_btn2') }}</NuxtLink>
          <NuxtLink to="/features" class="m-btn-ghost">{{ t('index_hero_cta2') }}</NuxtLink>
        </div>

        <ul class="hero-facts">
          <li>{{ t('index_hero_fact1') }}</li>
          <li>{{ t('index_hero_fact2') }}</li>
          <li>{{ t('index_hero_fact3') }}</li>
        </ul>
      </div>

      <div class="hero-preview">
        <!-- Preview Card 1: Preset Setup Table -->
        <div class="preview-card">
          <div class="preview-header">
            <div class="preview-dots" aria-hidden="true">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
            </div>
            <span class="preview-title">{{ t('index_preview_setup') }}</span>
          </div>
          <div class="preview-table">
            <div class="table-head">
              <span>{{ t('index_table_workflow') }}</span>
              <span>{{ t('index_table_preset') }}</span>
              <span>{{ t('index_table_status') }}</span>
            </div>
            <div v-for="(row, i) in tableRows" :key="row.col" class="table-row" :class="{ 'row-alt': i % 2 !== 0 }">
              <span class="col-name">{{ row.col }}</span>
              <span class="type-badge">{{ row.type }}</span>
              <span v-if="row.key" :class="['key-badge', row.keyClass]">{{ row.key }}</span>
              <span v-else />
            </div>
          </div>
        </div>

        <!-- Preview Card 2: POS Workspace with Hanging Bookmark Charge Button -->
        <div class="preview-card">
          <div class="preview-header">
            <div class="preview-dots" aria-hidden="true">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
            </div>
            <span class="preview-title">{{ t('index_preview_pos') }}</span>
          </div>
          <div class="terminal-mock">
            <div class="terminal-items">
              <button
                v-for="item in heroPosItems"
                :key="item.idx"
                type="button"
                class="t-item"
                :class="{ 't-alt': item.alt }"
                @click="bumpHeroPosItem(item.idx)"
              >
                <span>{{ item.label }} <span v-if="item.qty > 1" class="t-qty">×{{ item.qty }}</span></span>
                <span class="m-tabular">${{ (item.unitPrice * item.qty).toFixed(2) }}</span>
              </button>
            </div>
            <div class="terminal-total">
              <span>{{ t('index_mock_total') }}</span>
              <span class="total-val m-tabular">${{ heroPosTotal.toFixed(2) }}</span>
            </div>
            <button
              type="button"
              class="terminal-charge btn-ribbon"
              style="--ribbon-color: #68293A;"
              @click="triggerHeroCharge"
            >
              {{ heroPosCharged ? `✓ ${t('index_mock_charge')} ($${heroPosTotal.toFixed(2)})` : t('index_mock_charge') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Industry strip ────────────────────────────────────── -->
    <section class="section-industries">
      <div class="section-inner">
        <p class="m-overline">{{ t('index_industry_overline') }}</p>
        <div class="industry-grid">
          <div v-for="ind in industries" :key="ind.name" class="industry-chip">
            <span class="chip-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path :d="industryIcons[ind.iconKey]" />
              </svg>
            </span>
            <span>{{ ind.name }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Pillars ───────────────────────────────────────────── -->
    <section class="section-pillars">
      <div class="section-inner">
        <div class="m-label-block">
          <p class="m-overline">{{ t('index_pillars_overline') }}</p>
          <h2 class="m-heading">{{ t('index_pillars_heading') }}</h2>
          <p class="m-sub">{{ t('index_pillars_sub') }}</p>
        </div>
        <div class="pillar-grid">
          <div v-for="p in pillars" :key="p.title" class="pillar-card">
            <span class="pillar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path :d="pillarIcons[p.iconKey]" />
              </svg>
            </span>
            <h3 class="pillar-title">{{ p.title }}</h3>
            <p class="pillar-body">{{ p.body }}</p>
            <NuxtLink to="/features" class="pillar-link">{{ t('index_pillars_learn_more') }}</NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Interactive Terminal Preset Explorer (Additive) ────── -->
    <section class="explorer-section" aria-labelledby="explorer-heading">
      <div class="section-inner">
        <div class="explorer-header">
          <div class="explorer-heading-col">
            <p class="m-overline">{{ t('index_explorer_title') }}</p>
            <h2 id="explorer-heading" class="m-heading">
              {{ t('index_explorer_heading') }}
            </h2>
            <p class="m-sub">
              {{ t('index_explorer_sub') }}
            </p>
          </div>

          <div class="rollout-box">
            <div class="rollout-top">
              <span class="rollout-label">{{ t('index_explorer_rollout_label') }}</span>
              <button
                type="button"
                role="switch"
                :aria-checked="platformV24"
                class="rollout-switch"
                :class="{ active: platformV24 }"
                @click="togglePlatformVersion"
              >
                <span class="rollout-thumb" />
                <span class="rollout-state m-mono">
                  {{ platformV24 ? t('index_explorer_rollout_v24') : t('index_explorer_rollout_v23') }}
                </span>
              </button>
            </div>
            <p class="rollout-note">
              {{ platformV24 ? t('index_explorer_rollout_note_v24') : t('index_explorer_rollout_note_v23') }}
            </p>
          </div>
        </div>

        <div class="explorer-shell">
          <!-- Preset Switcher Tabs -->
          <div class="preset-tabs" role="tablist" :aria-label="t('index_explorer_title')">
            <button
              v-for="tab in presetTabs"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="activePreset === tab.id"
              class="preset-tab"
              :class="{ active: activePreset === tab.id }"
              @click="activePreset = tab.id"
            >
              <span class="preset-tab-code m-mono">{{ tab.code }}</span>
              <span class="preset-tab-name">{{ tab.name }}</span>
              <span class="preset-tab-role">{{ tab.role }}</span>
            </button>
          </div>

          <!-- Terminal Frame -->
          <div class="terminal-window" role="tabpanel">
            <div class="terminal-topbar">
              <div class="terminal-id-group">
                <div class="preview-dots" aria-hidden="true">
                  <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
                </div>
                <span class="terminal-code m-mono">{{ currentTab.code }}</span>
                <span class="terminal-title">{{ currentTab.name }}</span>
              </div>
              <div class="terminal-meta-group">
                <span class="terminal-sync">{{ t('index_explorer_sync_active') }}</span>
                <span class="terminal-version m-mono" :class="{ upgraded: platformV24 }">
                  {{ platformV24 ? 'v2.4' : 'v2.3' }}
                </span>
              </div>
            </div>

            <!-- Panel 1: Counter POS -->
            <div v-if="activePreset === 'pos'" class="terminal-body pos-grid">
              <div class="terminal-pane">
                <h3 class="pane-heading">{{ t('index_exp_menu') }}</h3>
                <div class="pos-menu-list">
                  <button
                    v-for="item in posMenu"
                    :key="item.id"
                    type="button"
                    class="pos-item-btn"
                    @click="addPosItem(item.id)"
                  >
                    <span class="pos-item-main">
                      <span class="pos-item-sku m-mono">{{ item.sku }}</span>
                      <span class="pos-item-name">{{ item.name }}</span>
                    </span>
                    <span class="pos-item-price m-tabular">${{ item.price.toFixed(2) }}</span>
                  </button>
                </div>
                <p v-if="platformV24" class="v24-note">
                  {{ t('index_exp_tax_v24') }}
                </p>
              </div>

              <div class="terminal-pane">
                <div class="pane-head-row">
                  <h3 class="pane-heading">{{ t('index_exp_ticket') }}</h3>
                  <div class="payment-selector" role="group" aria-label="Payment method">
                    <button
                      v-for="method in (['Cash', 'Card', 'QR'] as const)"
                      :key="method"
                      type="button"
                      class="pay-btn"
                      :class="{ active: posPayment === method }"
                      @click="posPayment = method"
                    >
                      {{ method }}
                    </button>
                  </div>
                </div>

                <div v-if="posTicketLines.length === 0" class="empty-ticket">
                  {{ t('index_exp_empty_ticket') }}
                </div>
                <div v-else class="ticket-lines">
                  <div v-for="line in posTicketLines" :key="line.id" class="ticket-row">
                    <span class="ticket-name">{{ line.name }}</span>
                    <div class="ticket-controls">
                      <button
                        type="button"
                        class="qty-btn"
                        :aria-label="`Decrease ${line.name}`"
                        @click="stepPosItem(line.id, -1)"
                      >
                        -
                      </button>
                      <span class="qty-val m-tabular">{{ line.qty }}</span>
                      <button
                        type="button"
                        class="qty-btn"
                        :aria-label="`Increase ${line.name}`"
                        @click="stepPosItem(line.id, 1)"
                      >
                        +
                      </button>
                    </div>
                    <span class="ticket-amount m-tabular">${{ line.lineTotal.toFixed(2) }}</span>
                  </div>
                </div>

                <div v-if="platformV24" class="discount-row">
                  <label class="discount-check">
                    <input v-model="posDiscountApplied" type="checkbox" />
                    <span>10% Member / Senior discount</span>
                  </label>
                  <span v-if="posDiscountAmount > 0" class="m-tabular discount-val">
                    -${{ posDiscountAmount.toFixed(2) }}
                  </span>
                </div>

                <div class="ticket-footer">
                  <div class="ticket-total-row">
                    <span>{{ t('index_exp_total') }}</span>
                    <span class="ticket-total-val m-tabular">${{ posTotal.toFixed(2) }}</span>
                  </div>
                  <button
                    type="button"
                    class="terminal-action-btn btn-ribbon"
                    style="--ribbon-color: #68293A;"
                    :disabled="posTicketLines.length === 0"
                    @click="submitPosOrder"
                  >
                    {{ t('index_exp_charge') }}
                  </button>
                </div>

                <div v-if="posLastOrder" class="receipt-strip m-mono">
                  {{ posLastOrder.orderNo }} · ${{ posLastOrder.total.toFixed(2) }} · {{ posLastOrder.payment }}
                  <span v-if="platformV24"> · RCP-{{ posOrderSeq + 2200 }}</span>
                </div>
              </div>
            </div>

            <!-- Panel 2: Logistics Dispatch -->
            <div v-else-if="activePreset === 'dispatch'" class="terminal-body">
              <div class="pane-head-row">
                <h3 class="pane-heading">{{ t('index_exp_waybills') }}</h3>
                <form class="inline-entry" @submit.prevent="addWaybill">
                  <label for="exp-waybill-dest" class="sr-only">Destination</label>
                  <input
                    id="exp-waybill-dest"
                    v-model="newWaybillDestination"
                    type="text"
                    class="inline-input"
                    placeholder="New destination..."
                  />
                  <button type="submit" class="inline-submit btn-ribbon" style="--ribbon-color: #68293A;">
                    {{ t('index_exp_add_waybill') }}
                  </button>
                </form>
              </div>

              <div class="ledger-table">
                <div
                  v-for="row in waybills"
                  :key="row.code"
                  class="ledger-row dispatch-row"
                >
                  <span class="m-mono ledger-code">{{ row.code }}</span>
                  <span class="ledger-primary">{{ row.destination }}</span>
                  <span class="ledger-secondary">{{ row.driver }}</span>
                  <span v-if="platformV24" class="m-mono ledger-eta">ETA {{ row.eta }}</span>
                  <span class="ledger-status" :class="{ accent: row.status === 'In transit' || row.status === 'Delivered' }">
                    {{ row.status }}
                  </span>
                  <button
                    type="button"
                    class="row-action-btn"
                    @click="advanceWaybill(row.code)"
                  >
                    {{ t('index_exp_advance') }}
                  </button>
                </div>
              </div>

              <p v-if="platformV24" class="v24-note">
                {{ t('index_exp_scan_v24') }}
              </p>
            </div>

            <!-- Panel 3: Stock Receiving -->
            <div v-else-if="activePreset === 'stock'" class="terminal-body">
              <div class="pane-head-row">
                <h3 class="pane-heading">{{ t('index_exp_stock') }}</h3>
                <div v-if="platformV24" class="stock-po-bar">
                  <span class="m-tabular stock-alert-text">
                    {{ lowStockCount }} {{ t('index_exp_low_stock').toLowerCase() }}
                  </span>
                  <button
                    type="button"
                    class="inline-submit btn-ribbon"
                    style="--ribbon-color: #68293A;"
                    :disabled="lowStockCount === 0"
                    @click="createPoDraft"
                  >
                    {{ poDraftCreated ? 'PO-882 drafted' : 'Draft reorder PO' }}
                  </button>
                </div>
              </div>

              <div class="ledger-table">
                <div
                  v-for="item in stockRows"
                  :key="item.sku"
                  class="ledger-row stock-row"
                >
                  <span class="m-mono ledger-code">{{ item.sku }}</span>
                  <span class="ledger-primary">{{ item.name }}</span>
                  <span class="ledger-qty m-tabular">
                    {{ item.qty }} {{ item.unit }}
                    <span class="ledger-reorder">(min {{ item.reorderAt }})</span>
                  </span>
                  <span
                    class="ledger-status"
                    :class="{ alert: item.qty <= item.reorderAt }"
                  >
                    {{ item.qty <= item.reorderAt ? t('index_exp_low_stock') : t('index_exp_ok') }}
                  </span>
                  <div class="stock-btns">
                    <button
                      type="button"
                      class="row-action-btn"
                      @click="adjustStock(item.sku, -1)"
                    >
                      {{ t('index_exp_use') }}
                    </button>
                    <button
                      type="button"
                      class="row-action-btn"
                      @click="adjustStock(item.sku, 5)"
                    >
                      {{ t('index_exp_restock') }}
                    </button>
                  </div>
                </div>
              </div>

              <p v-if="platformV24" class="v24-note">
                {{ t('index_exp_po_v24') }}
              </p>
            </div>

            <!-- Panel 4: Appointment Desk -->
            <div v-else class="terminal-body">
              <div class="pane-head-row">
                <h3 class="pane-heading">{{ t('index_exp_queue') }}</h3>
                <form class="inline-entry" @submit.prevent="checkInWalkIn">
                  <label for="exp-walkin-name" class="sr-only">Visitor name</label>
                  <input
                    id="exp-walkin-name"
                    v-model="walkInName"
                    type="text"
                    class="inline-input"
                    placeholder="Visitor name..."
                  />
                  <button type="submit" class="inline-submit btn-ribbon" style="--ribbon-color: #68293A;">
                    {{ t('index_exp_checkin') }}
                  </button>
                </form>
              </div>

              <div class="ledger-table">
                <div
                  v-for="appt in appointments"
                  :key="appt.id"
                  class="ledger-row appt-row"
                >
                  <span class="m-mono ledger-code">{{ appt.time }}</span>
                  <span class="ledger-primary">{{ appt.client }}</span>
                  <span class="ledger-secondary">{{ appt.service }}</span>
                  <span v-if="platformV24" class="m-mono ledger-eta">{{ appt.room }}</span>
                  <span class="ledger-status" :class="{ accent: appt.status === 'Checked in' }">
                    {{ appt.status }}
                  </span>
                  <button
                    type="button"
                    class="row-action-btn"
                    @click="cycleApptStatus(appt.id)"
                  >
                    {{ t('index_exp_advance') }}
                  </button>
                </div>
              </div>

              <p v-if="platformV24" class="v24-note">
                {{ t('index_exp_sms_v24') }}
              </p>
            </div>

            <!-- Audit Footer Strip -->
            <div class="terminal-audit-bar">
              <span class="audit-label">{{ t('index_explorer_audit_label') }}</span>
              <span class="audit-msg m-mono">{{ latestAuditEvent }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Philosophy (Restored 2x2 Badges + SaaS Comparison) ── -->
    <section class="section-philosophy">
      <div class="section-inner philosophy-inner">
        <div class="philosophy-text">
          <p class="m-overline">{{ t('index_philosophy_overline') }}</p>
          <h2 class="m-heading">{{ t('index_philosophy_heading') }}</h2>
          <p class="m-sub">
            {{ t('index_philosophy_sub') }}
          </p>

          <div class="comparison-list">
            <div v-for="item in comparisons" :key="item.title" class="comparison-row">
              <h3 class="comparison-title">{{ item.title }}</h3>
              <p class="comparison-body">{{ item.body }}</p>
            </div>
          </div>

          <NuxtLink to="/features" class="m-btn-secondary" style="margin-top: 1.75rem;">
            {{ t('index_philosophy_cta') }}
          </NuxtLink>
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
        <div class="directory-header">
          <p class="m-overline">{{ t('index_industry_overline') }}</p>
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
          <NuxtLink to="/pricing" class="m-btn-secondary">{{ t('index_cta_btn2') }}</NuxtLink>
          <NuxtLink to="/features" class="m-btn-ghost">{{ t('nav_features') }} →</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Shared ─────────────────────────────────────────── */
.section-inner {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* ── Hero ─────────────────────────────────────────────── */
.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  max-width: 1160px;
  margin: 0 auto;
  padding: 5.5rem 2rem 5rem;
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
  font-weight: 400;
  line-height: 1.12;
  color: #68293A;
  margin: 0 0 1.2rem;
  text-decoration: none;
}
.hero-headline em { font-style: italic; color: #FF5776; text-decoration: none; }

.hero-sub {
  font-size: 1rem;
  line-height: 1.72;
  color: rgba(104, 41, 58, 0.65);
  max-width: 480px;
  margin: 0 0 2rem;
}

.hero-inner { position: relative; z-index: 1; }

.hero-cta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-bottom: 12px;
}

.hero-facts {
  list-style: none;
  padding: 1.25rem 0 0;
  margin: 1rem 0 0;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  font-size: 0.84rem;
  color: rgba(104, 41, 58, 0.72);
  font-weight: 500;
}

.hero-facts li {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.hero-facts li::before {
  content: '—';
  color: #FF5776;
  font-weight: 600;
}

/* ── Hero preview cards ───────────────────────────────── */
.hero-preview {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.preview-card {
  background: #FFFFFF;
  border-radius: 0.75rem;
  border: 1px solid rgba(104, 41, 58, 0.09);
  box-shadow: 0 6px 24px rgba(104, 41, 58, 0.08), 0 1px 4px rgba(104, 41, 58, 0.05);
  overflow: visible;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.07);
  background: #F6E6D7;
  border-radius: 0.75rem 0.75rem 0 0;
}

.preview-dots { display: flex; align-items: center; gap: 0.32rem; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-red    { background: #FF5F56; }
.dot-yellow { background: #FFBD2E; }
.dot-green  { background: #27C93F; }

.preview-title {
  font-size: 0.74rem;
  font-weight: 600;
  color: rgba(104, 41, 58, 0.55);
  margin-left: 0.2rem;
}

/* Preset table */
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
  color: rgba(104, 41, 58, 0.42);
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
  color: rgba(104, 41, 58, 0.75);
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
  width: fit-content;
}

.key-badge {
  display: inline-block;
  padding: 0.1rem 0.38rem;
  border-radius: 3px;
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  width: fit-content;
}
.key-badge.pk { background: rgba(104, 41, 58, 0.1); color: #68293A; }
.key-badge.fk { background: transparent; color: rgba(104, 41, 58, 0.55); border: 1px solid rgba(104, 41, 58, 0.18); }

/* Workspace preview */
.terminal-mock { padding: 0.85rem 0.85rem 1.15rem; }
.terminal-items { display: flex; flex-direction: column; margin-bottom: 0.7rem; gap: 0.15rem; }

.t-item {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  justify-content: space-between;
  font-family: inherit;
  font-size: 0.82rem;
  color: rgba(104, 41, 58, 0.75);
  padding: 0.36rem 0.55rem;
  border-radius: 0.35rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
}
.t-item:hover { background: rgba(255, 87, 118, 0.08); }
.t-alt { background: #F6E6D7; }
.t-qty { font-weight: 700; color: #FF5776; margin-left: 0.25rem; }

.terminal-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.5rem 0.55rem;
  font-weight: 600;
  font-size: 0.86rem;
  color: #68293A;
  border-top: 1px solid rgba(104, 41, 58, 0.1);
  margin-bottom: 0.7rem;
}
.total-val { font-family: 'DM Serif Display', serif; font-size: 1rem; }

.terminal-charge {
  position: relative;
  display: block;
  width: 100%;
  border: none;
  font-family: inherit;
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

.chip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  color: rgba(104, 41, 58, 0.55);
  flex-shrink: 0;
}
.chip-icon svg { width: 1.1rem; height: 1.1rem; }

/* ── Pillars ──────────────────────────────────────────── */
.section-pillars {
  padding: 4.5rem 0;
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

.pillar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.55rem;
  background: rgba(255, 87, 118, 0.1);
  color: #FF5776;
  flex-shrink: 0;
}
.pillar-icon svg { width: 1.1rem; height: 1.1rem; }

.pillar-title { font-weight: 700; font-size: 0.98rem; color: #68293A; margin: 0; }
.pillar-body  { font-size: 0.845rem; color: rgba(104, 41, 58, 0.62); line-height: 1.6; flex: 1; margin: 0; }
.pillar-link  { font-size: 0.79rem; font-weight: 600; color: #FF5776; text-decoration: none; margin-top: 0.3rem; }
.pillar-link:hover { text-decoration: underline; }

/* ── Interactive Explorer ─────────────────────────────── */
.explorer-section {
  padding: 4.5rem 0;
  background: #FDFAF7;
  border-top: 1px solid rgba(104, 41, 58, 0.07);
  border-bottom: 1px solid rgba(104, 41, 58, 0.07);
}

.explorer-header {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 2rem;
  align-items: end;
  margin-bottom: 2rem;
}

.rollout-box {
  border: 1px solid rgba(104, 41, 58, 0.12);
  background: #FFFFFF;
  padding: 1rem 1.15rem;
  border-radius: 0.75rem;
  box-shadow: 0 6px 24px rgba(104, 41, 58, 0.06);
}

.rollout-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.rollout-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #68293A;
}

.rollout-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem 0.3rem 0.35rem;
  background: #FFFFFF;
  border: 1px solid rgba(104, 41, 58, 0.16);
  border-radius: 0.5rem;
  cursor: pointer;
  color: #68293A;
  font-size: 0.78rem;
  font-weight: 600;
}

.rollout-switch.active {
  border-color: #FF5776;
}

.rollout-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(104, 41, 58, 0.2);
  transition: background-color 0.15s ease;
}

.rollout-switch.active .rollout-thumb {
  background: #FF5776;
}

.rollout-note {
  margin: 0.55rem 0 0;
  font-size: 0.8125rem;
  color: rgba(104, 41, 58, 0.65);
  line-height: 1.45;
}

.explorer-shell {
  border: 1px solid rgba(104, 41, 58, 0.12);
  background: #FBF4ED;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(104, 41, 58, 0.09);
}

.preset-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid rgba(104, 41, 58, 0.12);
}

.preset-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.95rem 1.1rem;
  background: #FBF4ED;
  border: none;
  border-right: 1px solid rgba(104, 41, 58, 0.12);
  border-bottom: 2px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.preset-tab:last-child { border-right: none; }
.preset-tab:hover { background: #F6E6D7; }
.preset-tab.active {
  background: #FFFFFF;
  border-bottom-color: #FF5776;
}

.preset-tab-code {
  font-size: 0.72rem;
  color: rgba(104, 41, 58, 0.65);
}
.preset-tab.active .preset-tab-code { color: #FF5776; }

.preset-tab-name {
  font-size: 0.92rem;
  font-weight: 600;
  color: #68293A;
}

.preset-tab-role {
  font-size: 0.8rem;
  color: rgba(104, 41, 58, 0.65);
}

.terminal-window { background: #FFFFFF; }

.terminal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.1);
  background: #F6E6D7;
  flex-wrap: wrap;
}

.terminal-id-group,
.terminal-meta-group {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.terminal-code {
  font-size: 0.78rem;
  color: rgba(104, 41, 58, 0.65);
}

.terminal-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #68293A;
}

.terminal-sync {
  font-size: 0.8rem;
  color: rgba(104, 41, 58, 0.68);
}

.terminal-version {
  padding: 0.18rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid rgba(104, 41, 58, 0.15);
  border-radius: 0.4rem;
  color: #68293A;
  background: #FFFFFF;
}

.terminal-version.upgraded {
  border-color: #FF5776;
  background: #FF5776;
  color: #FFFFFF;
}

.terminal-body { padding: 1.35rem 1.35rem 1.65rem; }

.pos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.terminal-pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.pane-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.pane-heading {
  font-size: 0.875rem;
  font-weight: 600;
  color: #68293A;
  margin: 0;
}

.pos-menu-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.pos-item-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.45rem;
  padding: 0.85rem;
  background: #FBF4ED;
  border: 1px solid rgba(104, 41, 58, 0.12);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.pos-item-btn:hover {
  border-color: #68293A;
  background: #F6E6D7;
}

.pos-item-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.pos-item-sku {
  font-size: 0.72rem;
  color: rgba(104, 41, 58, 0.65);
}

.pos-item-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #68293A;
}

.pos-item-price {
  font-size: 0.85rem;
  font-weight: 600;
  color: #68293A;
}

.payment-selector {
  display: inline-flex;
  border: 1px solid rgba(104, 41, 58, 0.14);
  border-radius: 0.5rem;
  overflow: hidden;
}

.pay-btn {
  padding: 0.3rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 500;
  background: #FFFFFF;
  color: rgba(104, 41, 58, 0.72);
  border: none;
  border-right: 1px solid rgba(104, 41, 58, 0.14);
  cursor: pointer;
}
.pay-btn:last-child { border-right: none; }
.pay-btn.active {
  background: #68293A;
  color: #F6E6D7;
}

.empty-ticket {
  padding: 1.5rem 1rem;
  border: 1px dashed rgba(104, 41, 58, 0.2);
  border-radius: 0.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: rgba(104, 41, 58, 0.65);
}

.ticket-lines {
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
}

.ticket-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(104, 41, 58, 0.12);
  font-size: 0.86rem;
}

.ticket-name {
  color: #68293A;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.qty-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #FBF4ED;
  border: 1px solid rgba(104, 41, 58, 0.14);
  border-radius: 0.4rem;
  font-weight: 600;
  color: #68293A;
  cursor: pointer;
}

.qty-val {
  min-width: 1.25rem;
  text-align: center;
  font-size: 0.82rem;
}

.ticket-amount {
  font-weight: 600;
  color: #68293A;
  min-width: 3.75rem;
  text-align: right;
}

.discount-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: #68293A;
}

.discount-check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
}

.discount-val {
  color: #FF5776;
  font-weight: 600;
}

.ticket-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.35rem;
  padding-bottom: 10px;
  flex-wrap: wrap;
}

.ticket-total-row {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  font-size: 0.9rem;
  color: rgba(104, 41, 58, 0.72);
}

.ticket-total-val {
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: #68293A;
}

.terminal-action-btn {
  position: relative;
  overflow: visible;
  padding: 0.62rem 1.25rem;
  background: #68293A;
  color: #F6E6D7;
  border: 1px solid #68293A;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(104, 41, 58, 0.2);
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.terminal-action-btn:hover:not(:disabled) { opacity: 0.88; }
.terminal-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.receipt-strip {
  padding: 0.5rem 0.7rem;
  background: #FBF4ED;
  border-left: 2px solid #FF5776;
  font-size: 0.76rem;
  color: #68293A;
}

.v24-note {
  margin: 0.75rem 0 0;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
  font-size: 0.8125rem;
  color: #FF5776;
  font-weight: 500;
}

.inline-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-bottom: 10px;
}

.inline-input {
  padding: 0.42rem 0.7rem;
  font-size: 0.84rem;
  background: #FBF4ED;
  border: 1px solid rgba(104, 41, 58, 0.15);
  border-radius: 0.5rem;
  color: #68293A;
  min-width: 170px;
}

.inline-submit {
  position: relative;
  overflow: visible;
  padding: 0.44rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: #68293A;
  color: #F6E6D7;
  border: 1px solid #68293A;
  border-radius: 0.5rem;
  cursor: pointer;
}
.inline-submit:disabled { opacity: 0.45; cursor: not-allowed; }

.ledger-table {
  margin-top: 0.9rem;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
}

.ledger-row {
  display: grid;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid rgba(104, 41, 58, 0.12);
  font-size: 0.86rem;
}

.dispatch-row,
.appt-row {
  grid-template-columns: 90px 1.2fr 1fr auto auto auto;
}

.stock-row {
  grid-template-columns: 88px 1.3fr 1fr auto auto;
}

.ledger-code { font-size: 0.78rem; color: rgba(104, 41, 58, 0.65); }
.ledger-primary { font-weight: 600; color: #68293A; }
.ledger-secondary,
.ledger-reorder { color: rgba(104, 41, 58, 0.65); font-size: 0.82rem; }
.ledger-eta { font-size: 0.76rem; color: #68293A; }
.ledger-qty { font-weight: 600; color: #68293A; }
.ledger-status { font-size: 0.82rem; font-weight: 600; color: rgba(104, 41, 58, 0.68); }
.ledger-status.accent,
.ledger-status.alert { color: #FF5776; }

.stock-btns { display: inline-flex; gap: 0.4rem; }
.stock-po-bar { display: flex; align-items: center; gap: 0.75rem; padding-bottom: 10px; }
.stock-alert-text { font-size: 0.82rem; font-weight: 600; color: #FF5776; }

.row-action-btn {
  padding: 0.34rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 600;
  background: #FBF4ED;
  color: #68293A;
  border: 1px solid rgba(104, 41, 58, 0.15);
  border-radius: 0.45rem;
  cursor: pointer;
}
.row-action-btn:hover { border-color: #68293A; }

.terminal-audit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 1.25rem;
  background: #FBF4ED;
  border-top: 1px solid rgba(104, 41, 58, 0.12);
  font-size: 0.78rem;
  flex-wrap: wrap;
}
.audit-label { font-weight: 600; color: rgba(104, 41, 58, 0.68); }
.audit-msg { color: #68293A; }

/* ── Philosophy ───────────────────────────────────────── */
.section-philosophy { padding: 5rem 0; }

.philosophy-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4.5rem;
  align-items: center;
}

.comparison-list {
  margin-top: 1.5rem;
  border-top: 1px solid rgba(104, 41, 58, 0.1);
}

.comparison-row {
  padding: 0.85rem 0;
  border-bottom: 1px solid rgba(104, 41, 58, 0.1);
}

.comparison-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: #68293A;
  margin: 0 0 0.25rem;
}

.comparison-body {
  font-size: 0.84rem;
  line-height: 1.55;
  color: rgba(104, 41, 58, 0.62);
  margin: 0;
}

.philosophy-badges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.badge-card {
  border-radius: 0.75rem;
  padding: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.badge-plain   { background: #FFFFFF; border: 1px solid rgba(104, 41, 58, 0.09); box-shadow: 0 4px 16px rgba(104, 41, 58, 0.04); }
.badge-dark    { background: #68293A; color: #F6E6D7; }
.badge-brand   { background: #FF5776; color: #FFFFFF; }
.badge-outline { background: transparent; border: 1.5px solid rgba(104, 41, 58, 0.14); }

.badge-title { font-weight: 700; font-size: 0.92rem; margin: 0; }
.badge-body  { font-size: 0.82rem; line-height: 1.55; margin: 0; opacity: 0.78; }
.badge-dark .badge-body, .badge-brand .badge-body { opacity: 0.86; }

/* ── Industry Preset Directory ────────────────────────── */
.directory-section {
  background: #FDFAF7;
  border-top: 1px solid rgba(104, 41, 58, 0.07);
  padding: 4.5rem 0;
}

.directory-header {
  max-width: 680px;
  margin-bottom: 2.25rem;
}

.directory-table {
  border-top: 2px solid #68293A;
  background: #FFFFFF;
  border-radius: 0 0 0.75rem 0.75rem;
  padding: 0 1rem;
  box-shadow: 0 4px 18px rgba(104, 41, 58, 0.05);
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

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; gap: 2.5rem; padding: 3.5rem 1.25rem 4rem; }
  .pillar-grid { grid-template-columns: 1fr 1fr; }
  .explorer-header,
  .philosophy-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .preset-tabs { grid-template-columns: repeat(2, 1fr); }
  .preset-tab { border-bottom: 1px solid rgba(104, 41, 58, 0.12); }
  .pos-grid { grid-template-columns: 1fr; }
  .dispatch-row,
  .appt-row,
  .stock-row {
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0.75rem;
  }
  .directory-head { display: none; }
  .directory-row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}

@media (max-width: 600px) {
  .section-inner { padding: 0 1.25rem; }
  .pillar-grid,
  .philosophy-badges,
  .preset-tabs,
  .pos-menu-list,
  .dispatch-row,
  .appt-row,
  .stock-row {
    grid-template-columns: 1fr;
  }
  .preset-tab { border-right: none; }
}
</style>
