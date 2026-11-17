<script setup lang="ts">
import ActivityIcon from 'reicon-vue/icons/Activity';
import RefreshIcon from 'reicon-vue/icons/Refresh';
import TrendUpIcon from 'reicon-vue/icons/TrendUp';
import ShoppingBagIcon from 'reicon-vue/icons/ShoppingBag';
import CreditCardIcon from 'reicon-vue/icons/CreditCard';
import {
  buildDonutSlices,
  buildHorizontalBars,
  buildTrendChartSeries,
  type TrendDiagramMetric,
  type TrendInputPoint,
} from '~/lib/reportDiagrams';

interface TopItemInput {
  name: string;
  unitsSold: number;
  revenue: number;
  shareOfSales: number;
}

interface PaymentChannelInput {
  method: string;
  label: string;
  orders: number;
  revenue: number;
  shareOfSales: number;
}

interface OrderStatusInput {
  status: string;
  label: string;
  orders: number;
  revenue: number;
  shareOfOrders: number;
}

const props = withDefaults(defineProps<{
  trendPoints: TrendInputPoint[];
  topItems: TopItemInput[];
  paymentBreakdown: PaymentChannelInput[];
  statusBreakdown?: OrderStatusInput[];
  loading?: boolean;
  liveEnabled?: boolean;
  liveConnected?: boolean;
  livePulse?: boolean;
  lastUpdatedLabel?: string;
  title?: string;
  subtitle?: string;
  showMovingAverage?: boolean;
}>(), {
  statusBreakdown: () => [],
  loading: false,
  liveEnabled: true,
  liveConnected: false,
  livePulse: false,
  lastUpdatedLabel: '',
  title: 'Live Sales Diagrams',
  subtitle: 'Visual breakdown that updates automatically as new sales come in.',
  showMovingAverage: false,
});

const emit = defineEmits<{
  (e: 'toggle-live'): void;
  (e: 'refresh'): void;
}>();

const { format: formatCurrency, symbol: currencySymbol } = useCurrency();
const areaGradientId = `kogane-sales-area-${useId()}`;

const activeMetric = ref<TrendDiagramMetric>('revenue');
const hoveredPointIndex = ref<number | null>(null);
const hoveredSliceIndex = ref<number | null>(null);

const METRIC_OPTIONS: Array<{ key: TrendDiagramMetric; label: string }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'orders', label: 'Orders' },
  { key: 'averageOrderValue', label: 'Avg. Order' },
];

const trendSeries = computed(() =>
  buildTrendChartSeries(props.trendPoints, activeMetric.value),
);

const activeTrendPoint = computed(() => {
  const pts = trendSeries.value.points;
  if (pts.length === 0) return null;
  if (hoveredPointIndex.value != null && pts[hoveredPointIndex.value]) {
    return pts[hoveredPointIndex.value];
  }
  return pts[pts.length - 1];
});

const hasTrendSales = computed(() =>
  trendSeries.value.points.some((pt) => pt.revenue > 0 || pt.orders > 0),
);

const productBars = computed(() =>
  buildHorizontalBars(
    props.topItems.map((item) => ({
      label: item.name,
      value: item.revenue,
      secondaryLabel: `${item.unitsSold} unit${item.unitsSold === 1 ? '' : 's'}`,
      share: item.shareOfSales,
    })),
    6,
  ),
);

const donutUsesRevenue = computed(() =>
  props.paymentBreakdown.some((channel) => (Number(channel.revenue) || 0) > 0),
);

const paymentDonut = computed(() =>
  buildDonutSlices(
    props.paymentBreakdown.map((channel) => ({
      label: channel.label,
      value: donutUsesRevenue.value ? channel.revenue : channel.orders,
      count: channel.orders,
    })),
  ),
);

const highlightedSlice = computed(() => {
  if (hoveredSliceIndex.value == null) return null;
  return paymentDonut.value.slices[hoveredSliceIndex.value] ?? null;
});

