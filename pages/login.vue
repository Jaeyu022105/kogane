<script setup lang="ts">
import { Camera, QrCode, Eye, EyeOff } from 'lucide-vue-next';

definePageMeta({ layout: 'default' });

const router = useRouter();
const route  = useRoute();
const { isLoggedIn, setSession, loadDevSession } = useAuth();
const { openOnboarding }                        = useOnboarding();
const { t, locale, detectedLocale, setLocale, loadLocale, availableLocales, translateFor } = useLocale();

const mode = ref<'login' | 'signup' | '2fa-setup'>((route.query.mode as any) || 'login');
const signupStep = ref(0); // 0: Lang, 1: Profile, 2: Birthday, 3: Wizard handoff

useHead(() => ({
  title: `${mode.value === 'login' ? t('login_title') : t('signup_title')} - Kogane`,
}));

// Form state
const email           = ref(mode.value === 'signup' ? '' : 'admin@kogane.dev');
const password        = ref('');
const confirmPassword = ref('');
const fullName        = ref('');
const username        = ref('');

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

const error    = ref<string | null>(null);
const loading  = ref(false);

const primaryTitleKey = computed(() => {
  if (mode.value === 'login') return 'login_title';
  if (mode.value === '2fa-setup') return '2fa_title';
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

const redirectTarget = computed(() => {
  const target = typeof route.query.redirect === 'string'
    ? route.query.redirect
    : '/dashboard';

  return target.startsWith('/') ? target : '/dashboard';
});

const exitTarget = computed(() => {
  const target = typeof route.query.returnTo === 'string'
    ? route.query.returnTo
    : null;

  return target && target.startsWith('/') ? target : null;
});

function leaveLoginPage() {
  if (exitTarget.value)
  {
    router.push(exitTarget.value);
  }
}

onMounted(() => {
  loadLocale();
  loadDevSession();
  if (isLoggedIn.value) router.push(redirectTarget.value);
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
      const res = await $fetch<{ session: any; error: string | null }>('/api/auth/login', {
        method: 'POST',
        body: { email: email.value.trim(), password: password.value },
      });

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
  } else if (mode.value === 'signup') {
    if (signupStep.value < 3) {
      await nextStep();
    } else {
      await handleSignupSubmit();
    }
  } else if (mode.value === '2fa-setup') {
    if (verificationCode.value.length < 6) {
      error.value = t('error_invalid_code');
      return;
    }
    await handleSignupSubmit();
  }
}

async function handleSignupSubmit() {
  if (enable2FA.value && mode.value !== '2fa-setup') {
    mode.value = '2fa-setup';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ session: any; error: string | null }>('/api/auth/signup', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        password: password.value,
        fullName: fullName.value.trim(),
        username: username.value.trim(),
        profilePhotoUrl: profilePhotoUrl.value || undefined,
        languagePreference: locale.value,
        has2fa: enable2FA.value,
      },
    });

    if (res.error || !res.session) {
      error.value = res.error ?? 'Registration failed';
      return;
    }

    setSession(res.session);
    openOnboarding();
    router.push(redirectTarget.value);
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || 'Registration failed';
  } finally {
    loading.value = false;
  }
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
</script>

