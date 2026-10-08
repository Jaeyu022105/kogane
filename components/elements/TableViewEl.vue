<script setup lang="ts">
import { AlertTriangle, Bell, BellOff, CheckCircle2, Clock, Eye, Pencil, Receipt, RefreshCw, Trash2, UtensilsCrossed, X } from 'lucide-vue-next';
import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import { isActionAllowed } from '~/lib/permissions';
import type { TableViewElementDef } from '~/lib/uiTypes';
import { isLightColor } from '~/lib/workspaceBranding';
import { findCountry, formatCurrencyAmount } from '~/lib/currency';
import { useBusiness } from '~/composables/useBusiness';

import { parseInspectionItems, type ParsedInspectionItem } from '~/lib/kitchenDisplay';

const props = defineProps<{
  element: TableViewElementDef;
  businessId: string;
  runtime?: any;
  builderMode?: boolean;
}>();

const injectedRuntime = inject<any>(CANVAS_RUNTIME_KEY, null);
const effectiveRuntime = computed(() => props.runtime ?? injectedRuntime);

const loading = ref(false);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const displayColumns = computed(() =>
  props.element.columns.length > 0
    ? props.element.columns
    : ['name', 'status', 'amount'],
);

const columnLabels: Record<string, string> = {
  id: 'Reference',
  table_number: 'Table number',
  total: 'Total',
  status: 'Status',
  created_at: 'Created',
  updated_at: 'Updated',
  items: 'Items',
  item_name: 'Item',
  quantity: 'Quantity',
  unit: 'Unit',
  reorder_at: 'Reorder level',
  name: 'Name',
  category: 'Category',
  price: 'Price',
  customer_name: 'Customer',
  phone: 'Phone',
  email: 'Email',
  description: 'Details',
  notes: 'Notes',
};

