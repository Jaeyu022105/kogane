<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { CartWidgetElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: CartWidgetElementDef; businessId: string; runtime?: any; builderMode?: boolean }>();

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
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
const submitting = ref(false);
const tableNumber = ref('');

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
const textColor = computed(() => props.element.textColor ?? '#f5ede4');
const mutedTextColor = computed(() => 'rgba(245,237,228,0.68)');
const surfaceColor = computed(() => props.element.backgroundColor ?? '#161116');
const panelColor = computed(() => props.element.panelColor ?? 'rgba(255,255,255,0.04)');
const accentColor = computed(() => props.element.accentColor ?? '#e8748a');
const borderColor = computed(() => props.element.borderColor ?? 'rgba(255,255,255,0.08)');
const radius = computed(() => `${props.element.radius ?? 24}px`);
const canSubmit = computed(() =>
  !props.builderMode
  && !submitting.value
  && cart.value.length > 0
  && tableNumber.value.trim().length > 0,
);

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

async function submitOrder() {
  if (!canSubmit.value) return;
  submitting.value = true;

  try {
    const itemsSummary = cart.value
      .map((item) => `${item.name} x${item.qty}`)
      .join(', ');
    const normalizedTableNumber = tableNumber.value.trim();

    await props.runtime?.dispatch?.({
      type: 'insert',
      table: props.element.orderTable,
      payload: {
        items: itemsSummary,
        total: total.value,
        status: 'pending',
        table_number: normalizedTableNumber,
      },
    }, {
      element: props.element,
      trigger: 'click',
    });

    props.runtime?.emitLocal?.('cart:clear');
    tableNumber.value = '';
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
    class="w-full h-full flex gap-3 overflow-hidden p-3"
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
          {{ product[element.priceColumn ?? 'price'] != null ? `$${product[element.priceColumn ?? 'price']}` : '' }}
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

    <div class="w-52 shrink-0 flex flex-col rounded-[20px] overflow-hidden" :style="{ background: panelColor, border: `1px solid ${borderColor}` }">
      <div class="px-3 py-3 border-b text-xs font-semibold uppercase tracking-wide" :style="{ borderColor, color: mutedTextColor }">
        Cart
      </div>

      <div class="px-3 pt-3 space-y-1.5">
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

      <div class="flex-1 overflow-auto p-2 space-y-1">
        <div
          v-for="item in cart"
          :key="item.id"
          class="flex items-center justify-between gap-2 text-xs rounded-xl px-2 py-1.5"
          :style="{ background: 'rgba(255,255,255,0.03)' }"
        >
          <span class="truncate flex-1">{{ item.name }} x{{ item.qty }}</span>
          <button class="ml-2 flex items-center justify-center transition-colors" :style="{ color: mutedTextColor }" @click="removeFromCart(item.id)">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div v-if="cart.length === 0" class="text-center py-6 text-sm" :style="{ color: mutedTextColor }">Empty</div>
      </div>

      <div class="p-3 border-t space-y-3" :style="{ borderColor }">
        <div class="flex justify-between text-sm font-semibold">
          <span>Total</span>
          <span>${{ total.toFixed(2) }}</span>
        </div>
        <button
          class="w-full text-sm font-medium py-2 rounded-xl transition-all disabled:opacity-40"
          :style="{ background: accentColor, color: '#ffffff' }"
          :disabled="!canSubmit"
          @click="submitOrder"
        >
          {{ submitting ? 'Submitting...' : submitLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
