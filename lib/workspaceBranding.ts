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
  country?: string;
  currency?: string;
  currencySymbol?: string;
  uiStyle?: string;
  onboardingPreset?: string | null;
  layoutBundle?: LayoutBundleKey;
  surfaceStyle?: SurfaceStyle;
  particleEffect?: ParticleEffect;
  terminalLayouts?: Record<string, string>;
}

/** What a running terminal shows of the business: name, logo, and the two brand colors. */
export interface TerminalBrandInfo {
  name: string;
  logoUrl: string | null;
  initials: string;
  primary: string;
  accent: string;
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

export function isLightColor(color?: string | null): boolean {
  if (!color) return false;
  const str = color.trim().toLowerCase();
  if (str === 'white' || str === '#fff' || str === '#ffffff') return true;
  if (str === 'transparent') return false;

  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return (r * 299 + g * 587 + b * 114) / 1000 > 135;
  }

  const hex = str.replace('#', '');
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 135;
  }
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 135;
  }

  return false;
}

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
    accent: normalizeHex(raw?.accent, bundle.swatches[2] ?? '#ff8ca6'),
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

/**
 * Relative luminance (WCAG) of a hex color, 0 = black, 1 = white.
 */
function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Picks white or a deep ink for text placed on top of `background`.
 * Typical brand colors keep white text; only pale accents (yellow, pastel, cream) flip to dark ink.
 */
export function readableTextColor(background?: string | null) {
  if (!background || !/^#?[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(background.trim())) return '#ffffff';
  return relativeLuminance(normalizeHex(background)) > 0.45 ? '#1f1418' : '#ffffff';
}

/** Up to two initials from a business name, used when no logo has been uploaded. */
export function brandInitials(name?: string | null) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'K';
  const letters = words.length === 1
    ? Array.from(words[0]).slice(0, 2).join('')
    : `${Array.from(words[0])[0] ?? ''}${Array.from(words[words.length - 1])[0] ?? ''}`;
  return letters.toUpperCase() || 'K';
}

interface BundleSurfaces {
  frameBackground: string;
  topBarBackground: string;
  topBarText: string;
  canvasBackground: string;
  gridColor: string;
  defaultAccent: string;
  panelBackground: string;
  panelHeaderBackground: string;
  panelText: string;
  panelMutedText: string;
  panelBorder: string;
}

const BUNDLE_SURFACES: Record<LayoutBundleKey, BundleSurfaces> = {
  'paper-ledger': {
    frameBackground: '#ede4d8',
    topBarBackground: 'rgba(255, 255, 255, 0.94)',
    topBarText: '#261a14',
    canvasBackground: '#faf6f0',
    gridColor: 'rgba(81, 49, 31, 0.12)',
    defaultAccent: '#d97706',
    panelBackground: '#ffffff',
    panelHeaderBackground: '#f5ede2',
    panelText: '#261a14',
    panelMutedText: 'rgba(38, 26, 20, 0.68)',
    panelBorder: 'rgba(81, 49, 31, 0.16)',
  },
  'ink-studio': {
    frameBackground: '#0b111c',
    topBarBackground: 'rgba(17, 28, 46, 0.92)',
    topBarText: '#eef2ff',
    canvasBackground: '#0d1524',
    gridColor: 'rgba(238, 242, 255, 0.08)',
    defaultAccent: '#38bdf8',
    panelBackground: '#111c2e',
    panelHeaderBackground: 'rgba(238, 242, 255, 0.08)',
    panelText: '#eef2ff',
    panelMutedText: 'rgba(238, 242, 255, 0.65)',
    panelBorder: 'rgba(238, 242, 255, 0.14)',
  },
  'aurora-service': {
    frameBackground: '#130d11',
    topBarBackground: 'rgba(255, 255, 255, 0.04)',
    topBarText: '#f5ede4',
    canvasBackground: '#111118',
    gridColor: 'rgba(255, 255, 255, 0.08)',
    defaultAccent: '#ff8ca6',
    panelBackground: '#161116',
    panelHeaderBackground: 'rgba(255, 255, 255, 0.06)',
    panelText: '#f5ede4',
    panelMutedText: 'rgba(245, 237, 228, 0.68)',
    panelBorder: 'rgba(255, 255, 255, 0.08)',
  },
};

