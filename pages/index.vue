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

/* ── 1. Counter POS interactive state ────────────────────── */
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

/* ── 2. Logistics Dispatch interactive state ─────────────── */
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

/* ── 3. Stock Receiving interactive state ────────────────── */
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

/* ── 4. Appointment Desk interactive state ───────────────── */
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
    <!-- Hero (Asymmetric 2-column editorial layout) -->
    <section class="hero-section">
      <div class="m-inner hero-grid">
        <div class="hero-intro">
          <p class="hero-sub">
            {{ t('index_hero_sub') }}
          </p>
          <ul class="hero-facts">
            <li>{{ t('index_hero_fact1') }}</li>
            <li>{{ t('index_hero_fact2') }}</li>
            <li>{{ t('index_hero_fact3') }}</li>
          </ul>
        </div>

        <div class="hero-lead">
          <h1 class="m-heading-lg hero-headline">
            {{ t('index_hero_headline') }}
          </h1>
          <div class="hero-cta">
            <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary">
              {{ t('index_dashboard_cta') }}
            </NuxtLink>
            <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary">
              {{ t('index_hero_cta1') }}
            </NuxtLink>
            <NuxtLink to="/pricing" class="m-btn-secondary">
              {{ t('index_cta_btn2') }}
            </NuxtLink>
            <NuxtLink to="/features" class="m-btn-ghost">
              {{ t('index_hero_cta2') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Terminal Preset Explorer -->
    <section class="explorer-section" aria-labelledby="explorer-heading">
      <div class="m-inner">
        <div class="explorer-header">
          <div class="explorer-heading-col">
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
                    class="terminal-action-btn"
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
                  <button type="submit" class="inline-submit">
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
                    class="inline-submit"
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
                  <button type="submit" class="inline-submit">
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

    <!-- Why Managed SaaS Beats One-Off Agency Software -->
    <section class="philosophy-section">
      <div class="m-inner philosophy-grid">
        <div class="philosophy-lead">
          <h2 class="m-heading">
            {{ t('index_philosophy_heading') }}
          </h2>
          <p class="m-sub">
            {{ t('index_philosophy_sub') }}
          </p>
          <NuxtLink to="/features" class="m-btn-secondary" style="margin-top: 1.5rem;">
            {{ t('index_philosophy_cta') }}
          </NuxtLink>
        </div>

        <div class="comparison-list">
          <div v-for="item in comparisons" :key="item.title" class="comparison-row">
            <h3 class="comparison-title">{{ item.title }}</h3>
            <p class="comparison-body">{{ item.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Hairline-Ruled Preset Directory Across Industries -->
    <section class="directory-section">
      <div class="m-inner">
        <div class="directory-header">
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

    <!-- Solid Dark Closing Band -->
    <section class="m-cta-strip-dark">
      <div class="m-cta-inner dark-cta-layout">
        <div>
          <h2 class="m-cta-heading-light">
            {{ t('index_cta_heading') }}
          </h2>
          <p class="m-cta-sub-light" style="margin-bottom: 0;">
            {{ t('index_cta_sub') }}
          </p>
        </div>
        <div class="m-cta-btns">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary">
            {{ t('index_dashboard_cta') }}
          </NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary">
            {{ t('index_cta_btn1') }}
          </NuxtLink>
          <NuxtLink to="/pricing" class="m-btn-ghost on-dark">
            {{ t('index_cta_btn2') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Hero */
.hero-section {
  background: var(--k-bg, #F4F3EF);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  padding: clamp(3rem, 7vw, 5.5rem) 0;
}

.hero-grid {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: clamp(2rem, 5vw, 4.5rem);
  align-items: start;
}

.hero-intro {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 0.35rem;
}

.hero-sub {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--k-muted, #52524E);
  margin: 0;
}

.hero-facts {
  list-style: none;
  padding: 1.25rem 0 0;
  margin: 0;
  border-top: 1px solid var(--k-border, #DCDAD3);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--k-ink, #141414);
  font-weight: 500;
}

.hero-facts li {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.hero-facts li::before {
  content: '—';
  color: var(--k-accent, #E84A27);
  font-weight: 600;
}

.hero-headline {
  margin-bottom: 1.75rem;
}

.hero-cta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Interactive Explorer */
.explorer-section {
  background: var(--k-surface, #FFFFFF);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  padding: clamp(3rem, 6vw, 5rem) 0;
}

.explorer-header {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 2rem;
  align-items: end;
  margin-bottom: 2rem;
}

.rollout-box {
  border: 1px solid var(--k-border, #DCDAD3);
  background: var(--k-bg, #F4F3EF);
  padding: 1rem 1.15rem;
  border-radius: 3px;
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
  color: var(--k-ink, #141414);
}

.rollout-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem 0.3rem 0.35rem;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  cursor: pointer;
  color: var(--k-ink, #141414);
  font-size: 0.78rem;
  font-weight: 600;
}

.rollout-switch.active {
  border-color: var(--k-accent, #E84A27);
}

.rollout-switch:focus-visible {
  outline: 2px solid var(--k-accent, #E84A27);
  outline-offset: 2px;
}

.rollout-thumb {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: var(--k-border, #DCDAD3);
  transition: background-color 0.15s ease;
}

.rollout-switch.active .rollout-thumb {
  background: var(--k-accent, #E84A27);
}

.rollout-note {
  margin: 0.55rem 0 0;
  font-size: 0.8125rem;
  color: var(--k-muted, #52524E);
  line-height: 1.45;
}

.explorer-shell {
  border: 1px solid var(--k-border, #DCDAD3);
  background: var(--k-bg, #F4F3EF);
  border-radius: 3px;
}

.preset-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.preset-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.95rem 1.1rem;
  background: var(--k-bg, #F4F3EF);
  border: none;
  border-right: 1px solid var(--k-border, #DCDAD3);
  border-bottom: 2px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.preset-tab:last-child {
  border-right: none;
}

.preset-tab:hover {
  background: var(--k-surface-alt, #ECEAE4);
}

.preset-tab.active {
  background: var(--k-surface, #FFFFFF);
  border-bottom-color: var(--k-accent, #E84A27);
}

.preset-tab:focus-visible {
  outline: 2px solid var(--k-accent, #E84A27);
  outline-offset: -2px;
}

.preset-tab-code {
  font-size: 0.72rem;
  color: var(--k-muted, #52524E);
}

.preset-tab.active .preset-tab-code {
  color: var(--k-accent, #E84A27);
}

.preset-tab-name {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.preset-tab-role {
  font-size: 0.8rem;
  color: var(--k-muted, #52524E);
}

.terminal-window {
  background: var(--k-surface, #FFFFFF);
}

.terminal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  flex-wrap: wrap;
}

.terminal-id-group,
.terminal-meta-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.terminal-code {
  font-size: 0.78rem;
  color: var(--k-muted, #52524E);
}

.terminal-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.terminal-sync {
  font-size: 0.8rem;
  color: var(--k-muted, #52524E);
}

.terminal-version {
  padding: 0.18rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 2px;
  color: var(--k-ink, #141414);
  background: var(--k-bg, #F4F3EF);
}

.terminal-version.upgraded {
  border-color: var(--k-accent, #E84A27);
  background: var(--k-accent, #E84A27);
  color: var(--k-on-accent, #FFFFFF);
}

.terminal-body {
  padding: 1.25rem;
}

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
  color: var(--k-ink, #141414);
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
  background: var(--k-bg, #F4F3EF);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.pos-item-btn:hover {
  border-color: var(--k-ink, #141414);
  background: var(--k-surface-alt, #ECEAE4);
}

.pos-item-btn:focus-visible {
  outline: 2px solid var(--k-accent, #E84A27);
  outline-offset: 2px;
}

.pos-item-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.pos-item-sku {
  font-size: 0.72rem;
  color: var(--k-muted, #52524E);
}

.pos-item-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.pos-item-price {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.payment-selector {
  display: inline-flex;
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  overflow: hidden;
}

.pay-btn {
  padding: 0.3rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 500;
  background: var(--k-surface, #FFFFFF);
  color: var(--k-muted, #52524E);
  border: none;
  border-right: 1px solid var(--k-border, #DCDAD3);
  cursor: pointer;
}

.pay-btn:last-child {
  border-right: none;
}

.pay-btn.active {
  background: var(--k-ink, #141414);
  color: var(--k-surface, #FFFFFF);
}

.empty-ticket {
  padding: 1.5rem 1rem;
  border: 1px dashed var(--k-border, #DCDAD3);
  text-align: center;
  font-size: 0.85rem;
  color: var(--k-muted, #52524E);
}

.ticket-lines {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.ticket-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.86rem;
}

.ticket-name {
  color: var(--k-ink, #141414);
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
  background: var(--k-bg, #F4F3EF);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 2px;
  font-weight: 600;
  color: var(--k-ink, #141414);
  cursor: pointer;
}

.qty-btn:hover {
  border-color: var(--k-ink, #141414);
}

.qty-val {
  min-width: 1.25rem;
  text-align: center;
  font-size: 0.82rem;
}

.ticket-amount {
  font-weight: 600;
  color: var(--k-ink, #141414);
  min-width: 3.75rem;
  text-align: right;
}

.discount-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: var(--k-ink, #141414);
}

.discount-check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
}

.discount-val {
  color: var(--k-accent, #E84A27);
  font-weight: 600;
}

.ticket-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.35rem;
  flex-wrap: wrap;
}

.ticket-total-row {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  font-size: 0.9rem;
  color: var(--k-muted, #52524E);
}

.ticket-total-val {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--k-ink, #141414);
}

.terminal-action-btn {
  padding: 0.62rem 1.2rem;
  background: var(--k-accent, #E84A27);
  color: var(--k-on-accent, #FFFFFF);
  border: 1px solid var(--k-accent, #E84A27);
  border-radius: 3px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.terminal-action-btn:hover:not(:disabled) {
  background: var(--k-accent-hover, #CC3B1B);
}

.terminal-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.receipt-strip {
  padding: 0.5rem 0.7rem;
  background: var(--k-bg, #F4F3EF);
  border-left: 2px solid var(--k-accent, #E84A27);
  font-size: 0.76rem;
  color: var(--k-ink, #141414);
}

.v24-note {
  margin: 0.75rem 0 0;
  padding-top: 0.65rem;
  border-top: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.8125rem;
  color: var(--k-accent, #E84A27);
  font-weight: 500;
}

/* Dispatch, Stock, Appt ledgers */
.inline-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.inline-input {
  padding: 0.42rem 0.7rem;
  font-size: 0.84rem;
  background: var(--k-bg, #F4F3EF);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  color: var(--k-ink, #141414);
  min-width: 170px;
}

.inline-input:focus {
  outline: 2px solid var(--k-accent, #E84A27);
  outline-offset: 1px;
}

.inline-submit {
  padding: 0.44rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: var(--k-ink, #141414);
  color: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-ink, #141414);
  border-radius: 3px;
  cursor: pointer;
}

.inline-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ledger-table {
  margin-top: 0.9rem;
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.ledger-row {
  display: grid;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.86rem;
}

.dispatch-row,
.appt-row {
  grid-template-columns: 90px 1.2fr 1fr auto auto auto;
}

.stock-row {
  grid-template-columns: 88px 1.3fr 1fr auto auto;
}

.ledger-code {
  font-size: 0.78rem;
  color: var(--k-muted, #52524E);
}

.ledger-primary {
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.ledger-secondary,
.ledger-reorder {
  color: var(--k-muted, #52524E);
  font-size: 0.82rem;
}

.ledger-eta {
  font-size: 0.76rem;
  color: var(--k-ink, #141414);
}

.ledger-qty {
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.ledger-status {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--k-muted, #52524E);
}

.ledger-status.accent,
.ledger-status.alert {
  color: var(--k-accent, #E84A27);
}

.stock-btns {
  display: inline-flex;
  gap: 0.4rem;
}

.stock-po-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stock-alert-text {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--k-accent, #E84A27);
}

.row-action-btn {
  padding: 0.34rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 600;
  background: var(--k-bg, #F4F3EF);
  color: var(--k-ink, #141414);
  border: 1px solid var(--k-border, #DCDAD3);
  border-radius: 3px;
  cursor: pointer;
}

.row-action-btn:hover {
  border-color: var(--k-ink, #141414);
}

.terminal-audit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 1.25rem;
  background: var(--k-bg, #F4F3EF);
  border-top: 1px solid var(--k-border, #DCDAD3);
  font-size: 0.78rem;
  flex-wrap: wrap;
}

.audit-label {
  font-weight: 600;
  color: var(--k-muted, #52524E);
}

.audit-msg {
  color: var(--k-ink, #141414);
}

/* Philosophy / Agency Comparison */
.philosophy-section {
  background: var(--k-bg, #F4F3EF);
  border-bottom: 1px solid var(--k-border, #DCDAD3);
  padding: clamp(3rem, 6vw, 5rem) 0;
}

.philosophy-grid {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: clamp(2rem, 5vw, 4.5rem);
  align-items: start;
}

.comparison-list {
  border-top: 1px solid var(--k-border, #DCDAD3);
}

.comparison-row {
  padding: 1.35rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.comparison-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
  margin: 0 0 0.45rem;
}

.comparison-body {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--k-muted, #52524E);
  margin: 0;
}

/* Industry Preset Directory */
.directory-section {
  background: var(--k-surface, #FFFFFF);
  padding: clamp(3rem, 6vw, 5rem) 0;
}

.directory-header {
  max-width: 680px;
  margin-bottom: 2.25rem;
}

.directory-table {
  border-top: 1px solid var(--k-ink, #141414);
}

.directory-head,
.directory-row {
  display: grid;
  grid-template-columns: 1.1fr 2fr 1.2fr;
  gap: 1.25rem;
  align-items: baseline;
  padding: 1rem 0;
  border-bottom: 1px solid var(--k-border, #DCDAD3);
}

.directory-head {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--k-muted, #52524E);
}

.dir-industry {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--k-ink, #141414);
}

.dir-presets {
  font-size: 0.9rem;
  color: var(--k-ink, #141414);
  line-height: 1.45;
}

.dir-tables {
  font-size: 0.8rem;
  color: var(--k-muted, #52524E);
}

/* Closing dark CTA layout */
.dark-cta-layout {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 900px) {
  .hero-grid,
  .explorer-header,
  .philosophy-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .hero-intro {
    order: 2;
    padding-top: 0;
  }

  .hero-lead {
    order: 1;
  }

  .preset-tabs {
    grid-template-columns: repeat(2, 1fr);
  }

  .preset-tab {
    border-bottom: 1px solid var(--k-border, #DCDAD3);
  }

  .pos-grid {
    grid-template-columns: 1fr;
  }

  .dispatch-row,
  .appt-row,
  .stock-row {
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0.75rem;
  }

  .directory-head {
    display: none;
  }

  .directory-row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}

@media (max-width: 520px) {
  .preset-tabs {
    grid-template-columns: 1fr;
  }

  .preset-tab {
    border-right: none;
  }

  .pos-menu-list {
    grid-template-columns: 1fr;
  }

  .inline-input {
    min-width: 0;
    width: 100%;
  }
}
</style>
