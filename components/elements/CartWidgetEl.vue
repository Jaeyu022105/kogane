<script setup lang="ts">
import {
  CheckCircle2,
  CreditCard,
  Minus,
  Percent,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-vue-next';
import type { CartWidgetElementDef } from '~/lib/uiTypes';
import { isLightColor } from '~/lib/workspaceBranding';
import { findCountry, formatCurrencyAmount } from '~/lib/currency';
import { useBusiness } from '~/composables/useBusiness';
import { calculateOrderDiscounts, roundCurrency, type DiscountType } from '~/lib/discounts';

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
  discount?: number;
  discounted_qty?: number;
  regular_qty?: number;
  taxable?: boolean;
  total?: number;
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
  subtotal: number;
  discountAmount: number;
  discountLabel?: string | null;
  discountReference?: string | null;
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

const localCart = ref<CartItem[]>([]);

const cart = computed<CartItem[]>({
  get: () => {
    const runtimeCart = props.runtime?.state?.value?.cart;
    if (Array.isArray(runtimeCart)) {
      return runtimeCart as CartItem[];
    }
    return localCart.value;
  },
  set: (value) => {
    if (typeof props.runtime?.setCartValue === 'function') {
      props.runtime.setCartValue(value);
    } else {
      localCart.value = value;
    }
  },
});

const totalCartQuantity = computed(() =>
  cart.value.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
);

const tableNumber = ref('');
const submitting = ref(false);
const selectedPaymentMethod = ref(props.element.defaultPaymentMethod ?? 'cash');

// Card processing options: 'external' (standalone EFTPOS/card machine) vs 'integrated' (web reader bridge)
const cardProcessingMode = ref<'external' | 'integrated'>(
  props.element.enableCardReader ? 'integrated' : 'external',
);
const externalCardAuth = ref('');
const cardApprovalState = ref<'idle' | 'requested' | 'approved'>('idle');
const cardPaymentReference = ref<string | null>(null);

// Discounts: PWD, Senior Citizen, Custom %, Custom Fixed
type DiscountKind = DiscountType;
const discountType = ref<DiscountKind>('none');
const pwdCount = ref(1);
const customDiscountPercent = ref(10);
const customDiscountFixed = ref(5);
const discountRefNumber = ref('');

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

const discountResult = computed(() =>
  calculateOrderDiscounts(cart.value, {
    discountType: discountType.value,
    beneficiaryCount: pwdCount.value,
    customPercent: customDiscountPercent.value,
    customFixed: customDiscountFixed.value,
    reference: discountRefNumber.value,
  }),
);

const subtotal = computed(() => discountResult.value.subtotal);
const discountAmount = computed(() => discountResult.value.discountAmount);
const discountLabel = computed(() => discountResult.value.discountLabel);
const total = computed(() => discountResult.value.total);

function getDiscountedUnitsForItem(itemId: string): number {
  const line = discountResult.value.lineItems.find((l) => l.id === itemId);
  return line ? line.discountedQty : 0;
}

const displayColumns = computed(() =>
  props.element.displayColumns.length > 0
    ? props.element.displayColumns
    : ['name'],
);

const title = computed(() => props.element.title ?? 'Sale Panel');
const subtitle = computed(() => props.element.subtitle ?? 'Build an order from available items.');
const submitLabel = computed(() => {
  if (isCardPaymentSelected.value) {
    return 'Confirm Card Payment';
  }
  return props.element.submitLabel ?? 'Submit Order';
});
const emptyLabel = computed(() => {
  const configuredLabel = props.element.emptyLabel;
  if (configuredLabel && !/admin database view/i.test(configuredLabel)) return configuredLabel;
  return 'No products are ready for sale yet.';
});
const receiptTitle = computed(() => props.element.receiptTitle ?? 'Order Receipt');
const receiptFooter = computed(() => props.element.receiptFooter ?? 'Thank you for your visit.');

// Visual theme adaptations
const surfaceColor = computed(() => props.element.backgroundColor ?? '#161116');
const isLight = computed(() => isLightColor(surfaceColor.value));
const textColor = computed(() => props.element.textColor ?? (isLight.value ? '#261a14' : '#f5ede4'));
const mutedTextColor = computed(() => isLight.value ? 'rgba(38, 26, 20, 0.65)' : 'rgba(245, 237, 228, 0.68)');
const panelColor = computed(() => props.element.panelColor ?? (isLight.value ? '#f5ede2' : 'rgba(255, 255, 255, 0.04)'));
const accentColor = computed(() => props.element.accentColor ?? (isLight.value ? '#d97706' : '#e8748a'));
const borderColor = computed(() => props.element.borderColor ?? (isLight.value ? 'rgba(81, 49, 31, 0.16)' : 'rgba(255, 255, 255, 0.08)'));
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

const isCardPaymentSelected = computed(() => isCardStyleMethod(selectedPaymentMethod.value));

const requiresCardApproval = computed(() =>
  !props.builderMode
  && cardReaderEnabled.value
  && isCardPaymentSelected.value
  && cardProcessingMode.value === 'integrated',
);

const canSubmit = computed(() =>
  !props.builderMode
  && !submitting.value
  && cart.value.length > 0,
);

const readerStatusLabel = computed(() => {
  if (!requiresCardApproval.value) return 'External machine (Pre-approved)';
  if (cardApprovalState.value === 'approved') return 'Approved';
  if (cardApprovalState.value === 'requested') return 'Waiting for bridge confirmation';
  return cardReaderMode.value === 'bridge' ? 'Ready to request reader bridge' : 'Waiting for payment confirmation';
});

const readerHelperText = computed(() => {
  switch (cardReaderMode.value) {
    case 'simulated':
      return 'Demo mode for testing the cashier flow before a real reader is connected.';
    case 'bridge':
      return 'Bridge-ready mode. You can plug a vendor SDK or local bridge into this action.';
    default:
      return 'Confirm here once the card transaction finishes on your device.';
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

const { business } = useBusiness();
const countryCode = computed(() =>
  String(
    business.value?.country
    || props.runtime?.state?.value?.sessionVars?.country
    || props.runtime?.context?.value?.sessionVars?.country
    || 'US'
  )
);
const matchedCountry = computed(() => findCountry(countryCode.value));
const currencyCode = computed(() =>
  String(
    business.value?.currency
    || props.runtime?.state?.value?.sessionVars?.currency
    || props.runtime?.context?.value?.sessionVars?.currency
    || matchedCountry.value.currency
    || 'USD'
  )
);
const currencySymbol = computed(() =>
  String(
    business.value?.currencySymbol
    || props.runtime?.state?.value?.sessionVars?.currencySymbol
    || props.runtime?.context?.value?.sessionVars?.currencySymbol
    || props.element?.currencySymbol
    || matchedCountry.value.symbol
    || '$'
  )
);

function formatMoney(value: number | unknown) {
  return formatCurrencyAmount(value, {
    symbol: currencySymbol.value,
    currency: currencyCode.value,
    country: countryCode.value,
    decimals: matchedCountry.value.decimals,
  });
}

function buildLineItems(): ReceiptItem[] {
  const result: ReceiptItem[] = [];
  for (const item of discountResult.value.lineItems) {
    if (item.discountedQty > 0 && item.regularQty > 0) {
      // Split into discounted (tax-exempt) units and regular (taxable) units
      const discSubtotal = roundCurrency(item.price * item.discountedQty);
      result.push({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.discountedQty,
        subtotal: discSubtotal,
        discount: item.discountAmount,
        discounted_qty: item.discountedQty,
        regular_qty: 0,
        taxable: false,
        total: Math.max(0, roundCurrency(discSubtotal - item.discountAmount)),
      });
      const regSubtotal = roundCurrency(item.price * item.regularQty);
      result.push({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.regularQty,
        subtotal: regSubtotal,
        discount: 0,
        discounted_qty: 0,
        regular_qty: item.regularQty,
        taxable: true,
        total: regSubtotal,
      });
    } else {
      result.push({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        subtotal: item.lineSubtotal,
        discount: item.discountAmount,
        discounted_qty: item.discountedQty,
        regular_qty: item.regularQty,
        taxable: item.discountedQty === 0,
        total: item.lineTotal,
      });
    }
  }
  return result;
}

watch(totalCartQuantity, (newTotal) => {
  const maxBeneficiaries = Math.max(1, newTotal);
  if (pwdCount.value > maxBeneficiaries) {
    pwdCount.value = maxBeneficiaries;
  }
});

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

function proceedWithoutReader() {
  cardProcessingMode.value = 'external';
  cardApprovalState.value = 'approved';
  cardPaymentReference.value = externalCardAuth.value.trim() || generateReference('EXT-CARD');
}

async function handleReaderAction() {
  if (props.builderMode || cart.value.length === 0 || submitting.value) return;

  if (cardReaderMode.value === 'bridge' && cardApprovalState.value === 'idle') {
    const bridgeReference = generateReference('BRIDGE');
    cardApprovalState.value = 'requested';
    cardPaymentReference.value = bridgeReference;
    props.runtime?.emitLocal?.('payment:card-requested', {
      provider: cardReaderProvider.value,
      reference: bridgeReference,
      amount: total.value,
      tableNumber: tableNumber.value.trim() || 'Counter',
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
    tableNumber: tableNumber.value.trim() || 'Counter',
    paymentMethod: selectedPaymentMethod.value,
  });

  await submitOrder();
}

function requestCardPaymentApproval() {
  return handleReaderAction();
}

async function loadProducts() {
  if (props.builderMode) return;
  if (props.runtime?.reloadElement) {
    await props.runtime.reloadElement(props.element);
  } else {
    await props.runtime?.loadElement?.(props.element);
  }
}

let unsubscribeRealtime: (() => void) | null = null;

onMounted(() => {
  loadProducts();
  if (props.runtime?.on) {
    unsubscribeRealtime = props.runtime.on('realtime:table-update', (mutation: any) => {
      const targetTable = props.element.productTable ?? 'products';
      const isMatch = mutation?.table === targetTable
        || targetTable.endsWith(`_${mutation?.table}`)
        || mutation?.table?.endsWith(`_${targetTable}`);
      if (isMatch) {
        loadProducts();
      }
    });
  }
});

onUnmounted(() => {
  unsubscribeRealtime?.();
});

function getProductIdentifier(product: Record<string, unknown>, fallbackIndex?: number): string {
  const candidate = product.id
    ?? product._id
    ?? product.item_id
    ?? product.product_id
    ?? product[displayColumns.value[0]]
    ?? product.name
    ?? product.title;
  if (candidate != null && String(candidate).trim() !== '') {
    return String(candidate);
  }
  return fallbackIndex !== undefined ? `prod-${fallbackIndex}` : 'unknown-product';
}

function getProductName(product: Record<string, unknown>, id: string): string {
  const firstCol = displayColumns.value[0];
  const valFirst = firstCol && product[firstCol] != null ? String(product[firstCol]).trim() : '';
  if (valFirst) return valFirst;

  const valName = product.name != null ? String(product.name).trim() : '';
  if (valName) return valName;

  const valTitle = product.title != null ? String(product.title).trim() : '';
  if (valTitle) return valTitle;

  const valItem = product.item_name != null ? String(product.item_name).trim() : '';
  if (valItem) return valItem;

  const valLabel = product.label != null ? String(product.label).trim() : '';
  if (valLabel) return valLabel;

  if (id && String(id).trim() !== '') {
    return String(id).trim();
  }
  return 'Item';
}

function getProductPrice(product: Record<string, unknown>): number {
  const candidate = product[props.element.priceColumn ?? 'price']
    ?? product.price
    ?? product.unit_price
    ?? product.cost
    ?? 0;
  if (typeof candidate === 'number') return Number.isFinite(candidate) ? candidate : 0;
  if (typeof candidate === 'string') {
    const cleaned = candidate.replace(/[^0-9.-]+/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function addToCart(product: Record<string, unknown>, fallbackIndex?: number) {
  const id = getProductIdentifier(product, fallbackIndex);
  const name = getProductName(product, id);
  const price = getProductPrice(product);

  if (typeof props.runtime?.addToCart === 'function') {
    props.runtime.addToCart({ id, name, price, qty: 1 });
    return;
  }

  const current = cart.value || [];
  const existingIndex = current.findIndex((item) => String(item.id) === id);
  if (existingIndex >= 0) {
    const updated = current.map((item, idx) => {
      if (idx === existingIndex) {
        return { ...item, qty: (Number(item.qty) || 0) + 1 };
      }
      return { ...item };
    });
    cart.value = updated;
  } else {
    cart.value = [
      ...current.map((item) => ({ ...item })),
      { id, name, price, qty: 1 },
    ];
  }
}

function increaseQuantity(id: string) {
  const itemId = String(id);
  if (typeof props.runtime?.updateCartItemQty === 'function') {
    const item = cart.value.find((i) => String(i.id) === itemId);
    if (item) {
      props.runtime.updateCartItemQty(itemId, (Number(item.qty) || 0) + 1);
      return;
    }
  }

  const updated = cart.value.map((item) => {
    if (String(item.id) === itemId) {
      return { ...item, qty: (Number(item.qty) || 0) + 1 };
    }
    return { ...item };
  });
  cart.value = updated;
}

function decreaseQuantity(id: string) {
  const itemId = String(id);
  const item = cart.value.find((i) => String(i.id) === itemId);
  if (!item) return;

  const currentQty = Number(item.qty) || 0;
  if (currentQty <= 1) {
    removeFromCart(itemId);
    return;
  }

  if (typeof props.runtime?.updateCartItemQty === 'function') {
    props.runtime.updateCartItemQty(itemId, currentQty - 1);
    return;
  }

  const updated = cart.value.map((i) => {
    if (String(i.id) === itemId) {
      return { ...i, qty: currentQty - 1 };
    }
    return { ...i };
  });
  cart.value = updated;
}

function removeFromCart(id: string) {
  const itemId = String(id);
  if (typeof props.runtime?.removeFromCart === 'function') {
    props.runtime.removeFromCart(itemId);
    return;
  }
  cart.value = cart.value.filter((item) => String(item.id) !== itemId);
}

function clearCart() {
  if (typeof props.runtime?.clearCart === 'function') {
    props.runtime.clearCart();
  } else if (typeof props.runtime?.setCartValue === 'function') {
    props.runtime.setCartValue([]);
  } else {
    cart.value = [];
  }
  props.runtime?.emitLocal?.('cart:clear');
}

function getProductQuantityInCart(productId: string): number {
  const item = cart.value.find((i) => String(i.id) === String(productId));
  return item ? Number(item.qty) || 0 : 0;
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
    subtotal: subtotal.value,
    discountAmount: discountAmount.value,
    discountLabel: discountLabel.value,
    discountReference: discountRefNumber.value.trim() || null,
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

  const discountRow = receipt.discountAmount > 0 ? `
    <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:12px; color:#c2410c;">
      <span>Discount (${escapeHtml(receipt.discountLabel || 'Applied')}${receipt.discountReference ? ` - Ref: ${escapeHtml(receipt.discountReference)}` : ''})</span>
      <span>-${escapeHtml(formatMoney(receipt.discountAmount))}</span>
    </div>
  ` : '';

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
          .totals-block {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid #d8cfd5;
          }
          .subtotal-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
          }
          .total {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 15px;
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
          <div class="totals-block">
            <div class="subtotal-row">
              <span>Subtotal</span>
              <span>${escapeHtml(formatMoney(receipt.subtotal))}</span>
            </div>
            ${discountRow}
            <div class="total">
              <span>Total</span>
              <span>${escapeHtml(formatMoney(receipt.total))}</span>
            </div>
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
    const itemsSummary = cart.value.length > 0
      ? cart.value.map((item) => `${item.name} x${item.qty}`).join(', ')
      : lineItems.map((item) => `${item.name} x${item.qty}`).join(', ');
    const normalizedTableNumber = tableNumber.value.trim() || 'Counter';
    const receiptNumber = generateReceiptNumber();

    let paymentReference: string | null = null;
    if (isCardPaymentSelected.value) {
      if (cardProcessingMode.value === 'external') {
        paymentReference = externalCardAuth.value.trim() || generateReference('EXT-CARD');
      } else {
        cardApprovalState.value = 'approved';
        paymentReference = cardPaymentReference.value ?? generateReference('CARD');
        cardPaymentReference.value = paymentReference;
      }
    } else if (normalizePaymentMethod(selectedPaymentMethod.value) !== 'cash') {
      paymentReference = generateReference('PAY');
    }

    const paymentStatus = 'paid';

    const normalizedPaymentMethod = isCardPaymentSelected.value ? 'card' : selectedPaymentMethod.value;

    const inserted = await props.runtime?.dispatch?.({
      type: 'insert',
      table: props.element.orderTable || 'orders',
      payload: {
        items: itemsSummary,
        line_items: lineItems,
        subtotal: subtotal.value,
        discount_type: discountType.value !== 'none' ? discountType.value : null,
        discount_amount: discountAmount.value > 0 ? discountAmount.value : 0,
        discount_label: discountLabel.value || null,
        discount_reference: discountRefNumber.value.trim() || null,
        total: total.value,
        status: 'pending',
        table_number: normalizedTableNumber,
        payment_method: normalizedPaymentMethod,
        payment_status: paymentStatus,
        payment_reference: paymentReference,
        receipt_number: receiptNumber,
        metadata: {
          discount_breakdown: discountResult.value.metadata,
          tax_exempt_subtotal: discountResult.value.taxExemptGross,
          taxable_subtotal: discountResult.value.taxableGross,
        },
      },
    }, {
      element: props.element,
      trigger: 'click',
    });

    if (props.runtime?.dispatch && inserted === null) {
      console.error('Order creation rejected or failed');
      return;
    }

    lastReceipt.value = buildReceiptPreview(
      inserted as Record<string, unknown> | null,
      lineItems,
      receiptNumber,
      paymentReference,
      'Paid',
    );
    props.runtime?.emitLocal?.('receipt:ready', lastReceipt.value);

    props.runtime?.setCartValue?.([]);
    cart.value = [];
    props.runtime?.emitLocal?.('cart:clear');
    tableNumber.value = '';
    discountType.value = 'none';
    pwdCount.value = 1;
    discountRefNumber.value = '';
    externalCardAuth.value = '';
    selectedPaymentMethod.value = paymentMethods.value.includes(props.element.defaultPaymentMethod ?? '')
      ? props.element.defaultPaymentMethod ?? paymentMethods.value[0]
      : paymentMethods.value[0];
    resetCardReaderState();
  } catch (err) {
    console.error('Failed to submit order:', err);
  } finally {
    submitting.value = false;
  }
}

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
    class="relative w-full h-full flex flex-col md:flex-row gap-3 overflow-hidden p-3"
    :style="{
      background: surfaceColor,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: radius,
    }"
  >
    <!-- Left: Product Catalog Grid -->
    <div
      class="flex-1 min-w-0 flex flex-col overflow-hidden rounded-[22px]"
      :style="{ background: panelColor, border: `1px solid ${borderColor}` }"
    >
      <div class="px-4 py-3 border-b flex items-center justify-between shrink-0" :style="{ borderColor }">
        <div>
          <p class="text-sm font-bold truncate">{{ title }}</p>
          <p class="text-[11px] mt-0.5 truncate" :style="{ color: mutedTextColor }">{{ subtitle }}</p>
        </div>
        <div
          class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
          :style="{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', color: mutedTextColor }"
        >
          {{ element.productTable || 'products' }}
        </div>
      </div>

      <div class="flex-1 overflow-y-auto grid grid-cols-2 gap-3 content-start p-3">
        <button
          v-for="(product, idx) in products"
          :key="getProductIdentifier(product, idx)"
          type="button"
          class="group relative rounded-2xl p-3 text-left transition-all active:scale-[0.98] hover:brightness-105 cursor-pointer flex flex-col justify-between min-h-[110px]"
          :style="{
            background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
            color: textColor,
            border: `1px solid ${getProductQuantityInCart(getProductIdentifier(product, idx)) > 0 ? accentColor : borderColor}`,
            boxShadow: getProductQuantityInCart(getProductIdentifier(product, idx)) > 0 ? `0 0 0 1px ${accentColor}40` : 'none',
          }"
          @click="addToCart(product, idx)"
        >
          <div class="w-full min-w-0">
            <div class="flex items-start justify-between gap-1.5 w-full min-w-0">
              <span
                class="text-xs md:text-sm font-semibold flex-1 leading-snug line-clamp-2 break-words"
                :style="{ color: textColor }"
                :title="getProductName(product, getProductIdentifier(product, idx))"
              >
                {{ getProductName(product, getProductIdentifier(product, idx)) }}
              </span>
              <span
                v-if="getProductQuantityInCart(getProductIdentifier(product, idx)) > 0"
                class="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs ml-1"
                :style="{ background: accentColor }"
              >
                x{{ getProductQuantityInCart(getProductIdentifier(product, idx)) }}
              </span>
            </div>
            <div
              v-if="displayColumns[1] && product[displayColumns[1]] && String(product[displayColumns[1]]).trim() !== ''"
              class="mt-1 flex items-center"
            >
              <span
                class="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate max-w-full tracking-wide"
                :style="{
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                  color: mutedTextColor,
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
                }"
              >
                {{ String(product[displayColumns[1]]).trim() }}
              </span>
            </div>
          </div>

          <div
            class="flex items-center justify-between gap-1.5 flex-wrap mt-2 pt-2 border-t w-full min-w-0"
            :style="{ borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }"
          >
            <span class="text-xs md:text-sm font-bold shrink-0 tabular-nums" :style="{ color: accentColor }">
              {{ formatMoney(getProductPrice(product)) }}
            </span>
            <span
              class="text-[11px] font-semibold shrink-0 whitespace-nowrap flex items-center gap-1 px-2 py-0.5 rounded-lg opacity-85 group-hover:opacity-100 transition-all"
              :style="{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)',
                color: textColor,
              }"
            >
              <Plus class="w-3 h-3" /> Add
            </span>
          </div>
        </button>

        <div
          v-if="products.length === 0"
          class="col-span-2 rounded-2xl p-8 text-center text-sm"
          :style="{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', color: mutedTextColor, border: `1px dashed ${borderColor}` }"
        >
          <p class="font-medium">{{ emptyLabel }}</p>
          <p
            v-if="!props.builderMode && element.productTable === 'products'"
            class="mt-2 text-xs"
          >
            Add products from the Catalog or Inventory terminal first.
          </p>
        </div>
      </div>
    </div>

    <!-- Right: Cart & Checkout Sidebar -->
    <div
      class="w-full md:w-[330px] shrink-0 flex flex-col rounded-[22px] overflow-hidden shadow-sm"
      :style="{ background: panelColor, border: `1px solid ${borderColor}` }"
    >
      <!-- Cart Header -->
      <div
        class="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider flex items-center justify-between shrink-0"
        :style="{ borderColor, color: mutedTextColor }"
      >
        <div class="flex items-center gap-2 min-w-0">
          <ShoppingCart class="w-4 h-4 shrink-0" :style="{ color: accentColor }" />
          <span class="font-bold tracking-normal text-sm truncate" :style="{ color: textColor }">Current Order</span>
          <span
            v-if="cart.length > 0"
            class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
            :style="{ background: accentColor }"
          >
            {{ totalCartQuantity }} {{ totalCartQuantity === 1 ? 'item' : 'items' }}
          </span>
        </div>

        <button
          v-if="cart.length > 0"
          type="button"
          class="text-[11px] font-medium flex items-center gap-1 transition-colors hover:text-rose-500 cursor-pointer shrink-0 ml-2"
          :style="{ color: mutedTextColor }"
          title="Clear all items from cart"
          @click="clearCart"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      <!-- Cart Line Items (Scrollable - Generous Height) -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]">
        <div
          v-for="item in cart"
          :key="item.id"
          class="flex items-center justify-between gap-2 rounded-xl p-2.5 transition-all shadow-xs"
          :style="{
            background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${borderColor}`,
          }"
        >
          <!-- Left: Name & Unit Price -->
          <div class="min-w-0 flex-1 pr-1.5">
            <p
              class="font-semibold text-xs md:text-sm leading-snug line-clamp-3 break-words"
              :style="{ color: textColor }"
              :title="item.name"
            >
              {{ item.name }}
            </p>
            <p class="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" :style="{ color: mutedTextColor }">
              <span>{{ formatMoney(item.price) }} each</span>
              <span
                v-if="getDiscountedUnitsForItem(item.id) > 0"
                class="px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-600 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30"
              >
                20% off ({{ getDiscountedUnitsForItem(item.id) }}x)
              </span>
            </p>
          </div>

          <!-- Center: Inline Stepper [- qty +] with touch-friendly tap targets -->
          <div
            class="flex items-center rounded-lg p-0.5 shrink-0"
            :style="{
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${borderColor}`,
            }"
          >
            <button
              type="button"
              class="w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-90 hover:bg-rose-500/10"
              :style="{
                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.12)',
                color: textColor,
              }"
              :title="item.qty <= 1 ? 'Remove item' : 'Decrease quantity'"
              :aria-label="`Decrease quantity of ${item.name}`"
              @click.stop="decreaseQuantity(item.id)"
            >
              <Trash2 v-if="item.qty <= 1" class="w-3.5 h-3.5 text-rose-500" />
              <Minus v-else class="w-3.5 h-3.5" />
            </button>

            <span
              class="w-7 text-center font-bold text-xs md:text-sm tabular-nums select-none"
              :style="{ color: textColor }"
            >
              {{ item.qty }}
            </span>

            <button
              type="button"
              class="w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-90 hover:bg-emerald-500/10"
              :style="{
                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.12)',
                color: textColor,
              }"
              :title="'Increase quantity'"
              :aria-label="`Increase quantity of ${item.name}`"
              @click.stop="increaseQuantity(item.id)"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Right: Line Subtotal & Remove -->
          <div class="flex items-center gap-1.5 text-right shrink-0">
            <span class="font-bold text-xs md:text-sm min-w-[48px] tabular-nums" :style="{ color: accentColor }">
              {{ formatMoney(item.price * item.qty) }}
            </span>
            <button
              type="button"
              class="w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer opacity-40 hover:opacity-100 hover:text-rose-500"
              :style="{ color: mutedTextColor }"
              title="Remove from cart"
              :aria-label="`Remove ${item.name}`"
              @click.stop="removeFromCart(item.id)"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          v-if="cart.length === 0"
          class="flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl border border-dashed"
          :style="{
            borderColor,
            background: isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.015)',
          }"
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
            :style="{
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
              color: mutedTextColor,
            }"
          >
            <ShoppingCart class="w-5 h-5" />
          </div>
          <p class="font-semibold text-xs" :style="{ color: textColor }">Cart is empty</p>
          <p class="text-[11px] mt-1" :style="{ color: mutedTextColor }">
            Tap food items on the left to add.
          </p>
        </div>
      </div>

      <!-- Order Controls: Table, Payment, Discounts (Streamlined & Compact) -->
      <div
        class="border-t px-3.5 py-2.5 space-y-2 overflow-y-auto max-h-[42%] shrink-0"
        :style="{ borderColor }"
      >
        <!-- Row: Table Number & Payment Method -->
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-0.5">
            <label class="text-[10px] font-bold uppercase tracking-wider" :style="{ color: mutedTextColor }">
              Table / Counter
            </label>
            <input
              v-model="tableNumber"
              type="text"
              placeholder="e.g. Table 4"
              class="w-full rounded-xl px-2.5 py-1.5 text-xs outline-none transition-all"
              :style="{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                color: textColor,
                border: `1px solid ${borderColor}`,
              }"
              :disabled="props.builderMode || submitting"
            />
          </div>

          <div class="space-y-0.5">
            <label class="text-[10px] font-bold uppercase tracking-wider" :style="{ color: mutedTextColor }">
              Payment
            </label>
            <div class="flex gap-1">
              <button
                v-for="method in paymentMethods"
                :key="method"
                type="button"
                class="flex-1 rounded-xl py-1.5 px-1 text-[11px] font-semibold transition-all cursor-pointer text-center active:scale-95 flex items-center justify-center gap-0.5 truncate"
                :style="selectedPaymentMethod === method
                  ? { background: accentColor, color: '#ffffff', border: `1px solid ${accentColor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', color: textColor, border: `1px solid ${borderColor}` }"
                @click="selectedPaymentMethod = method"
              >
                <CreditCard v-if="isCardStyleMethod(method)" class="w-3 h-3 shrink-0" />
                <span class="truncate">{{ formatPaymentLabel(method) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- External vs Integrated Card Payment options -->
        <div
          v-if="isCardPaymentSelected"
          class="rounded-xl p-2 space-y-1.5"
          :style="{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }"
        >
          <div class="grid grid-cols-2 gap-1 text-[11px]">
            <button
              type="button"
              class="py-1 px-2 rounded-lg font-medium transition-all text-center cursor-pointer active:scale-95"
              :style="cardProcessingMode === 'external'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)', color: textColor }"
              @click="cardProcessingMode = 'external'"
            >
              External Machine
            </button>
            <button
              type="button"
              class="py-1 px-2 rounded-lg font-medium transition-all text-center cursor-pointer active:scale-95"
              :style="cardProcessingMode === 'integrated'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)', color: textColor }"
              @click="cardProcessingMode = 'integrated'"
            >
              Reader Bridge
            </button>
          </div>

          <!-- Standalone external card reader (no web reader needed) -->
          <div v-if="cardProcessingMode === 'external'" class="pt-0.5">
            <input
              v-model="externalCardAuth"
              type="text"
              placeholder="Auth / Slip Ref # (Optional)"
              class="w-full rounded-lg px-2.5 py-1 text-[11px] outline-none"
              :style="{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                color: textColor,
                border: `1px solid ${borderColor}`,
              }"
            />
          </div>

          <!-- Integrated reader bridge -->
          <div v-else class="space-y-1.5 pt-0.5">
            <div class="rounded-lg px-2 py-0.5 flex items-center justify-between text-[10px]" :style="{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}` }">
              <span :style="{ color: mutedTextColor }">Status</span>
              <span class="font-semibold" :style="{ color: cardApprovalState === 'approved' ? accentColor : textColor }">{{ readerStatusLabel }}</span>
            </div>
            <div class="flex gap-1.5">
              <button
                type="button"
                class="flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white transition-all cursor-pointer disabled:opacity-40 active:scale-95"
                :style="{ background: accentColor }"
                :disabled="props.builderMode || submitting || cart.length === 0"
                @click="handleReaderAction"
              >
                {{ submitting ? 'Processing...' : readerActionLabel }}
              </button>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                :style="{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', color: textColor }"
                title="Mark as paid on external terminal without web reader"
                @click="proceedWithoutReader"
              >
                Skip
              </button>
            </div>
          </div>
        </div>

        <!-- Discounts Section (PWD, Senior Citizen, Custom %, Fixed) -->
        <div
          class="rounded-xl p-2 space-y-1.5"
          :style="{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }"
        >
          <div class="flex items-center justify-between text-[11px] font-semibold">
            <span class="flex items-center gap-1.5">
              <Tag class="w-3.5 h-3.5" :style="{ color: accentColor }" />
              Discounts
            </span>
            <span v-if="discountAmount > 0" class="text-[10px] font-bold" :style="{ color: accentColor }">
              -{{ formatMoney(discountAmount) }}
            </span>
          </div>

          <!-- Discount Pills -->
          <div class="grid grid-cols-5 gap-1 text-[10px] font-semibold">
            <button
              type="button"
              class="py-1 rounded-lg transition-all text-center cursor-pointer active:scale-95"
              :style="discountType === 'none'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', color: textColor }"
              @click="discountType = 'none'"
            >
              None
            </button>
            <button
              type="button"
              class="py-1 rounded-lg transition-all text-center cursor-pointer active:scale-95"
              :style="discountType === 'pwd'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', color: textColor }"
              @click="discountType = 'pwd'"
            >
              PWD 20%
            </button>
            <button
              type="button"
              class="py-1 rounded-lg transition-all text-center cursor-pointer active:scale-95"
              :style="discountType === 'senior'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', color: textColor }"
              @click="discountType = 'senior'"
            >
              Senior
            </button>
            <button
              type="button"
              class="py-1 rounded-lg transition-all text-center cursor-pointer active:scale-95"
              :style="discountType === 'percent'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', color: textColor }"
              @click="discountType = 'percent'"
            >
              % Custom
            </button>
            <button
              type="button"
              class="py-1 rounded-lg transition-all text-center cursor-pointer active:scale-95"
              :style="discountType === 'fixed'
                ? { background: accentColor, color: '#ffffff' }
                : { background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', color: textColor }"
              @click="discountType = 'fixed'"
            >
              $ Fixed
            </button>
          </div>

          <!-- Contextual Discount Inputs -->
          <div v-if="discountType === 'pwd' || discountType === 'senior'" class="pt-0.5 space-y-1.5">
            <!-- Beneficiary count stepper (1 PWD / Senior or multiple per table) -->
            <div class="flex items-center justify-between text-[11px] rounded-lg px-2 py-1" :style="{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }">
              <span class="font-medium" :style="{ color: textColor }">
                {{ discountType === 'pwd' ? 'No. of PWDs:' : 'No. of Seniors:' }}
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition-all active:scale-90 cursor-pointer disabled:opacity-30"
                  :style="{ background: isLight ? '#ffffff' : 'rgba(255,255,255,0.1)', color: textColor, border: `1px solid ${borderColor}` }"
                  :disabled="pwdCount <= 1"
                  @click="pwdCount = Math.max(1, pwdCount - 1)"
                >
                  -
                </button>
                <span class="w-6 text-center font-bold text-xs tabular-nums" :style="{ color: accentColor }">
                  {{ pwdCount }}
                </span>
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition-all active:scale-90 cursor-pointer disabled:opacity-30"
                  :style="{ background: isLight ? '#ffffff' : 'rgba(255,255,255,0.1)', color: textColor, border: `1px solid ${borderColor}` }"
                  :disabled="pwdCount >= Math.max(1, totalCartQuantity)"
                  @click="pwdCount++"
                >
                  +
                </button>
              </div>
            </div>

            <p class="text-[10px] leading-snug px-0.5" :style="{ color: mutedTextColor }">
              {{ pwdCount === 1
                ? '1 discount applies 20% to the single highest-value item.'
                : `Applies 20% to the top ${Math.min(pwdCount, totalCartQuantity)} highest-value items in cart.` }}
            </p>

            <input
              v-model="discountRefNumber"
              type="text"
              :placeholder="discountType === 'pwd' ? 'PWD ID / Booklet Number (Optional)' : 'Senior (OSCA) ID Number (Optional)'"
              class="w-full rounded-lg px-2.5 py-1 text-[11px] outline-none"
              :style="{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                color: textColor,
                border: `1px solid ${borderColor}`,
              }"
            />
          </div>

          <div v-else-if="discountType === 'percent'" class="grid grid-cols-2 gap-1.5 pt-0.5">
            <div>
              <div class="flex items-center rounded-lg px-2 py-1 text-[11px]" :style="{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}` }">
                <input
                  v-model.number="customDiscountPercent"
                  type="number"
                  min="1"
                  max="100"
                  class="w-full bg-transparent outline-none text-xs font-semibold"
                  :style="{ color: textColor }"
                />
                <span :style="{ color: mutedTextColor }">%</span>
              </div>
            </div>
            <input
              v-model="discountRefNumber"
              type="text"
              placeholder="Reason (Optional)"
              class="w-full rounded-lg px-2.5 py-1 text-[11px] outline-none"
              :style="{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                color: textColor,
                border: `1px solid ${borderColor}`,
              }"
            />
          </div>

          <div v-else-if="discountType === 'fixed'" class="grid grid-cols-2 gap-1.5 pt-0.5">
            <div>
              <div class="flex items-center rounded-lg px-2 py-1 text-[11px]" :style="{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}` }">
                <span :style="{ color: mutedTextColor }" class="mr-1">$</span>
                <input
                  v-model.number="customDiscountFixed"
                  type="number"
                  min="0"
                  step="0.5"
                  class="w-full bg-transparent outline-none text-xs font-semibold"
                  :style="{ color: textColor }"
                />
              </div>
            </div>
            <input
              v-model="discountRefNumber"
              type="text"
              placeholder="Reason (Optional)"
              class="w-full rounded-lg px-2.5 py-1 text-[11px] outline-none"
              :style="{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                color: textColor,
                border: `1px solid ${borderColor}`,
              }"
            />
          </div>
        </div>
      </div>

      <!-- Cart Totals & Checkout Button -->
      <div
        class="p-3.5 border-t space-y-2.5 shrink-0"
        :style="{ borderColor, background: isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.02)' }"
      >
        <div class="space-y-1 text-xs">
          <div class="flex justify-between" :style="{ color: mutedTextColor }">
            <span>Subtotal</span>
            <span class="font-medium tabular-nums">{{ formatMoney(subtotal) }}</span>
          </div>
          <div v-if="discountAmount > 0" class="flex justify-between font-semibold" :style="{ color: accentColor }">
            <span>Discount ({{ discountLabel }})</span>
            <span class="tabular-nums">-{{ formatMoney(discountAmount) }}</span>
          </div>
          <div class="flex justify-between items-baseline text-sm font-bold pt-1 border-t" :style="{ borderColor }">
            <span>Total Due</span>
            <span class="text-base md:text-lg tabular-nums font-black" :style="{ color: accentColor }">{{ formatMoney(total) }}</span>
          </div>
        </div>

        <button
          type="button"
          class="w-full text-sm font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-40 cursor-pointer text-white shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
          :style="{ background: accentColor }"
          :disabled="!canSubmit"
          @click="submitOrder"
        >
          <CreditCard v-if="isCardPaymentSelected" class="w-4 h-4" />
          <CheckCircle2 v-else class="w-4 h-4" />
          <span>{{ submitting ? 'Submitting Order...' : submitLabel }}</span>
          <span v-if="cart.length > 0 && !submitting" class="ml-1 opacity-90 text-xs font-semibold">
            &middot; {{ formatMoney(total) }}
          </span>
        </button>

        <p v-if="requiresCardApproval && cardApprovalState !== 'approved' && cart.length > 0" class="text-[10px] leading-tight text-center" :style="{ color: mutedTextColor }">
          Click Confirm Card Payment or Confirm Reader Charge to complete the sale.
        </p>
      </div>
    </div>

    <!-- Receipt Preview & Print Modal -->
    <div
      v-if="lastReceipt"
      class="absolute inset-3 rounded-[24px] flex items-center justify-center px-4 z-50"
      :style="{ background: 'rgba(8,5,8,0.65)', backdropFilter: 'blur(4px)' }"
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

        <div class="mt-4 space-y-2 max-h-40 overflow-auto">
          <div
            v-for="item in lastReceipt.items"
            :key="`${item.id}-${item.qty}`"
            class="flex items-center justify-between gap-3 text-xs"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium line-clamp-3 break-words leading-tight" :title="item.name">{{ item.name }}</p>
              <p class="text-[10px]" style="color: rgba(47,24,34,0.55);">{{ item.qty }} x {{ formatMoney(item.price) }}</p>
            </div>
            <span class="font-semibold shrink-0 tabular-nums">{{ formatMoney(item.subtotal) }}</span>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t text-xs space-y-1" style="border-color: rgba(47,24,34,0.12);">
          <div class="flex justify-between" style="color: rgba(47,24,34,0.65);">
            <span>Subtotal</span>
            <span>{{ formatMoney(lastReceipt.subtotal) }}</span>
          </div>
          <div v-if="lastReceipt.discountAmount > 0" class="flex justify-between font-semibold" style="color: #c2410c;">
            <span>Discount ({{ lastReceipt.discountLabel }}{{ lastReceipt.discountReference ? ` - ${lastReceipt.discountReference}` : '' }})</span>
            <span>-{{ formatMoney(lastReceipt.discountAmount) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm font-bold pt-1 border-t" style="border-color: rgba(47,24,34,0.12);">
            <span>Total</span>
            <span>{{ formatMoney(lastReceipt.total) }}</span>
          </div>
        </div>

        <div class="mt-2 text-[10px] leading-relaxed" style="color: rgba(47,24,34,0.6);">
          {{ lastReceipt.footer }}
        </div>

        <div class="mt-4 flex gap-2">
          <button
            class="flex-1 rounded-xl px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            :style="{ background: accentColor }"
            @click="printReceipt"
          >
            <span class="inline-flex items-center justify-center gap-1.5">
              <Printer class="w-3.5 h-3.5" /> Print Receipt
            </span>
          </button>
          <button
            class="flex-1 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            style="background: rgba(47,24,34,0.06); color: #2f1822;"
            @click="dismissReceipt"
          >
            <span class="inline-flex items-center justify-center gap-1.5">
              <CheckCircle2 class="w-3.5 h-3.5" /> Done
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