function formatMetricValue(value: number, metric: TrendDiagramMetric): string {
  if (metric === 'orders') {
    return `${Math.round(value).toLocaleString()}`;
  }
  return formatCurrency(value);
}

function formatDonutValue(value: number): string {
  if (!donutUsesRevenue.value) {
    const rounded = Math.round(value);
    return `${rounded} order${rounded === 1 ? '' : 's'}`;
  }
  return formatCurrency(value);
}

function formatAxisTick(value: number): string {
  if (activeMetric.value === 'orders') {
    return `${Math.round(value)}`;
  }
  const sym = currencySymbol.value || '$';
  if (value >= 1000000) {
    return `${sym}${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) {
    return `${sym}${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return formatCurrency(value);
}

function statusPillColor(status: string): string {
  const clean = status.toLowerCase();
  if (clean === 'fulfilled' || clean === 'completed' || clean === 'served') return '#059669';
  if (clean === 'preparing' || clean === 'in_progress') return '#D97706';
  if (clean === 'cancelled' || clean === 'void') return '#dc2626';
  return '#68293A';
}
</script>

<template>
  <section
    aria-label="Live sales diagrams"
    class="rounded-2xl border bg-white shadow-sm overflow-hidden transition-colors duration-300"
    :style="{
      borderColor: livePulse ? 'rgba(255, 87, 118, 0.45)' : 'rgba(104, 41, 58, 0.12)',
    }"
  >
    <!-- Header Bar -->
    <div
      class="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
      style="background: #FDF7F2; border-bottom: 1px solid rgba(104, 41, 58, 0.1);"
    >
      <div>
        <div class="flex items-center gap-2">
          <TrendUpIcon class="w-4 h-4 shrink-0" style="color: rgb(var(--shell-pink));" />
          <h2 class="font-serif text-lg font-normal m-0" style="color: rgb(var(--shell-sidebar));">
            {{ title }}
          </h2>
        </div>
        <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
          {{ subtitle }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border cursor-pointer"
          :style="liveEnabled
            ? livePulse
              ? 'background: rgba(255, 87, 118, 0.14); border-color: rgba(255, 87, 118, 0.4); color: #68293A;'
              : liveConnected
                ? 'background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.35); color: #065f46;'
                : 'background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.35); color: #92400e;'
            : 'background: #ffffff; border-color: rgba(104, 41, 58, 0.2); color: #5c3742;'"
          :aria-pressed="liveEnabled"
          @click="emit('toggle-live')"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="liveEnabled && (liveConnected || livePulse) ? 'animate-pulse' : ''"
            :style="{
              background: !liveEnabled
                ? '#78716c'
                : livePulse
                  ? '#FF5776'
                  : liveConnected
                    ? '#10b981'
                    : '#f59e0b',
            }"
          />
          <span v-if="!liveEnabled">Live updates paused</span>
          <span v-else-if="livePulse">Sale synced just now</span>
          <span v-else-if="liveConnected">Live updates active</span>
          <span v-else>Connecting live sync…</span>
        </button>

        <span
          v-if="lastUpdatedLabel"
          class="text-xs font-medium tabular-nums"
          style="color: #5c3742;"
        >
          Updated {{ lastUpdatedLabel }}
        </span>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white hover:bg-stone-50 transition-colors cursor-pointer"
          style="border-color: rgba(104, 41, 58, 0.2); color: rgb(var(--shell-sidebar));"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <RefreshIcon class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <!-- Diagram 1: Sales Trend Line & Area Chart -->
      <div
        class="rounded-xl border p-5 bg-white"
        style="border-color: rgba(104, 41, 58, 0.1);"
      >
        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div class="flex items-center gap-2">
              <ActivityIcon class="w-4 h-4 shrink-0" style="color: rgb(var(--shell-sidebar));" />
              <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                Sales Over Time
              </h3>
            </div>
            <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
              Hover or focus any period to inspect exact revenue, order volume, and average order value.
            </p>
          </div>

          <!-- Metric Switcher -->
          <div
            class="inline-flex rounded-lg p-1"
            style="background: #FDF7F2; border: 1px solid rgba(104, 41, 58, 0.12);"
            role="group"
            aria-label="Sales diagram metric"
          >
            <button
              v-for="option in METRIC_OPTIONS"
              :key="option.key"
              type="button"
              class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0"
              :style="activeMetric === option.key
                ? 'background: rgb(var(--shell-sidebar)); color: #ffffff;'
                : 'background: transparent; color: #5c3742;'"
              @click="activeMetric = option.key"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- Active / Hovered Point Readout Bar -->
        <div
          v-if="activeTrendPoint && hasTrendSales"
          class="mb-4 px-4 py-2.5 rounded-lg flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm"
          style="background: #FDF7F2; border: 1px solid rgba(104, 41, 58, 0.1);"
        >
          <span class="font-semibold" style="color: rgb(var(--shell-sidebar));">
            {{ activeTrendPoint.label }}
          </span>
          <span class="tabular-nums" style="color: #4a2530;">
            Revenue: <strong style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(activeTrendPoint.revenue) }}</strong>
          </span>
          <span class="tabular-nums" style="color: #4a2530;">
            Orders: <strong style="color: rgb(var(--shell-sidebar));">{{ activeTrendPoint.orders }}</strong>
          </span>
          <span class="tabular-nums" style="color: #4a2530;">
            Avg. order: <strong style="color: rgb(var(--shell-sidebar));">{{ formatCurrency(activeTrendPoint.averageOrderValue) }}</strong>
          </span>
          <span
            v-if="showMovingAverage && trendSeries.hasMovingAverage && activeTrendPoint.movingAverage7d != null"
            class="tabular-nums"
            style="color: #065f46;"
          >
            7-day avg: <strong>{{ formatCurrency(activeTrendPoint.movingAverage7d) }}</strong>
          </span>
        </div>

        <div
          v-if="loading && trendSeries.points.length === 0"
          class="py-14 text-center text-sm"
          style="color: #5c3742;"
        >
          Loading live sales diagram…
        </div>

        <div
          v-else-if="trendSeries.points.length === 0 || !hasTrendSales"
          class="py-12 px-4 text-center rounded-lg"
          style="background: #FDF7F2; border: 1px dashed rgba(104, 41, 58, 0.18);"
        >
          <p class="text-sm font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
            No sales recorded in this date range yet
          </p>
          <p class="text-sm mt-1 m-0" style="color: #5c3742;">
            Complete an order in your Cashier terminal and this diagram will update automatically.
          </p>
        </div>

        <div v-else class="w-full overflow-x-auto">
          <svg
            :viewBox="`0 0 ${trendSeries.width} ${trendSeries.height}`"
            class="w-full min-w-[480px] h-auto select-none"
            role="img"
            aria-label="Sales trend diagram"
            @mouseleave="hoveredPointIndex = null"
          >
            <defs>
              <linearGradient :id="areaGradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FF5776" stop-opacity="0.28" />
                <stop offset="100%" stop-color="#FF5776" stop-opacity="0.02" />
              </linearGradient>
            </defs>

            <!-- Horizontal grid lines + Y-axis labels -->
            <g v-for="(tick, idx) in trendSeries.yTicks" :key="idx">
              <line
                :x1="trendSeries.padLeft"
                :x2="trendSeries.width - trendSeries.padRight"
                :y1="tick.y"
                :y2="tick.y"
                stroke="rgba(104, 41, 58, 0.1)"
                :stroke-dasharray="idx === 0 ? undefined : '4 4'"
                stroke-width="1"
              />
              <text
                :x="trendSeries.padLeft - 8"
                :y="tick.y + 4"
                text-anchor="end"
                font-size="12"
                font-family="Inter, sans-serif"
                fill="#5c3742"
              >
                {{ formatAxisTick(tick.value) }}
              </text>
            </g>

            <!-- Single point bar fallback when only 1 period exists -->
            <rect
              v-if="trendSeries.points.length === 1 && trendSeries.points[0].value > 0"
              :x="trendSeries.points[0].x - 24"
              :y="Math.min(trendSeries.points[0].y, trendSeries.baselineY - 4)"
              width="48"
              :height="Math.max(4, trendSeries.baselineY - trendSeries.points[0].y)"
              rx="6"
              fill="#FF5776"
              opacity="0.85"
            />

            <!-- Multi-point Area + Primary Line -->
            <template v-if="trendSeries.points.length >= 2">
              <path :d="trendSeries.areaPath" :fill="`url(#${areaGradientId})`" />
              <path
                :d="trendSeries.linePath"
                fill="none"
                stroke="#68293A"
                stroke-width="2.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </template>

            <!-- 7-day Moving Average Overlay -->
            <path
              v-if="showMovingAverage && trendSeries.maLinePath"
              :d="trendSeries.maLinePath"
              fill="none"
              stroke="#059669"
              stroke-width="2"
              stroke-dasharray="5 4"
              stroke-linecap="round"
            />

            <!-- Interactive Hover Vertical Guide + Data Points -->
            <g v-for="pt in trendSeries.points" :key="pt.index">
              <line
                v-if="hoveredPointIndex === pt.index"
                :x1="pt.x"
                :x2="pt.x"
                :y1="trendSeries.padTop"
                :y2="trendSeries.baselineY"
                stroke="rgba(255, 87, 118, 0.45)"
                stroke-width="1.5"
                stroke-dasharray="3 3"
              />

              <circle
                :cx="pt.x"
                :cy="pt.y"
                :r="hoveredPointIndex === pt.index ? 6 : (trendSeries.points.length > 20 ? 3 : 4.5)"
                :fill="hoveredPointIndex === pt.index ? '#FF5776' : '#68293A'"
                stroke="#ffffff"
                stroke-width="2"
              />

              <!-- Generous invisible hit area for effortless hovering, tapping, and keyboard focus -->
              <rect
                :x="pt.x - Math.max(10, (trendSeries.width - trendSeries.padLeft - trendSeries.padRight) / Math.max(2, trendSeries.points.length * 2))"
                :y="trendSeries.padTop"
                :width="Math.max(20, (trendSeries.width - trendSeries.padLeft - trendSeries.padRight) / Math.max(1, trendSeries.points.length))"
                :height="trendSeries.baselineY - trendSeries.padTop"
                fill="transparent"
                class="cursor-pointer"
                tabindex="0"
                :aria-label="`${pt.label}: ${formatMetricValue(pt.value, activeMetric)}`"
                @mouseenter="hoveredPointIndex = pt.index"
                @focus="hoveredPointIndex = pt.index"
                @blur="hoveredPointIndex = null"
                @click="hoveredPointIndex = pt.index"
              />
            </g>

            <!-- X-axis period labels -->
            <text
              v-for="idx in trendSeries.xLabelIndices"
              :key="`xlabel-${idx}`"
              :x="trendSeries.points[idx].x"
              :y="trendSeries.height - 10"
              text-anchor="middle"
              font-size="12"
              font-family="Inter, sans-serif"
              fill="#5c3742"
            >
              {{ trendSeries.points[idx].shortLabel }}
            </text>
          </svg>

          <!-- Legend -->
          <div class="flex flex-wrap items-center gap-5 mt-2 pt-2 border-t text-xs font-medium" style="border-color: rgba(104, 41, 58, 0.08); color: #5c3742;">
            <span class="inline-flex items-center gap-2">
              <span class="w-3 h-1 rounded-full" style="background: #68293A;" />
              <span>{{ activeMetric === 'orders' ? 'Order count' : activeMetric === 'averageOrderValue' ? 'Average order value' : 'Sales revenue' }}</span>
            </span>
            <span v-if="showMovingAverage && trendSeries.hasMovingAverage" class="inline-flex items-center gap-2">
              <span class="w-3 h-0.5 border-t-2 border-dashed" style="border-color: #059669;" />
              <span>7-day moving average</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Lower Row: Top Selling Products + Payment Channels -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Diagram 2: Top Selling Products Horizontal Bar Chart -->
        <div
          class="rounded-xl border p-5 bg-white flex flex-col"
          style="border-color: rgba(104, 41, 58, 0.1);"
        >
          <div class="flex items-center justify-between gap-2 mb-4">
            <div>
              <div class="flex items-center gap-2">
                <ShoppingBagIcon class="w-4 h-4 shrink-0" style="color: rgb(var(--shell-pink));" />
                <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                  Top Selling Items
                </h3>
              </div>
              <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
                Share of sales across your best-performing items
              </p>
            </div>
          </div>

          <div
            v-if="productBars.length === 0"
            class="flex-1 flex items-center justify-center py-10 px-4 text-center rounded-lg"
            style="background: #FDF7F2; border: 1px dashed rgba(104, 41, 58, 0.18);"
          >
            <p class="text-sm m-0" style="color: #5c3742;">
              Product performance bars will appear once items are sold.
            </p>
          </div>

          <div v-else class="space-y-3.5">
            <div v-for="bar in productBars" :key="bar.label" class="space-y-1.5">
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="font-semibold truncate" style="color: rgb(var(--shell-sidebar));">
                  {{ bar.label }}
                </span>
                <span class="shrink-0 tabular-nums font-medium" style="color: #4a2530;">
                  {{ formatCurrency(bar.value) }}
                  <span class="text-xs ml-1" style="color: #5c3742;">
                    ({{ bar.secondaryLabel }} · {{ bar.share }}%)
                  </span>
                </span>
              </div>
              <div
                class="w-full h-2.5 rounded-full overflow-hidden"
                style="background: rgba(104, 41, 58, 0.08);"
              >
                <div
                  class="h-full rounded-full transition-all duration-500 ease-out"
                  :style="{
                    width: `${bar.widthPct}%`,
                    background: bar.color,
                  }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Diagram 3: Payment Channels Donut Diagram -->
        <div
          class="rounded-xl border p-5 bg-white flex flex-col"
          style="border-color: rgba(104, 41, 58, 0.1);"
        >
          <div class="mb-4">
            <div class="flex items-center gap-2">
              <CreditCardIcon class="w-4 h-4 shrink-0" style="color: rgb(var(--shell-sidebar));" />
              <h3 class="text-base font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                Sales by Payment Method
              </h3>
            </div>
            <p class="text-sm mt-0.5 m-0" style="color: #5c3742;">
              Live split across Cash, Card, and E-Wallet checkouts
            </p>
          </div>

          <div
            v-if="paymentDonut.slices.length === 0"
            class="flex-1 flex items-center justify-center py-10 px-4 text-center rounded-lg"
            style="background: #FDF7F2; border: 1px dashed rgba(104, 41, 58, 0.18);"
          >
            <p class="text-sm m-0" style="color: #5c3742;">
              Payment channel distribution will appear after your first checkout.
            </p>
          </div>

          <div v-else class="flex flex-col sm:flex-row items-center gap-6 my-auto">
            <div class="relative w-44 h-44 shrink-0">
              <svg viewBox="0 0 168 168" class="w-full h-full" role="img" aria-label="Payment method breakdown donut diagram">
                <path
                  v-for="(slice, idx) in paymentDonut.slices"
                  :key="slice.label"
                  :d="slice.path"
                  :fill="slice.color"
                  stroke="#ffffff"
                  stroke-width="2"
                  class="transition-opacity duration-200 cursor-pointer outline-none"
                  tabindex="0"
                  :aria-label="`${slice.label}: ${formatDonutValue(slice.value)} (${slice.percentage}%)`"
                  :style="{
                    opacity: hoveredSliceIndex == null || hoveredSliceIndex === idx ? 1 : 0.45,
                  }"
                  @mouseenter="hoveredSliceIndex = idx"
                  @mouseleave="hoveredSliceIndex = null"
                  @focus="hoveredSliceIndex = idx"
                  @blur="hoveredSliceIndex = null"
                  @click="hoveredSliceIndex = hoveredSliceIndex === idx ? null : idx"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                <span class="text-xs font-semibold" style="color: #5c3742;">
                  {{ highlightedSlice ? highlightedSlice.label : (donutUsesRevenue ? 'Total Sales' : 'Total Orders') }}
                </span>
                <span class="text-base font-serif mt-0.5 tabular-nums" style="color: rgb(var(--shell-sidebar));">
                  {{ formatDonutValue(highlightedSlice ? highlightedSlice.value : paymentDonut.total) }}
                </span>
                <span v-if="highlightedSlice" class="text-xs font-semibold tabular-nums" style="color: #B8294B;">
                  {{ highlightedSlice.percentage }}%
                </span>
              </div>
            </div>

            <div class="flex-1 w-full space-y-2.5">
              <button
                v-for="(slice, idx) in paymentDonut.slices"
                :key="slice.label"
                type="button"
                class="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                :style="{
                  background: hoveredSliceIndex === idx ? '#FDF7F2' : 'transparent',
                  border: hoveredSliceIndex === idx ? '1px solid rgba(104, 41, 58, 0.14)' : '1px solid transparent',
                }"
                @mouseenter="hoveredSliceIndex = idx"
                @mouseleave="hoveredSliceIndex = null"
                @focus="hoveredSliceIndex = idx"
                @blur="hoveredSliceIndex = null"
                @click="hoveredSliceIndex = hoveredSliceIndex === idx ? null : idx"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: slice.color }" />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold truncate m-0" style="color: rgb(var(--shell-sidebar));">
                      {{ slice.label }}
                    </p>
                    <p class="text-xs m-0 tabular-nums" style="color: #5c3742;">
                      {{ slice.count }} order{{ slice.count === 1 ? '' : 's' }}
                    </p>
                  </div>
                </div>
                <div class="text-right shrink-0 tabular-nums">
                  <p class="text-sm font-semibold m-0" style="color: rgb(var(--shell-sidebar));">
                    {{ formatDonutValue(slice.value) }}
                  </p>
                  <p class="text-xs font-semibold m-0" style="color: #5c3742;">
                    {{ slice.percentage }}%
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Optional Order Status Breakdown Strip -->
      <div
        v-if="statusBreakdown && statusBreakdown.length > 0"
        class="rounded-xl border px-5 py-3.5 bg-white flex flex-wrap items-center justify-between gap-3"
        style="border-color: rgba(104, 41, 58, 0.1);"
      >
        <span class="text-xs font-semibold uppercase tracking-wider" style="color: #5c3742;">
          Order Fulfillment Mix
        </span>
        <div class="flex flex-wrap items-center gap-3">
          <span
            v-for="item in statusBreakdown"
            :key="item.status"
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tabular-nums"
            style="background: #FDF7F2; border: 1px solid rgba(104, 41, 58, 0.12); color: #4a2530;"
          >
            <span class="w-2 h-2 rounded-full" :style="{ background: statusPillColor(item.status) }" />
            <span>{{ item.label }}:</span>
            <strong style="color: rgb(var(--shell-sidebar));">{{ item.orders }}</strong>
            <span style="color: #5c3742;">({{ item.shareOfOrders }}%)</span>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