<template>
  <div class="login-shell" role="main">
    <!-- background blobs -->
    <div class="login-blob login-blob--top" />
    <div class="login-blob login-blob--bottom" />

    <div class="login-wrap" :class="{ 'login-wrap--wide': mode === 'signup' && signupStep > 0 }">
      <!-- brand mark -->
      <div class="login-brand" :style="(mode === 'signup' && signupStep > 0) ? 'justify-content: center;' : ''">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12h8 M8 8h5 M8 16h6" />
          </svg>
        </div>
        <div>
          <h1 class="brand-name">
            Kogane
          </h1>
          <p class="brand-tagline">Preset workspace setup</p>
          <p v-if="localizedEcho" class="brand-echo">{{ localizedEcho }}</p>
        </div>
      </div>

      <!-- card -->
      <div class="login-card">
        
        <template v-if="mode === 'signup' && signupStep === 0">
           <div class="login-card-header">
             <h2 class="login-title">{{ translateFor('en', 'lang_picker_title') }}</h2>
             <p class="login-echo">{{ languagePickerTitleEcho }}</p>
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
             {{ t('have_account') }} <a href="#" @click.prevent="mode = 'login'" class="link-text">{{ t('sign_in_link') }}</a>
           </p>
        </template>
        
        <template v-else>
          <div class="login-card-header" :style="(mode === 'signup') ? 'text-align: center;' : ''">
            <h2 class="login-title">
              {{ mode === 'login' ? t('login_title') : mode === 'signup' ? t('signup_title') : t('2fa_title') }}
            </h2>
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
                  <div class="progress-fill" :style="`width: ${((signupStep - 1) / 2) * 100}%`"></div>
                </div>
                <div class="progress-labels">
                   <span :class="{'active': signupStep >= 1}">{{ t('step_profile') }}</span>
                   <span :class="{'active': signupStep >= 2}">{{ t('step_birthday') }}</span>
                   <span :class="{'active': signupStep >= 3}">{{ t('step_business') }}</span>
                </div>
              </div>
              
              <div class="step-header">
                <h3 class="step-title">
                   {{ signupStep === 1 ? t('step1_heading') : signupStep === 2 ? t('step2_heading') : t('step3_heading') }}
                </h3>
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
                      class="w-full h-full object-cover rounded-full"
                    />
                    <Camera
                      v-else
                      class="w-6 h-6 transition-transform group-hover:scale-110"
                      style="color: rgba(104,41,58,0.4);"
                    />
                    <div
                      v-if="profilePhotoUrl"
                      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full text-white text-[11px] font-medium"
                    >
                      Change
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="profile-upload-text hover:underline cursor-pointer bg-transparent border-0 p-0"
                      @click="triggerPhotoSelect"
                    >
                      {{ profilePhotoUrl ? 'Change photo' : t('upload_photo') }}
                    </button>
                    <button
                      v-if="profilePhotoUrl"
                      type="button"
                      class="text-[11px] text-red-500 hover:underline cursor-pointer bg-transparent border-0 p-0"
                      @click="removePhoto"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div class="signup-grid">
                  <div class="field">
                    <label for="signup-fullname" class="field-label">{{ t('field_fullname') }}</label>
                    <input id="signup-fullname" v-model="fullName" type="text" required class="field-input" :placeholder="t('field_fullname_placeholder')" />
                  </div>
                  <div class="field">
                    <label for="signup-username" class="field-label">{{ t('field_username') }}</label>
                    <input id="signup-username" v-model="username" type="text" required class="field-input" :placeholder="t('field_username_placeholder')" />
                  </div>
                  <div class="field">
                    <label for="signup-email" class="field-label">{{ t('field_email') }}</label>
                    <input id="signup-email" v-model="email" type="email" required class="field-input" :placeholder="t('field_email_placeholder')" />
                  </div>
                  <div class="field">
                    <label for="signup-password" class="field-label">{{ t('field_password') }}</label>
                    <div class="relative flex items-center">
                      <input
                        id="signup-password"
                        v-model="password"
                        :type="signupPasswordVisible ? 'text' : 'password'"
                        required
                        class="field-input pr-10"
                        :placeholder="t('field_password_placeholder')"
                      />
                      <button
                        type="button"
                        class="absolute right-3 p-1 text-[rgba(104,41,58,0.45)] hover:text-[#68293A] transition-colors bg-transparent border-0 cursor-pointer flex items-center justify-center"
                        :title="signupPasswordVisible ? 'Hide password' : 'Show password'"
                        :aria-label="signupPasswordVisible ? 'Hide password' : 'Show password'"
                        @click="signupPasswordVisible = !signupPasswordVisible"
                      >
                        <EyeOff v-if="signupPasswordVisible" class="w-4 h-4" />
                        <Eye v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="field" style="grid-column: span 2;">
                    <label for="signup-confirm-password" class="field-label">Confirm Password</label>
                    <div class="relative flex items-center">
                      <input
                        id="signup-confirm-password"
                        v-model="confirmPassword"
                        :type="signupConfirmPasswordVisible ? 'text' : 'password'"
                        required
                        class="field-input pr-10"
                        placeholder="Re-enter password to confirm"
                      />
                      <button
                        type="button"
                        class="absolute right-3 p-1 text-[rgba(104,41,58,0.45)] hover:text-[#68293A] transition-colors bg-transparent border-0 cursor-pointer flex items-center justify-center"
                        :title="signupConfirmPasswordVisible ? 'Hide password' : 'Show password'"
                        :aria-label="signupConfirmPasswordVisible ? 'Hide password' : 'Show password'"
                        @click="signupConfirmPasswordVisible = !signupConfirmPasswordVisible"
                      >
                        <EyeOff v-if="signupConfirmPasswordVisible" class="w-4 h-4" />
                        <Eye v-else class="w-4 h-4" />
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
                  <div class="wizard-handoff" style="grid-column: span 2;">
                    <p class="wizard-handoff-title">{{ t('signup_wizard_handoff_title') }}</p>
                    <p class="wizard-handoff-body">{{ t('signup_wizard_handoff_body') }}</p>
                  </div>
                </div>
                
                <div class="toggle-wrap">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="enable2FA" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">{{ t('field_2fa') }}</span>
                </div>
              </template>
              
              <div class="signup-actions">
                 <button type="button" class="login-return" @click="prevStep">
                    {{ t('btn_back') }}
                 </button>
                 <button type="submit" :disabled="loading || uploadingPhoto" class="login-submit">
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
                    autocomplete="current-password"
                    class="field-input pr-10"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    class="absolute right-3 p-1 text-[rgba(104,41,58,0.45)] hover:text-[#68293A] transition-colors bg-transparent border-0 cursor-pointer flex items-center justify-center"
                    :title="loginPasswordVisible ? 'Hide password' : 'Show password'"
                    :aria-label="loginPasswordVisible ? 'Hide password' : 'Show password'"
                    @click="loginPasswordVisible = !loginPasswordVisible"
                  >
                    <EyeOff v-if="loginPasswordVisible" class="w-4 h-4" />
                    <Eye v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <button
                id="login-submit"
                type="submit"
                :disabled="loading"
                class="login-submit"
              >
                {{ loading ? t('btn_signing_in') : t('btn_signin') }}
              </button>
              <button
                type="button"
                class="w-full text-center text-xs py-1.5 text-[rgba(104,41,58,0.65)] hover:text-[#68293A] bg-transparent border-0 cursor-pointer underline transition-colors"
                @click="fillDemoAdmin"
              >
                Auto-fill default admin (admin@kogane.dev / admin123)
              </button>
            </template>

            <template v-if="mode === '2fa-setup'">
              <div class="qr-placeholder">
                <QrCode class="w-16 h-16" style="color: #68293A;" />
                <p class="qr-text">Scan with Authy, Google Authenticator, etc.</p>
              </div>
              <div class="field">
                <label for="2fa-code" class="field-label">{{ t('field_verification_code') }}</label>
                <input
                  id="2fa-code"
                  v-model="verificationCode"
                  type="text"
                  required
                  class="field-input text-center text-lg tracking-widest"
                  placeholder="000000"
                  maxlength="6"
                />
              </div>
              
              <button
                id="login-submit"
                type="submit"
                :disabled="loading"
                class="login-submit"
              >
                {{ t('btn_complete_setup') }}
              </button>
            </template>

            <div v-if="error" class="login-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {{ error }}
            </div>

          </form>

          <p v-if="mode === 'login'" class="login-dev-note">
            {{ t('no_account') }} <a href="#" @click.prevent="mode = 'signup'; signupStep = 0;" class="link-text">{{ t('sign_up_link') }}</a>
          </p>
          <p v-else-if="mode === 'signup' && signupStep > 0" class="login-dev-note">
            {{ t('have_account') }} <a href="#" @click.prevent="mode = 'login'" class="link-text">{{ t('sign_in_link') }}</a>
          </p>
          <p v-else-if="mode === '2fa-setup'" class="login-dev-note">
            <a href="#" @click.prevent="mode = 'signup'" class="link-text">{{ t('back_to_signup') }}</a>
          </p>

          <p class="login-legal">
            {{ t('legal_text') }} <NuxtLink to="/terms" class="link-text">{{ t('legal_tos') }}</NuxtLink> {{ t('legal_and') }} <NuxtLink to="/privacy" class="link-text">{{ t('legal_privacy') }}</NuxtLink>.
          </p>

          <button
            v-if="exitTarget && mode === 'login'"
            class="login-return"
            @click="leaveLoginPage"
          >
            {{ t('return_terminal') }}
          </button>
          
        </template>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* -- Shell --------------------------------------------------------------- */
