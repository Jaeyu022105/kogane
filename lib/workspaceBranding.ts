import { cloneLayout, DEFAULT_LAYOUT_THEME, normalizeLayout, type ElementDef, type UiLayout, type UiLayoutTheme } from '~/lib/uiTypes';

export type LayoutBundleKey = 'aurora-service' | 'ink-studio' | 'paper-ledger';
export type SurfaceStyle = 'rounded' | 'square';
export type ParticleEffect = 'none' | 'floating-orbs' | 'soft-grid';

export interface WorkspaceUiBundle {
  key: LayoutBundleKey;
  label: string;
  description: string;
  swatches: string[];
  primaryBias: string;
  backgroundBias: string;
}

export interface WorkspaceBrandConfig {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  languagePreference?: string;
  uiStyle?: string;
  onboardingPreset?: string | null;
  layoutBundle?: LayoutBundleKey;
  surfaceStyle?: SurfaceStyle;
  particleEffect?: ParticleEffect;
  terminalLayouts?: Record<string, string>;
}

export const UI_LAYOUT_BUNDLES: WorkspaceUiBundle[] = [
  {
    key: 'aurora-service',
    label: 'Aurora Service',
    description: 'Warm hospitality screens with bright accents and gentler contrast for customer-facing stations.',
    swatches: ['#6f2334', '#f3e5d7', '#ff8ca6'],
    primaryBias: '#6f2334',
    backgroundBias: '#120d10',
  },
  {
    key: 'ink-studio',
    label: 'Ink Studio',
    description: 'Sharper operator-first layouts with deeper surfaces and stronger hierarchy for busy teams.',
    swatches: ['#1e293b', '#eef2ff', '#38bdf8'],
    primaryBias: '#1e293b',
    backgroundBias: '#09111d',
  },
  {
    key: 'paper-ledger',
    label: 'Paper Ledger',
    description: 'Editorial panels with lighter boards and grounded accent tones for guided workflows.',
    swatches: ['#51311f', '#fbf4ea', '#d97706'],
    primaryBias: '#51311f',
    backgroundBias: '#18110c',
  },
];

const DEFAULT_BRAND_PRIMARY = '#68293A';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value?: string | null, fallback = DEFAULT_BRAND_PRIMARY) {
  if (!value) return fallback;
  const clean = value.trim().replace('#', '');

  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean.split('').map((item) => `${item}${item}`).join('').toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }

  return fallback;
}

