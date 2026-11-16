<script setup lang="ts">
/**
 * Settings page — business branding, theme colors, country & currency, and workspace creation.
 */

definePageMeta({ layout: 'dashboard' });

import CheckIcon from 'reicon-vue/icons/Check';
import GlobeIcon from 'reicon-vue/icons/Globe';
import SparklesIcon from 'reicon-vue/icons/Sparkles';
import UploadIcon from 'reicon-vue/icons/Upload';
import LockIcon from 'reicon-vue/icons/Lock';
import ShieldCheckIcon from 'reicon-vue/icons/ShieldCheck';
import EyeIcon from 'reicon-vue/icons/Eye';
import EyeOffIcon from 'reicon-vue/icons/EyeOff';
import KeyIcon from 'reicon-vue/icons/Key';
import LaptopIcon from 'reicon-vue/icons/Laptop';
import LogoutIcon from 'reicon-vue/icons/Logout';
import { COUNTRIES, findCountry } from '~/lib/currency';
import { sanitizeImageSrc } from '~/lib/securityClient';

const { session, authHeaders, setSession, hydrateSession } = useAuth();
const { business, fetchBusiness, updateTheme, updateCountry } = useBusiness();
const { openOnboarding }                     = useOnboarding();
const { t, availableLocales, setLocale, locale } = useLocale();

const saving        = ref(false);
const savingCountry = ref(false);
const uploadingLogo = ref(false);
const error         = ref<string | null>(null);
const success       = ref(false);
const countrySuccess = ref(false);

// Password management state
const currentPassword = ref('');
const newPassword = ref('');
const confirmNewPassword = ref('');
const currentPasswordVisible = ref(false);
const newPasswordVisible = ref(false);
const confirmPasswordVisible = ref(false);
const changingPassword = ref(false);
const passwordError = ref<string | null>(null);
const passwordSuccess = ref(false);

async function handlePasswordChange() {
  passwordError.value = null;
  passwordSuccess.value = false;

  if (!currentPassword.value || !newPassword.value) {
    passwordError.value = 'Please provide both current and new password.';
    return;
  }
  if (newPassword.value.length < 6) {
    passwordError.value = 'New password must be at least 6 characters.';
    return;
  }
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = 'New passwords do not match.';
    return;
  }

  changingPassword.value = true;
  try {
    const res = await $fetch<{ success?: boolean; error?: string | null; message?: string }>('/api/auth/change-password', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmNewPassword.value,
      },
    });

    if (res.error || !res.success) {
      passwordError.value = res.error || 'Failed to update password.';
      return;
    }

    passwordSuccess.value = true;
    currentPassword.value = '';
    newPassword.value = '';
    confirmNewPassword.value = '';
    void loadSessions();
    setTimeout(() => { passwordSuccess.value = false; }, 3500);
  } catch (err: any) {
    passwordError.value = err?.data?.error || err?.message || 'Failed to update password.';
  } finally {
    changingPassword.value = false;
  }
}

// ── Two-Factor Authentication (2FA) ───────────────────────────────────────────
const twoFactorLoading = ref(false);
const twoFactorError = ref<string | null>(null);
const twoFactorNotice = ref<string | null>(null);
const twoFactorQr = ref('');
const twoFactorSecret = ref('');
const twoFactorOtp = ref('');
const twoFactorBackupCodes = ref<string[]>([]);
const twoFactorActionPassword = ref('');
const twoFactorDisableCode = ref('');
const showDisable2fa = ref(false);

async function beginTwoFactorSetup() {
  twoFactorError.value = null;
  twoFactorNotice.value = null;
  twoFactorBackupCodes.value = [];
  twoFactorLoading.value = true;
  try {
    const res = await $fetch<{
      secret: string;
      qrCodeDataUrl: string;
      error: string | null;
    }>('/api/auth/2fa/setup', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
    });
    if (res.error || !res.secret) {
      twoFactorError.value = res.error || 'Could not initialize 2FA setup.';
      return;
    }
    twoFactorSecret.value = res.secret;
    twoFactorQr.value = res.qrCodeDataUrl;
    twoFactorOtp.value = '';
  } catch (err: any) {
    twoFactorError.value = err?.data?.error || err?.message || 'Could not initialize 2FA setup.';
  } finally {
    twoFactorLoading.value = false;
  }
}

