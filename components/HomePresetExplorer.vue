<script setup lang="ts">
const { t } = useLocale();

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

function recordAuditEvent(message: string) {
  latestAuditEvent.value = message;
}

/* Logistics Dispatch interactive state */
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

/* Stock Receiving interactive state */
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

/* Appointment Desk interactive state */
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
</script>

<template>
  <section class="explorer-section" aria-labelledby="explorer-heading">
    <div class="section-inner">
      <div class="section-rule">
        <p class="m-overline">{{ t('index_explorer_title') }}</p>
      </div>
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

          <!-- Panel 1: Counter POS (v-show keeps the ticket while other presets are open) -->
          <div v-show="activePreset === 'pos'" class="terminal-body">
            <HomeExplorerPosPanel :platform-v24="platformV24" @audit="recordAuditEvent" />
          </div>

          <!-- Panel 2: Logistics Dispatch -->
          <div v-if="activePreset === 'dispatch'" class="terminal-body">
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
          <div v-else-if="activePreset === 'appt'" class="terminal-body">
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
</template>

<style scoped>
.explorer-section {
  padding: 5.5rem 0 6.5rem;
  background: #F6E6D7;
}

.explorer-header {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 2rem;
  align-items: end;
  margin: 2.25rem 0 2.5rem;
}

.explorer-heading-col .m-heading {
  margin-bottom: 1rem;
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

/* Pane primitives shared with HomeExplorerPosPanel */
.terminal-window :deep(.pane-head-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.terminal-window :deep(.pane-heading) {
  font-size: 0.875rem;
  font-weight: 600;
  color: #68293A;
  margin: 0;
}

.terminal-window :deep(.v24-note) {
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

@media (max-width: 900px) {
  .explorer-header { grid-template-columns: 1fr; gap: 2.5rem; }
  .preset-tabs { grid-template-columns: repeat(2, 1fr); }
  .preset-tab { border-bottom: 1px solid rgba(104, 41, 58, 0.12); }
  .dispatch-row,
  .appt-row,
  .stock-row {
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0.75rem;
  }
}

@media (max-width: 600px) {
  .preset-tabs,
  .dispatch-row,
  .appt-row,
  .stock-row {
    grid-template-columns: 1fr;
  }
  .preset-tab { border-right: none; }
}
</style>