function columnLabel(column: string) {
  if (columnLabels[column]) return columnLabels[column];

  return column
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const rows = computed<Record<string, unknown>[]>(() => {
  if (props.builderMode) {
    return [
      Object.fromEntries(displayColumns.value.map((column, index) => [column, ['Sample', 'Ready', 42][index] ?? `Value ${index + 1}`])),
      Object.fromEntries(displayColumns.value.map((column, index) => [column, ['Another', 'Pending', 18][index] ?? `Value ${index + 2}`])),
    ];
  }

  return effectiveRuntime.value?.state?.value?.queryResults?.[props.element.id] ?? [];
});

const sourceLabel = computed(() =>
  props.element.source === 'audit-log'
    ? 'audit log'
    : props.element.tableName || 'table',
);

const surfaceColor = computed(() => props.element.backgroundColor ?? '#161116');
const isLight = computed(() => isLightColor(surfaceColor.value));
const textColor = computed(() => props.element.textColor ?? (isLight.value ? '#261a14' : '#f5ede4'));
const mutedTextColor = computed(() => isLight.value ? 'rgba(38, 26, 20, 0.65)' : 'rgba(245,237,228,0.65)');
const headerColor = computed(() => props.element.headerBackgroundColor ?? (isLight.value ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'));
const borderColor = computed(() => isLight.value ? 'rgba(81, 49, 31, 0.14)' : 'rgba(255,255,255,0.08)');
const rowBorderColor = computed(() => isLight.value ? 'rgba(81, 49, 31, 0.08)' : 'rgba(255,255,255,0.06)');
const stripedBg = computed(() => isLight.value ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)');

async function fetchRows() {
  if (props.builderMode || !effectiveRuntime.value) return;
  loading.value = true;

  try {
    if (effectiveRuntime.value.reloadElement) {
      await effectiveRuntime.value.reloadElement(props.element);
    } else {
      await effectiveRuntime.value.loadElement(props.element);
    }
  } finally {
    loading.value = false;
  }
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();

  if (props.builderMode) return;

  const intervalMs = Number(props.element.autoRefreshMs ?? 0);
  if (!intervalMs || intervalMs < 1000) return;

  refreshTimer = setInterval(() => {
    fetchRows();
  }, intervalMs);
}

let unsubscribeRealtime: (() => void) | null = null;

function statusBadgeClasses(status: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'fulfilled' || s === 'completed' || s === 'served') {
    return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
  }
  if (s === 'preparing' || s === 'in_progress') {
    return 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30';
  }
  return 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30';
}

const { business } = useBusiness();
const countryCode = computed(() =>
  String(
    business.value?.country
    || effectiveRuntime.value?.state?.value?.sessionVars?.country
    || effectiveRuntime.value?.context?.value?.sessionVars?.country
    || 'US'
  )
);
const matchedCountry = computed(() => findCountry(countryCode.value));
const currencyCode = computed(() =>
  String(
    business.value?.currency
    || effectiveRuntime.value?.state?.value?.sessionVars?.currency
    || effectiveRuntime.value?.context?.value?.sessionVars?.currency
    || matchedCountry.value.currency
    || 'USD'
  )
);
const currencySymbol = computed(() =>
  String(
    business.value?.currencySymbol
    || effectiveRuntime.value?.state?.value?.sessionVars?.currencySymbol
    || effectiveRuntime.value?.context?.value?.sessionVars?.currencySymbol
    || matchedCountry.value.symbol
    || '$'
  )
);

function formatPrice(val: unknown) {
  if (val == null || val === '') return '-';
  return formatCurrencyAmount(val, {
    symbol: currencySymbol.value,
    currency: currencyCode.value,
    country: countryCode.value,
    decimals: matchedCountry.value.decimals,
  });
}

function isPriceColumn(column: string): boolean {
  const col = String(column || '').toLowerCase();
  return col === 'price'
    || col === 'unit_price'
    || col === 'total'
    || col === 'subtotal'
    || col === 'amount'
    || col === 'cost'
    || col === 'gross_amount'
    || col === 'tax_amount'
    || col === 'taxable_amount'
    || col === 'total_amount'
    || col === 'grand_total'
    || col === 'discount_amount'
    || col === 'balance'
    || col === 'net_amount'
    || col === 'gross_total'
    || col === 'unit_cost'
    || col === 'average_price'
    || col === 'revenue';
}

function isAvailable(val: unknown) {
  if (val == null) return true;
  return val === 1 || val === true || val === '1' || val === 'true';
}

const effectiveRole = computed(() =>
  (effectiveRuntime.value?.state?.value?.sessionVars?.terminalRole as string)
  || (effectiveRuntime.value?.state?.value?.sessionVars?.role as string)
  || (effectiveRuntime.value?.context?.value?.sessionVars?.terminalRole as string)
  || (effectiveRuntime.value?.context?.value?.sessionVars?.role as string)
  || undefined,
);

const canUpdateTable = computed(() => {
  if (props.builderMode) return true;
  if (!props.element.tableName) return false;
  if (!effectiveRuntime.value?.state?.value?.permissions) return true;
  return isActionAllowed(effectiveRuntime.value.state.value.permissions, {
    type: 'update',
    table: props.element.tableName,
  }, effectiveRole.value);
});

const canDeleteTable = computed(() => {
  if (props.builderMode) return true;
  if (!props.element.tableName) return false;
  if (!effectiveRuntime.value?.state?.value?.permissions) return true;
  return isActionAllowed(effectiveRuntime.value.state.value.permissions, {
    type: 'delete',
    table: props.element.tableName,
  }, effectiveRole.value);
});

const isProductsTable = computed(() => props.element.tableName === 'products' || Boolean(props.element.tableName?.endsWith('_products')));
const isOrdersTable = computed(() => props.element.tableName === 'orders' || Boolean(props.element.tableName?.endsWith('_orders')));

const hasRowActions = computed(() => {
  if (isOrdersTable.value) {
    return true;
  }
  if (props.builderMode) {
    return isProductsTable.value;
  }
  if (isProductsTable.value) {
    return canUpdateTable.value || canDeleteTable.value;
  }
  return false;
});

function isOrderServed(row: Record<string, unknown>) {
  const s = String(row.status || '').toLowerCase();
  return s === 'fulfilled' || s === 'served' || s === 'completed';
}

function displayStatus(status: unknown) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'fulfilled') return 'SERVED';
  return s.toUpperCase();
}

const servingOrderId = ref<string | null>(null);

async function markOrderServed(row: Record<string, unknown>, e: Event) {
  e.stopPropagation();
  const rowId = row.id ?? (row as any)._id ?? (row as any).reference;
  if (props.builderMode || !effectiveRuntime.value || !rowId || servingOrderId.value === String(rowId)) return;

  const previousStatus = row.status;
  servingOrderId.value = String(rowId);
  // Optimistically mark as served immediately for instant UI responsiveness
  row.status = 'fulfilled';

  try {
    await effectiveRuntime.value.dispatch({
      type: 'update',
      table: props.element.tableName || 'orders',
      rowId,
      payload: { status: 'fulfilled' },
    }, {
      element: props.element,
      trigger: 'click',
    });
    await fetchRows();
  } catch (err) {
    row.status = previousStatus;
    console.error('Failed to mark order as served:', err);
  } finally {
    servingOrderId.value = null;
  }
}

