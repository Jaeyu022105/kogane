<script setup lang="ts">
import { Camera, QrCode } from 'lucide-vue-next';

definePageMeta({ layout: 'default' });

const router = useRouter();
const route  = useRoute();
const { isLoggedIn, devLogin, loadDevSession } = useAuth();
const { openOnboarding }                        = useOnboarding();
const { t, locale, detectedLocale, setLocale, loadLocale, availableLocales, translateFor } = useLocale();

const mode = ref<'login' | 'signup' | '2fa-setup'>((route.query.mode as any) || 'login');
const signupStep = ref(0); // 0: Lang, 1: Profile, 2: Birthday, 3: Business

// Form state
const email    = ref('admin@kogane.dev');
const password = ref('');
const fullName = ref('');
const username = ref('');

// Birthday state
const birthMonth = ref('');
const birthDay = ref('');
const birthYear = ref('');

// Business state
const businessName = ref('');
const businessType = ref('');
const businessWebsite = ref('');

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

function nextStep() {
  error.value = null;
  if (signupStep.value === 1) {
    if (!email.value || !password.value || !fullName.value || !username.value) {
      error.value = t('error_fill_all');
      return;
    }
  } else if (signupStep.value === 2) {
    if (!birthMonth.value || !birthDay.value || !birthYear.value) {
      error.value = t('error_fill_all');
      return;
    }
  }
  
  if (signupStep.value < 3) {
    signupStep.value++;
  } else {
    handleSignupSubmit();
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

function selectLanguage(code: string) {
  setLocale(code);
  nextStep();
}

async function handleAction() {
  error.value = null;

  if (mode.value === 'login')
  {
    if (!email.value) return;
    loading.value = true;
    try {
      const res = await $fetch<{ session: any; error: string | null }>('/api/auth/login', {
        method: 'POST',
        body: { email: email.value, password: password.value },
      });

      if (res.error || !res.session)
      {
        error.value = res.error ?? t('error_login_failed');
        return;
      }

      devLogin(email.value);
      router.push(redirectTarget.value);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }
  else if (mode.value === 'signup')
  {
     if (signupStep.value < 3) {
        nextStep();
     } else {
        handleSignupSubmit();
     }
  }
  else if (mode.value === '2fa-setup')
  {
    if (verificationCode.value.length < 6)
    {
      error.value = t('error_invalid_code');
      return;
    }
    
    devLogin(email.value, {
      fullName: fullName.value,
      username: username.value,
      languagePreference: locale.value,
      has2fa: true,
    });
    
    openOnboarding();
    router.push(redirectTarget.value);
  }
}

function handleSignupSubmit() {
  if (enable2FA.value)
  {
    mode.value = '2fa-setup';
  }
  else
  {
    devLogin(email.value, {
      fullName: fullName.value,
      username: username.value,
      languagePreference: locale.value,
      has2fa: false,
    });
    
    openOnboarding();
    router.push(redirectTarget.value);
  }
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
</script>

<template>
  <div class="login-shell">
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
             <h2 class="login-title">{{ t('lang_picker_title') }}</h2>
             <p v-if="localizedEcho" class="login-echo">{{ localizedEcho }}</p>
             <p class="login-subtitle">{{ t('lang_picker_subtitle') }}</p>
           </div>
           
           <div class="lang-picker-list">
             <button
               v-for="lang in availableLocales"
               :key="lang.code"
               type="button"
               class="lang-option"
               @click="selectLanguage(lang.code)"
             >
               <span class="lang-option-native">{{ lang.nativeLabel }}</span>
               <span class="lang-option-translated" v-if="lang.code !== 'en' || locale !== 'en'">
                  {{ t(`lang_${lang.code}`) }}
               </span>
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
                  <div class="profile-upload">
                    <Camera class="w-6 h-6" style="color: rgba(104,41,58,0.4);" />
                  </div>
                  <span class="profile-upload-text">{{ t('upload_photo') }}</span>
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
                    <input id="signup-password" v-model="password" type="password" required class="field-input" :placeholder="t('field_password_placeholder')" />
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
                  <div class="field" style="grid-column: span 2;">
                    <label for="signup-business-name" class="field-label">{{ t('field_business_name') }}</label>
                    <input id="signup-business-name" v-model="businessName" type="text" class="field-input" :placeholder="t('field_business_name_placeholder')" />
                  </div>
                  <div class="field">
                    <label for="signup-business-type" class="field-label">{{ t('field_business_type') }}</label>
                    <input id="signup-business-type" v-model="businessType" type="text" class="field-input" :placeholder="t('field_business_type_placeholder')" />
                  </div>
                  <div class="field">
                    <label for="signup-business-website" class="field-label">{{ t('field_business_website') }}</label>
                    <input id="signup-business-website" v-model="businessWebsite" type="url" class="field-input" :placeholder="t('field_business_website_placeholder')" />
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
                 <button type="submit" :disabled="loading" class="login-submit">
                    {{ signupStep < 3 ? t('btn_continue') : t('btn_finish') }}
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
                <input
                  id="login-password"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  class="field-input"
                  placeholder="Enter password"
                />
              </div>
              
              <button
                id="login-submit"
                type="submit"
                :disabled="loading"
                class="login-submit"
              >
                {{ loading ? t('btn_signing_in') : t('btn_signin') }}
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
/* â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Content wrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Brand mark â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Lang Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.login-form { display: flex; flex-direction: column; gap: 1rem; }

/* â”€â”€ Signup Process â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.signup-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(104, 41, 58, 0.1);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #68293A;
  transition: width 0.3s ease;
}
.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(104, 41, 58, 0.4);
  text-transform: uppercase;
}
.progress-labels span.active {
  color: #68293A;
}

.step-header {
  margin-bottom: 0.5rem;
}
.step-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #68293A;
  margin: 0 0 0.25rem 0;
}
.step-desc {
  font-size: 0.85rem;
  color: rgba(104, 41, 58, 0.6);
  margin: 0;
  line-height: 1.4;
}

.signup-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}
.signup-actions button {
  margin-top: 0;
}

.signup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.birthday-grid {
  grid-template-columns: 2fr 1fr 1fr;
}

.field { display: flex; flex-direction: column; gap: 0.4rem; }

.field-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: rgba(104, 41, 58, 0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field-input {
  background: #FDFAF7;
  border: 1.5px solid rgba(104, 41, 58, 0.15);
  border-radius: 0.5rem;
  color: #68293A;
  font-size: 0.9rem;
  padding: 0.6rem 0.85rem;
  font-family: 'Inter', sans-serif;
  width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-input::placeholder { color: rgba(104, 41, 58, 0.3); }
.field-input:focus {
  outline: none;
  border-color: rgba(104, 41, 58, 0.45);
  box-shadow: 0 0 0 3px rgba(104, 41, 58, 0.07);
}

/* â”€â”€ Signup specific â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.profile-upload-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.profile-upload {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: rgba(104, 41, 58, 0.05);
  border: 1.5px dashed rgba(104, 41, 58, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
}
.profile-upload:hover {
  background: rgba(104, 41, 58, 0.08);
}
.profile-upload-text {
  font-size: 0.76rem;
  color: rgba(104, 41, 58, 0.5);
  font-weight: 600;
}

.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(104, 41, 58, 0.08);
}
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(104, 41, 58, 0.15);
  transition: .4s;
  border-radius: 20px;
}
.toggle-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}
input:checked + .toggle-slider {
  background-color: #68293A;
}
input:checked + .toggle-slider:before {
  transform: translateX(16px);
}
.toggle-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #68293A;
}

/* â”€â”€ 2FA specific â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(104, 41, 58, 0.03);
  border: 1px dashed rgba(104, 41, 58, 0.15);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
}
.qr-text {
  font-size: 0.85rem;
  color: rgba(104, 41, 58, 0.6);
  margin: 0;
  text-align: center;
}

/* â”€â”€ Error â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.login-error {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.5rem;
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #dc2626;
  font-size: 0.84rem;
  line-height: 1.5;
}
.login-error svg { width: 1rem; height: 1rem; flex-shrink: 0; }

/* â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.login-submit {
  width: 100%;
  padding: 0.75rem;
  background: #68293A;
  color: #F6E6D7;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 4px 16px rgba(104, 41, 58, 0.25);
  margin-top: 0.5rem;
  flex: 1;
}
.login-submit:hover    { opacity: 0.88; }
.login-submit:active   { transform: scale(0.98); }
.login-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* â”€â”€ Return button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.login-return {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  color: rgba(104, 41, 58, 0.68);
  border: 1.5px solid rgba(104, 41, 58, 0.12);
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  flex: 1;
}
.login-return:hover {
  border-color: rgba(104, 41, 58, 0.3);
  background: rgba(104, 41, 58, 0.03);
}

/* â”€â”€ Dev note & Links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.login-dev-note {
  font-size: 0.8rem;
  text-align: center;
  color: rgba(104, 41, 58, 0.5);
  margin: 0;
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