.login-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: linear-gradient(160deg, #F6E6D7 0%, #FFFFFF 35%);
  position: relative;
  overflow: hidden;
}

/* decorative blobs */
.login-blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.login-blob--top {
  top: -10rem;
  right: -10rem;
  width: 28rem;
  height: 28rem;
  background: radial-gradient(circle, rgba(255, 87, 118, 0.15) 0%, transparent 70%);
}

.login-blob--bottom {
  bottom: -10rem;
  left: -10rem;
  width: 28rem;
  height: 28rem;
  background: radial-gradient(circle, rgba(104, 41, 58, 0.07) 0%, transparent 70%);
}

/* -- Content wrap -------------------------------------------------------- */
.login-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 26rem;
  animation: fade-up 0.35s ease both;
  transition: max-width 0.3s ease;
}
.login-wrap--wide {
  max-width: 32rem;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* -- Brand mark ---------------------------------------------------------- */
.login-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 2rem;
  transition: justify-content 0.3s ease;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: #68293A;
  color: #F6E6D7;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(104, 41, 58, 0.28);
}
.brand-mark svg { width: 1.3rem; height: 1.3rem; }

.brand-name {
  font-family: 'DM Serif Display', serif;
  font-size: 1.35rem;
  color: #68293A;
  line-height: 1;
  margin: 0;
  text-decoration: none;
}

