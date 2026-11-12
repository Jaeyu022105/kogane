export type TrendDiagramMetric = 'revenue' | 'orders' | 'averageOrderValue';

export interface TrendInputPoint {
  label: string;
  revenue: number;
  orders: number;
  averageOrderValue?: number;
  movingAverage7d?: number;
}

export interface ComputedTrendPoint {
  index: number;
  label: string;
  shortLabel: string;
  value: number;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  movingAverage7d: number | null;
  x: number;
  y: number;
  maY: number | null;
}

export interface TrendYTick {
  value: number;
  y: number;
}

export interface TrendChartSeries {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  baselineY: number;
  maxValue: number;
  hasMovingAverage: boolean;
  points: ComputedTrendPoint[];
  yTicks: TrendYTick[];
  xLabelIndices: number[];
  linePath: string;
  areaPath: string;
  maLinePath: string;
}

export interface DonutInputItem {
  label: string;
  value: number;
  count?: number;
  color?: string;
}

export interface ComputedDonutSlice {
  label: string;
  value: number;
  count: number;
  percentage: number;
  color: string;
  path: string;
  isFullCircle: boolean;
}

export interface HorizontalBarItem {
  label: string;
  value: number;
  secondaryLabel: string;
  share: number;
  widthPct: number;
  color: string;
}

export const KOGANE_DIAGRAM_PALETTE = [
  '#68293A', // Kogane Maroon
  '#FF5776', // Kogane Pink
  '#D97706', // Warm Amber
  '#059669', // Emerald
  '#0284C7', // Sky Blue
  '#7C3AED', // Violet
];

const SALES_TABLES = new Set(['orders', 'transactions', 'invoices', 'products']);

export function isSalesMutationTable(tableName: string | undefined | null): boolean {
  const clean = String(tableName ?? '').trim().toLowerCase();
  if (!clean) return false;
  if (SALES_TABLES.has(clean)) return true;
  for (const suffix of SALES_TABLES) {
    if (clean.endsWith(`_${suffix}`)) return true;
  }
  return false;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortPeriodLabel(rawLabel: string): string {
  const label = String(rawLabel ?? '').trim();
  if (!label) return '—';

  // YYYY-MM-DD
  const dayMatch = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    const monthIdx = Number(dayMatch[2]) - 1;
    const day = Number(dayMatch[3]);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_SHORT[monthIdx]} ${day}`;
    }
  }

  // YYYY-MM
  const monthMatch = label.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const monthIdx = Number(monthMatch[2]) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_SHORT[monthIdx]} '${monthMatch[1].slice(2)}`;
    }
  }

  // YYYY-Www
  const weekMatch = label.match(/^(\d{4})-W(\d{2})$/i);
  if (weekMatch) {
    return `W${weekMatch[2]}`;
  }

  return label.length > 14 ? `${label.slice(0, 12)}…` : label;
}

function niceCeil(rawMax: number): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const fraction = rawMax / magnitude;
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 1.5) niceFraction = 1.5;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 3) niceFraction = 3;
  else if (fraction <= 5) niceFraction = 5;
  else if (fraction <= 7.5) niceFraction = 7.5;
  else niceFraction = 10;
  return Math.max(1, niceFraction * magnitude);
}