function hexToRgb(hex: string) {
  const clean = normalizeHex(hex).replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(left: string, right: string, ratio: number) {
  const l = hexToRgb(left);
  const r = hexToRgb(right);
  const amount = clamp(ratio, 0, 1);

  return rgbToHex(
    l.r + (r.r - l.r) * amount,
    l.g + (r.g - l.g) * amount,
    l.b + (r.b - l.b) * amount,
  );
}

function alphaHex(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1)})`;
}

function pickBundle(key?: string | null) {
  return UI_LAYOUT_BUNDLES.find((item) => item.key === key) ?? UI_LAYOUT_BUNDLES[0];
}

export function normalizeWorkspaceBrandConfig(raw?: Partial<WorkspaceBrandConfig> | null): Required<WorkspaceBrandConfig> {
  const bundle = pickBundle(raw?.layoutBundle);
  const primary = normalizeHex(raw?.primary, bundle.primaryBias);

  return {
    primary,
    secondary: normalizeHex(raw?.secondary, mixHex(primary, '#f5efe8', 0.68)),
    accent: normalizeHex(raw?.accent, mixHex(primary, '#ff8ca6', 0.4)),
    background: normalizeHex(raw?.background, bundle.backgroundBias),
    languagePreference: raw?.languagePreference ?? 'en',
    uiStyle: raw?.uiStyle ?? 'warm-minimal',
    onboardingPreset: raw?.onboardingPreset ?? null,
    layoutBundle: bundle.key,
    surfaceStyle: raw?.surfaceStyle ?? 'rounded',
    particleEffect: raw?.particleEffect ?? 'none',
    terminalLayouts: raw?.terminalLayouts ?? {},
  };
}

export function buildBusinessPalette(primary: string, bundleKey?: LayoutBundleKey) {
  const bundle = pickBundle(bundleKey);
  const safePrimary = normalizeHex(primary, bundle.primaryBias);

  return {
    primary: safePrimary,
    secondary: mixHex(safePrimary, '#f7f1e8', 0.72),
    accent: mixHex(safePrimary, bundle.swatches[2] ?? '#ff8ca6', 0.45),
    background: mixHex(bundle.backgroundBias, safePrimary, 0.18),
  };
}

export function buildLayoutTheme(config?: Partial<WorkspaceBrandConfig> | null): UiLayoutTheme {
  const resolved = normalizeWorkspaceBrandConfig(config);
  const bundle = pickBundle(resolved.layoutBundle);
  const palette = buildBusinessPalette(resolved.primary, resolved.layoutBundle);
  const frameBase = mixHex(palette.background, resolved.primary, 0.18);
  const canvasBase = bundle.key === 'paper-ledger'
    ? mixHex('#fff9f1', resolved.primary, 0.06)
    : mixHex(frameBase, '#0b0d12', 0.24);
  const panelBase = bundle.key === 'paper-ledger'
    ? mixHex('#fffdf9', resolved.primary, 0.08)
    : mixHex(frameBase, '#11131a', 0.12);
  const panelText = bundle.key === 'paper-ledger' ? mixHex('#2d1d17', resolved.primary, 0.2) : '#f5ede4';
  const mutedText = bundle.key === 'paper-ledger'
    ? alphaHex(mixHex('#59392d', resolved.primary, 0.26), 0.74)
    : alphaHex('#f5ede4', 0.68);
  const border = bundle.key === 'paper-ledger'
    ? alphaHex(mixHex('#b68a72', resolved.primary, 0.2), 0.34)
    : alphaHex(resolved.secondary, 0.16);

  return {
    ...DEFAULT_LAYOUT_THEME,
    frameBackground: frameBase,
    topBarBackground: bundle.key === 'paper-ledger'
      ? alphaHex(mixHex('#ffffff', resolved.primary, 0.05), 0.88)
      : alphaHex(resolved.secondary, 0.08),
    topBarText: panelText,
    canvasBackground: canvasBase,
    gridColor: bundle.key === 'paper-ledger'
      ? alphaHex(mixHex('#a0674f', resolved.primary, 0.25), 0.22)
      : alphaHex(resolved.secondary, 0.22),
    accentColor: resolved.accent,
    panelBackground: panelBase,
    panelHeaderBackground: bundle.key === 'paper-ledger'
      ? alphaHex(mixHex('#ffffff', resolved.primary, 0.06), 0.96)
      : alphaHex(resolved.secondary, 0.08),
    panelText,
    panelMutedText: mutedText,
    panelBorder: border,
    surfaceStyle: resolved.surfaceStyle,
    particleEffect: resolved.particleEffect,
  };
}

function themedRadius(style: SurfaceStyle, small = false) {
  if (style === 'square') return small ? 8 : 12;
  return small ? 18 : 26;
}

function applyElementDefaults(element: ElementDef, theme: UiLayoutTheme, style: SurfaceStyle): ElementDef {
  switch (element.type) {
    case 'button':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.accentColor,
        textColor: element.textColor ?? '#ffffff',
        radius: themedRadius(style, true),
      };
    case 'text':
      return {
        ...element,
        color: element.fontSize >= 24 ? theme.panelText : element.color ?? theme.panelMutedText,
      };
    case 'image':
      return {
        ...element,
        radius: themedRadius(style),
      };
    case 'table-view':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.panelBackground,
        headerBackgroundColor: element.headerBackgroundColor ?? theme.panelHeaderBackground,
        textColor: element.textColor ?? theme.panelText,
      };
    case 'input-field':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.panelHeaderBackground,
        textColor: element.textColor ?? theme.panelText,
        borderColor: element.borderColor ?? theme.panelBorder,
        radius: themedRadius(style, true),
      };
    case 'chart':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.panelBackground,
        textColor: element.textColor ?? theme.panelText,
        colorPalette: element.colorPalette?.length
          ? element.colorPalette
          : [theme.accentColor, mixHex(theme.accentColor, '#38bdf8', 0.42), mixHex(theme.accentColor, '#22c55e', 0.52), mixHex(theme.accentColor, '#f59e0b', 0.62)],
      };
    case 'upload':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.panelHeaderBackground,
        textColor: element.textColor ?? theme.panelText,
        borderColor: element.borderColor ?? theme.panelBorder,
        radius: themedRadius(style),
      };
    case 'cart-widget':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.panelBackground,
        panelColor: element.panelColor ?? theme.panelHeaderBackground,
        textColor: element.textColor ?? theme.panelText,
        accentColor: element.accentColor ?? theme.accentColor,
        borderColor: element.borderColor ?? theme.panelBorder,
        radius: themedRadius(style),
      };
    case 'scan-field':
      return {
        ...element,
        backgroundColor: element.backgroundColor ?? theme.panelHeaderBackground,
        textColor: element.textColor ?? theme.panelText,
        borderColor: element.borderColor ?? theme.panelBorder,
        radius: themedRadius(style, true),
      };
    default:
      return element;
  }
}

export function applyBrandingToLayout(incoming: UiLayout, config?: Partial<WorkspaceBrandConfig> | null) {
  const layout = normalizeLayout(cloneLayout(incoming));
  const resolved = normalizeWorkspaceBrandConfig(config);
  const theme = buildLayoutTheme(resolved);

  layout.theme = theme;
  layout.elements = layout.elements.map((element) => applyElementDefaults(element, theme, resolved.surfaceStyle));
  layout.modals = (layout.modals ?? []).map((modal) => ({
    ...modal,
    elements: modal.elements.map((element) => applyElementDefaults(element, theme, resolved.surfaceStyle)),
  }));

  return layout;
}

export async function extractPaletteFromLogoDataUrl(dataUrl: string, bundleKey?: LayoutBundleKey) {
  if (!import.meta.client) {
    return buildBusinessPalette(DEFAULT_BRAND_PRIMARY, bundleKey);
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error('Unable to read logo image'));
    next.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return buildBusinessPalette(DEFAULT_BRAND_PRIMARY, bundleKey);
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let samples = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let brightest = { score: -1, color: DEFAULT_BRAND_PRIMARY };
  let mostSaturated = { score: -1, color: DEFAULT_BRAND_PRIMARY };

  for (let index = 0; index < data.length; index += 16) {
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    const a = data[index + 3] ?? 0;

    if (a < 120) continue;

    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    if (lightness > 248 && chroma < 10) continue;

    samples += 1;
    totalR += r;
    totalG += g;
    totalB += b;

    if (lightness > brightest.score) {
      brightest = { score: lightness, color: rgbToHex(r, g, b) };
    }

    if (chroma > mostSaturated.score) {
      mostSaturated = { score: chroma, color: rgbToHex(r, g, b) };
    }
  }

  if (!samples) {
    return buildBusinessPalette(DEFAULT_BRAND_PRIMARY, bundleKey);
  }

  const average = rgbToHex(totalR / samples, totalG / samples, totalB / samples);
  const palette = buildBusinessPalette(average, bundleKey);

  return {
    ...palette,
    secondary: mixHex(brightest.color, '#fff7ef', 0.4),
    accent: mixHex(mostSaturated.color, palette.accent, 0.45),
  };
}