async function activateTwoFactor() {
  twoFactorError.value = null;
  twoFactorNotice.value = null;
  const code = twoFactorOtp.value.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) {
    twoFactorError.value = 'Enter the 6-digit code shown in your authenticator app.';
    return;
  }
  twoFactorLoading.value = true;
  try {
    const res = await $fetch<{ enabled: boolean; backupCodes?: string[]; error: string | null }>('/api/auth/2fa/enable', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: { code },
    });
    if (res.error || !res.enabled) {
      twoFactorError.value = res.error || 'Verification failed.';
      return;
    }
    twoFactorQr.value = '';
    twoFactorSecret.value = '';
    twoFactorOtp.value = '';
    twoFactorBackupCodes.value = res.backupCodes ?? [];
    twoFactorNotice.value = 'Two-factor authentication is now enabled.';
    if (session.value) {
      setSession({ ...session.value, has2fa: true });
    }
  } catch (err: any) {
    twoFactorError.value = err?.data?.error || err?.message || 'Could not activate 2FA.';
  } finally {
    twoFactorLoading.value = false;
  }
}

async function regenerateBackupCodes() {
  twoFactorError.value = null;
  twoFactorNotice.value = null;
  if (!twoFactorActionPassword.value) {
    twoFactorError.value = 'Enter your current password to regenerate backup codes.';
    return;
  }
  twoFactorLoading.value = true;
  try {
    const res = await $fetch<{ backupCodes?: string[]; error: string | null }>('/api/auth/2fa/backup-codes', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: { password: twoFactorActionPassword.value },
    });
    if (res.error || !res.backupCodes) {
      twoFactorError.value = res.error || 'Failed to regenerate backup codes.';
      return;
    }
    twoFactorBackupCodes.value = res.backupCodes;
    twoFactorActionPassword.value = '';
    twoFactorNotice.value = 'New backup codes generated. Previous codes are invalidated.';
  } catch (err: any) {
    twoFactorError.value = err?.data?.error || err?.message || 'Failed to regenerate backup codes.';
  } finally {
    twoFactorLoading.value = false;
  }
}

async function disableTwoFactor() {
  twoFactorError.value = null;
  twoFactorNotice.value = null;
  if (!twoFactorActionPassword.value || !twoFactorDisableCode.value.trim()) {
    twoFactorError.value = 'Provide both your password and an authenticator or backup code.';
    return;
  }
  twoFactorLoading.value = true;
  try {
    const res = await $fetch<{ disabled?: boolean; error: string | null }>('/api/auth/2fa/disable', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: {
        password: twoFactorActionPassword.value,
        code: twoFactorDisableCode.value.trim(),
      },
    });
    if (res.error || !res.disabled) {
      twoFactorError.value = res.error || 'Failed to disable 2FA.';
      return;
    }
    twoFactorActionPassword.value = '';
    twoFactorDisableCode.value = '';
    twoFactorBackupCodes.value = [];
    showDisable2fa.value = false;
    twoFactorNotice.value = 'Two-factor authentication has been disabled.';
    await hydrateSession(true);
  } catch (err: any) {
    twoFactorError.value = err?.data?.error || err?.message || 'Failed to disable 2FA.';
  } finally {
    twoFactorLoading.value = false;
  }
}

// ── Active Stateful Sessions ─────────────────────────────────────────────────
interface ActiveSessionItem {
  id: string;
  sessionType: string;
  deviceLabel: string;
  ipAddress: string | null;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

const activeSessions = ref<ActiveSessionItem[]>([]);
const loadingSessions = ref(false);
const sessionsError = ref<string | null>(null);
const revokingSessionId = ref<string | null>(null);

async function loadSessions() {
  loadingSessions.value = true;
  sessionsError.value = null;
  try {
    const res = await $fetch<{ sessions?: ActiveSessionItem[]; error: string | null }>('/api/auth/sessions', {
      method: 'GET',
      credentials: 'include',
      headers: authHeaders(),
    });
    if (res.error) {
      sessionsError.value = res.error;
      return;
    }
    activeSessions.value = res.sessions ?? [];
  } catch (err: any) {
    sessionsError.value = err?.data?.error || err?.message || 'Could not load active sessions.';
  } finally {
    loadingSessions.value = false;
  }
}

async function revokeSession(options: { sessionId?: string; allOthers?: boolean }) {
  sessionsError.value = null;
  revokingSessionId.value = options.allOthers ? '__others__' : (options.sessionId ?? null);
  try {
    const res = await $fetch<{ success: boolean; error: string | null }>('/api/auth/sessions/revoke', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: options,
    });
    if (res.error || !res.success) {
      sessionsError.value = res.error || 'Failed to revoke session.';
      return;
    }
    await loadSessions();
  } catch (err: any) {
    sessionsError.value = err?.data?.error || err?.message || 'Failed to revoke session.';
  } finally {
    revokingSessionId.value = null;
  }
}