export function buildTrendChartSeries(
  rawPoints: TrendInputPoint[],
  metric: TrendDiagramMetric,
  options?: {
    width?: number;
    height?: number;
    padLeft?: number;
    padRight?: number;
    padTop?: number;
    padBottom?: number;
  },
): TrendChartSeries {
  const width = options?.width ?? 680;
  const height = options?.height ?? 230;
  const padLeft = options?.padLeft ?? 64;
  const padRight = options?.padRight ?? 20;
  const padTop = options?.padTop ?? 20;
  const padBottom = options?.padBottom ?? 34;

  const usableWidth = Math.max(1, width - padLeft - padRight);
  const usableHeight = Math.max(1, height - padTop - padBottom);
  const baselineY = padTop + usableHeight;

  const normalized = rawPoints.map((pt) => {
    const revenue = Number(pt.revenue) || 0;
    const orders = Number(pt.orders) || 0;
    const averageOrderValue = pt.averageOrderValue != null
      ? Number(pt.averageOrderValue) || 0
      : orders > 0
        ? Number((revenue / orders).toFixed(2))
        : 0;
    const movingAverage7d = pt.movingAverage7d != null && Number.isFinite(Number(pt.movingAverage7d))
      ? Number(pt.movingAverage7d)
      : null;
    const value = metric === 'orders'
      ? orders
      : metric === 'averageOrderValue'
        ? averageOrderValue
        : revenue;

    return {
      label: pt.label,
      shortLabel: formatShortPeriodLabel(pt.label),
      value: Math.max(0, value),
      revenue,
      orders,
      averageOrderValue,
      movingAverage7d,
    };
  });

  const hasMovingAverage = metric === 'revenue'
    && normalized.length >= 2
    && normalized.some((pt) => pt.movingAverage7d != null);

  let rawMax = 0;
  for (const pt of normalized) {
    if (pt.value > rawMax) rawMax = pt.value;
    if (hasMovingAverage && pt.movingAverage7d != null && pt.movingAverage7d > rawMax) {
      rawMax = pt.movingAverage7d;
    }
  }

  const maxValue = metric === 'orders'
    ? (rawMax > 0 ? Math.max(4, niceCeil(rawMax)) : 4)
    : (rawMax > 0 ? niceCeil(rawMax) : 1);

  const yTicks: TrendYTick[] = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const tickVal = metric === 'orders'
      ? Math.round(maxValue * ratio)
      : Number((maxValue * ratio).toFixed(2));
    return {
      value: tickVal,
      y: Number((baselineY - ratio * usableHeight).toFixed(2)),
    };
  });

  const count = normalized.length;
  const points: ComputedTrendPoint[] = normalized.map((pt, index) => {
    const x = count === 1
      ? padLeft + usableWidth / 2
      : padLeft + (index / Math.max(1, count - 1)) * usableWidth;
    const y = baselineY - (pt.value / maxValue) * usableHeight;
    const maY = hasMovingAverage && pt.movingAverage7d != null
      ? Number((baselineY - (Math.max(0, pt.movingAverage7d) / maxValue) * usableHeight).toFixed(2))
      : null;

    return {
      index,
      ...pt,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      maY,
    };
  });

  let linePath = '';
  let areaPath = '';
  let maLinePath = '';

  if (points.length >= 2) {
    linePath = points
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
      .join(' ');
    const first = points[0];
    const last = points[points.length - 1];
    areaPath = `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;

    if (hasMovingAverage) {
      const maPoints = points.filter((pt) => pt.maY != null);
      if (maPoints.length >= 2) {
        maLinePath = maPoints
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.maY}`)
          .join(' ');
      }
    }
  }

  // Pick at most 6 evenly distributed x-axis label indices
  const xLabelIndices: number[] = [];
  if (count > 0) {
    const maxLabels = 6;
    if (count <= maxLabels) {
      for (let i = 0; i < count; i++) xLabelIndices.push(i);
    } else {
      const step = (count - 1) / (maxLabels - 1);
      const seen = new Set<number>();
      for (let i = 0; i < maxLabels; i++) {
        const idx = Math.round(i * step);
        if (!seen.has(idx)) {
          seen.add(idx);
          xLabelIndices.push(idx);
        }
      }
    }
  }

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    baselineY,
    maxValue,
    hasMovingAverage,
    points,
    yTicks,
    xLabelIndices,
    linePath,
    areaPath,
    maLinePath,
  };
}

function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: Number((cx + radius * Math.cos(angleRad)).toFixed(2)),
    y: Number((cy + radius * Math.sin(angleRad)).toFixed(2)),
  };
}

function donutArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function buildDonutSlices(
  items: DonutInputItem[],
  options?: { cx?: number; cy?: number; outerRadius?: number; innerRadius?: number; palette?: string[] },
): { total: number; slices: ComputedDonutSlice[] } {
  const cx = options?.cx ?? 84;
  const cy = options?.cy ?? 84;
  const outerR = options?.outerRadius ?? 68;
  const innerR = options?.innerRadius ?? 42;
  const palette = options?.palette ?? KOGANE_DIAGRAM_PALETTE;

  const positiveItems = items
    .map((item) => ({
      label: item.label || 'Other',
      value: Math.max(0, Number(item.value) || 0),
      count: Math.max(0, Number(item.count ?? 0) || 0),
      color: item.color,
    }))
    .filter((item) => item.value > 0);

  if (positiveItems.length === 0) {
    return { total: 0, slices: [] };
  }

  const total = positiveItems.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return { total: 0, slices: [] };
  }

  let currentAngle = -Math.PI / 2;
  const slices: ComputedDonutSlice[] = positiveItems.map((item, idx) => {
    const ratio = item.value / total;
    const sweep = ratio * Math.PI * 2;
    const isFullCircle = positiveItems.length === 1 || sweep >= Math.PI * 1.999;

    // For a full 360-degree slice, draw two 180-degree ring halves so SVG arc never collapses
    const path = isFullCircle
      ? `${donutArcPath(cx, cy, outerR, innerR, -Math.PI / 2, Math.PI / 2)} ${donutArcPath(cx, cy, outerR, innerR, Math.PI / 2, (Math.PI * 3) / 2)}`
      : donutArcPath(cx, cy, outerR, innerR, currentAngle, currentAngle + sweep);

    currentAngle += sweep;

    return {
      label: item.label,
      value: Number(item.value.toFixed(2)),
      count: item.count,
      percentage: Number((ratio * 100).toFixed(1)),
      color: item.color ?? palette[idx % palette.length],
      path,
      isFullCircle,
    };
  });

  return {
    total: Number(total.toFixed(2)),
    slices,
  };
}

export function buildHorizontalBars(
  items: Array<{ label: string; value: number; secondaryLabel?: string; share?: number }>,
  limit = 6,
  palette: string[] = KOGANE_DIAGRAM_PALETTE,
): HorizontalBarItem[] {
  const sliced = items.slice(0, Math.max(1, limit));
  const maxVal = Math.max(0, ...sliced.map((item) => Math.max(0, Number(item.value) || 0)));

  return sliced.map((item, idx) => {
    const safeVal = Math.max(0, Number(item.value) || 0);
    const widthPct = maxVal > 0 ? Math.max(4, Number(((safeVal / maxVal) * 100).toFixed(1))) : 0;
    return {
      label: item.label || 'Item',
      value: safeVal,
      secondaryLabel: item.secondaryLabel ?? '',
      share: Number((Number(item.share ?? 0) || 0).toFixed(1)),
      widthPct,
      color: palette[idx % palette.length],
    };
  });
}