export function buildLayoutTheme(config?: Partial<WorkspaceBrandConfig> | null): UiLayoutTheme {
  const resolved = normalizeWorkspaceBrandConfig(config);
  const bundle = pickBundle(resolved.layoutBundle);
  const surfaces = BUNDLE_SURFACES[bundle.key];
  const accentColor = config?.accent ? normalizeHex(config.accent, surfaces.defaultAccent) : surfaces.defaultAccent;
  const brandColor = normalizeHex(config?.primary, bundle.primaryBias);
  const isPaper = bundle.key === 'paper-ledger';

  // Only an explicit business primary tints the frame; panels stay neutral so data stays easy to read.
  const tint = config?.primary
    ? {
        frameBackground: mixHex(surfaces.frameBackground, brandColor, isPaper ? 0.1 : 0.16),
        canvasBackground: mixHex(surfaces.canvasBackground, brandColor, isPaper ? 0.04 : 0.08),
        gridColor: alphaHex(isPaper ? brandColor : mixHex(brandColor, '#ffffff', 0.6), isPaper ? 0.12 : 0.1),
      }
    : {};

  return {
    frameBackground: surfaces.frameBackground,
    topBarBackground: surfaces.topBarBackground,
    topBarText: surfaces.topBarText,
    canvasBackground: surfaces.canvasBackground,
    gridColor: surfaces.gridColor,
    ...tint,
    accentColor,
    accentTextColor: readableTextColor(accentColor),
    brandColor,
    panelBackground: surfaces.panelBackground,
    panelHeaderBackground: surfaces.panelHeaderBackground,
    panelText: surfaces.panelText,
    panelMutedText: surfaces.panelMutedText,
    panelBorder: surfaces.panelBorder,
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
        backgroundColor: theme.accentColor,
        textColor: theme.accentTextColor ?? '#ffffff',
        radius: themedRadius(style, true),
      };
    case 'text':
      return {
        ...element,
        color: element.fontSize >= 22 ? theme.panelText : theme.panelMutedText,
      };
    case 'image':
      return {
        ...element,
        radius: themedRadius(style),
      };
    case 'table-view':
      return {
        ...element,
        backgroundColor: theme.panelBackground,
        headerBackgroundColor: theme.panelHeaderBackground,
        textColor: theme.panelText,
      };
    case 'input-field':
      return {
        ...element,
        backgroundColor: theme.panelHeaderBackground,
        textColor: theme.panelText,
        borderColor: theme.panelBorder,
        radius: themedRadius(style, true),
      };
    case 'chart':
      return {
        ...element,
        backgroundColor: theme.panelBackground,
        textColor: theme.panelText,
        colorPalette: theme.panelText === '#261a14'
          ? ['#d97706', '#0284c7', '#16a34a', '#dc2626']
          : theme.accentColor === '#38bdf8'
            ? ['#38bdf8', '#818cf8', '#34d399', '#f472b6']
            : [theme.accentColor, '#38bdf8', '#22c55e', '#f59e0b'],
      };
    case 'upload':
      return {
        ...element,
        backgroundColor: theme.panelHeaderBackground,
        textColor: theme.panelText,
        borderColor: theme.panelBorder,
        radius: themedRadius(style),
      };
    case 'cart-widget':
      return {
        ...element,
        backgroundColor: theme.panelBackground,
        panelColor: theme.panelHeaderBackground,
        textColor: theme.panelText,
        accentColor: theme.accentColor,
        borderColor: theme.panelBorder,
        radius: themedRadius(style),
      };
    case 'scan-field':
      return {
        ...element,
        backgroundColor: theme.panelHeaderBackground,
        textColor: theme.panelText,
        borderColor: theme.panelBorder,
        radius: themedRadius(style, true),
      };
    default:
      return element;
  }
}

