<script setup lang="ts">
/**
 * CartWidgetEl — a simple cart/order widget.
 * Loads products from the configured table, lets users add to cart,
 * and submits order records. Fully self-contained.
 */

import type { CartWidgetElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: CartWidgetElementDef; businessId: string }>();

interface CartItem { id: string; name: string; price: number; qty: number }

const products   = ref<Record<string, unknown>[]>([]);
const cart       = ref<CartItem[]>([]);
const submitting = ref(false);

const { authHeaders } = useAuth();

const total = computed(() =>
  cart.value.reduce((sum, item) => sum + item.price * item.qty, 0)
);

async function loadProducts() {
  const res = await $fetch<{ data: Record<string, unknown>[] }>('/api/data/query', {
    method:  'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body:    {
      businessId: props.businessId,
      tableName:  props.element.productTable,
      columns:    props.element.displayColumns,
      limit:      100,
      offset:     0,
    },
  });
  products.value = res.data ?? [];
}

function addToCart(product: Record<string, unknown>) {
  const id   = String(product.id ?? product.name);
  const name = String(product[props.element.displayColumns[0]] ?? id);
  const price = Number(product.price ?? product.unit_price ?? 0);

  const existing = cart.value.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.value.push({ id, name, price, qty: 1 });
  }
}

function removeFromCart(id: string) {
  cart.value = cart.value.filter(i => i.id !== id);
}

async function submitOrder() {
  if (!cart.value.length) return;
  submitting.value = true;

  try {
    await $fetch('/api/data/insert', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    {
        businessId: props.businessId,
        tableName:  props.element.orderTable,
        values:     {
          items:      JSON.stringify(cart.value),
          total:      total.value,
          created_at: new Date().toISOString(),
        },
      },
    });
    cart.value = [];
  } catch (err) {
    console.error('Order submit failed:', err);
  } finally {
    submitting.value = false;
  }
}

onMounted(loadProducts);
</script>

<template>
  <div class="w-full h-full flex gap-2 overflow-hidden">
    <!-- Product grid -->
    <div class="flex-1 overflow-auto grid grid-cols-2 gap-2 content-start p-2">
      <button
        v-for="product in products"
        :key="String(product.id)"
        class="surface rounded-lg p-3 text-left hover:bg-white/10 transition-colors"
        @click="addToCart(product)"
      >
        <div class="text-sm font-medium text-white truncate">
          {{ product[element.displayColumns[0]] }}
        </div>
        <div class="text-xs text-white/50 mt-0.5">
          {{ product.price != null ? `$${product.price}` : '' }}
        </div>
      </button>
    </div>

    <!-- Cart panel -->
    <div class="w-48 flex flex-col surface border-l border-white/10">
      <div class="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/60 uppercase tracking-wide">
        Cart
      </div>

      <div class="flex-1 overflow-auto p-2 space-y-1">
        <div
          v-for="item in cart"
          :key="item.id"
          class="flex items-center justify-between text-xs text-white/80"
        >
          <span class="truncate flex-1">{{ item.name }} ×{{ item.qty }}</span>
          <button class="text-white/30 hover:text-red-400 ml-2" @click="removeFromCart(item.id)">✕</button>
        </div>
        <div v-if="cart.length === 0" class="text-center text-white/30 py-4">Empty</div>
      </div>

      <div class="p-2 border-t border-white/10 space-y-2">
        <div class="flex justify-between text-sm font-semibold text-white">
          <span>Total</span>
          <span>${{ total.toFixed(2) }}</span>
        </div>
        <button
          class="w-full bg-brand-primary hover:brightness-110 text-white text-sm font-medium py-1.5 rounded-lg transition-all disabled:opacity-40"
          :disabled="!cart.length || submitting"
          @click="submitOrder"
        >
          {{ submitting ? 'Submitting…' : 'Submit Order' }}
        </button>
      </div>
    </div>
  </div>
</template>
