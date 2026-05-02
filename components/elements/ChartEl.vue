<script setup lang="ts">
import type { ChartElementDef } from '~/lib/uiTypes';

const props = defineProps<{
  element: ChartElementDef;
  businessId: string;
  runtime?: any;
  builderMode?: boolean;
}>();

const rows = computed<Record<string, unknown>[]>(() => props.runtime?.state?.value?.queryResults?.[props.element.id] ?? []);
const loading = ref(false);

const palette = computed(() =>
  props.element.colorPalette?.length
    ? props.element.colorPalette
    : ['#e8748a', '#6366f1', '#f59e0b', '#10b981', '#0ea5e9', '#a78bfa', '#fb923c'],
);

const textColor = computed(() => props.element.textColor ?? '#f5ede4');
const mutedTextColor = computed(() => 'rgba(245,237,228,0.7)');
const surfaceColor = computed(() => props.element.backgroundColor ?? '#161116');
const lineGradientId = computed(() => `chart-line-fill-${props.element.id}`);
const chartTitle = computed(() =>
  props.element.title
  ?? (props.element.source === 'audit-log' ? 'Audit Activity' : props.element.tableName || 'Chart'),
);

function normalizeLabel(raw: unknown): string {
  if (raw == null) return 'Unknown';
  const value = String(raw);

  if (props.element.labelColumn === 'created_at') {
    return value.slice(0, 10);
  }

  return value;
}

