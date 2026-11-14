<script setup lang="ts">
const props = defineProps<{
  platformV24: boolean;
}>();

const emit = defineEmits<{
  audit: [message: string];
}>();

const { t } = useLocale();

/* Counter POS interactive state */
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
  props.platformV24 && posDiscountApplied.value ? posSubtotal.value * 0.1 : 0,
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
  emit('audit', `TRM-POS-01 · ${orderNo} submitted ($${total.toFixed(2)} via ${posPayment.value})`);
}
</script>

<template>
  <div class="pos-grid">
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
</template>

<style scoped>
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

@media (max-width: 900px) {
  .pos-grid { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .pos-menu-list { grid-template-columns: 1fr; }
}
</style>
