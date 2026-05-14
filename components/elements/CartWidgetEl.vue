<script setup lang="ts">
import { CheckCircle2, CreditCard, Printer, ReceiptText, RotateCcw, X } from 'lucide-vue-next';
import type { CartWidgetElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: CartWidgetElementDef; businessId: string; runtime?: any; builderMode?: boolean }>();

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
}

interface ReceiptPreview {
  orderId: string;
  businessName: string;
  terminalName: string;
  title: string;
  footer?: string;
  receiptNumber: string;
  createdAt: string;
  tableNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference?: string | null;
  items: ReceiptItem[];
  total: number;
}

const sampleProducts = computed<Record<string, unknown>[]>(() => {
  const nameKey = props.element.displayColumns[0] ?? 'name';
  const secondaryKey = props.element.displayColumns[1] ?? 'category';
  const priceKey = props.element.priceColumn ?? 'price';

  return [
    { id: 'sample-americano', [nameKey]: 'Americano', [secondaryKey]: 'Hot Coffee', [priceKey]: 120 },
    { id: 'sample-croissant', [nameKey]: 'Butter Croissant', [secondaryKey]: 'Pastry', [priceKey]: 95 },
    { id: 'sample-matcha', [nameKey]: 'Matcha Latte', [secondaryKey]: 'Signature Drink', [priceKey]: 155 },
    { id: 'sample-sandwich', [nameKey]: 'Club Sandwich', [secondaryKey]: 'Kitchen', [priceKey]: 210 },
  ];
});

const products = computed<Record<string, unknown>[]>(() => {
  if (props.builderMode) return sampleProducts.value;
  return props.runtime?.state?.value?.queryResults?.[props.element.id] ?? [];
});

const cart = computed<CartItem[]>({
  get: () => props.runtime?.state?.value?.cart ?? [],
  set: (value) => props.runtime?.setCartValue?.(value),
});

const tableNumber = ref('');
const submitting = ref(false);
const selectedPaymentMethod = ref(props.element.defaultPaymentMethod ?? 'cash');
const cardApprovalState = ref<'idle' | 'requested' | 'approved'>('idle');
const cardPaymentReference = ref<string | null>(null);
const lastReceipt = ref<ReceiptPreview | null>(null);

const paymentMethods = computed(() => {
  const methods = (props.element.paymentMethods ?? [])
    .map((method) => String(method).trim())
    .filter(Boolean);

  if (methods.length === 0) {
    return ['cash', 'card'];
  }

  return Array.from(new Set(methods));
});

const total = computed(() =>
  cart.value.reduce((sum, item) => sum + item.price * item.qty, 0),
);

const displayColumns = computed(() =>
  props.element.displayColumns.length > 0
    ? props.element.displayColumns
    : ['name'],
);

const title = computed(() => props.element.title ?? 'Sale Panel');
const subtitle = computed(() => props.element.subtitle ?? 'Build an order from available items.');
const submitLabel = computed(() => props.element.submitLabel ?? 'Submit Order');
const receiptTitle = computed(() => props.element.receiptTitle ?? 'Order Receipt');
const receiptFooter = computed(() => props.element.receiptFooter ?? 'Thank you for your visit.');
const textColor = computed(() => props.element.textColor ?? '#f5ede4');
const mutedTextColor = computed(() => 'rgba(245,237,228,0.68)');
const surfaceColor = computed(() => props.element.backgroundColor ?? '#161116');
const panelColor = computed(() => props.element.panelColor ?? 'rgba(255,255,255,0.04)');
const accentColor = computed(() => props.element.accentColor ?? '#e8748a');
const borderColor = computed(() => props.element.borderColor ?? 'rgba(255,255,255,0.08)');
const radius = computed(() => `${props.element.radius ?? 24}px`);
const cardReaderEnabled = computed(() => Boolean(props.element.enableCardReader));
const cardReaderMode = computed(() => props.element.cardReaderMode ?? 'manual');
const cardReaderLabel = computed(() => props.element.cardReaderLabel ?? 'Card Reader');
const cardReaderProvider = computed(() => props.element.cardReaderProvider ?? 'External Reader');
const receiptPrintingEnabled = computed(() => Boolean(props.element.enableReceiptPrinting));
const businessName = computed(() =>
  String(props.runtime?.state?.value?.sessionVars?.businessName ?? 'Kogane'),
);
const terminalName = computed(() =>
  String(props.runtime?.state?.value?.sessionVars?.terminalName ?? title.value ?? 'Cashier'),
);