onMounted(() => {
  void loadSessions();
});

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
        credentials: 'include',
        headers: authHeaders(),
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
  <div class="relative flex-1 min-h-0 overflow-y-auto overscroll-contain" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

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
          <CheckIcon class="w-3.5 h-3.5" /> Country and currency updated platform-wide.
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
            <img v-if="business.logoUrl && sanitizeImageSrc(business.logoUrl)" :src="sanitizeImageSrc(business.logoUrl)" :alt="t('settings_business_logo')" class="w-full h-full object-cover" />
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
            <UploadIcon class="w-3.5 h-3.5" />
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
          <CheckIcon class="w-3.5 h-3.5" /> {{ t('settings_theme_saved') }}
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
          <SparklesIcon class="w-4 h-4" style="color: rgb(232,116,138);" />
          {{ t('settings_open_setup_wizard') }}
        </button>
      </section>

      <!-- ── System Language ────────────────────────────────────── -->
      <section class="relative space-y-3">
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

      <!-- ── Account & Password Security ────────────────────────── -->
      <section class="space-y-4">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">Security</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Account & Password</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">
            Manage your admin credentials. Authenticated as <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ session?.email || 'admin@kogane.dev' }}</span>.
          </p>
        </div>

        <div
          v-if="passwordError"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ passwordError }}
        </div>

        <div
          v-if="passwordSuccess"
          class="text-xs px-3 py-2 rounded flex items-center gap-1.5"
          style="background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.18); color: #15803d;"
        >
          <ShieldCheckIcon class="w-4 h-4" /> Password updated successfully.
        </div>

        <div class="space-y-3">
          <div>
            <label for="settings-current-password" class="text-[10px] font-mono uppercase tracking-widest block mb-1" style="color: rgba(61,24,32,0.4);">
              Current Password
            </label>
            <div class="relative flex items-center">
              <input
                id="settings-current-password"
                v-model="currentPassword"
                :type="currentPasswordVisible ? 'text' : 'password'"
                class="input-warm w-full px-3 py-2 pr-9 text-xs"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; border-radius: 0.5rem; height: 2.25rem;"
                placeholder="Enter current password"
              />
              <button
                type="button"
                class="absolute right-2.5 p-1 text-[rgba(104,41,58,0.45)] hover:text-[#68293A] bg-transparent border-0 cursor-pointer"
                @click="currentPasswordVisible = !currentPasswordVisible"
              >
                <EyeOffIcon v-if="currentPasswordVisible" class="w-3.5 h-3.5" />
                <EyeIcon v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label for="settings-new-password" class="text-[10px] font-mono uppercase tracking-widest block mb-1" style="color: rgba(61,24,32,0.4);">
              New Password (min. 6 characters)
            </label>
            <div class="relative flex items-center">
              <input
                id="settings-new-password"
                v-model="newPassword"
                :type="newPasswordVisible ? 'text' : 'password'"
                class="input-warm w-full px-3 py-2 pr-9 text-xs"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; border-radius: 0.5rem; height: 2.25rem;"
                placeholder="Enter new password"
              />
              <button
                type="button"
                class="absolute right-2.5 p-1 text-[rgba(104,41,58,0.45)] hover:text-[#68293A] bg-transparent border-0 cursor-pointer"
                @click="newPasswordVisible = !newPasswordVisible"
              >
                <EyeOffIcon v-if="newPasswordVisible" class="w-3.5 h-3.5" />
                <EyeIcon v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label for="settings-confirm-password" class="text-[10px] font-mono uppercase tracking-widest block mb-1" style="color: rgba(61,24,32,0.4);">
              Confirm New Password
            </label>
            <div class="relative flex items-center">
              <input
                id="settings-confirm-password"
                v-model="confirmNewPassword"
                :type="confirmPasswordVisible ? 'text' : 'password'"
                class="input-warm w-full px-3 py-2 pr-9 text-xs"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; border-radius: 0.5rem; height: 2.25rem;"
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                class="absolute right-2.5 p-1 text-[rgba(104,41,58,0.45)] hover:text-[#68293A] bg-transparent border-0 cursor-pointer"
                @click="confirmPasswordVisible = !confirmPasswordVisible"
              >
                <EyeOffIcon v-if="confirmPasswordVisible" class="w-3.5 h-3.5" />
                <EyeIcon v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] btn-primary btn-ribbon flex items-center justify-center gap-2"
          :disabled="changingPassword || !currentPassword || !newPassword"
          @click="handlePasswordChange"
        >
          <LockIcon class="w-4 h-4" />
          {{ changingPassword ? 'Updating Password…' : 'Update Password' }}
        </button>
      </section>

      <!-- ── Two-Factor Authentication ─────────────────────────── -->
      <section class="pt-6 space-y-4" style="border-top: 1px solid rgba(61,24,32,0.08);">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Two-Factor Authentication (2FA)</h2>
            <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.45);">
              Protect your admin account with a TOTP authenticator app and single-use backup codes.
            </p>
          </div>
          <span
            class="text-[11px] font-mono px-2.5 py-1 rounded-full shrink-0"
            :style="session?.has2fa
              ? 'background: rgba(22,163,74,0.1); color: #15803d;'
              : 'background: rgba(61,24,32,0.06); color: rgba(61,24,32,0.6);'"
          >
            {{ session?.has2fa ? 'Enabled' : 'Not enabled' }}
          </span>
        </div>

        <div
          v-if="twoFactorError"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ twoFactorError }}
        </div>

        <div
          v-if="twoFactorNotice"
          class="text-xs px-3 py-2 rounded flex items-center gap-1.5"
          style="background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.18); color: #15803d;"
        >
          <ShieldCheckIcon class="w-4 h-4" /> {{ twoFactorNotice }}
        </div>

        <div v-if="twoFactorBackupCodes.length > 0" class="rounded-lg p-3.5 space-y-2" style="background: rgba(61,24,32,0.03); border: 1px solid rgba(61,24,32,0.1);">
          <p class="text-xs font-semibold" style="color: rgb(var(--shell-sidebar));">Save your backup recovery codes</p>
          <p class="text-[11px]" style="color: rgba(61,24,32,0.6);">Each recovery code works once if your authenticator is unavailable.</p>
          <div class="grid grid-cols-2 gap-1.5 font-mono text-xs">
            <code
              v-for="code in twoFactorBackupCodes"
              :key="code"
              class="px-2 py-1 rounded bg-white text-center select-all"
              style="border: 1px solid rgba(61,24,32,0.1);"
            >
              {{ code }}
            </code>
          </div>
        </div>

        <template v-if="!session?.has2fa">
          <div v-if="!twoFactorSecret">
            <button
              class="py-2.5 px-4 text-xs font-semibold rounded-lg btn-primary btn-ribbon flex items-center gap-2 disabled:opacity-40"
              :disabled="twoFactorLoading"
              @click="beginTwoFactorSetup"
            >
              <KeyIcon class="w-3.5 h-3.5" />
              {{ twoFactorLoading ? 'Preparing Setup…' : 'Enable Two-Factor Auth' }}
            </button>
          </div>

          <div v-else class="rounded-lg p-4 space-y-3" style="background: rgba(61,24,32,0.025); border: 1px solid rgba(61,24,32,0.1);">
            <div class="flex flex-col sm:flex-row items-center gap-4">
              <img
                v-if="twoFactorQr"
                :src="twoFactorQr"
                alt="2FA QR code"
                class="w-32 h-32 rounded bg-white p-1 shrink-0"
                style="border: 1px solid rgba(61,24,32,0.12);"
              />
              <div class="space-y-1.5 text-xs">
                <p class="font-medium" style="color: rgb(var(--shell-sidebar));">Scan with your authenticator app</p>
                <p style="color: rgba(61,24,32,0.55);">Or enter this manual setup key:</p>
                <code class="block px-2.5 py-1 rounded bg-white font-mono text-[11px] break-all select-all" style="border: 1px solid rgba(61,24,32,0.1);">
                  {{ twoFactorSecret }}
                </code>
              </div>
            </div>

            <div class="flex items-end gap-2">
              <div class="flex-1">
                <label for="settings-2fa-otp" class="text-[10px] font-mono uppercase tracking-widest block mb-1" style="color: rgba(61,24,32,0.4);">
                  6-Digit Verification Code
                </label>
                <input
                  id="settings-2fa-otp"
                  v-model="twoFactorOtp"
                  type="text"
                  maxlength="6"
                  class="input-warm w-full px-3 py-2 text-xs font-mono tracking-widest"
                  style="border: 1.5px solid rgba(61,24,32,0.12); background: white; border-radius: 0.5rem; height: 2.25rem;"
                  placeholder="000000"
                />
              </div>
              <button
                class="py-2 px-4 text-xs font-semibold rounded-lg btn-primary btn-ribbon h-9 disabled:opacity-40"
                :disabled="twoFactorLoading"
                @click="activateTwoFactor"
              >
                Verify & Enable
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="rounded-lg p-3.5 space-y-3" style="background: rgba(61,24,32,0.025); border: 1px solid rgba(61,24,32,0.1);">
            <div>
              <label for="settings-2fa-password" class="text-[10px] font-mono uppercase tracking-widest block mb-1" style="color: rgba(61,24,32,0.4);">
                Current Password (required for 2FA changes)
              </label>
              <input
                id="settings-2fa-password"
                v-model="twoFactorActionPassword"
                type="password"
                class="input-warm w-full px-3 py-2 text-xs"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: white; border-radius: 0.5rem; height: 2.25rem;"
                placeholder="Enter current password"
              />
            </div>

            <div v-if="showDisable2fa">
              <label for="settings-2fa-disable-code" class="text-[10px] font-mono uppercase tracking-widest block mb-1" style="color: rgba(61,24,32,0.4);">
                Authenticator or Backup Code
              </label>
              <input
                id="settings-2fa-disable-code"
                v-model="twoFactorDisableCode"
                type="text"
                maxlength="12"
                class="input-warm w-full px-3 py-2 text-xs font-mono"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: white; border-radius: 0.5rem; height: 2.25rem;"
                placeholder="000000 or recovery code"
              />
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="py-2 px-3 text-xs font-semibold rounded-lg transition-colors"
                style="background: white; border: 1px solid rgba(61,24,32,0.16); color: rgb(var(--shell-sidebar));"
                :disabled="twoFactorLoading"
                @click="regenerateBackupCodes"
              >
                Regenerate Backup Codes
              </button>
              <button
                v-if="!showDisable2fa"
                type="button"
                class="py-2 px-3 text-xs font-semibold rounded-lg"
                style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
                @click="showDisable2fa = true"
              >
                Disable 2FA…
              </button>
              <button
                v-else
                type="button"
                class="py-2 px-3 text-xs font-semibold rounded-lg"
                style="background: #dc2626; color: white;"
                :disabled="twoFactorLoading"
                @click="disableTwoFactor"
              >
                Confirm Disable 2FA
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- ── Active Sessions ───────────────────────────────────── -->
      <section class="pt-6 space-y-4 pb-8" style="border-top: 1px solid rgba(61,24,32,0.08);">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Active Sessions</h2>
            <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.45);">
              Devices currently signed into your admin account. Revoke any unrecognized session immediately.
            </p>
          </div>
          <button
            v-if="activeSessions.length > 1"
            type="button"
            class="text-[11px] font-medium px-2.5 py-1.5 rounded-lg shrink-0"
            style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
            :disabled="revokingSessionId !== null"
            @click="revokeSession({ allOthers: true })"
          >
            Sign out other devices
          </button>
        </div>

        <div
          v-if="sessionsError"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ sessionsError }}
        </div>

        <div v-if="loadingSessions" class="text-xs" style="color: rgba(61,24,32,0.45);">
          Loading active sessions…
        </div>

        <div v-else-if="activeSessions.length === 0" class="text-xs" style="color: rgba(61,24,32,0.45);">
          No tracked stateful sessions yet (sign in again to create one).
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="item in activeSessions"
            :key="item.id"
            class="flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5"
            style="background: rgba(61,24,32,0.025); border: 1px solid rgba(61,24,32,0.09);"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <LaptopIcon class="w-4 h-4 shrink-0" style="color: rgba(61,24,32,0.5);" />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium truncate" style="color: rgb(var(--shell-sidebar));">
                    {{ item.deviceLabel }}
                  </span>
                  <span
                    v-if="item.isCurrent"
                    class="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style="background: rgba(22,163,74,0.1); color: #15803d;"
                  >
                    Current
                  </span>
                </div>
                <p class="text-[11px] truncate" style="color: rgba(61,24,32,0.5);">
                  {{ item.ipAddress || 'Unknown IP' }} · Active {{ new Date(item.lastActiveAt).toLocaleString() }}
                </p>
              </div>
            </div>

            <button
              v-if="!item.isCurrent"
              type="button"
              class="text-xs px-2.5 py-1 rounded flex items-center gap-1 shrink-0"
              style="background: white; border: 1px solid rgba(61,24,32,0.15); color: #dc2626;"
              :disabled="revokingSessionId === item.id"
              @click="revokeSession({ sessionId: item.id })"
            >
              <LogoutIcon class="w-3 h-3" />
              Revoke
            </button>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