async function fetchData() {
  if (props.builderMode || !props.runtime) return;
  if (props.element.source !== 'audit-log' && !props.element.tableName) return;

  loading.value = true;

  try {
    await props.runtime.loadElement(props.element);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [
    props.element.source,
    props.element.tableName,
    props.element.labelColumn,
    props.element.valueColumn,
    props.element.aggregation,
    JSON.stringify(props.element.filters ?? {}),
  ],
  fetchData,
  { deep: true },
);

onMounted(fetchData);

const chartData = computed(() => {
  if (props.builderMode) {
    return [
      { label: 'Alpha', value: 42 },
      { label: 'Beta', value: 28 },
      { label: 'Gamma', value: 18 },
      { label: 'Delta', value: 12 },
    ];
  }

  const labelColumn = props.element.labelColumn ?? (props.element.source === 'audit-log' ? 'action_type' : '');
  const valueColumn = props.element.valueColumn ?? '';
  const aggregation = props.element.aggregation ?? 'sum';

  if (!labelColumn) return [];

  if (aggregation === 'count') {
    const grouped = new Map<string, number>();

    for (const row of rows.value) {
      const label = normalizeLabel(row[labelColumn]);
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  return rows.value
    .map((row) => ({
      label: normalizeLabel(row[labelColumn]),
      value: Number(row[valueColumn] ?? 0),
    }))
    .filter((item) => !Number.isNaN(item.value));
});

const total = computed(() => chartData.value.reduce((sum, item) => sum + item.value, 0) || 1);
const maxValue = computed(() => Math.max(...chartData.value.map((item) => item.value), 1));

function polarToXY(angle: number, radius: number, cx: number, cy: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function pieSlicePath(startAngle: number, endAngle: number, cx: number, cy: number, radius: number): string {
  const start = polarToXY(startAngle, radius, cx, cy);
  const end = polarToXY(endAngle, radius, cx, cy);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

const pieSlices = computed(() => {
  let angle = -Math.PI / 2;

  return chartData.value.map((item, index) => {
    const sweep = (item.value / total.value) * 2 * Math.PI;
    const slice = {
      path: pieSlicePath(angle, angle + sweep, 80, 80, 70),
      color: palette.value[index % palette.value.length],
      label: item.label,
      pct: Math.round((item.value / total.value) * 100),
    };
    angle += sweep;
    return slice;
  });
});

function linePoints(width: number, height: number): string {
  const pad = 24;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;

  if (chartData.value.length < 2) return '';

  return chartData.value.map((item, index) => {
    const x = pad + (index / (chartData.value.length - 1)) * usableWidth;
    const y = pad + usableHeight - (item.value / maxValue.value) * usableHeight;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}
</script>

<template>
  <div
    class="w-full h-full flex flex-col overflow-hidden rounded-[22px]"
    :style="{
      background: surfaceColor,
      border: '1px solid rgba(255,255,255,0.08)',
      color: textColor,
    }"
  >
    <div class="px-4 py-3 flex items-start justify-between shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate">{{ chartTitle }}</p>
        <p v-if="element.subtitle" class="text-[11px] truncate" :style="{ color: mutedTextColor }">{{ element.subtitle }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[10px] font-mono px-2 py-1 rounded-full uppercase"
          style="background: rgba(255,255,255,0.08);"
        >
          {{ element.source === 'audit-log' ? 'audit' : (element.tableName || 'table') }}
        </span>
        <span
          class="text-[10px] font-mono px-2 py-1 rounded-full uppercase"
          style="background: rgba(232,116,138,0.14); color: #e8748a;"
        >
          {{ element.aggregation ?? 'sum' }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color: rgba(255,255,255,0.16); border-top-color: #e8748a;" />
    </div>

    <div v-else-if="chartData.length === 0" class="flex-1 flex items-center justify-center px-4 text-center text-sm" :style="{ color: mutedTextColor }">
      {{ element.emptyLabel ?? 'No chart data yet' }}
    </div>

    <div v-else-if="element.chartType === 'pie'" class="flex-1 flex items-center justify-center p-3 gap-4">
      <svg viewBox="0 0 160 160" class="w-28 h-28 shrink-0">
        <path
          v-for="(slice, index) in pieSlices"
          :key="index"
          :d="slice.path"
          :fill="slice.color"
          stroke="rgba(255,255,255,0.9)"
          stroke-width="1.5"
        />
      </svg>
      <div class="flex flex-col gap-1 min-w-0">
        <div
          v-for="(slice, index) in pieSlices"
          :key="index"
          class="flex items-center gap-2 text-xs"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: slice.color }" />
          <span class="truncate" :style="{ color: mutedTextColor }">{{ slice.label }}</span>
          <span class="font-semibold ml-auto pl-2">{{ slice.pct }}%</span>
        </div>
      </div>
    </div>

    <div v-else-if="element.chartType === 'bar'" class="flex-1 flex items-end gap-2 px-4 pb-4 pt-3">
      <div
        v-for="(item, index) in chartData"
        :key="index"
        class="flex-1 flex flex-col items-center gap-1 min-w-0"
      >
        <span class="text-[10px] font-semibold" :style="{ color: mutedTextColor }">{{ item.value }}</span>
        <div
          class="w-full rounded-t-xl transition-all"
          :style="{
            height: `${Math.max(6, (item.value / maxValue) * 110)}px`,
            background: palette[index % palette.length],
          }"
        />
        <span class="text-[10px] truncate w-full text-center" :style="{ color: mutedTextColor }">{{ item.label }}</span>
      </div>
    </div>

    <div v-else class="flex-1 relative p-3">
      <svg class="w-full h-full overflow-visible" viewBox="0 0 160 100" preserveAspectRatio="none">
        <defs>
          <linearGradient :id="lineGradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="palette[0]" stop-opacity="0.25" />
            <stop offset="100%" :stop-color="palette[0]" stop-opacity="0" />
          </linearGradient>
        </defs>

        <template v-if="chartData.length >= 2">
          <path
            :d="linePoints(160, 100) + ' L 160 100 L 0 100 Z'"
            :fill="`url(#${lineGradientId})`"
          />
          <path
            :d="linePoints(160, 100)"
            fill="none"
            :stroke="palette[0]"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-for="(item, index) in chartData"
            :key="index"
            :cx="24 + (index / (chartData.length - 1)) * 112"
            :cy="24 + 52 - (item.value / maxValue) * 52"
            r="3.5"
            :fill="palette[0]"
            :stroke="surfaceColor"
            stroke-width="1.5"
          />
        </template>
      </svg>
    </div>
  </div>
</template>
