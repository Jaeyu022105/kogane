<script setup lang="ts">
const { t } = useLocale();

/* Original Hero Preview Cards Data & Interactive POS Mock */
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

const collageTiles = computed(() => [
  { id: 'restaurant', label: t('ind_restaurant_label') },
  { id: 'retail', label: t('ind_retail_label') },
  { id: 'clinic', label: t('ind_clinic_label') },
  { id: 'logistics', label: t('ind_logistics_label') },
]);
</script>

<template>
  <div class="hero-collage">
    <div class="collage-art" aria-hidden="true">
      <span class="collage-field field-strawberry" />
      <span class="collage-field field-chocolate" />
      <span
        v-for="tile in collageTiles"
        :key="tile.id"
        class="collage-tile"
        :class="`tile-${tile.id}`"
      >
        <span class="tile-tag">{{ tile.label }}</span>
      </span>
    </div>

    <div class="hero-preview">
      <!-- Preview Card 1: Preset Setup Table -->
      <div class="preview-card card-setup">
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
      <div class="preview-card card-pos">
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
  </div>
</template>

<style scoped>
/* Collage band: strawberry, vanilla and chocolate fields with flat tiles and live previews */
.hero-collage {
  position: relative;
  height: clamp(380px, 31vw, 460px);
  background: #F6E6D7;
  overflow: hidden;
}

.collage-art {
  position: absolute;
  inset: 0;
}

.collage-field {
  position: absolute;
  top: 0;
  bottom: 0;
}

.field-strawberry { left: 0; width: 36%; background: #FF5776; }
.field-chocolate  { right: 0; width: 30%; background: #68293A; }

.collage-tile {
  position: absolute;
}

.tile-restaurant { left: 4%; bottom: 0; width: 22%; height: 56%; background: #E3C7B9; }
.tile-retail     { left: 13%; top: 0; width: 13%; height: 36%; background: #68293A; }
.tile-clinic     { left: 47%; top: 0; width: 24%; height: 52%; background: #FF5776; }
.tile-logistics  { right: 5%; bottom: 0; width: 17%; height: 46%; background: #F6E6D7; }

.tile-tag {
  position: absolute;
  right: -0.6rem;
  bottom: 0.9rem;
  padding: 0.28rem 0.5rem;
  background: #FFFDFB;
  font-family: var(--k-font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #68293A;
  white-space: nowrap;
}

.tile-restaurant .tile-tag { right: auto; left: 0.9rem; bottom: 0.9rem; }
.tile-retail .tile-tag     { right: auto; left: -0.6rem; bottom: 0.9rem; }
.tile-clinic .tile-tag     { bottom: auto; top: 0.9rem; }

/* Hero preview cards */
.hero-preview {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.preview-card {
  background: #FFFFFF;
  border-radius: 0.75rem;
  border: 1px solid rgba(104, 41, 58, 0.09);
  box-shadow: 0 6px 24px rgba(104, 41, 58, 0.08), 0 1px 4px rgba(104, 41, 58, 0.05);
  overflow: visible;
}

.hero-preview .preview-card {
  position: absolute;
  width: clamp(290px, 26vw, 370px);
  pointer-events: auto;
}

.card-setup { left: 24%; top: 13%; }
.card-pos   { left: 58%; top: 27%; }

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.07);
  background: #F6E6D7;
  border-radius: 0.75rem 0.75rem 0 0;
}


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

@media (max-width: 900px) {
  .hero-collage { height: auto; }
  .hero-preview {
    position: relative;
    inset: auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: start;
    padding: 2.5rem 2rem 3rem;
  }
  .hero-preview .preview-card { position: static; width: auto; }
  .tile-tag { display: none; }
}

@media (max-width: 600px) {
  .hero-preview { grid-template-columns: 1fr; padding: 2rem 1.25rem 2.5rem; }
}
</style>
