<script setup lang="ts">
/**
 * Settings page — business branding, theme colors, country & currency, and workspace creation.
 */

definePageMeta({ layout: 'dashboard' });

import { Check, Globe, Sparkles, Upload } from 'lucide-vue-next';
import { COUNTRIES, findCountry } from '~/lib/currency';

const { business, fetchBusiness, updateTheme, updateCountry } = useBusiness();
const { openOnboarding }                     = useOnboarding();
const { t, availableLocales, setLocale, locale } = useLocale();

const saving        = ref(false);
const savingCountry = ref(false);
const uploadingLogo = ref(false);
const error         = ref<string | null>(null);
const success       = ref(false);
const countrySuccess = ref(false);

const selectedLanguage = ref(locale.value);
const selectedCountry  = ref(business.value?.country ?? 'US');

const currentCountryRecord = computed(() => findCountry(selectedCountry.value));

function friendlySettingsError(value: unknown, fallback: string) {
  const message = String(value ?? '').toLowerCase();
  if (message.includes('unsupported file') || message.includes('file type')) {
    return 'Choose a PNG, JPEG, WebP, SVG, or GIF image.';
  }
  if (message.includes('size') || message.includes('large')) {
    return 'Choose an image smaller than 5 MB.';
  }
  return fallback;
}

watch(locale, (newLoc) => {
  selectedLanguage.value = newLoc;
});

const palette = reactive({
  primary:    '#3b82f6',
  secondary:  '#6366f1',
  accent:     '#a855f7',
  background: '#0f0f17',
});

onMounted(async () => {
  if (!business.value) await fetchBusiness();

  if (business.value) {
    palette.primary    = business.value.colorPalette.primary    ?? palette.primary;
    palette.secondary  = business.value.colorPalette.secondary  ?? palette.secondary;
    palette.accent     = business.value.colorPalette.accent     ?? palette.accent;
    palette.background = business.value.colorPalette.background ?? palette.background;
    selectedLanguage.value = business.value.colorPalette.languagePreference ?? locale.value;
    selectedCountry.value = business.value.country ?? 'US';
  }
});

watch(() => business.value?.country, (newCountry) => {
  if (newCountry) {
    selectedCountry.value = newCountry;
  }
});

async function saveTheme() {
  saving.value  = true;
  error.value   = null;
  success.value = false;

  const invalidColor = Object.values(palette).some((value) => !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim()));
  if (invalidColor) {
    error.value = 'Use a valid hex colour such as #68293A for each colour.';
    saving.value = false;
    return;
  }

  try {
    setLocale(selectedLanguage.value);
    const updatedPalette = {
      ...business.value?.colorPalette,
      ...palette,
      languagePreference: selectedLanguage.value,
      country: currentCountryRecord.value.code,
      currency: currentCountryRecord.value.currency,
      currencySymbol: currentCountryRecord.value.symbol,
    };
    await updateTheme(updatedPalette, undefined, {
      country: currentCountryRecord.value.code,
      currency: currentCountryRecord.value.currency,
      currencySymbol: currentCountryRecord.value.symbol,
    });
    success.value = true;
    setTimeout(() => (success.value = false), 2500);
  } catch (err) {
    error.value = friendlySettingsError(err, 'We could not save the workspace settings. Please try again.');
  } finally {
    saving.value = false;
  }
}

async function saveCountrySettings() {
  savingCountry.value = true;
  error.value = null;
  countrySuccess.value = false;

  try {
    const c = findCountry(selectedCountry.value);
    await updateCountry(c.code);
    countrySuccess.value = true;
    setTimeout(() => (countrySuccess.value = false), 2500);
  } catch (err) {
    error.value = friendlySettingsError(err, 'We could not save the country settings. Please try again.');
  } finally {
    savingCountry.value = false;
  }
}

async function changeLanguage() {
  setLocale(selectedLanguage.value);
  if (business.value) {
    const updatedPalette = {
      ...business.value.colorPalette,
      languagePreference: selectedLanguage.value,
    };
    try {
      await updateTheme(updatedPalette);
    } catch (err) {
      error.value = friendlySettingsError(err, 'We could not save the language preference. Please try again.');
    }
  }
}