.brand-tagline {
  font-size: 0.76rem;
  color: rgba(104, 41, 58, 0.45);
  margin: 0.2rem 0 0;
}

.brand-echo {
  font-size: 0.72rem;
  color: rgba(104, 41, 58, 0.32);
  margin: 0.2rem 0 0;
  letter-spacing: 0.04em;
}

/* -- Card ---------------------------------------------------------------- */
.login-card {
  background: #FFFFFF;
  border-radius: 0.75rem;
  border: 1px solid rgba(104, 41, 58, 0.09);
  box-shadow: 0 8px 32px rgba(104, 41, 58, 0.1);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.login-card-header { display: flex; flex-direction: column; gap: 0.35rem; }

.login-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.45rem;
  color: #68293A;
  margin: 0;
  font-weight: 400;
}

.login-subtitle {
  font-size: 0.875rem;
  color: rgba(104, 41, 58, 0.5);
  margin: 0;
  line-height: 1.5;
}

.login-echo {
  font-size: 0.78rem;
  color: rgba(104, 41, 58, 0.34);
  margin: 0;
  letter-spacing: 0.03em;
}

/* -- Forms & Wizard ──────────────────────────────────────────────────────── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.signup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.birthday-grid {
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(104, 41, 58, 0.7);
}

.field-input {
  background: #FDFAF7;
  border: 1.5px solid rgba(104, 41, 58, 0.15);
  border-radius: 0.5rem;
  color: #68293A;
  font-size: 0.9rem;
  padding: 0.65rem 0.85rem;
  font-family: 'Inter', sans-serif;
  width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input::placeholder {
  color: rgba(104, 41, 58, 0.35);
}

.field-input:focus {
  outline: none;
  border-color: rgba(104, 41, 58, 0.45);
  box-shadow: 0 0 0 3px rgba(104, 41, 58, 0.07);
}

/* Progress Indicator */
.signup-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.progress-bar {
  height: 4px;
  background: rgba(104, 41, 58, 0.08);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #68293A;
  transition: width 0.3s ease;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: rgba(104, 41, 58, 0.4);
  font-weight: 500;
}

