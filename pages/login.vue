<script setup lang="ts">
import { Camera, QrCode, Eye, EyeOff } from 'lucide-vue-next';

definePageMeta({ layout: 'default' });

const router = useRouter();
const route = useRoute();
// The demo-admin shortcut exists only on the `nuxt dev` server; production builds compile it out
// (DEV_MODE alone is not enough: the launcher runs production builds with DEV_MODE=true on the LAN).
const showDemoAutofill = import.meta.dev;
const { isLoggedIn, setSession, hydrateSession, authHeaders, session } = useAuth();
const { openOnboarding } = useOnboarding();
const { t, locale, detectedLocale, setLocale, loadLocale, availableLocales, translateFor } = useLocale();

function parseMode(raw: unknown): 'login' | 'signup' | '2fa-setup' | '2fa-verify' {
  if (raw === 'signup') return 'signup';
  return 'login';
}

const mode = ref<'login' | 'signup' | '2fa-setup' | '2fa-verify'>(parseMode(route.query.mode));
const signupStep = ref(0); // 0: Lang, 1: Profile, 2: Birthday, 3: Wizard handoff

watch(
  () => route.query.mode,
  (nextMode) => {
    if (nextMode === 'signup') {
      mode.value = 'signup';
      signupStep.value = 0;
      error.value = null;
    } else if (nextMode === 'login') {
      mode.value = 'login';
      error.value = null;
    }
  },
);

usePageSeo({
  title: () => (mode.value === 'login' || mode.value === '2fa-verify' ? t('login_title') : t('signup_title')),
  description: () => (mode.value === 'login' ? t('login_subtitle_default') : t('signup_subtitle')),
  path: '/login',
  noindex: true,
});

// Form state
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const fullName = ref('');
const username = ref('');

watch(mode, (newMode) => {
  if (newMode === 'signup' && email.value === 'admin@kogane.dev') {
    email.value = '';
    password.value = '';
    confirmPassword.value = '';
  }
});

function fillDemoAdmin() {
  email.value = 'admin@kogane.dev';
  password.value = 'admin123';
}

// Photo upload state
const photoInput = ref<HTMLInputElement | null>(null);
const profilePhotoUrl = ref('');
const uploadingPhoto = ref(false);

// Password visibility state
const signupPasswordVisible = ref(false);
const signupConfirmPasswordVisible = ref(false);
const loginPasswordVisible = ref(false);

function triggerPhotoSelect() {
  photoInput.value?.click();
}

async function handlePhotoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    error.value = 'Please select an image file (PNG, JPG, WebP).';
    return;
  }

  // Instant local preview
  const reader = new FileReader();
  reader.onload = () => {
    profilePhotoUrl.value = reader.result as string;
  };
  reader.readAsDataURL(file);

  uploadingPhoto.value = true;
  error.value = null;

  try {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const form = new FormData();
    form.append('file', file);
    form.append('bucket', 'avatars');
    form.append('path', `avatar-${Date.now()}.${ext}`);

    const res = await $fetch<{ url: string | null; error: string | null }>('/api/storage/upload', {
      method: 'POST',
      body: form,
    });

    if (res.error) {
      error.value = res.error;
    } else if (res.url) {
      profilePhotoUrl.value = res.url;
    }
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || 'Failed to upload photo';
  } finally {
    uploadingPhoto.value = false;
  }
}

function removePhoto() {
  profilePhotoUrl.value = '';
  if (photoInput.value) photoInput.value.value = '';
}

// Birthday state
const birthMonth = ref('');
const birthDay = ref('');
const birthYear = ref('');

const enable2FA = ref(false);
const verificationCode = ref('');
const challengeToken = ref<string | null>(null);
const twoFactorSecret = ref('');
const qrCodeDataUrl = ref('');
const setupBackupCodes = ref<string[]>([]);

const error = ref<string | null>(null);
const loading = ref(false);

const primaryTitleKey = computed(() => {
  if (mode.value === 'login') return 'login_title';
  if (mode.value === '2fa-setup' || mode.value === '2fa-verify') return '2fa_title';
  if (signupStep.value === 0) return 'lang_picker_title';
  if (signupStep.value === 1) return 'step1_heading';
  if (signupStep.value === 2) return 'step2_heading';
  return 'step3_heading';
});

const localizedEcho = computed(() => {
  if (detectedLocale.value === 'en') return '';
  return translateFor(detectedLocale.value, primaryTitleKey.value as any);
});

const languagePickerTitleEcho = computed(() => {
  if (detectedLocale.value === 'en') return '';
  return translateFor(detectedLocale.value, 'lang_picker_title');
});