async function cycleOrderStatus(row: Record<string, unknown>, e: Event) {
  e.stopPropagation();
  const rowId = row.id ?? (row as any)._id ?? (row as any).reference;
  if (props.builderMode || !effectiveRuntime.value || !isOrdersTable.value || !rowId || !canUpdateTable.value) return;
  const current = String(row.status || 'pending').toLowerCase();
  const nextStatus = current === 'pending' ? 'preparing' : current === 'preparing' ? 'fulfilled' : 'pending';

  const previousStatus = row.status;
  row.status = nextStatus;

  try {
    await effectiveRuntime.value.dispatch({
      type: 'update',
      table: props.element.tableName || 'orders',
      rowId,
      payload: { status: nextStatus },
    }, {
      element: props.element,
      trigger: 'click',
    });
    await fetchRows();
  } catch (err) {
    row.status = previousStatus;
    console.error('Failed to bump order status:', err);
  }
}

// Order Inspection Modal
const inspectedOrder = ref<Record<string, unknown> | null>(null);

function openOrderModal(row: Record<string, unknown>, e?: Event) {
  e?.stopPropagation();
  inspectedOrder.value = row;
}

function closeOrderModal() {
  inspectedOrder.value = null;
}

// Kitchen Audio Chime & Arrival Notifications
let audioContext: AudioContext | null = null;
const soundEnabled = ref(true);
const newOrderAlert = ref(false);
let alertTimeout: ReturnType<typeof setTimeout> | null = null;
const knownOrderIds = ref<Set<string>>(new Set());
const chimedOrderIds = ref<Set<string>>(new Set());
const initialOrderLoadDone = ref(false);
let lastChimeTimestamp = 0;

function initAudioContext() {
  if (!import.meta.client) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && !audioContext) {
      audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  } catch (err) {
    console.warn('AudioContext init error:', err);
  }
}

function playKitchenChimeNodes() {
  if (!audioContext) return;
  const ctx = audioContext;
  const now = ctx.currentTime;

  // High clear bell note (880 Hz [A5])
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

  gain1.gain.setValueAtTime(0.35, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.85);

  // Warm resonant second tone (1174.66 Hz [D6])
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1174.66, now + 0.1);

  gain2.gain.setValueAtTime(0.3, now + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.1);
  osc2.stop(now + 1.2);
}

function playKitchenChime() {
  if (!import.meta.client || !soundEnabled.value) return;
  try {
    initAudioContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => playKitchenChimeNodes()).catch(() => {});
      return;
    }
    playKitchenChimeNodes();
  } catch (err) {
    console.warn('Kitchen chime playback error:', err);
  }
}

function toggleKitchenSound() {
  soundEnabled.value = !soundEnabled.value;
  if (import.meta.client) {
    localStorage.setItem('kogane_kitchen_sound', soundEnabled.value ? 'true' : 'false');
  }
  if (soundEnabled.value) {
    initAudioContext();
    if (audioContext?.state === 'suspended') {
      audioContext.resume().then(() => playKitchenChime());
    } else {
      playKitchenChime();
    }
  }
}

function triggerNewOrderArrival(orderId?: string) {
  if (!isOrdersTable.value) return;
  if (orderId) {
    if (chimedOrderIds.value.has(orderId)) return;
    chimedOrderIds.value.add(orderId);
  }
  const now = Date.now();
  if (now - lastChimeTimestamp > 1500) {
    lastChimeTimestamp = now;
    playKitchenChime();
  }
  newOrderAlert.value = true;
  if (alertTimeout) clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => {
    newOrderAlert.value = false;
  }, 4000);
}

// Product Editing
interface ProductEditForm {
  id: string;
  name: string;
  price: number | string;
  category: string;
  description: string;
  available: boolean;
}

const editingProduct = ref<ProductEditForm | null>(null);
const savingEdit = ref(false);
const editError = ref<string | null>(null);

function openEditModal(row: Record<string, unknown>, e: Event) {
  e.stopPropagation();
  if (props.builderMode) return;
  editError.value = null;

  let initialPrice: number | string = '';
  if (row.price != null && row.price !== '') {
    const raw = String(row.price).replace(/^[$\s]+/, '').replace(/,/g, '').trim();
    const num = Number(raw);
    initialPrice = !Number.isNaN(num) ? num : '';
  }

  const rowId = row.id ?? (row as any)._id ?? (row as any).reference;
  editingProduct.value = {
    id: String(rowId ?? ''),
    name: String(row.name ?? ''),
    price: initialPrice,
    category: String(row.category ?? ''),
    description: String(row.description ?? ''),
    available: isAvailable(row.available),
  };
}

function closeEditModal() {
  editingProduct.value = null;
  editError.value = null;
}

