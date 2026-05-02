<script setup lang="ts">
import type { ChartElementDef } from '~/lib/uiTypes';

const props = defineProps<{
  element: ChartElementDef;
  businessId: string;
  builderMode?: boolean;
}>();

const { authHeaders } = useAuth();

const rows    = ref<Record<string, unknown>[]>([]);
const loading = ref(false);

const PALETTE = computed(() =>
  props.element.colorPalette?.length
    ? props.element.colorPalette
    : ['#e8748a', '#6366f1', '#f59e0b', '#10b981', '#0ea5e9', '#a78bfa', '#fb923c'],
);

async function fetchData() {
  if (!props.element.tableName || props.builderMode) return;
  loading.value = true;

  try {
    const res = await $fetch<{ rows: any[] }>('/api/data/query', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessId: props.businessId,
        table:      props.element.tableName,
        columns:    [props.element.labelColumn, props.element.valueColumn].filter(Boolean),
        limit:      100,
      },
    });
    rows.value = res.rows ?? [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
watch(() => [props.element.tableName, props.element.labelColumn, props.element.valueColumn], fetchData);

/* ── computed chart data ─────────────────────────────────────────────────── */

const chartData = computed(() => {
  const labelCol = props.element.labelColumn ?? '';
  const valueCol = props.element.valueColumn ?? '';

  if (props.builderMode) {
    /* demo data for the builder canvas */
    return [
      { label: 'Alpha', value: 42 },
      { label: 'Beta',  value: 28 },
      { label: 'Gamma', value: 18 },
      { label: 'Delta', value: 12 },
    ];
  }

  return rows.value
    .map(r => ({
      label: String(r[labelCol] ?? '?'),
      value: Number(r[valueCol] ?? 0),
    }))
    .filter(d => !Number.isNaN(d.value));
});

const total = computed(() => chartData.value.reduce((s, d) => s + d.value, 0) || 1);

/* ── pie helpers ─────────────────────────────────────────────────────────── */

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function pieSlicePath(startAngle: number, endAngle: number, cx: number, cy: number, r: number): string {
  const s = polarToXY(startAngle, r, cx, cy);
  const e = polarToXY(endAngle,   r, cx, cy);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

const pieSlices = computed(() => {
  let angle = -Math.PI / 2;
  return chartData.value.map((d, i) => {
    const sweep = (d.value / total.value) * 2 * Math.PI;
    const slice = {
      path:  pieSlicePath(angle, angle + sweep, 80, 80, 70),
      color: PALETTE.value[i % PALETTE.value.length],
      label: d.label,
      pct:   Math.round((d.value / total.value) * 100),
    };
    angle += sweep;
    return slice;
  });
});

/* ── bar helpers ─────────────────────────────────────────────────────────── */

const maxValue = computed(() => Math.max(...chartData.value.map(d => d.value), 1));

/* ── line helpers ────────────────────────────────────────────────────────── */

function linePoints(w: number, h: number): string {
  const data  = chartData.value;
  const pad   = 24;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;

  if (data.length < 2) return '';

  return data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * usableW;
    const y = pad + usableH - (d.value / maxValue.value) * usableH;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}
</script>

<template>
  <div class="w-full h-full flex flex-col bg-white rounded-xl overflow-hidden" style="border: 1px solid rgba(61,24,32,0.08);">
    <!-- Header -->
    <div class="px-3 py-2 flex items-center justify-between shrink-0" style="border-bottom: 1px solid rgba(61,24,32,0.06);">
      <span class="text-xs font-semibold" style="color: rgb(var(--shell-sidebar));">
        {{ element.tableName || 'Chart' }}
      </span>
      <span
        class="text-[0.6rem] font-mono px-1.5 py-0.5 rounded capitalize"
        style="background: rgba(232,116,138,0.12); color: rgb(232,116,138);"
      >
        {{ element.chartType }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color: rgba(61,24,32,0.1); border-top-color: rgb(var(--shell-sidebar));"></div>
    </div>

    <!-- Pie Chart -->
    <div v-else-if="element.chartType === 'pie'" class="flex-1 flex items-center justify-center p-2 gap-4">
      <svg viewBox="0 0 160 160" class="w-28 h-28 shrink-0">
        <g>
          <path
            v-for="(slice, i) in pieSlices"
            :key="i"
            :d="slice.path"
            :fill="slice.color"
            stroke="white"
            stroke-width="1.5"
          />
        </g>
      </svg>
      <div class="flex flex-col gap-1 min-w-0">
        <div
          v-for="(slice, i) in pieSlices"
          :key="i"
          class="flex items-center gap-1.5 text-xs"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="`background: ${slice.color};`" />
          <span class="truncate" style="color: rgba(61,24,32,0.65);">{{ slice.label }}</span>
          <span class="font-semibold ml-auto pl-2" style="color: rgb(var(--shell-sidebar));">{{ slice.pct }}%</span>
        </div>
      </div>
    </div>

    <!-- Bar Chart -->
    <div v-else-if="element.chartType === 'bar'" class="flex-1 flex items-end gap-1.5 px-3 pb-3 pt-2">
      <div
        v-for="(d, i) in chartData"
        :key="i"
        class="flex-1 flex flex-col items-center gap-1 min-w-0"
      >
        <span class="text-[0.55rem] font-semibold" style="color: rgba(61,24,32,0.5);">{{ d.value }}</span>
        <div
          class="w-full rounded-t transition-all"
          :style="`height: ${Math.max(4, (d.value / maxValue) * 80)}px; background: ${PALETTE[i % PALETTE.length]};`"
        />
        <span class="text-[0.55rem] truncate w-full text-center" style="color: rgba(61,24,32,0.45);">{{ d.label }}</span>
      </div>
    </div>

    <!-- Line Chart -->
    <div v-else-if="element.chartType === 'line'" class="flex-1 relative p-2">
      <svg class="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="PALETTE[0]" stop-opacity="0.2" />
            <stop offset="100%" :stop-color="PALETTE[0]" stop-opacity="0" />
          </linearGradient>
        </defs>
        <template v-if="chartData.length >= 2">
          <!-- Area fill -->
          <path
            :d="linePoints(160, 100) + ` L 160 100 L 0 100 Z`"
            fill="url(#line-fill)"
          />
          <!-- Line -->
          <path
            :d="linePoints(160, 100)"
            fill="none"
            :stroke="PALETTE[0]"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <!-- Dots -->
          <circle
            v-for="(d, i) in chartData"
            :key="i"
            :cx="24 + (i / (chartData.length - 1)) * 112"
            :cy="24 + 52 - (d.value / maxValue) * 52"
            r="3"
            :fill="PALETTE[0]"
            stroke="white"
            stroke-width="1.5"
          />
        </template>
        <text
          v-if="chartData.length < 2"
          x="50%"
          y="50%"
          text-anchor="middle"
          dominant-baseline="middle"
          class="text-xs"
          style="fill: rgba(61,24,32,0.25); font-size: 11px;"
        >
          Not enough data
        </text>
      </svg>
    </div>
  </div>
</template>