async function uploadLogo() {
  if (!import.meta.client) return;

  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
  input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    uploadingLogo.value = true;
    error.value         = null;

    try {
      const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'png';
      const form = new FormData();
      form.append('file',   file);
      form.append('bucket', 'assets');
      form.append('path',   `logo.${ext}`);

      const res = await $fetch<{ url: string; error: string | null }>('/api/storage/upload', {
        method: 'POST',
        body:   form,
      });

      if (res.error) {
        error.value = friendlySettingsError(res.error, 'We could not upload the logo. Please try again.');
        return;
      }

      await updateTheme({ ...business.value?.colorPalette, ...palette }, res.url);
      if (business.value) business.value.logoUrl = res.url;
    } catch (err) {
      error.value = friendlySettingsError(err, 'We could not upload the logo. Please try again.');
    } finally {
      uploadingLogo.value = false;
    }
  };
}

const COLOR_FIELDS: Array<{ key: keyof typeof palette; label: string }> = [
  { key: 'primary',    label: 'Primary' },
  { key: 'secondary',  label: 'Secondary' },
  { key: 'accent',     label: 'Accent' },
  { key: 'background', label: 'Background' },
];

const businessDetailItems = computed(() => {
  if (!business.value) return [];

  return [
    { label: 'Business name', value: business.value.name },
    { label: 'Country', value: currentCountryRecord.value.name },
    { label: 'Currency', value: `${currentCountryRecord.value.symbol} ${currentCountryRecord.value.currency}` },
    { label: 'Started', value: new Date(business.value.createdAt).toLocaleDateString() },
  ];
});
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">{{ t('settings_title') }}</h1>
      <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">{{ t('settings_subtitle') }}</p>
    </div>

    <div class="px-10 py-8 max-w-xl space-y-10">

      <!-- ── No business yet ───────────────────────────────────── -->
      <section v-if="!business" class="space-y-4">
        <div>
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-2" style="color: rgba(61,24,32,0.3);">{{ t('settings_setup_overline') }}</p>
          <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">{{ t('settings_create_workspace') }}</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.45);">{{ t('settings_create_workspace_body') }}</p>
        </div>

        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ error }}
        </div>

        <button
          class="w-full py-3 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] btn-primary btn-ribbon"
          @click="openOnboarding"
        >
          {{ t('settings_open_setup_wizard') }}
        </button>
      </section>

      <!-- ── Country & Currency ─────────────────────────────────── -->
      <section v-if="business" class="space-y-4">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">Regional Settings</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Country & Currency</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">
            Select your country to set the platform-wide currency across all cashier registers, product tiles, receipts, reports, and exports.
          </p>
        </div>

        <div>
          <label for="settings-country" class="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style="color: rgba(61,24,32,0.4);">
            Country
          </label>
          <select
            id="settings-country"
            v-model="selectedCountry"
            class="input-warm w-full px-3 py-2 text-xs cursor-pointer"
            style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; border-radius: 0.5rem; height: 2.5rem;"
            @change="saveCountrySettings"
          >
            <option
              v-for="c in COUNTRIES"
              :key="c.code"
              :value="c.code"
            >
              {{ c.name }} ({{ c.symbol }} {{ c.currency }})
            </option>
          </select>
        </div>

        <!-- Currency summary box -->
        <div
          class="flex items-center justify-between p-3.5 rounded-xl transition-all"
          style="background: rgba(61,24,32,0.025); border: 1px solid rgba(61,24,32,0.08);"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style="background: rgba(61,24,32,0.06); color: rgb(var(--shell-sidebar));">
              {{ currentCountryRecord.symbol }}
            </div>
            <div>
              <p class="text-xs font-semibold" style="color: rgb(var(--shell-sidebar));">
                {{ currentCountryRecord.currency }} · {{ currentCountryRecord.name }}
              </p>
              <p class="text-[10px]" style="color: rgba(61,24,32,0.45);">
                Symbol: {{ currentCountryRecord.symbol }} · Standard precision: {{ currentCountryRecord.decimals }} decimal places
              </p>
            </div>
          </div>
          <span class="text-[11px] font-mono font-medium px-2 py-0.5 rounded" style="background: rgba(16,185,129,0.1); color: #059669;">
            Active
          </span>
        </div>

        <div
          v-if="countrySuccess"
          class="text-xs px-3 py-2 rounded flex items-center gap-1.5"
          style="background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.18); color: #15803d;"
        >
          <Check class="w-3.5 h-3.5" /> Country and currency updated platform-wide.
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] btn-primary btn-ribbon"
          :disabled="savingCountry"
          @click="saveCountrySettings"
        >
          {{ savingCountry ? 'Saving…' : 'Save Country & Currency' }}
        </button>
      </section>

      <!-- ── Brand Colors ──────────────────────────────────────── -->
      <section v-if="business" class="space-y-5">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">{{ t('settings_branding_overline') }}</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">{{ t('settings_brand_colors') }}</h2>
        </div>

        <!-- Logo -->
        <div class="flex items-center gap-4">
          <div
            class="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
            style="background: rgba(61,24,32,0.05); border: 1px solid rgba(61,24,32,0.1);"
          >
            <img v-if="business.logoUrl" :src="business.logoUrl" :alt="t('settings_business_logo')" class="w-full h-full object-cover" />
            <span v-else class="text-xs font-mono" style="color: rgba(61,24,32,0.3);">{{ t('settings_logo_short') }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">{{ t('settings_business_logo') }}</p>
            <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">{{ t('settings_logo_formats') }}</p>
          </div>
          <button
            class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shrink-0 btn-ghost"
            :disabled="uploadingLogo"
            @click="uploadLogo"
          >
            <Upload class="w-3.5 h-3.5" />
            {{ uploadingLogo ? t('settings_uploading') : t('settings_upload') }}
          </button>
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
                type="color"
                :id="`settings-color-${field.key}`"
                :aria-label="`${field.label} color`"
                v-model="palette[field.key]"
                class="w-8 h-8 rounded cursor-pointer shrink-0"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; padding: 1px;"
              />
              <input
                :id="`settings-color-value-${field.key}`"
                :aria-label="`${field.label} hex value`"
                v-model="palette[field.key]"
                class="input-warm flex-1 px-3 py-2 text-xs font-mono"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Feedback -->
        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ error }}
        </div>

        <div
          v-if="success"
          class="text-xs px-3 py-2 rounded flex items-center gap-1.5"
          style="background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.18); color: #15803d;"
        >
          <Check class="w-3.5 h-3.5" /> {{ t('settings_theme_saved') }}
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] btn-primary btn-ribbon"
          :disabled="saving"
          @click="saveTheme"
        >
          {{ saving ? t('settings_saving') : t('settings_save_theme') }}
        </button>
      </section>

      <!-- ── Business Info ──────────────────────────────────────── -->
      <section v-if="business" class="space-y-3">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">{{ t('settings_info_overline') }}</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">{{ t('settings_business_details') }}</h2>
        </div>

        <div class="space-y-0">
          <div
            v-for="(item, i) in businessDetailItems"
            :key="i"
            class="flex items-center justify-between py-3"
            style="border-bottom: 1px solid rgba(61,24,32,0.06);"
          >
            <span class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">
              {{ item.label }}
            </span>
            <span class="text-xs font-mono" style="color: rgba(61,24,32,0.6);">{{ item.value }}</span>
          </div>
        </div>
      </section>

      <!-- ── Workspace Setup ────────────────────────────────────── -->
      <section v-if="business" class="space-y-3">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">{{ t('settings_onboarding_overline') }}</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">{{ t('settings_workspace_setup') }}</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">{{ t('settings_workspace_setup_body') }}</p>
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 btn-ghost"
          @click="openOnboarding"
        >
          <Sparkles class="w-4 h-4" style="color: rgb(232,116,138);" />
          {{ t('settings_open_setup_wizard') }}
        </button>
      </section>

      <!-- ── System Language ────────────────────────────────────── -->
      <section class="space-y-3">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">{{ t('settings_system_overline') }}</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">{{ t('settings_language') }}</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">{{ t('settings_language_desc') }}</p>
        </div>

        <label for="settings-language" class="sr-only">{{ t('settings_language') }}</label>
        <select
          id="settings-language"
          v-model="selectedLanguage"
          class="input-warm w-full px-3 py-2 text-xs"
          style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; border-radius: 0.5rem; height: 2.25rem;"
          @change="changeLanguage"
        >
          <option
            v-for="lang in availableLocales"
            :key="lang.code"
            :value="lang.code"
          >
            {{ lang.label }} ({{ lang.nativeLabel }})
          </option>
        </select>
      </section>

    </div>
  </div>
</template>