async function saveProductEdit() {
  if (!editingProduct.value || !effectiveRuntime.value) return;

  const name = editingProduct.value.name.trim();
  if (!name) {
    editError.value = 'Product name is required.';
    return;
  }

  const rawPrice = String(editingProduct.value.price).trim().replace(/^[$\s]+/, '').replace(/,/g, '');
  const numPrice = Number(rawPrice);
  if (!rawPrice || Number.isNaN(numPrice) || numPrice < 0) {
    editError.value = 'Please enter a valid price.';
    return;
  }

  savingEdit.value = true;
  editError.value = null;

  try {
    const result = await effectiveRuntime.value.dispatch({
      type: 'update',
      table: props.element.tableName || 'products',
      rowId: editingProduct.value.id,
      payload: {
        name,
        price: numPrice,
        category: editingProduct.value.category.trim(),
        description: editingProduct.value.description.trim(),
        available: editingProduct.value.available ? 1 : 0,
      },
    }, {
      element: props.element,
      trigger: 'click',
    });

    if (result === null) {
      editError.value = 'Failed to update product. Please check permissions and try again.';
      return;
    }

    closeEditModal();
    await fetchRows();
  } catch (err: any) {
    editError.value = err?.message || 'Failed to update product.';
  } finally {
    savingEdit.value = false;
  }
}

// Product Deletion
const deletingProduct = ref<Record<string, unknown> | null>(null);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

function openDeleteModal(row: Record<string, unknown>, e: Event) {
  e.stopPropagation();
  if (props.builderMode) return;
  deleteError.value = null;
  deletingProduct.value = row;
}

function closeDeleteModal() {
  deletingProduct.value = null;
  deleteError.value = null;
}

async function confirmDeleteProduct() {
  const delId = deletingProduct.value?.id ?? (deletingProduct.value as any)?._id ?? (deletingProduct.value as any)?.reference;
  if (!delId || !effectiveRuntime.value) return;
  deleting.value = true;
  deleteError.value = null;

  try {
    const result = await effectiveRuntime.value.dispatch({
      type: 'delete',
      table: props.element.tableName || 'products',
      rowId: delId,
    }, {
      element: props.element,
      trigger: 'click',
    });

    if (result === null) {
      deleteError.value = 'Failed to delete product. Please check permissions and try again.';
      return;
    }

    closeDeleteModal();
    await fetchRows();
  } catch (err: any) {
    deleteError.value = err?.message || 'Failed to delete product.';
  } finally {
    deleting.value = false;
  }
}

watch(
  () => [
    props.element.source,
    props.element.tableName,
    props.element.columns.join(','),
    JSON.stringify(props.element.filters ?? {}),
    props.element.pageSize,
  ],
  fetchRows,
  { deep: true },
);

watch(
  () => props.element.autoRefreshMs,
  () => startAutoRefresh(),
);

watch(
  rows,
  (newRows) => {
    if (!isOrdersTable.value || props.builderMode) return;

    const currentIds = new Set<string>();
    let hasNewIncomingOrder = false;

    let newIncomingOrderId: string | undefined;

    for (const row of newRows) {
      const rowId = String(row.id ?? (row as any)._id ?? (row as any).reference ?? '');
      if (!rowId) continue;
      currentIds.add(rowId);

      if (initialOrderLoadDone.value && !knownOrderIds.value.has(rowId)) {
        const s = String(row.status || '').toLowerCase();
        if (s !== 'fulfilled' && s !== 'served' && s !== 'completed') {
          hasNewIncomingOrder = true;
          newIncomingOrderId = rowId;
        }
      }
    }

    if (!initialOrderLoadDone.value) {
      initialOrderLoadDone.value = true;
    } else if (hasNewIncomingOrder) {
      triggerNewOrderArrival(newIncomingOrderId);
    }

    knownOrderIds.value = currentIds;
  },
  { deep: true },
);

onMounted(() => {
  if (import.meta.client) {
    const savedSound = localStorage.getItem('kogane_kitchen_sound');
    if (savedSound !== null) {
      soundEnabled.value = savedSound === 'true';
    }
    const unlockEvents = ['pointerdown', 'touchstart', 'touchend', 'click'];
    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, initAudioContext, { once: true });
    });
  }

  fetchRows();
  startAutoRefresh();

  if (effectiveRuntime.value?.on) {
    unsubscribeRealtime = effectiveRuntime.value.on('realtime:table-update', (payload: any) => {
      if (!payload?.table) return;
      const isMatch = payload.table === props.element.tableName
        || props.element.tableName?.endsWith(`_${payload.table}`)
        || payload.table?.endsWith(`_${props.element.tableName}`);

      if (
        isMatch ||
        (props.element.source === 'audit-log' && (payload.table === 'audit_log' || payload.table === 'audit-log'))
      ) {
        if (isOrdersTable.value && payload.action === 'insert') {
          const insertId = String(payload.row?.id ?? payload.id ?? '');
          triggerNewOrderArrival(insertId || undefined);
        }
        fetchRows();
      }
    });
  }
});