function normalizePaymentMethod(method: string) {
  return method.trim().toLowerCase();
}

function formatPaymentLabel(method: string) {
  return method
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isCardStyleMethod(method: string) {
  return /(card|credit|debit|visa|mastercard)/i.test(method);
}

const requiresCardApproval = computed(() =>
  !props.builderMode
  && cardReaderEnabled.value
  && isCardStyleMethod(selectedPaymentMethod.value),
);

const canSubmit = computed(() =>
  !props.builderMode
  && !submitting.value
  && cart.value.length > 0
  && tableNumber.value.trim().length > 0
  && (!requiresCardApproval.value || cardApprovalState.value === 'approved'),
);

const readerStatusLabel = computed(() => {
  if (!requiresCardApproval.value) return 'Not required';
  if (cardApprovalState.value === 'approved') return 'Approved';
  if (cardApprovalState.value === 'requested') return 'Waiting for bridge confirmation';
  return cardReaderMode.value === 'bridge' ? 'Ready to request reader bridge' : 'Waiting for payment confirmation';
});

const readerHelperText = computed(() => {
  switch (cardReaderMode.value) {
    case 'simulated':
      return 'Demo mode for testing the cashier flow before a real reader is connected.';
    case 'bridge':
      return 'Bridge-ready mode. You can plug a vendor SDK or local bridge into this action later.';
    default:
      return 'Use this after your physical terminal completes the charge.';
  }
});

const readerActionLabel = computed(() => {
  if (cardReaderMode.value === 'bridge' && cardApprovalState.value === 'requested') {
    return 'Mark Bridge Payment Approved';
  }

  switch (cardReaderMode.value) {
    case 'simulated':
      return 'Simulate Tap To Pay';
    case 'bridge':
      return 'Request Reader Bridge';
    default:
      return 'Confirm Reader Charge';
  }
});

watch(
  paymentMethods,
  (methods) => {
    if (!methods.includes(selectedPaymentMethod.value)) {
      selectedPaymentMethod.value = props.element.defaultPaymentMethod && methods.includes(props.element.defaultPaymentMethod)
        ? props.element.defaultPaymentMethod
        : methods[0];
    }
  },
  { immediate: true },
);

watch(selectedPaymentMethod, () => {
  cardApprovalState.value = 'idle';
  cardPaymentReference.value = null;
});

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function buildLineItems(): ReceiptItem[] {
  return cart.value.map((item) => ({
    ...item,
    subtotal: item.price * item.qty,
  }));
}

function generateReference(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function generateReceiptNumber() {
  return generateReference('RCPT');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resetCardReaderState() {
  cardApprovalState.value = 'idle';
  cardPaymentReference.value = null;
}

function requestCardPaymentApproval() {
  if (props.builderMode || !requiresCardApproval.value) return;

  if (cardReaderMode.value === 'bridge' && cardApprovalState.value === 'idle') {
    const bridgeReference = generateReference('BRIDGE');
    cardApprovalState.value = 'requested';
    cardPaymentReference.value = bridgeReference;
    props.runtime?.emitLocal?.('payment:card-requested', {
      provider: cardReaderProvider.value,
      reference: bridgeReference,
      amount: total.value,
      tableNumber: tableNumber.value.trim(),
      paymentMethod: selectedPaymentMethod.value,
    });
    return;
  }

  cardApprovalState.value = 'approved';
  cardPaymentReference.value = cardPaymentReference.value ?? generateReference('CARD');
  props.runtime?.emitLocal?.('payment:card-approved', {
    provider: cardReaderProvider.value,
    reference: cardPaymentReference.value,
    amount: total.value,
    tableNumber: tableNumber.value.trim(),
    paymentMethod: selectedPaymentMethod.value,
  });
}

async function loadProducts() {
  if (props.builderMode) return;
  await props.runtime?.loadElement?.(props.element);
}

function addToCart(product: Record<string, unknown>) {
  const id = String(product.id ?? product.name);
  const name = String(product[displayColumns.value[0]] ?? id);
  const price = Number(product[props.element.priceColumn ?? 'price'] ?? product.price ?? product.unit_price ?? 0);

  const next = [...cart.value];
  const existing = next.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    next.push({ id, name, price, qty: 1 });
  }
  cart.value = next;
}

function removeFromCart(id: string) {
  cart.value = cart.value.filter((item) => item.id !== id);
}

function buildReceiptPreview(
  insertedOrder: Record<string, unknown> | null,
  lineItems: ReceiptItem[],
  receiptNumber: string,
  paymentReference: string | null,
  paymentStatus: string,
) {
  return {
    orderId: String(insertedOrder?.id ?? receiptNumber),
    businessName: businessName.value,
    terminalName: terminalName.value,
    title: receiptTitle.value,
    footer: receiptFooter.value,
    receiptNumber,
    createdAt: new Date().toLocaleString(),
    tableNumber: tableNumber.value.trim(),
    paymentMethod: formatPaymentLabel(selectedPaymentMethod.value),
    paymentStatus,
    paymentReference,
    items: lineItems,
    total: total.value,
  } satisfies ReceiptPreview;
}

function dismissReceipt() {
  lastReceipt.value = null;
}

function printReceipt() {
  if (!import.meta.client || !lastReceipt.value) return;

  const receipt = lastReceipt.value;
  const receiptRows = receipt.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)} x${item.qty}</td>
        <td style="text-align:right;">${escapeHtml(formatMoney(item.subtotal))}</td>
      </tr>
    `).join('');

  const printWindow = window.open('', '_blank', 'width=420,height=680');
  if (!printWindow) return;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(receipt.title)}</title>
        <style>
          body {
            margin: 0;
            font-family: "Inter", Arial, sans-serif;
            color: #1f1720;
            background: #ffffff;
          }
          .receipt {
            width: 320px;
            margin: 0 auto;
            padding: 24px 18px 30px;
          }
          .brand {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
          }
          .title {
            margin: 4px 0 0;
            font-size: 13px;
            color: #6b5d67;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .meta {
            margin: 18px 0;
            padding: 12px 0;
            border-top: 1px dashed #cfc6cc;
            border-bottom: 1px dashed #cfc6cc;
            font-size: 12px;
            line-height: 1.6;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          td {
            padding: 6px 0;
            vertical-align: top;
          }
          .total {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid #d8cfd5;
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 700;
          }
          .footer {
            margin-top: 16px;
            font-size: 11px;
            line-height: 1.5;
            color: #6b5d67;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <p class="brand">${escapeHtml(receipt.businessName)}</p>
          <p class="title">${escapeHtml(receipt.title)}</p>
          <div class="meta">
            <div>Receipt: ${escapeHtml(receipt.receiptNumber)}</div>
            <div>Terminal: ${escapeHtml(receipt.terminalName)}</div>
            <div>Table: ${escapeHtml(receipt.tableNumber)}</div>
            <div>Payment: ${escapeHtml(receipt.paymentMethod)} (${escapeHtml(receipt.paymentStatus)})</div>
            ${receipt.paymentReference ? `<div>Reference: ${escapeHtml(receipt.paymentReference)}</div>` : ''}
            <div>${escapeHtml(receipt.createdAt)}</div>
          </div>
          <table>
            <tbody>
              ${receiptRows}
            </tbody>
          </table>
          <div class="total">
            <span>Total</span>
            <span>${escapeHtml(formatMoney(receipt.total))}</span>
          </div>
          <div class="footer">${escapeHtml(receipt.footer ?? '')}</div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

async function submitOrder() {
  if (!canSubmit.value) return;
  submitting.value = true;

  try {
    const lineItems = buildLineItems();
    const itemsSummary = lineItems
      .map((item) => `${item.name} x${item.qty}`)
      .join(', ');
    const normalizedTableNumber = tableNumber.value.trim();
    const receiptNumber = generateReceiptNumber();
    const paymentReference = cardPaymentReference.value
      ?? (normalizePaymentMethod(selectedPaymentMethod.value) !== 'cash' ? generateReference('PAY') : null);
    const paymentStatus = requiresCardApproval.value ? 'authorized' : 'paid';

    const inserted = await props.runtime?.dispatch?.({
      type: 'insert',
      table: props.element.orderTable,
      payload: {
        items: itemsSummary,
        line_items: lineItems,
        total: total.value,
        status: 'pending',
        table_number: normalizedTableNumber,
        payment_method: selectedPaymentMethod.value,
        payment_status: paymentStatus,
        payment_reference: paymentReference,
        receipt_number: receiptNumber,
      },
    }, {
      element: props.element,
      trigger: 'click',
    });

    if (receiptPrintingEnabled.value) {
      lastReceipt.value = buildReceiptPreview(
        inserted as Record<string, unknown> | null,
        lineItems,
        receiptNumber,
        paymentReference,
        paymentStatus === 'authorized' ? 'Authorized' : 'Paid',
      );
      props.runtime?.emitLocal?.('receipt:ready', lastReceipt.value);
    }

    props.runtime?.emitLocal?.('cart:clear');
    tableNumber.value = '';
    selectedPaymentMethod.value = paymentMethods.value.includes(props.element.defaultPaymentMethod ?? '')
      ? props.element.defaultPaymentMethod ?? paymentMethods.value[0]
      : paymentMethods.value[0];
    resetCardReaderState();
  } finally {
    submitting.value = false;
  }
}

onMounted(loadProducts);

watch(
  () => [
    props.element.productTable,
    props.element.orderTable,
    props.element.priceColumn,
    props.element.displayColumns.join(','),
  ],
  loadProducts,
);
</script>

<template>
  <div
    class="relative w-full h-full flex gap-3 overflow-hidden p-3"
    :style="{
      background: surfaceColor,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: radius,
    }"
  >
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-[20px]" :style="{ background: panelColor, border: `1px solid ${borderColor}` }">
      <div class="px-4 py-3 border-b" :style="{ borderColor }">
        <p class="text-sm font-semibold truncate">{{ title }}</p>
        <p class="text-[11px] mt-0.5 truncate" :style="{ color: mutedTextColor }">{{ subtitle }}</p>
      </div>

      <div class="px-4 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]" :style="{ color: mutedTextColor }">
        <span class="inline-flex items-center rounded-full px-2 py-1" :style="{ background: 'rgba(255,255,255,0.06)' }">
          {{ element.productTable || 'products' }}
        </span>
        <span>Tap to add</span>
      </div>

      <div class="flex-1 overflow-auto grid grid-cols-2 gap-2 content-start p-2">
        <button
          v-for="product in products"
          :key="String(product.id)"
          class="rounded-2xl p-3 text-left transition-colors"
          :style="{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }"
          @click="addToCart(product)"
        >
          <div class="text-sm font-medium truncate">
            {{ product[displayColumns[0]] }}
          </div>
          <div v-if="displayColumns[1]" class="text-[11px] mt-1 truncate" :style="{ color: mutedTextColor }">
            {{ product[displayColumns[1]] ?? '' }}
          </div>
          <div class="text-xs mt-2 font-semibold" :style="{ color: accentColor }">
            {{ product[element.priceColumn ?? 'price'] != null ? formatMoney(Number(product[element.priceColumn ?? 'price'])) : '' }}
          </div>
        </button>

        <div
          v-if="products.length === 0"
          class="col-span-2 rounded-2xl p-6 text-center text-sm"
          :style="{ background: 'rgba(255,255,255,0.03)', color: mutedTextColor, border: `1px dashed ${borderColor}` }"
        >
          <p>{{ element.emptyLabel ?? 'No products loaded yet.' }}</p>
          <p
            v-if="!props.builderMode && element.productTable === 'products'"
            class="mt-2 text-[11px]"
          >
            Add products from a Catalog Registrar or Inventory terminal, or from the admin database view.
          </p>
        </div>
      </div>
    </div>

    <div class="w-64 shrink-0 flex flex-col rounded-[20px] overflow-hidden" :style="{ background: panelColor, border: `1px solid ${borderColor}` }">
      <div class="px-3 py-3 border-b text-xs font-semibold uppercase tracking-wide flex items-center justify-between" :style="{ borderColor, color: mutedTextColor }">
        <span>Cart</span>
        <span>{{ cart.length }} item{{ cart.length === 1 ? '' : 's' }}</span>
      </div>

      <div class="px-3 pt-3 space-y-3">
        <div class="space-y-1.5">
          <label class="text-[10px] font-semibold uppercase tracking-[0.18em]" :style="{ color: mutedTextColor }">
            Table Number
          </label>
          <input
            v-model="tableNumber"
            type="text"
            placeholder="Enter table number"
            class="w-full rounded-xl px-3 py-2 text-sm outline-none"
            :style="{
              background: 'rgba(255,255,255,0.05)',
              color: textColor,
              border: `1px solid ${borderColor}`,
            }"
            :disabled="props.builderMode || submitting"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] font-semibold uppercase tracking-[0.18em]" :style="{ color: mutedTextColor }">
            Payment Method
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="method in paymentMethods"
              :key="method"
              type="button"
              class="rounded-xl px-2.5 py-2 text-xs font-semibold transition-all"
              :style="selectedPaymentMethod === method
                ? { background: accentColor, color: '#ffffff', border: `1px solid ${accentColor}` }
                : { background: 'rgba(255,255,255,0.04)', color: textColor, border: `1px solid ${borderColor}` }"
              @click="selectedPaymentMethod = method"
            >
              {{ formatPaymentLabel(method) }}
            </button>
          </div>
        </div>

        <div
          v-if="requiresCardApproval"
          class="rounded-2xl p-3 space-y-2"
          :style="{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }"
        >
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center" :style="{ background: `${accentColor}20`, color: accentColor }">
              <CreditCard class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold truncate">{{ cardReaderLabel }}</p>
              <p class="text-[10px] truncate" :style="{ color: mutedTextColor }">{{ cardReaderProvider }}</p>
            </div>
          </div>
          <p class="text-[11px] leading-relaxed" :style="{ color: mutedTextColor }">
            {{ readerHelperText }}
          </p>
          <div class="rounded-xl px-3 py-2 flex items-center justify-between text-[11px]" :style="{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}` }">
            <span :style="{ color: mutedTextColor }">Status</span>
            <span class="font-semibold" :style="{ color: cardApprovalState === 'approved' ? accentColor : textColor }">{{ readerStatusLabel }}</span>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
              :style="{ background: accentColor, color: '#ffffff' }"
              @click="requestCardPaymentApproval"
            >
              {{ readerActionLabel }}
            </button>
            <button
              v-if="cardApprovalState !== 'idle'"
              type="button"
              class="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
              :style="{ background: 'rgba(255,255,255,0.05)', color: textColor, border: `1px solid ${borderColor}` }"
              @click="resetCardReaderState"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-auto p-2 space-y-1">
        <div
          v-for="item in cart"
          :key="item.id"
          class="flex items-center justify-between gap-2 text-xs rounded-xl px-2 py-1.5"
          :style="{ background: 'rgba(255,255,255,0.03)' }"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate">{{ item.name }} x{{ item.qty }}</p>
            <p class="text-[10px]" :style="{ color: mutedTextColor }">{{ formatMoney(item.price * item.qty) }}</p>
          </div>
          <button class="ml-2 flex items-center justify-center transition-colors" :style="{ color: mutedTextColor }" @click="removeFromCart(item.id)">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div v-if="cart.length === 0" class="text-center py-6 text-sm" :style="{ color: mutedTextColor }">Empty</div>
      </div>

      <div class="p-3 border-t space-y-3" :style="{ borderColor }">
        <div class="flex justify-between text-sm font-semibold">
          <span>Total</span>
          <span>{{ formatMoney(total) }}</span>
        </div>
        <button
          class="w-full text-sm font-medium py-2 rounded-xl transition-all disabled:opacity-40"
          :style="{ background: accentColor, color: '#ffffff' }"
          :disabled="!canSubmit"
          @click="submitOrder"
        >
          {{ submitting ? 'Submitting...' : submitLabel }}
        </button>
        <p v-if="requiresCardApproval && cardApprovalState !== 'approved'" class="text-[10px] leading-relaxed" :style="{ color: mutedTextColor }">
          Confirm the card charge first so the order is saved with payment approval metadata.
        </p>
      </div>
    </div>

    <div
      v-if="lastReceipt"
      class="absolute inset-3 rounded-[24px] flex items-center justify-center px-4"
      :style="{ background: 'rgba(8,5,8,0.54)' }"
      @click.self="dismissReceipt"
    >
      <div class="w-full max-w-sm rounded-[26px] p-5 shadow-2xl" :style="{ background: '#fffaf6', color: '#2f1822', border: `1px solid ${accentColor}30` }">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-lg font-semibold">{{ lastReceipt.businessName }}</p>
            <p class="text-[11px] uppercase tracking-[0.2em] mt-1" style="color: rgba(47,24,34,0.55);">{{ lastReceipt.title }}</p>
          </div>
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center" :style="{ background: `${accentColor}18`, color: accentColor }">
            <ReceiptText class="w-5 h-5" />
          </div>
        </div>

        <div class="mt-4 rounded-2xl p-3 text-xs space-y-1.5" style="background: rgba(47,24,34,0.05);">
          <div class="flex justify-between gap-4"><span style="color: rgba(47,24,34,0.55);">Receipt</span><span class="font-semibold">{{ lastReceipt.receiptNumber }}</span></div>
          <div class="flex justify-between gap-4"><span style="color: rgba(47,24,34,0.55);">Table</span><span class="font-semibold">{{ lastReceipt.tableNumber }}</span></div>
          <div class="flex justify-between gap-4"><span style="color: rgba(47,24,34,0.55);">Payment</span><span class="font-semibold">{{ lastReceipt.paymentMethod }}</span></div>
          <div class="flex justify-between gap-4"><span style="color: rgba(47,24,34,0.55);">Status</span><span class="font-semibold">{{ lastReceipt.paymentStatus }}</span></div>
          <div v-if="lastReceipt.paymentReference" class="flex justify-between gap-4"><span style="color: rgba(47,24,34,0.55);">Reference</span><span class="font-semibold text-right break-all">{{ lastReceipt.paymentReference }}</span></div>
          <div class="flex justify-between gap-4"><span style="color: rgba(47,24,34,0.55);">Time</span><span class="font-semibold text-right">{{ lastReceipt.createdAt }}</span></div>
        </div>

        <div class="mt-4 space-y-2 max-h-44 overflow-auto">
          <div
            v-for="item in lastReceipt.items"
            :key="`${item.id}-${item.qty}`"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">{{ item.name }}</p>
              <p class="text-[11px]" style="color: rgba(47,24,34,0.55);">{{ item.qty }} x {{ formatMoney(item.price) }}</p>
            </div>
            <span class="font-semibold">{{ formatMoney(item.subtotal) }}</span>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t flex items-center justify-between text-sm font-semibold" style="border-color: rgba(47,24,34,0.12);">
          <span>Total</span>
          <span>{{ formatMoney(lastReceipt.total) }}</span>
        </div>

        <div class="mt-3 text-[11px] leading-relaxed" style="color: rgba(47,24,34,0.6);">
          {{ lastReceipt.footer }}
        </div>

        <div class="mt-5 flex gap-2">
          <button
            class="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            :style="{ background: accentColor }"
            @click="printReceipt"
          >
            <span class="inline-flex items-center justify-center gap-1.5">
              <Printer class="w-4 h-4" /> Print Receipt
            </span>
          </button>
          <button
            class="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style="background: rgba(47,24,34,0.06); color: #2f1822;"
            @click="dismissReceipt"
          >
            <span class="inline-flex items-center justify-center gap-1.5">
              <CheckCircle2 class="w-4 h-4" /> Done
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
