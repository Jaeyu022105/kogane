<script setup lang="ts">
/**
 * Brand kit editor for the settings page: business name, logo, colors, and the terminal style
 * (screen style, corners, background effect), with a live preview of a branded terminal.
 * Saving pushes the new look to every terminal in the workspace.
 */
import CheckIcon from 'reicon-vue/icons/Check';
import UploadIcon from 'reicon-vue/icons/Upload';
import SparklesIcon from 'reicon-vue/icons/Sparkles';
import TrashIcon from 'reicon-vue/icons/Trash';
import TerminalBrandMark from '~/components/TerminalBrandMark.vue';
import { sanitizeImageSrc } from '~/lib/securityClient';
import {
  UI_LAYOUT_BUNDLES,
  buildLayoutTheme,
  extractPaletteFromLogoDataUrl,
  type LayoutBundleKey,
  type ParticleEffect,
  type SurfaceStyle,
} from '~/lib/workspaceBranding';

type ColorKey = 'primary' | 'secondary' | 'accent' | 'background';

const { business, updateTheme } = useBusiness();
const { authHeaders } = useAuth();
const { t } = useLocale();

const businessName = ref('');
const palette = reactive<Record<ColorKey, string>>({
  primary: '#68293A',
  secondary: '#F6E6D7',
  accent: '#FF5776',
  background: '#130d11',
});
const layoutBundle = ref<LayoutBundleKey>('aurora-service');
const surfaceStyle = ref<SurfaceStyle>('rounded');
const particleEffect = ref<ParticleEffect>('none');

const saving = ref(false);
const uploadingLogo = ref(false);
const matchingLogo = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const COLOR_FIELDS = computed<Array<{ key: ColorKey; label: string }>>(() => [
  { key: 'primary', label: t('brandkit_color_primary') },
  { key: 'secondary', label: t('brandkit_color_secondary') },
  { key: 'accent', label: t('brandkit_color_accent') },
  { key: 'background', label: t('brandkit_color_background') },
]);

const EFFECT_OPTIONS = computed<Array<{ value: ParticleEffect; label: string }>>(() => [
  { value: 'none', label: t('brandkit_effect_none') },
  { value: 'floating-orbs', label: t('brandkit_effect_orbs') },
  { value: 'soft-grid', label: t('brandkit_effect_grid') },
]);

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function loadFromBusiness() {
  if (!business.value) return;
  const saved = business.value.colorPalette ?? {};
  businessName.value = business.value.name ?? '';
  palette.primary = saved.primary ?? palette.primary;
  palette.secondary = saved.secondary ?? palette.secondary;
  palette.accent = saved.accent ?? palette.accent;
  palette.background = saved.background ?? palette.background;
  layoutBundle.value = saved.layoutBundle ?? 'aurora-service';
  surfaceStyle.value = saved.surfaceStyle ?? 'rounded';
  particleEffect.value = saved.particleEffect ?? 'none';
}

onMounted(loadFromBusiness);
watch(() => business.value?.id, loadFromBusiness);

const validColors = computed(() => Object.values(palette).every((value) => HEX_PATTERN.test(value.trim())));

const previewTheme = computed(() => buildLayoutTheme(validColors.value
  ? { ...palette, layoutBundle: layoutBundle.value, surfaceStyle: surfaceStyle.value, particleEffect: particleEffect.value }
  : { layoutBundle: layoutBundle.value, surfaceStyle: surfaceStyle.value, particleEffect: particleEffect.value }));
const previewRadius = computed(() => (surfaceStyle.value === 'square' ? '6px' : '14px'));
const logoUrl = computed(() => sanitizeImageSrc(business.value?.logoUrl) || '');

function friendlyError(value: unknown, fallback: string) {
  const message = String((value as Error)?.message ?? value ?? '').toLowerCase();
  if (message.includes('unsupported file') || message.includes('file type')) return t('brandkit_logo_type_error');
  if (message.includes('size') || message.includes('large')) return t('brandkit_logo_size_error');
  return fallback;
}

function flashSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => {
    if (successMessage.value === message) successMessage.value = null;
  }, 3200);
}

function brandPayload() {
  return {
    ...business.value?.colorPalette,
    primary: palette.primary.trim(),
    secondary: palette.secondary.trim(),
    accent: palette.accent.trim(),
    background: palette.background.trim(),
    layoutBundle: layoutBundle.value,
    surfaceStyle: surfaceStyle.value,
    particleEffect: particleEffect.value,
  };
}