const languageOptions = computed(() =>
  availableLocales.map((lang) => ({
    ...lang,
    englishLabel: translateFor('en', `lang_${lang.code}` as any),
    nativeEcho: translateFor(lang.code, `lang_${lang.code}` as any),
  })),
);

function isSafePath(path: string | null | undefined): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.startsWith('/\\')
    && !path.includes('://');
}

const redirectTarget = computed(() => {
  const target = typeof route.query.redirect === 'string'
    ? route.query.redirect
    : '/dashboard';

  return isSafePath(target) ? target : '/dashboard';
});

const exitTarget = computed(() => {
  const target = typeof route.query.returnTo === 'string'
    ? route.query.returnTo
    : null;

  return isSafePath(target) ? target : null;
});

function leaveLoginPage() {
  if (exitTarget.value) {
    router.push(exitTarget.value);
  }
}

onMounted(async () => {
  loadLocale();
  const active = await hydrateSession();
  if (active && isLoggedIn.value) router.push(redirectTarget.value);
});

async function nextStep() {
  error.value = null;
  if (signupStep.value === 1) {
    if (!email.value || !password.value || !confirmPassword.value || !fullName.value || !username.value) {
      error.value = t('error_fill_all') || 'Please fill in all fields.';
      return;
    }
    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match.';
      return;
    }
    if (password.value.length < 6) {
      error.value = 'Password must be at least 6 characters.';
      return;
    }
  } else if (signupStep.value === 2) {
    if (!birthMonth.value || !birthDay.value || !birthYear.value) {
      error.value = t('error_fill_all') || 'Please fill in all fields.';
      return;
    }
  }

  if (signupStep.value < 3) {
    signupStep.value++;
  } else {
    await handleSignupSubmit();
  }
}

function prevStep() {
  error.value = null;
  if (signupStep.value > 0) {
    signupStep.value--;
  } else {
    mode.value = 'login';
  }
}

async function selectLanguage(code: string) {
  setLocale(code);
  await nextStep();
}

async function handleAction() {
  error.value = null;

  if (mode.value === 'login') {
    if (!email.value || !email.value.trim()) {
      error.value = 'Please enter your email.';
      return;
    }
    if (!password.value) {
      error.value = 'Please enter your password.';
      return;
    }
    loading.value = true;
    try {
      const res = await $fetch<{
        session: any;
        requires2fa?: boolean;
        challengeToken?: string;
        error: string | null;
      }>('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        body: { email: email.value.trim(), password: password.value },
      });

      if (res.requires2fa && res.challengeToken) {
        challengeToken.value = res.challengeToken;
        verificationCode.value = '';
        mode.value = '2fa-verify';
        return;
      }

      if (res.error || !res.session) {
        error.value = res.error ?? t('error_login_failed');
        return;
      }

      setSession(res.session);
      router.push(redirectTarget.value);
    } catch (err: any) {
      error.value = err?.data?.error || err?.message || 'Login failed';
    } finally {
      loading.value = false;
    }
  } else if (mode.value === '2fa-verify') {
    const cleaned = verificationCode.value.trim();
    if (cleaned.length < 6) {
      error.value = t('error_invalid_code') || 'Please enter a valid 6-digit code or backup code.';
      return;
    }
    loading.value = true;
    try {
      const res = await $fetch<{ session: any; error: string | null }>('/api/auth/2fa/verify', {
        method: 'POST',
        credentials: 'include',
        body: { challengeToken: challengeToken.value, code: cleaned },
      });

      if (res.error || !res.session) {
        error.value = res.error ?? (t('error_invalid_code') || 'Invalid verification code.');
        return;
      }

      challengeToken.value = null;
      setSession(res.session);
      router.push(redirectTarget.value);
    } catch (err: any) {
      error.value = err?.data?.error || err?.message || 'Verification failed';
    } finally {
      loading.value = false;
    }
  } else if (mode.value === 'signup') {
    if (signupStep.value < 3) {
      await nextStep();
    } else {
      await handleSignupSubmit();
    }
  } else if (mode.value === '2fa-setup') {
    if (setupBackupCodes.value.length > 0) {
      openOnboarding();
      router.push(redirectTarget.value);
      return;
    }

    const cleaned = verificationCode.value.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      error.value = t('error_invalid_code') || 'Please enter the 6-digit code from your authenticator app.';
      return;
    }

    loading.value = true;
    try {
      const res = await $fetch<{ enabled: boolean; backupCodes?: string[]; error: string | null }>('/api/auth/2fa/enable', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: { code: cleaned },
      });

      if (res.error || !res.enabled) {
        error.value = res.error ?? 'Failed to enable 2FA';
        return;
      }

      if (session.value) {
        setSession({ ...session.value, has2fa: true });
      }
      setupBackupCodes.value = res.backupCodes ?? [];
      if (setupBackupCodes.value.length === 0) {
        openOnboarding();
        router.push(redirectTarget.value);
      }
    } catch (err: any) {
      error.value = err?.data?.error || err?.message || '2FA activation failed';
    } finally {
      loading.value = false;
    }
  }
}