onUnmounted(() => {
  stopAutoRefresh();
  unsubscribeRealtime?.();
  if (alertTimeout) clearTimeout(alertTimeout);
});
</script>

<template>
  <div
    class="w-full h-full flex flex-col overflow-hidden rounded-[22px]"
    :style="{
      background: surfaceColor,
      border: `1px solid ${borderColor}`,
      color: textColor,
    }"
  >
    <div
      class="px-4 py-3 border-b flex items-start justify-between gap-3 shrink-0"
      :style="{ borderColor }"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate">{{ element.title || sourceLabel }}</p>
        <p v-if="element.subtitle" class="text-[11px] truncate" :style="{ color: mutedTextColor }">{{ element.subtitle }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <!-- New order alert pill -->
        <Transition name="fade">
          <div
            v-if="newOrderAlert"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white animate-bounce shadow-md"
          >
            <Bell class="w-3.5 h-3.5 animate-spin" />
            <span>New Order!</span>
          </div>
        </Transition>

        <!-- Kitchen Chime Bell Toggle Button -->
        <button
          v-if="isOrdersTable"
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95"
          :style="{
            borderColor: soundEnabled ? 'rgba(234, 179, 8, 0.4)' : borderColor,
            background: soundEnabled ? (isLight ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.15)') : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)'),
            color: soundEnabled ? '#eab308' : mutedTextColor,
          }"
          :title="soundEnabled ? 'Kitchen Bell: Active (Click to mute)' : 'Kitchen Bell: Muted (Click to enable chime)'"
          :aria-label="soundEnabled ? 'Mute kitchen bell' : 'Unmute kitchen bell'"
          @click="toggleKitchenSound"
        >
          <Bell v-if="soundEnabled" class="w-3.5 h-3.5 animate-pulse text-amber-500" />
          <BellOff v-else class="w-3.5 h-3.5 opacity-60" />
          <span class="hidden sm:inline font-semibold text-[11px]">{{ soundEnabled ? 'Chime ON' : 'Chime OFF' }}</span>
        </button>

        <button
          class="text-xs shrink-0 transition-colors p-1 rounded-lg hover:opacity-80"
          :style="{ color: mutedTextColor }"
          aria-label="Refresh list"
          @click="fetchRows"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <div v-if="loading && rows.length === 0" class="flex-1 flex items-center justify-center">
      <div class="w-5 h-5 rounded-full border-2 animate-spin" :style="{ borderColor, borderTopColor: textColor }" />
    </div>

    <div v-else class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="sticky top-0" :style="{ background: headerColor }">
          <tr>
            <th
              v-for="column in displayColumns"
              :key="column"
              class="px-4 py-2 text-left font-medium whitespace-nowrap"
              :style="{ color: mutedTextColor }"
            >
              {{ columnLabel(column) }}
            </th>
            <th
              v-if="hasRowActions"
              class="px-4 py-2 text-right font-medium whitespace-nowrap"
              :style="{ color: mutedTextColor }"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="index"
            class="border-t transition-colors"
            :class="isOrdersTable ? 'cursor-pointer hover:bg-white/[0.04]' : ''"
            :style="{
              borderColor: rowBorderColor,
              background: element.striped && index % 2 === 1 ? stripedBg : 'transparent',
            }"
            @click="isOrdersTable ? openOrderModal(row) : undefined"
          >
            <td
              v-for="column in displayColumns"
              :key="column"
              class="px-4 py-2 whitespace-nowrap max-w-[240px] truncate"
            >
              <template v-if="column === 'status'">
                <button
                  v-if="isOrdersTable && !builderMode && canUpdateTable"
                  type="button"
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all active:scale-95 cursor-pointer hover:brightness-125 shadow-sm"
                  :class="statusBadgeClasses(String(row[column] ?? 'pending'))"
                  title="Click to advance status (pending → preparing → fulfilled)"
                  @click.stop="cycleOrderStatus(row, $event)"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current" :class="{ 'animate-pulse': !isOrderServed(row) }" />
                  {{ displayStatus(row[column]) }}
                </button>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                  :class="statusBadgeClasses(String(row[column] ?? 'pending'))"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current" />
                  {{ displayStatus(row[column]) }}
                </span>
              </template>
              <template v-else-if="column === 'items' && isOrdersTable">
                <div
                  class="flex items-center gap-1.5 group cursor-pointer max-w-[280px]"
                  title="Click to view full order details"
                  @click.stop="openOrderModal(row)"
                >
                  <span class="truncate font-medium flex-1">
                    {{ row[column] ?? '-' }}
                  </span>
                  <span
                    class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all group-hover:scale-105 border shadow-2xs"
                    :style="{
                      background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                      borderColor,
                      color: textColor,
                    }"
                  >
                    <Eye class="w-3 h-3" />
                    <span>View</span>
                  </span>
                </div>
              </template>
              <template v-else-if="isPriceColumn(column)">
                {{ formatPrice(row[column]) }}
              </template>
              <template v-else-if="column === 'available'">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                  :class="isAvailable(row[column]) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-600 dark:text-rose-300'"
                >
                  {{ isAvailable(row[column]) ? 'Available' : 'Unavailable' }}
                </span>
              </template>
              <template v-else>
                {{ row[column] ?? '-' }}
              </template>
            </td>

            <td v-if="hasRowActions" class="px-4 py-2 whitespace-nowrap text-right">
              <!-- Orders row action: Kitchen Order Served Confirmation + Inspect Order -->
              <div v-if="isOrdersTable" class="inline-flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 cursor-pointer hover:brightness-125"
                  :style="{ borderColor, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)', color: textColor }"
                  title="Inspect full order line items, notes, and totals"
                  @click.stop="openOrderModal(row)"
                >
                  <Eye class="w-3.5 h-3.5" />
                  <span class="hidden md:inline">Inspect</span>
                </button>
                <button
                  v-if="!isOrderServed(row)"
                  type="button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-95 cursor-pointer hover:brightness-110 disabled:opacity-50"
                  :style="{ background: '#059669' }"
                  :disabled="servingOrderId === String(row.id)"
                  title="Confirm order has been prepared and served"
                  @click="markOrderServed(row, $event)"
                >
                  <RefreshCw v-if="servingOrderId === String(row.id)" class="w-3.5 h-3.5 animate-spin" />
                  <CheckCircle2 v-else class="w-3.5 h-3.5" />
                  {{ servingOrderId === String(row.id) ? 'Updating...' : 'Mark as Served' }}
                </button>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  Served
                </span>
              </div>

              <!-- Products row actions: Catalog Edit & Delete -->
              <div v-else-if="isProductsTable" class="inline-flex items-center justify-end gap-1.5">
                <button
                  v-if="canUpdateTable"
                  type="button"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all active:scale-95 cursor-pointer hover:brightness-125"
                  :style="{ borderColor, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)', color: textColor }"
                  title="Edit product"
                  @click="openEditModal(row, $event)"
                >
                  <Pencil class="w-3 h-3" />
                  Edit
                </button>
                <button
                  v-if="canDeleteTable"
                  type="button"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95 cursor-pointer"
                  title="Delete product"
                  @click="openDeleteModal(row, $event)"
                >
                  <Trash2 class="w-3 h-3" />
                  Delete
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="Math.max(displayColumns.length, 1) + (hasRowActions ? 1 : 0)" class="px-4 py-8 text-center" :style="{ color: mutedTextColor }">
              {{ element.emptyLabel ?? 'No records yet' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Product Modal -->
    <Teleport to="body">
      <div
        v-if="editingProduct"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style="background: rgba(10, 6, 10, 0.65); backdrop-filter: blur(6px);"
        @click.self="closeEditModal"
      >
        <div
          class="w-full max-w-md rounded-[26px] p-6 shadow-2xl space-y-4"
          :style="{
            background: isLight ? '#ffffff' : '#1d151c',
            color: textColor,
            border: `1px solid ${borderColor}`,
          }"
        >
          <div class="flex items-center justify-between pb-2 border-b" :style="{ borderColor }">
            <div>
              <h3 class="text-base font-semibold">Edit Product</h3>
              <p class="text-xs mt-0.5" :style="{ color: mutedTextColor }">Update details in the catalog</p>
            </div>
            <button
              type="button"
              class="p-1 rounded-lg hover:opacity-75 transition-opacity cursor-pointer"
              :style="{ color: mutedTextColor }"
              @click="closeEditModal"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="editError" class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
            <AlertTriangle class="w-4 h-4 shrink-0" />
            <span>{{ editError }}</span>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-medium mb-1" :style="{ color: mutedTextColor }">Product Name</label>
              <input
                v-model="editingProduct.name"
                type="text"
                placeholder="Product name"
                class="w-full rounded-xl px-3 py-2 outline-none border"
                :style="{
                  borderColor,
                  background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                  color: textColor,
                }"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-medium mb-1" :style="{ color: mutedTextColor }">Price ($)</label>
                <input
                  v-model="editingProduct.price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="w-full rounded-xl px-3 py-2 outline-none border"
                  :style="{
                    borderColor,
                    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                    color: textColor,
                  }"
                />
              </div>

              <div>
                <label class="block font-medium mb-1" :style="{ color: mutedTextColor }">Category</label>
                <input
                  v-model="editingProduct.category"
                  type="text"
                  placeholder="Category"
                  class="w-full rounded-xl px-3 py-2 outline-none border"
                  :style="{
                    borderColor,
                    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                    color: textColor,
                  }"
                />
              </div>
            </div>

            <div>
              <label class="block font-medium mb-1" :style="{ color: mutedTextColor }">Description (Optional)</label>
              <textarea
                v-model="editingProduct.description"
                rows="2"
                placeholder="Short description"
                class="w-full rounded-xl px-3 py-2 outline-none border resize-none"
                :style="{
                  borderColor,
                  background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                  color: textColor,
                }"
              />
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input
                id="edit-available"
                v-model="editingProduct.available"
                type="checkbox"
                class="rounded cursor-pointer w-4 h-4"
              />
              <label for="edit-available" class="cursor-pointer font-medium select-none">
                Available for sale
              </label>
            </div>
          </div>

          <div class="flex gap-2 pt-3 border-t" :style="{ borderColor }">
            <button
              type="button"
              class="flex-1 rounded-xl px-4 py-2 text-xs font-medium border transition-colors cursor-pointer"
              :style="{ borderColor, color: textColor }"
              :disabled="savingEdit"
              @click="closeEditModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-opacity cursor-pointer disabled:opacity-50"
              :style="{ background: '#e8748a' }"
              :disabled="savingEdit"
              @click="saveProductEdit"
            >
              {{ savingEdit ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="deletingProduct"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style="background: rgba(10, 6, 10, 0.65); backdrop-filter: blur(6px);"
        @click.self="closeDeleteModal"
      >
        <div
          class="w-full max-w-sm rounded-[26px] p-6 shadow-2xl space-y-4"
          :style="{
            background: isLight ? '#ffffff' : '#1d151c',
            color: textColor,
            border: `1px solid ${borderColor}`,
          }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-rose-500/15 text-rose-500">
              <Trash2 class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-semibold">Delete Product</h3>
              <p class="text-xs mt-1 leading-relaxed" :style="{ color: mutedTextColor }">
                Are you sure you want to remove <span class="font-semibold text-rose-400">"{{ deletingProduct.name || 'this product' }}"</span> from the catalog? This cannot be undone.
              </p>
            </div>
          </div>

          <div v-if="deleteError" class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
            <AlertTriangle class="w-4 h-4 shrink-0" />
            <span>{{ deleteError }}</span>
          </div>

          <div class="flex gap-2 pt-2">
            <button
              type="button"
              class="flex-1 rounded-xl px-4 py-2 text-xs font-medium border transition-colors cursor-pointer"
              :style="{ borderColor, color: textColor }"
              :disabled="deleting"
              @click="closeDeleteModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              :disabled="deleting"
              @click="confirmDeleteProduct"
            >
              {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- Order Inspection Modal (Kitchen Display / Full Order View) -->
    <Teleport to="body">
      <div
        v-if="inspectedOrder"
        class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
        style="background: rgba(10, 6, 10, 0.68); backdrop-filter: blur(6px);"
        @click.self="closeOrderModal"
      >
        <div
          class="w-full max-w-lg rounded-[26px] p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          :style="{
            background: isLight ? '#ffffff' : '#1d151c',
            color: textColor,
            border: `1px solid ${borderColor}`,
          }"
        >
          <!-- Modal Header -->
          <div class="flex items-start justify-between pb-3 border-b shrink-0" :style="{ borderColor }">
            <div class="min-w-0 pr-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" :style="{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: mutedTextColor }">
                  {{ inspectedOrder.receipt_number || inspectedOrder.id || 'Order Ticket' }}
                </span>
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                  :class="statusBadgeClasses(String(inspectedOrder.status || 'pending'))"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current" :class="{ 'animate-pulse': !isOrderServed(inspectedOrder) }" />
                  {{ displayStatus(inspectedOrder.status) }}
                </span>
              </div>
              <h3 class="text-base sm:text-lg font-bold mt-1.5 truncate">
                {{ inspectedOrder.table_number || 'Counter / Takeout' }}
              </h3>
              <p class="text-[11px] mt-0.5 flex items-center gap-1.5" :style="{ color: mutedTextColor }">
                <Clock class="w-3 h-3" />
                <span>{{ inspectedOrder.created_at || 'Just now' }}</span>
                <span v-if="inspectedOrder.staff_name">&middot; Server: {{ inspectedOrder.staff_name }}</span>
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-xl hover:opacity-75 transition-opacity cursor-pointer shrink-0"
              :style="{ color: mutedTextColor, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)' }"
              aria-label="Close modal"
              @click="closeOrderModal"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Items List (Scrollable) -->
          <div class="flex-1 overflow-y-auto py-3 space-y-2 min-h-0">
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider px-1 pb-1" :style="{ color: mutedTextColor }">
              <span class="flex items-center gap-1.5">
                <UtensilsCrossed class="w-3.5 h-3.5" /> Ordered Items
              </span>
              <span>{{ parseInspectionItems(inspectedOrder).length }} item(s)</span>
            </div>

            <div
              v-for="(item, idx) in parseInspectionItems(inspectedOrder)"
              :key="idx"
              class="rounded-xl p-3 flex items-start justify-between gap-3 border transition-colors shadow-2xs"
              :style="{
                borderColor: rowBorderColor,
                background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
              }"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2">
                  <span class="font-extrabold text-sm sm:text-base tabular-nums text-emerald-600 dark:text-emerald-400">
                    {{ item.qty }}x
                  </span>
                  <span class="font-bold text-sm sm:text-base break-words leading-tight" :style="{ color: textColor }">
                    {{ item.name }}
                  </span>
                </div>

                <div class="flex items-center gap-2 mt-1 flex-wrap text-xs" :style="{ color: mutedTextColor }">
                  <span v-if="item.price > 0">{{ formatPrice(item.price) }} each</span>
                  <span
                    v-if="item.discount && item.discount > 0"
                    class="px-1.5 py-0.2 rounded text-[10px] font-semibold text-amber-600 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30"
                  >
                    -{{ formatPrice(item.discount) }} discount
                  </span>
                  <span
                    v-if="item.taxable === false"
                    class="px-1.5 py-0.2 rounded text-[10px] font-semibold text-sky-600 dark:text-sky-300 bg-sky-500/15 border border-sky-500/30"
                  >
                    VAT-Exempt
                  </span>
                </div>

                <p v-if="item.notes" class="text-xs italic mt-1 text-amber-500">
                  Note: {{ item.notes }}
                </p>
              </div>

              <div class="text-right shrink-0">
                <span class="font-bold text-sm tabular-nums" :style="{ color: textColor }">
                  {{ formatPrice(item.subtotal) }}
                </span>
              </div>
            </div>

            <div
              v-if="parseInspectionItems(inspectedOrder).length === 0"
              class="text-center py-6 text-xs"
              :style="{ color: mutedTextColor }"
            >
              No line item details recorded for this order.
            </div>
          </div>

          <!-- Order Summary Footer -->
          <div class="pt-3 border-t shrink-0 space-y-2.5 text-xs" :style="{ borderColor }">
            <div class="rounded-xl p-2.5 space-y-1" :style="{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)' }">
              <div v-if="inspectedOrder.subtotal" class="flex justify-between" :style="{ color: mutedTextColor }">
                <span>Subtotal</span>
                <span class="tabular-nums">{{ formatPrice(inspectedOrder.subtotal) }}</span>
              </div>
              <div v-if="Number(inspectedOrder.discount_amount) > 0" class="flex justify-between font-semibold text-amber-600 dark:text-amber-400">
                <span>Discount ({{ inspectedOrder.discount_label || 'Applied' }}{{ inspectedOrder.discount_reference ? ` - ${inspectedOrder.discount_reference}` : '' }})</span>
                <span class="tabular-nums">-{{ formatPrice(inspectedOrder.discount_amount) }}</span>
              </div>
              <div class="flex justify-between font-extrabold text-sm pt-1 border-t" :style="{ borderColor: rowBorderColor }">
                <span>Total Amount</span>
                <span class="text-base tabular-nums" :style="{ color: textColor }">{{ formatPrice(inspectedOrder.total) }}</span>
              </div>
              <div class="flex justify-between text-[11px] pt-0.5" :style="{ color: mutedTextColor }">
                <span>Payment: {{ inspectedOrder.payment_method || 'cash' }} ({{ inspectedOrder.payment_status || 'paid' }})</span>
                <span v-if="inspectedOrder.payment_reference" class="truncate max-w-[160px]">Ref: {{ inspectedOrder.payment_reference }}</span>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                :style="{ borderColor, color: textColor }"
                @click="closeOrderModal"
              >
                Close View
              </button>
              <button
                v-if="!isOrderServed(inspectedOrder) && canUpdateTable"
                type="button"
                class="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                :style="{ background: '#059669' }"
                :disabled="servingOrderId === String(inspectedOrder.id)"
                @click="markOrderServed(inspectedOrder, $event); closeOrderModal()"
              >
                <CheckCircle2 class="w-4 h-4" />
                <span>Mark as Served</span>
              </button>
              <button
                v-else-if="canUpdateTable"
                type="button"
                class="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                :style="{ borderColor, color: mutedTextColor }"
                @click="cycleOrderStatus(inspectedOrder, $event)"
              >
                Bump Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