async function saveBrandKit() {
  error.value = null;
  successMessage.value = null;

  if (!businessName.value.trim()) {
    error.value = t('brandkit_name_required');
    return;
  }
  if (!validColors.value) {
    error.value = t('brandkit_invalid_color');
    return;
  }

  saving.value = true;
  try {
    const { terminalsUpdated } = await updateTheme(brandPayload(), undefined, undefined, { name: businessName.value.trim() });
    flashSuccess(terminalsUpdated > 0
      ? t('brandkit_saved_terminals', { count: terminalsUpdated })
      : t('settings_theme_saved'));
  } catch (err) {
    error.value = friendlyError(err, t('brandkit_save_error'));
  } finally {
    saving.value = false;
  }
}

function chooseBundle(key: LayoutBundleKey) {
  layoutBundle.value = key;
}

function uploadLogo() {
  if (!import.meta.client) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    uploadingLogo.value = true;
    error.value = null;
    try {
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'png';
      const form = new FormData();
      form.append('file', file);
      form.append('bucket', 'assets');
      form.append('path', `logo.${extension}`);

      const res = await $fetch<{ url: string; error: string | null }>('/api/storage/upload', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: form,
      });
      if (res.error) {
        error.value = friendlyError(res.error, t('brandkit_logo_upload_error'));
        return;
      }

      await updateTheme({ ...(business.value?.colorPalette ?? { primary: palette.primary }) }, res.url);
      flashSuccess(t('brandkit_logo_saved'));
    } catch (err) {
      error.value = friendlyError(err, t('brandkit_logo_upload_error'));
    } finally {
      uploadingLogo.value = false;
    }
  };
  input.click();
}

async function removeLogo() {
  if (!business.value?.logoUrl) return;
  uploadingLogo.value = true;
  error.value = null;
  try {
    await updateTheme({ ...business.value.colorPalette }, null);
    flashSuccess(t('brandkit_logo_removed'));
  } catch (err) {
    error.value = friendlyError(err, t('brandkit_save_error'));
  } finally {
    uploadingLogo.value = false;
  }
}

async function matchColorsToLogo() {
  if (!logoUrl.value) return;
  matchingLogo.value = true;
  error.value = null;
  try {
    const extracted = await extractPaletteFromLogoDataUrl(logoUrl.value, layoutBundle.value);
    palette.primary = extracted.primary;
    palette.secondary = extracted.secondary;
    palette.accent = extracted.accent;
    palette.background = extracted.background;
  } catch {
    error.value = t('brandkit_match_logo_failed');
  } finally {
    matchingLogo.value = false;
  }
}
</script>