async function handleSignupSubmit() {
  loading.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ session: any; error: string | null }>('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      body: {
        email: email.value.trim(),
        password: password.value,
        fullName: fullName.value.trim(),
        username: username.value.trim(),
        profilePhotoUrl: profilePhotoUrl.value || undefined,
        languagePreference: locale.value,
        has2fa: false,
      },
    });

    if (res.error || !res.session) {
      error.value = res.error ?? 'Registration failed';
      return;
    }

    setSession(res.session);

    if (enable2FA.value) {
      const setupRes = await $fetch<{
        secret: string;
        qrCodeDataUrl: string;
        error: string | null;
      }>('/api/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${res.session.token}` },
      });

      if (setupRes.error || !setupRes.secret) {
        error.value = setupRes.error ?? 'Could not initialize 2FA setup. You can enable it later in Settings.';
        openOnboarding();
        router.push(redirectTarget.value);
        return;
      }

      twoFactorSecret.value = setupRes.secret;
      qrCodeDataUrl.value = setupRes.qrCodeDataUrl;
      verificationCode.value = '';
      setupBackupCodes.value = [];
      mode.value = '2fa-setup';
      return;
    }

    openOnboarding();
    router.push(redirectTarget.value);
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || 'Registration failed';
  } finally {
    loading.value = false;
  }
}

