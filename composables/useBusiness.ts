/**
 * useBusiness — fetches and caches the admin's business profile.
 * Provides theme injection into CSS variables so every page reflects the brand.
 */

import { ref, watch } from 'vue';
import { useAuth } from './useAuth';

export interface ColorPalette {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  languagePreference?: string;
  uiStyle?: string;
  onboardingPreset?: string | null;
  layoutBundle?: 'aurora-service' | 'ink-studio' | 'paper-ledger';
  surfaceStyle?: 'rounded' | 'square';
  particleEffect?: 'none' | 'floating-orbs' | 'soft-grid';
  terminalLayouts?: Record<string, string>;
}

export interface Business {
  id: string;
  name: string;
  logoUrl: string | null;
  colorPalette: ColorPalette;
  schemaName: string;
  createdAt: string;
}

const business = ref<Business | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

function hexToRgb(hex: string): string {
  let clean = String(hex ?? '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    clean = clean.split('').map((value) => `${value}${value}`).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '104 41 58';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Inject CSS variables from the business color palette into :root. */
function applyTheme(palette: ColorPalette) {
  const root = document.documentElement;
  if (palette.primary) root.style.setProperty('--color-primary', hexToRgb(palette.primary));
  if (palette.secondary) root.style.setProperty('--color-secondary', hexToRgb(palette.secondary));
  if (palette.accent) root.style.setProperty('--color-accent', hexToRgb(palette.accent));
  if (palette.background) root.style.setProperty('--color-background', hexToRgb(palette.background));
}

export function useBusiness() {
  const { authHeaders } = useAuth();

  async function fetchBusiness() {
    loading.value = true;
    error.value = null;

    try {
      const res = await $fetch<{ business: any; error: string | null }>('/api/businesses/me', {
        headers: authHeaders(),
      });

      if (res.error || !res.business) {
        business.value = null;
        error.value = res.error ? 'We could not load the business workspace right now.' : 'No business found';
        return;
      }

      const raw = res.business;
      let palette: ColorPalette;

      try {
        palette = typeof raw.color_palette === 'string'
          ? JSON.parse(raw.color_palette)
          : (raw.color_palette ?? {});
      } catch {
        palette = {} as ColorPalette;
      }

      business.value = {
        id: raw.id,
        name: raw.name,
        logoUrl: raw.logo_url ?? null,
        colorPalette: palette,
        schemaName: raw.schema_name,
        createdAt: raw.created_at,
      };

      applyTheme(palette);
      if (palette.languagePreference) {
        const { setLocale } = useLocale();
        setLocale(palette.languagePreference);
      }
    } catch {
      business.value = null;
      error.value = 'We could not load the business workspace right now.';
    } finally {
      loading.value = false;
    }
  }

  async function updateTheme(palette: ColorPalette, logoUrl?: string) {
    const res = await $fetch<{ success?: boolean; error?: string | null }>('/api/businesses/theme', {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: { colorPalette: palette, logoUrl },
    });

    if (res.error || res.success === false) {
      throw new Error(res.error ?? 'Unable to save workspace settings');
    }

    if (business.value) {
      business.value.colorPalette = palette;
      applyTheme(palette);
    }
  }

  return { business, loading, error, fetchBusiness, updateTheme };
}