export function applyBrandingToLayout(incoming: UiLayout, config?: Partial<WorkspaceBrandConfig> | null) {
  const layout = normalizeLayout(cloneLayout(incoming));
  const resolved = normalizeWorkspaceBrandConfig(config);
  const theme = buildLayoutTheme(config);

  layout.theme = theme;
  layout.elements = layout.elements.map((element) => applyElementDefaults(element, theme, resolved.surfaceStyle));
  layout.modals = (layout.modals ?? []).map((modal) => ({
    ...modal,
    elements: modal.elements.map((element) => applyElementDefaults(element, theme, resolved.surfaceStyle)),
  }));

  return layout;
}

/** Brand keys a single terminal may override on top of the workspace brand kit. */
export const TERMINAL_BRAND_OVERRIDE_KEYS = ['layoutBundle', 'accent', 'surfaceStyle', 'particleEffect'] as const;

/**
 * Combines the workspace brand kit with a terminal's own style override.
 * The workspace supplies the brand colors and defaults; the terminal only wins on the keys it overrides.
 */
export function mergeTerminalBrandConfig(
  workspace?: Partial<WorkspaceBrandConfig> | null,
  terminalOverride?: Partial<WorkspaceBrandConfig> | null,
): Partial<WorkspaceBrandConfig> {
  const merged: Partial<WorkspaceBrandConfig> = { ...(workspace ?? {}) };
  if (!terminalOverride) return merged;

  for (const key of TERMINAL_BRAND_OVERRIDE_KEYS) {
    const value = terminalOverride[key];
    if (value !== undefined && value !== null && value !== '') {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function sameValue(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) return JSON.stringify(left) === JSON.stringify(right);
  if (typeof left === 'string' && typeof right === 'string') return left.trim().toLowerCase() === right.trim().toLowerCase();
  return left === right;
}

function rebrandElement(element: ElementDef, previous: UiLayoutTheme, next: UiLayoutTheme, nextStyle: SurfaceStyle): ElementDef {
  const previousStyle: SurfaceStyle = previous.surfaceStyle === 'square' ? 'square' : 'rounded';
  const previousDefaults = applyElementDefaults(element, previous, previousStyle) as unknown as Record<string, unknown>;
  const nextDefaults = applyElementDefaults(element, next, nextStyle) as unknown as Record<string, unknown>;
  const current = element as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...current };

  for (const [key, nextValue] of Object.entries(nextDefaults)) {
    if (sameValue(current[key], nextValue)) continue;
    // Only move values that still match the old theme default; anything styled by hand stays put.
    if (current[key] === undefined || sameValue(current[key], previousDefaults[key])) {
      out[key] = nextValue;
    }
  }
  return out as unknown as ElementDef;
}

/**
 * Re-themes an existing terminal layout after the brand kit changes.
 * Unlike `applyBrandingToLayout`, it keeps colors and corner radii that were customized in the builder.
 */
export function rebrandLayout(incoming: UiLayout, config?: Partial<WorkspaceBrandConfig> | null) {
  const layout = normalizeLayout(cloneLayout(incoming));
  const previous = layout.theme ?? DEFAULT_LAYOUT_THEME;
  const resolved = normalizeWorkspaceBrandConfig(config);
  const next = buildLayoutTheme(config);

  layout.theme = next;
  layout.elements = layout.elements.map((element) => rebrandElement(element, previous, next, resolved.surfaceStyle));
  layout.modals = (layout.modals ?? []).map((modal) => ({
    ...modal,
    elements: modal.elements.map((element) => rebrandElement(element, previous, next, resolved.surfaceStyle)),
  }));

  return layout;
}

export async function extractPaletteFromLogoDataUrl(dataUrl: string, bundleKey?: LayoutBundleKey) {
  if (!import.meta.client) {
    return buildBusinessPalette(DEFAULT_BRAND_PRIMARY, bundleKey);
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    // Uploaded logos may live on a storage host; ask for CORS so the canvas can read its pixels.
    if (!dataUrl.startsWith('data:')) next.crossOrigin = 'anonymous';
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