function skipTwoFactorSetup() {
  openOnboarding();
  router.push(redirectTarget.value);
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
</script>

<template>
  <main class="login-shell">
    <!-- background blobs -->
    <div class="login-blob login-blob--top" aria-hidden="true" />
    <div class="login-blob login-blob--bottom" aria-hidden="true" />

    <div class="login-wrap" :class="{ 'login-wrap--wide': mode === 'signup' && signupStep > 0 }">
      <!-- Brand link -->
      <NuxtLink
        to="/"
        class="login-brand"
        :class="{ 'login-brand--centered': mode === 'signup' && signupStep > 0 }"
      >
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12h8 M8 8h5 M8 16h6" />
          </svg>
        </div>
        <div>
          <span class="brand-name">Kogane</span>
          <p class="brand-tagline">{{ t('login_brand_tagline') }}</p>
          <p v-if="localizedEcho" class="brand-echo">{{ localizedEcho }}</p>
        </div>
      </NuxtLink>

      <!-- Card -->
      <div class="login-card">
        <template v-if="mode === 'signup' && signupStep === 0">
          <div class="login-card-header">
            <h1 class="login-title">{{ translateFor('en', 'lang_picker_title') }}</h1>
            <p v-if="languagePickerTitleEcho" class="login-echo">{{ languagePickerTitleEcho }}</p>
            <p class="login-subtitle">{{ t('lang_picker_subtitle') }}</p>
          </div>

          <div class="lang-picker-list">
            <button
              v-for="lang in languageOptions"
              :key="lang.code"
              type="button"
              class="lang-option"
              :aria-pressed="locale === lang.code"
              @click="selectLanguage(lang.code)"
            >
              <span class="lang-option-native">{{ lang.englishLabel }}</span>
              <span class="lang-option-translated">{{ lang.nativeEcho }}</span>
            </button>
          </div>

          <p class="login-dev-note">
            {{ t('have_account') }}
            <button type="button" class="link-btn" @click="mode = 'login'">
              {{ t('sign_in_link') }}
            </button>
          </p>
        </template>

        <template v-else>
          <div class="login-card-header" :class="{ 'login-card-header--centered': mode === 'signup' }">
            <h1 class="login-title">
              {{ mode === 'login' ? t('login_title') : mode === 'signup' ? t('signup_title') : t('2fa_title') }}
            </h1>
            <p v-if="localizedEcho && !(mode === 'signup' && signupStep === 0)" class="login-echo">
              {{ localizedEcho }}
            </p>
            <p class="login-subtitle">
              <template v-if="mode === 'login'">
                {{ exitTarget ? t('login_subtitle_redirect') : t('login_subtitle_default') }}
              </template>
              <template v-else-if="mode === 'signup'">
                {{ t('signup_subtitle') }}
              </template>
              <template v-else>
                {{ t('2fa_subtitle') }}
              </template>
            </p>
          </div>

          <form class="login-form" @submit.prevent="handleAction">
            <template v-if="mode === 'signup'">
              <!-- Progress indicator -->
              <div class="signup-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="`width: ${((signupStep - 1) / 2) * 100}%`" />
                </div>
                <div class="progress-labels">
                  <span :class="{ active: signupStep >= 1 }">{{ t('step_profile') }}</span>
                  <span :class="{ active: signupStep >= 2 }">{{ t('step_birthday') }}</span>
                  <span :class="{ active: signupStep >= 3 }">{{ t('step_business') }}</span>
                </div>
              </div>

              <div class="step-header">
                <h2 class="step-title">
                  {{ signupStep === 1 ? t('step1_heading') : signupStep === 2 ? t('step2_heading') : t('step3_heading') }}
                </h2>
                <p class="step-desc">
                  {{ signupStep === 1 ? t('step1_subheading') : signupStep === 2 ? t('step2_subheading') : t('step3_subheading') }}
                </p>
              </div>

              <!-- Step 1: Profile -->
              <template v-if="signupStep === 1">
                <div class="profile-upload-wrapper">
                  <input
                    ref="photoInput"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden"
                    aria-label="Upload profile picture"
                    @change="handlePhotoSelect"
                  />
                  <div
                    class="profile-upload group relative overflow-hidden"
                    role="button"
                    tabindex="0"
                    aria-label="Select profile photo"
                    @click="triggerPhotoSelect"
                    @keydown.enter="triggerPhotoSelect"
                    @keydown.space.prevent="triggerPhotoSelect"
                  >
                    <img
                      v-if="profilePhotoUrl"
                      :src="profilePhotoUrl"
                      alt="Profile preview"
                      class="w-full h-full object-cover"
                    />
                    <Camera
                      v-else
                      class="w-5 h-5"
                      aria-hidden="true"
                      style="color: var(--k-muted, rgba(104, 41, 58, 0.72));"
                    />
                  </div>
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      class="profile-upload-text link-btn"
                      @click="triggerPhotoSelect"
                    >
                      {{ profilePhotoUrl ? 'Change photo' : t('upload_photo') }}
                    </button>
                    <button
                      v-if="profilePhotoUrl"
                      type="button"
                      class="link-btn link-btn--danger"
                      @click="removePhoto"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div class="signup-grid">
                  <div class="field">
                    <label for="signup-fullname" class="field-label">{{ t('field_fullname') }}</label>
                    <input
                      id="signup-fullname"
                      v-model="fullName"
                      type="text"
                      maxlength="100"
                      required
                      class="field-input"
                      :placeholder="t('field_fullname_placeholder')"
                    />
                  </div>
                  <div class="field">
                    <label for="signup-username" class="field-label">{{ t('field_username') }}</label>
                    <input
                      id="signup-username"
                      v-model="username"
                      type="text"
                      maxlength="50"
                      required
                      class="field-input"
                      :placeholder="t('field_username_placeholder')"
                    />
                  </div>
                  <div class="field">
                    <label for="signup-email" class="field-label">{{ t('field_email') }}</label>
                    <input
                      id="signup-email"
                      v-model="email"
                      type="email"
                      maxlength="255"
                      required
                      class="field-input"
                      :placeholder="t('field_email_placeholder')"
                    />
                  </div>
                  <div class="field">
                    <label for="signup-password" class="field-label">{{ t('field_password') }}</label>
                    <div class="relative flex items-center">
                      <input
                        id="signup-password"
                        v-model="password"
                        :type="signupPasswordVisible ? 'text' : 'password'"
                        maxlength="255"
                        required
                        class="field-input pr-10"
                        :placeholder="t('field_password_placeholder')"
                      />
                      <button
                        type="button"
                        class="password-toggle"
                        :title="signupPasswordVisible ? 'Hide password' : 'Show password'"
                        :aria-label="signupPasswordVisible ? 'Hide password' : 'Show password'"
                        @click="signupPasswordVisible = !signupPasswordVisible"
                      >
                        <EyeOff v-if="signupPasswordVisible" class="w-4 h-4" aria-hidden="true" />
                        <Eye v-else class="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div class="field field-span-2">
                    <label for="signup-confirm-password" class="field-label">Confirm Password</label>
                    <div class="relative flex items-center">
                      <input
                        id="signup-confirm-password"
                        v-model="confirmPassword"
                        :type="signupConfirmPasswordVisible ? 'text' : 'password'"
                        maxlength="255"
                        required
                        class="field-input pr-10"
                        placeholder="Re-enter password to confirm"
                      />
                      <button
                        type="button"
                        class="password-toggle"
                        :title="signupConfirmPasswordVisible ? 'Hide password' : 'Show password'"
                        :aria-label="signupConfirmPasswordVisible ? 'Hide password' : 'Show password'"
                        @click="signupConfirmPasswordVisible = !signupConfirmPasswordVisible"
                      >
                        <EyeOff v-if="signupConfirmPasswordVisible" class="w-4 h-4" aria-hidden="true" />
                        <Eye v-else class="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Step 2: Birthday -->
              <template v-if="signupStep === 2">
                <div class="signup-grid birthday-grid">
                  <div class="field">
                    <label for="signup-month" class="field-label">{{ t('field_birth_month') }}</label>
                    <select id="signup-month" v-model="birthMonth" required class="field-input">
                      <option disabled value="">{{ t('field_birth_month') }}</option>
                      <option v-for="m in months" :key="m" :value="m">{{ t(`month_${m}`) }}</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="signup-day" class="field-label">{{ t('field_birth_day') }}</label>
                    <select id="signup-day" v-model="birthDay" required class="field-input">
                      <option disabled value="">{{ t('field_birth_day') }}</option>
                      <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="signup-year" class="field-label">{{ t('field_birth_year') }}</label>
                    <select id="signup-year" v-model="birthYear" required class="field-input">
                      <option disabled value="">{{ t('field_birth_year') }}</option>
                      <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
                    </select>
                  </div>
                </div>
              </template>

              <!-- Step 3: Business -->
              <template v-if="signupStep === 3">
                <div class="signup-grid">
                  <div class="wizard-handoff field-span-2">
                    <p class="wizard-handoff-title">{{ t('signup_wizard_handoff_title') }}</p>
                    <p class="wizard-handoff-body">{{ t('signup_wizard_handoff_body') }}</p>
                  </div>
                </div>

                <div class="toggle-wrap">
                  <label class="toggle-switch">
                    <input v-model="enable2FA" type="checkbox" />
                    <span class="toggle-slider" />
                  </label>
                  <span class="toggle-label">{{ t('field_2fa') }}</span>
                </div>
              </template>

              <div class="signup-actions">
                <button type="button" class="login-return" @click="prevStep">
                  {{ t('btn_back') }}
                </button>
                <button type="submit" :disabled="loading || uploadingPhoto" class="login-submit btn-ribbon">
                  {{ uploadingPhoto ? 'Uploading photo...' : (signupStep < 3 ? t('btn_continue') : t('btn_finish')) }}
                </button>
              </div>
            </template>

            <template v-if="mode === 'login'">
              <div class="field">
                <label for="login-email" class="field-label">{{ t('field_login_email') }}</label>
                <input
                  id="login-email"
                  v-model="email"
                  type="email"
                  maxlength="255"
                  required
                  autocomplete="email"
                  class="field-input"
                  placeholder="you@company.com"
                />
              </div>
              <div class="field">
                <label for="login-password" class="field-label">{{ t('field_login_password') }}</label>
                <div class="relative flex items-center">
                  <input
                    id="login-password"
                    v-model="password"
                    :type="loginPasswordVisible ? 'text' : 'password'"
                    maxlength="255"
                    autocomplete="current-password"
                    class="field-input pr-10"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    class="password-toggle"
                    :title="loginPasswordVisible ? 'Hide password' : 'Show password'"
                    :aria-label="loginPasswordVisible ? 'Hide password' : 'Show password'"
                    @click="loginPasswordVisible = !loginPasswordVisible"
                  >
                    <EyeOff v-if="loginPasswordVisible" class="w-4 h-4" aria-hidden="true" />
                    <Eye v-else class="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                :disabled="loading"
                class="login-submit btn-ribbon"
              >
                {{ loading ? t('btn_signing_in') : t('btn_signin') }}
              </button>

              <button
                v-if="showDemoAutofill"
                type="button"
                class="dev-autofill-btn"
                @click="fillDemoAdmin"
              >
                Auto-fill default admin (admin@kogane.dev / admin123)
              </button>
            </template>

            <template v-if="mode === '2fa-verify'">
              <div class="field">
                <label for="2fa-verify-code" class="field-label">Authenticator or Backup Code</label>
                <input
                  id="2fa-verify-code"
                  v-model="verificationCode"
                  type="text"
                  required
                  autocomplete="one-time-code"
                  class="field-input field-input--code"
                  placeholder="000000 or ABCD-1234"
                  maxlength="12"
                />
                <p class="field-help">
                  Enter the 6-digit code from your authenticator app or one of your 8-character recovery codes.
                </p>
              </div>

              <button
                id="login-submit"
                type="submit"
                :disabled="loading"
                class="login-submit btn-ribbon"
              >
                {{ loading ? 'Verifying...' : 'Verify & Sign In' }}
              </button>
            </template>

            <template v-if="mode === '2fa-setup'">
              <template v-if="setupBackupCodes.length === 0">
                <div class="qr-placeholder">
                  <img
                    v-if="qrCodeDataUrl"
                    :src="qrCodeDataUrl"
                    alt="Two-factor authentication QR code"
                    class="w-40 h-40 border border-[#E3C7B9] bg-white p-1"
                  />
                  <QrCode v-else class="w-16 h-16" aria-hidden="true" style="color: #68293A;" />
                  <p class="qr-text">Scan with Google Authenticator, Authy, 1Password, or Apple Passwords.</p>
                  <div v-if="twoFactorSecret" class="mt-2 w-full text-center">
                    <span class="secret-label">Manual entry key</span>
                    <code class="secret-code">
                      {{ twoFactorSecret }}
                    </code>
                  </div>
                </div>
                <div class="field">
                  <label for="2fa-code" class="field-label">{{ t('field_verification_code') }}</label>
                  <input
                    id="2fa-code"
                    v-model="verificationCode"
                    type="text"
                    required
                    autocomplete="one-time-code"
                    class="field-input field-input--code"
                    placeholder="000000"
                    maxlength="6"
                  />
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  :disabled="loading"
                  class="login-submit btn-ribbon"
                >
                  {{ loading ? 'Activating 2FA...' : t('btn_complete_setup') }}
                </button>
              </template>

              <template v-else>
                <div class="backup-box">
                  <p class="backup-title">Save your backup recovery codes</p>
                  <p class="backup-desc">
                    Each code can be used once if you lose access to your authenticator device.
                  </p>
                  <div class="backup-grid">
                    <div
                      v-for="code in setupBackupCodes"
                      :key="code"
                      class="backup-code"
                    >
                      {{ code }}
                    </div>
                  </div>
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  class="login-submit btn-ribbon"
                >
                  Continue to Workspace
                </button>
              </template>
            </template>

            <div v-if="error" class="login-error" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{{ error }}</span>
            </div>
          </form>

          <p v-if="mode === 'login'" class="login-dev-note">
            {{ t('no_account') }}
            <button type="button" class="link-btn" @click="mode = 'signup'; signupStep = 0;">
              {{ t('sign_up_link') }}
            </button>
          </p>
          <p v-else-if="mode === 'signup' && signupStep > 0" class="login-dev-note">
            {{ t('have_account') }}
            <button type="button" class="link-btn" @click="mode = 'login'">
              {{ t('sign_in_link') }}
            </button>
          </p>
          <p v-else-if="mode === '2fa-verify'" class="login-dev-note">
            <button
              type="button"
              class="link-btn"
              @click="mode = 'login'; challengeToken = null; verificationCode = ''; error = null;"
            >
              Back to password sign in
            </button>
          </p>
          <p v-else-if="mode === '2fa-setup' && setupBackupCodes.length === 0" class="login-dev-note">
            <button type="button" class="link-btn" @click="skipTwoFactorSetup">
              Skip 2FA setup for now
            </button>
          </p>

          <p class="login-legal">
            {{ t('legal_text') }}
            <NuxtLink to="/terms" class="link-text">{{ t('legal_tos') }}</NuxtLink>
            {{ t('legal_and') }}
            <NuxtLink to="/privacy" class="link-text">{{ t('legal_privacy') }}</NuxtLink>.
          </p>

          <button
            v-if="exitTarget && mode === 'login'"
            type="button"
            class="login-return"
            @click="leaveLoginPage"
          >
            {{ t('return_terminal') }}
          </button>
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Shell */
.login-shell {
  position: relative;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 2.5rem) 1rem;
  overflow: hidden;
  background: var(--k-cream, #F6E6D7);
  color: var(--k-ink, #68293A);
  font-family: var(--k-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
}

/* Warm ambient blobs */
.login-blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
}
.login-blob--top {
  width: 500px;
  height: 500px;
  top: -180px;
  right: -120px;
  background: radial-gradient(circle, rgba(255, 87, 118, 0.14), transparent 70%);
}
.login-blob--bottom {
  width: 400px;
  height: 400px;
  bottom: -140px;
  left: -100px;
  background: radial-gradient(circle, rgba(104, 41, 58, 0.10), transparent 70%);
}

/* Content wrap */
.login-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 26rem;
  animation: fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.login-wrap--wide {
  max-width: 34rem;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Brand mark */
.login-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  text-decoration: none;
  color: var(--k-ink, #68293A);
}

.login-brand--centered {
  justify-content: center;
}

.login-brand:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 4px;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  border: none;
  background: var(--k-dark, #68293A);
  color: var(--k-on-dark, #F6E6D7);
  box-shadow: 0 4px 14px rgba(104, 41, 58, 0.24);
  flex-shrink: 0;
}

.brand-mark svg {
  width: 1.25rem;
  height: 1.25rem;
}

.brand-name {
  display: block;
  font-family: var(--k-font-serif, 'DM Serif Display', Georgia, serif);
  font-size: 1.4rem;
  font-weight: 400;
  color: var(--k-ink, #68293A);
  line-height: 1.05;
}

.brand-tagline {
  font-size: 0.78rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0.18rem 0 0;
}

.brand-echo {
  font-size: 0.74rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0.15rem 0 0;
}

/* Card */
.login-card {
  background: var(--k-surface, #FFFFFF);
  border-radius: var(--k-radius-lg, 0.85rem);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  box-shadow: var(--k-shadow-lg, 0 8px 32px rgba(104, 41, 58, 0.1));
  padding: clamp(1.25rem, 4vw, 2rem);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.login-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.login-card-header--centered {
  text-align: center;
}

.login-title {
  font-family: var(--k-font-serif, 'DM Serif Display', Georgia, serif);
  font-size: 1.55rem;
  font-weight: 400;
  color: var(--k-ink, #68293A);
  margin: 0;
  line-height: 1.18;
}

.login-subtitle {
  font-size: 0.875rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0;
  line-height: 1.5;
}

.login-echo {
  font-size: 0.78rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0;
}

/* Forms & Wizard */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.signup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.birthday-grid {
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.field-span-2 {
  grid-column: span 2;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
}

.field-input {
  background: var(--k-surface-alt, #FBF4ED);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  color: var(--k-ink, #68293A);
  font-size: 0.9rem;
  padding: 0.62rem 0.8rem;
  font-family: var(--k-font-sans, 'Inter', sans-serif);
  width: 100%;
  transition: border-color 0.15s ease;
}

.field-input::placeholder {
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  opacity: 0.75;
}

.field-input:focus {
  outline: none;
  border-color: var(--k-ink, #68293A);
  background: var(--k-surface, #FFFFFF);
}

.field-input--code {
  text-align: center;
  font-size: 1.05rem;
  font-family: var(--k-font-mono, monospace);
  letter-spacing: 0.12em;
}

.field-help {
  font-size: 0.76rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0.2rem 0 0;
  line-height: 1.45;
}

.password-toggle {
  position: absolute;
  right: 0.6rem;
  padding: 0.25rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.password-toggle:hover {
  color: var(--k-ink, #68293A);
}

/* Progress Indicator */
.signup-progress {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 0.5rem;
}

.progress-bar {
  height: 3px;
  background: var(--k-border, rgba(104, 41, 58, 0.14));
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--k-accent, #FF5776);
  transition: width 0.25s ease;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  font-weight: 500;
}

.progress-labels span.active {
  color: var(--k-ink, #68293A);
  font-weight: 600;
}

/* Step Header */
.step-header {
  text-align: left;
}

.step-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
  margin: 0 0 0.25rem;
}

.step-desc {
  font-size: 0.85rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0;
  line-height: 1.45;
}

/* Profile Upload */
.profile-upload-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.profile-upload {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  border: 2px dashed rgba(104, 41, 58, 0.25);
  background: var(--k-surface-alt, #FBF4ED);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-upload:hover {
  border-color: var(--k-accent, #FF5776);
  background: rgba(255, 87, 118, 0.05);
}

.profile-upload-text {
  font-size: 0.8rem;
}

/* Buttons */
.signup-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.login-submit {
  position: relative;
  padding: 0.72rem 1.35rem;
  background: var(--k-dark, #68293A);
  color: var(--k-on-dark, #F6E6D7);
  border: 1px solid var(--k-dark, #68293A);
  border-radius: var(--k-radius-sm, 0.55rem);
  font-size: 0.9rem;
  font-weight: 600;
  font-family: var(--k-font-sans, 'Inter', sans-serif);
  cursor: pointer;
  box-shadow: 0 3px 14px rgba(104, 41, 58, 0.22);
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
}

.login-submit:hover:not(:disabled) {
  background: var(--k-dark-deep, #4A1A27);
  border-color: var(--k-dark-deep, #4A1A27);
}

.login-submit:active:not(:disabled) {
  transform: scale(0.98);
}

.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-return {
  padding: 0.72rem 1.25rem;
  background: var(--k-surface, #FFFFFF);
  color: var(--k-ink, #68293A);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--k-font-sans, 'Inter', sans-serif);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
}

.login-return:hover {
  border-color: var(--k-ink, #68293A);
}

.dev-autofill-btn {
  width: 100%;
  text-align: center;
  font-size: 0.76rem;
  padding: 0.35rem 0;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.dev-autofill-btn:hover {
  color: var(--k-ink, #68293A);
}

.login-dev-note {
  font-size: 0.84rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  text-align: center;
  margin: 0;
}

.login-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.9rem;
  background: #FFF0F2;
  border: 1px solid var(--k-accent, #FF5776);
  border-radius: 0.55rem;
  color: #C62842;
  font-size: 0.84rem;
  font-weight: 500;
}

.login-error svg {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
}

/* 2FA & QR Code */
.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  background: var(--k-surface-alt, #FBF4ED);
}

.qr-text {
  font-size: 0.8rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  text-align: center;
  margin: 0;
}

.secret-label {
  display: block;
  font-size: 0.75rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

.secret-code {
  display: inline-block;
  margin-top: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  font-size: 0.78rem;
  font-family: var(--k-font-mono, monospace);
  color: var(--k-ink, #68293A);
  word-break: break-all;
}

.backup-box {
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  background: var(--k-surface-alt, #FBF4ED);
  border-radius: 0.55rem;
  padding: 1rem;
}

.backup-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
  margin: 0 0 0.25rem;
}

.backup-desc {
  font-size: 0.78rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0 0 0.75rem;
}

.backup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  font-family: var(--k-font-mono, monospace);
  font-size: 0.78rem;
}

.backup-code {
  padding: 0.4rem 0.6rem;
  background: var(--k-surface, #FFFFFF);
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  text-align: center;
  color: var(--k-ink, #68293A);
}

/* Toggle */
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  background: var(--k-surface-alt, #FBF4ED);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 2.4rem;
  height: 1.3rem;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--k-border, rgba(104, 41, 58, 0.14));
  transition: 0.2s ease;
  border-radius: 1rem;
}

.toggle-slider::before {
  position: absolute;
  content: '';
  height: 0.95rem;
  width: 0.95rem;
  left: 0.18rem;
  bottom: 0.18rem;
  background-color: var(--k-surface, #FFFFFF);
  transition: 0.2s ease;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--k-accent, #FF5776);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(1.08rem);
}

.toggle-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--k-ink, #68293A);
}

/* Lang Picker */
.lang-picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  background: var(--k-surface-alt, #FBF4ED);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.lang-option:hover {
  border-color: var(--k-ink, #68293A);
  background: var(--k-cream, #F6E6D7);
}

.lang-option-native {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--k-ink, #68293A);
}

.lang-option-translated {
  font-size: 0.82rem;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

.wizard-handoff {
  padding: 0.95rem;
  border: 1px solid var(--k-border, rgba(104, 41, 58, 0.14));
  border-radius: 0.55rem;
  background: var(--k-surface-alt, #FBF4ED);
}

.wizard-handoff-title {
  margin: 0 0 0.3rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--k-ink, #68293A);
}

.wizard-handoff-body {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
}

.login-legal {
  font-size: 0.76rem;
  text-align: center;
  color: var(--k-muted, rgba(104, 41, 58, 0.72));
  margin: 0;
  line-height: 1.45;
}

.link-text,
.link-btn {
  color: var(--k-accent, #FF5776);
  font-weight: 600;
  text-decoration: none;
  background: transparent;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
}

.link-btn--danger {
  color: #C62842;
  font-size: 0.78rem;
}

.link-text:hover,
.link-btn:hover {
  text-decoration: underline;
}

.link-text:focus-visible,
.link-btn:focus-visible,
.login-submit:focus-visible,
.login-return:focus-visible,
.lang-option:focus-visible {
  outline: 2px solid var(--k-accent, #FF5776);
  outline-offset: 2px;
}

@media (max-width: 600px) {
  .signup-grid,
  .birthday-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: span 1;
  }
}
</style>