.progress-labels span.active {
  color: #68293A;
  font-weight: 600;
}

/* Step Header */
.step-header {
  margin-bottom: 0.5rem;
  text-align: left;
}

.step-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #68293A;
  margin: 0 0 0.25rem;
}

.step-desc {
  font-size: 0.85rem;
  color: rgba(104, 41, 58, 0.55);
  margin: 0;
  line-height: 1.4;
}

/* Profile Upload */
.profile-upload-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.profile-upload {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  border: 2px dashed rgba(104, 41, 58, 0.25);
  background: #FDFAF7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-upload:hover {
  border-color: rgba(104, 41, 58, 0.45);
  background: rgba(104, 41, 58, 0.02);
}

.profile-upload-text {
  font-size: 0.78rem;
  color: rgba(104, 41, 58, 0.6);
  font-weight: 500;
}

/* Buttons */
.signup-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.5rem;
}

.login-submit {
  padding: 0.75rem 1.5rem;
  background: #68293A;
  color: #F6E6D7;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
}

.login-submit:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.login-submit:active {
  transform: translateY(0);
}

.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-return {
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: rgba(104, 41, 58, 0.68);
  border: 1.5px solid rgba(104, 41, 58, 0.12);
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
}

.login-return:hover {
  border-color: rgba(104, 41, 58, 0.3);
  background: rgba(104, 41, 58, 0.03);
}

.login-dev-note {
  font-size: 0.82rem;
  color: rgba(104, 41, 58, 0.6);
  text-align: center;
  margin: 0.5rem 0 0;
}

.login-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #FFF0F2;
  border: 1px solid rgba(255, 87, 118, 0.2);
  border-radius: 0.5rem;
  color: #D32F2F;
  font-size: 0.85rem;
  font-weight: 500;
}

.login-error svg {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
}

/* 2FA & QR Code */
.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  border: 1px solid rgba(104, 41, 58, 0.1);
  border-radius: 0.5rem;
  background: #FDFAF7;
  margin-bottom: 0.5rem;
}

.qr-text {
  font-size: 0.8rem;
  color: rgba(104, 41, 58, 0.6);
  text-align: center;
  margin: 0;
}

/* Toggles (2FA) */
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(104, 41, 58, 0.1);
  border-radius: 0.5rem;
  background: #FDFAF7;
  margin-top: 0.5rem;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 2.5rem;
  height: 1.35rem;
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
  background-color: rgba(104, 41, 58, 0.15);
  transition: .3s;
  border-radius: 1rem;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 1.05rem;
  width: 1.05rem;
  left: 0.15rem;
  bottom: 0.15rem;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #68293A;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(1.15rem);
}

.toggle-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #68293A;
}

/* -- Lang Picker --------------------------------------------------------- */
.lang-picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.lang-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid rgba(104, 41, 58, 0.1);
  border-radius: 0.5rem;
  background: #FDFAF7;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}
.lang-option:hover {
  border-color: rgba(104, 41, 58, 0.3);
  background: #fdf5f0;
  transform: translateY(-1px);
}
.lang-option-native {
  font-size: 1rem;
  font-weight: 600;
  color: #68293A;
}
.lang-option-translated {
  font-size: 0.8rem;
  color: rgba(104, 41, 58, 0.5);
  margin-top: 0.15rem;
}

.wizard-handoff {
  padding: 1rem;
  border: 1px solid rgba(104, 41, 58, 0.1);
  border-radius: 0.5rem;
  background: #FDFAF7;
}

.wizard-handoff-title {
  margin: 0 0 0.35rem;
  font-weight: 700;
  color: #68293A;
}

.wizard-handoff-body {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: rgba(104, 41, 58, 0.58);
}
.login-legal {
  font-size: 0.75rem;
  text-align: center;
  color: rgba(104, 41, 58, 0.45);
  margin: 0;
  line-height: 1.4;
}
.link-text {
  color: #FF5776;
  font-weight: 600;
  text-decoration: none;
}
.link-text:hover {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .signup-grid {
    grid-template-columns: 1fr;
  }
  .birthday-grid {
    grid-template-columns: 1fr;
  }
}
</style>