<template>
  <section class="space-y-5">
    <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
      <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">{{ t('settings_branding_overline') }}</p>
      <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">{{ t('brandkit_title') }}</h2>
      <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">{{ t('brandkit_body') }}</p>
    </div>

    <!-- Business name -->
    <div class="space-y-1.5">
      <label for="brandkit-name" class="text-[10px] font-mono uppercase tracking-widest block" style="color: rgba(61,24,32,0.4);">
        {{ t('brandkit_name_label') }}
      </label>
      <input
        id="brandkit-name"
        v-model="businessName"
        maxlength="120"
        class="input-warm w-full px-3 py-2 text-sm"
        autocomplete="organization"
      />
      <p class="text-[11px]" style="color: rgba(61,24,32,0.45);">{{ t('brandkit_name_hint') }}</p>
    </div>

    <!-- Logo -->
    <div class="flex flex-wrap items-center gap-4">
      <div
        class="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
        style="background: rgba(61,24,32,0.05); border: 1px solid rgba(61,24,32,0.1);"
      >
        <img v-if="logoUrl" :src="logoUrl" :alt="t('settings_business_logo')" class="w-full h-full object-contain" />
        <span v-else class="text-xs font-mono" style="color: rgba(61,24,32,0.3);">{{ t('settings_logo_short') }}</span>
      </div>
      <div class="flex-1 min-w-[10rem]">
        <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ t('settings_business_logo') }}</p>
        <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">{{ t('settings_logo_formats') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shrink-0 btn-ghost"
          :disabled="uploadingLogo"
          @click="uploadLogo"
        >
          <UploadIcon class="w-3.5 h-3.5" />
          {{ uploadingLogo ? t('settings_uploading') : t('settings_upload') }}
        </button>
        <button
          v-if="logoUrl"
          type="button"
          class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shrink-0 btn-ghost"
          :disabled="matchingLogo"
          @click="matchColorsToLogo"
        >
          <SparklesIcon class="w-3.5 h-3.5" style="color: rgb(232,116,138);" />
          {{ t('brandkit_match_logo') }}
        </button>
        <button
          v-if="logoUrl"
          type="button"
          class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shrink-0 btn-ghost"
          :disabled="uploadingLogo"
          :aria-label="t('brandkit_remove_logo')"
          @click="removeLogo"
        >
          <TrashIcon class="w-3.5 h-3.5" />
          {{ t('brandkit_remove_logo') }}
        </button>
      </div>
    </div>

    <!-- Color swatches preview strip -->
    <div class="flex gap-2 h-2 rounded overflow-hidden">
      <div
        v-for="field in COLOR_FIELDS"
        :key="field.key"
        class="flex-1 transition-colors"
        :style="{ background: palette[field.key] }"
        :title="field.label"
      />
    </div>

    <!-- Color fields -->
    <div class="grid grid-cols-2 gap-4">
      <div v-for="field in COLOR_FIELDS" :key="field.key" class="space-y-2">
        <label :for="`settings-color-${field.key}`" class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">
          {{ field.label }}
        </label>
        <div class="flex items-center gap-2">
          <input
            :id="`settings-color-${field.key}`"
            v-model="palette[field.key]"
            type="color"
            :aria-label="`${field.label} color`"
            class="w-8 h-8 rounded cursor-pointer shrink-0"
            style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; padding: 1px;"
          />
          <input
            :id="`settings-color-value-${field.key}`"
            v-model="palette[field.key]"
            :aria-label="`${field.label} hex value`"
            class="input-warm flex-1 min-w-0 px-3 py-2 text-xs font-mono"
            placeholder="#000000"
          />
        </div>
      </div>
    </div>

    <!-- Terminal style -->
    <div class="space-y-3 pt-1">
      <div>
        <h3 class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ t('brandkit_style_heading') }}</h3>
        <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.45);">{{ t('brandkit_style_hint') }}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" :aria-label="t('brandkit_style_heading')">
        <button
          v-for="bundle in UI_LAYOUT_BUNDLES"
          :key="bundle.key"
          type="button"
          role="radio"
          :aria-checked="layoutBundle === bundle.key"
          class="brandkit-bundle text-left rounded-xl p-3 transition-all"
          :class="{ 'is-active': layoutBundle === bundle.key }"
          @click="chooseBundle(bundle.key)"
        >
          <span class="flex gap-1 mb-2" aria-hidden="true">
            <span v-for="swatch in bundle.swatches" :key="swatch" class="h-3 flex-1 rounded-sm" :style="{ background: swatch }" />
          </span>
          <span class="block text-xs font-semibold" style="color: rgb(var(--shell-sidebar));">{{ bundle.label }}</span>
          <span class="block text-[11px] leading-snug mt-0.5" style="color: rgba(61,24,32,0.5);">{{ bundle.description }}</span>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <fieldset class="space-y-1.5">
          <legend class="text-[10px] font-mono uppercase tracking-widest mb-1.5" style="color: rgba(61,24,32,0.4);">{{ t('brandkit_corners') }}</legend>
          <div class="brandkit-toggle inline-flex rounded-lg p-0.5">
            <button
              v-for="option in (['rounded', 'square'] as const)"
              :key="option"
              type="button"
              class="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
              :class="{ 'is-active': surfaceStyle === option }"
              :aria-pressed="surfaceStyle === option"
              @click="surfaceStyle = option"
            >
              {{ option === 'rounded' ? t('brandkit_corners_rounded') : t('brandkit_corners_square') }}
            </button>
          </div>
        </fieldset>

        <div class="space-y-1.5">
          <label for="brandkit-effect" class="text-[10px] font-mono uppercase tracking-widest block" style="color: rgba(61,24,32,0.4);">{{ t('brandkit_effect') }}</label>
          <select
            id="brandkit-effect"
            v-model="particleEffect"
            class="input-warm w-full px-3 py-2 text-xs cursor-pointer"
            style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; border-radius: 0.5rem; height: 2.25rem;"
          >
            <option v-for="option in EFFECT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Live terminal preview -->
    <div class="space-y-2">
      <h3 class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">{{ t('brandkit_preview_heading') }}</h3>
      <div
        class="brandkit-preview relative overflow-hidden"
        :style="{ background: previewTheme.frameBackground, borderRadius: previewRadius }"
        aria-hidden="true"
      >
        <div
          class="flex items-center justify-between px-3 py-2 border-b"
          :style="{ background: previewTheme.topBarBackground, borderColor: previewTheme.panelBorder }"
        >
          <span class="flex min-w-0 items-center gap-2">
            <TerminalBrandMark :name="businessName" :logo-url="logoUrl" :color="previewTheme.brandColor" size="sm" :rounded="surfaceStyle" />
            <span class="truncate font-serif text-sm" :style="{ color: previewTheme.topBarText }">{{ businessName || t('dashboard_workspace_fallback') }}</span>
            <span class="text-xs" :style="{ color: previewTheme.panelMutedText }">/</span>
            <span class="truncate text-xs font-semibold" :style="{ color: previewTheme.topBarText }">{{ t('brandkit_preview_terminal') }}</span>
          </span>
        </div>

        <div class="relative p-3" :style="{ background: previewTheme.canvasBackground }">
          <div
            v-if="particleEffect === 'floating-orbs'"
            class="pointer-events-none absolute -top-10 right-4 h-32 w-32 blur-2xl opacity-40"
            :style="{ background: `radial-gradient(circle, ${previewTheme.accentColor} 0%, transparent 72%)` }"
          />
          <div
            v-if="particleEffect === 'soft-grid'"
            class="pointer-events-none absolute inset-0 opacity-40"
            :style="{ backgroundImage: `linear-gradient(${previewTheme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${previewTheme.gridColor} 1px, transparent 1px)`, backgroundSize: '18px 18px' }"
          />

          <div class="relative grid grid-cols-[1fr_auto] gap-3 items-end">
            <div
              class="overflow-hidden border text-[11px]"
              :style="{ background: previewTheme.panelBackground, borderColor: previewTheme.panelBorder, borderRadius: previewRadius, color: previewTheme.panelText }"
            >
              <div class="flex justify-between px-2.5 py-1.5 font-semibold" :style="{ background: previewTheme.panelHeaderBackground }">
                <span>{{ t('brandkit_preview_item') }}</span>
                <span class="font-mono tabular-nums">{{ business?.currencySymbol ?? '$' }}</span>
              </div>
              <div class="flex justify-between px-2.5 py-1.5" :style="{ color: previewTheme.panelMutedText }">
                <span>{{ t('brandkit_preview_row') }}</span>
                <span class="font-mono tabular-nums">4.50</span>
              </div>
            </div>
            <span
              class="px-3 py-2 text-xs font-semibold"
              :style="{ background: previewTheme.accentColor, color: previewTheme.accentTextColor, borderRadius: surfaceStyle === 'square' ? '6px' : '12px' }"
            >
              {{ t('brandkit_preview_button') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback -->
    <div
      v-if="error"
      role="alert"
      class="text-xs px-3 py-2 rounded"
      style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
    >
      {{ error }}
    </div>

    <div
      v-if="successMessage"
      role="status"
      class="text-xs px-3 py-2 rounded flex items-center gap-1.5"
      style="background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.18); color: #15803d;"
    >
      <CheckIcon class="w-3.5 h-3.5" /> {{ successMessage }}
    </div>

    <button
      type="button"
      class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] btn-primary btn-ribbon"
      :disabled="saving"
      @click="saveBrandKit"
    >
      {{ saving ? t('settings_saving') : t('settings_save_theme') }}
    </button>
  </section>
</template>

<style scoped>
.brandkit-bundle {
  border: 1.5px solid rgba(61, 24, 32, 0.1);
  background: #ffffff;
}

.brandkit-bundle:hover {
  border-color: rgba(255, 87, 118, 0.5);
}

.brandkit-bundle.is-active {
  border-color: #FF5776;
  box-shadow: 0 0 0 3px rgba(255, 87, 118, 0.12);
}

.brandkit-toggle {
  border: 1.5px solid rgba(61, 24, 32, 0.12);
}

.brandkit-toggle button {
  color: rgba(61, 24, 32, 0.6);
}

.brandkit-toggle button.is-active {
  background: #68293A;
  color: #ffffff;
}

.brandkit-preview {
  border: 1px solid rgba(61, 24, 32, 0.12);
  box-shadow: 0 10px 30px -18px rgba(61, 24, 32, 0.45);
}
</style>
