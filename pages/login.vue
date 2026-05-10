<script setup lang="ts">
import { Camera, QrCode } from 'lucide-vue-next';

definePageMeta({ layout: 'default' });

const router = useRouter();
const route  = useRoute();
const { isLoggedIn, devLogin, loadDevSession } = useAuth();

const mode = ref<'login' | 'signup' | '2fa-setup'>('login');

// Form state
const email    = ref('admin@postfolio.dev');
const password = ref('');
const fullName = ref('');
const username = ref('');
const enable2FA = ref(false);
const verificationCode = ref('');

const error    = ref<string | null>(null);
const loading  = ref(false);

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
  loadDevSession();
  if (isLoggedIn.value) router.push(redirectTarget.value);
});

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
        error.value = res.error ?? 'Login failed';
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
    if (!email.value || !password.value || !fullName.value || !username.value)
    {
      error.value = 'Please fill in all required fields.';
      return;
    }

    if (enable2FA.value)
    {
      mode.value = '2fa-setup';
    }
    else
    {
      devLogin(email.value, { fullName: fullName.value, username: username.value, has2fa: false });
      router.push(redirectTarget.value);
    }
  }
  else if (mode.value === '2fa-setup')
  {
    if (verificationCode.value.length < 6)
    {
      error.value = 'Please enter a valid 6-digit code.';
      return;
    }
    
    devLogin(email.value, { fullName: fullName.value, username: username.value, has2fa: true });
    router.push(redirectTarget.value);
  }
}
</script>

<template>
  <div class="login-shell">
    <!-- background blobs -->
    <div class="login-blob login-blob--top" />
    <div class="login-blob login-blob--bottom" />

    <div class="login-wrap" :class="{ 'login-wrap--wide': mode === 'signup' }">
      <!-- brand mark -->
      <div class="login-brand" :style="mode === 'signup' ? 'justify-content: center;' : ''">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12h8 M8 8h5 M8 16h6" />
          </svg>
        </div>
        <div>
          <h1 class="brand-name">
            <span class="brand-name-pink">Post</span>folio
          </h1>
          <p class="brand-tagline">Internal tool builder</p>
        </div>
      </div>

      <!-- card -->
      <div class="login-card">
        <div class="login-card-header" :style="mode === 'signup' ? 'text-align: center;' : ''">
          <h2 class="login-title">
            {{ mode === 'login' ? 'Admin login' : mode === 'signup' ? 'Create an account' : 'Set up 2FA' }}
          </h2>
          <p class="login-subtitle">
            <template v-if="mode === 'login'">
              {{ exitTarget ? 'Sign in to continue to the admin view.' : 'Sign in to manage your workspace.' }}
            </template>
            <template v-else-if="mode === 'signup'">
              Get started by creating your administrator profile.
            </template>
            <template v-else>
              Scan the QR code with your authenticator app and enter the code below.
            </template>
          </p>
        </div>

        <form class="login-form" @submit.prevent="handleAction">
          
          <template v-if="mode === 'signup'">
            <!-- Profile upload -->
            <div class="profile-upload-wrapper">
              <div class="profile-upload">
                <Camera class="w-6 h-6" style="color: rgba(104,41,58,0.4);" />
              </div>
              <span class="profile-upload-text">Upload photo</span>
            </div>

            <div class="signup-grid">
              <div class="field">
                <label for="signup-fullname" class="field-label">Full Name</label>
                <input id="signup-fullname" v-model="fullName" type="text" required class="field-input" placeholder="Jane Doe" />
              </div>
              <div class="field">
                <label for="signup-username" class="field-label">Username</label>
                <input id="signup-username" v-model="username" type="text" required class="field-input" placeholder="janedoe" />
              </div>
              <div class="field">
                <label for="signup-email" class="field-label">Email</label>
                <input id="signup-email" v-model="email" type="email" required class="field-input" placeholder="you@company.com" />
              </div>
              <div class="field">
                <label for="signup-password" class="field-label">Password</label>
                <input id="signup-password" v-model="password" type="password" required class="field-input" placeholder="········" />
              </div>
            </div>

            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" v-model="enable2FA" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Enable Two-Factor Authentication</span>
            </div>
          </template>

          <template v-if="mode === 'login'">
            <div class="field">
              <label for="login-email" class="field-label">Email</label>
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
              <label for="login-password" class="field-label">Password</label>
              <input
                id="login-password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                class="field-input"
                placeholder="········"
              />
            </div>
          </template>

          <template v-if="mode === '2fa-setup'">
            <div class="qr-placeholder">
              <QrCode class="w-16 h-16" style="color: #68293A;" />
              <p class="qr-text">Scan with Authy, Google Authenticator, etc.</p>
            </div>
            <div class="field">
              <label for="2fa-code" class="field-label">Verification Code</label>
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
          </template>

          <div v-if="error" class="login-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {{ error }}
          </div>

          <button
            id="login-submit"
            type="submit"
            :disabled="loading"
            class="login-submit"
          >
            {{ mode === 'login' ? (loading ? 'Signing in…' : 'Sign in') : mode === 'signup' ? (enable2FA ? 'Continue to 2FA' : 'Sign up') : 'Complete setup' }}
          </button>
        </form>

        <p v-if="mode === 'login'" class="login-dev-note">
          Don't have an account? <a href="#" @click.prevent="mode = 'signup'" class="link-text">Sign up</a>
        </p>
        <p v-else-if="mode === 'signup'" class="login-dev-note">
          Already have an account? <a href="#" @click.prevent="mode = 'login'" class="link-text">Sign in</a>
        </p>
        <p v-else-if="mode === '2fa-setup'" class="login-dev-note">
          <a href="#" @click.prevent="mode = 'signup'" class="link-text">Back to sign up</a>
        </p>

        <button
          v-if="exitTarget && mode === 'login'"
          class="login-return"
          @click="leaveLoginPage"
        >
          Return to terminal
        </button>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────────── */
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

/* ── Content wrap ─────────────────────────────────────── */
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

/* ── Brand mark ───────────────────────────────────────── */
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
.brand-name-pink { color: #FF5776; }

.brand-tagline {
  font-size: 0.76rem;
  color: rgba(104, 41, 58, 0.45);
  margin: 0.2rem 0 0;
}

/* ── Card ─────────────────────────────────────────────── */
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

/* ── Form ─────────────────────────────────────────────── */
.login-form { display: flex; flex-direction: column; gap: 1rem; }

.signup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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

/* ── Signup specific ───────────────────────────────────── */
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

/* ── 2FA specific ─────────────────────────────────────── */
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

/* ── Error ────────────────────────────────────────────── */
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

/* ── Submit ───────────────────────────────────────────── */
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
}
.login-submit:hover    { opacity: 0.88; }
.login-submit:active   { transform: scale(0.98); }
.login-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Return button ────────────────────────────────────── */
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
}
.login-return:hover {
  border-color: rgba(104, 41, 58, 0.3);
  background: rgba(104, 41, 58, 0.03);
}

/* ── Dev note & Links ─────────────────────────────────── */
.login-dev-note {
  font-size: 0.8rem;
  text-align: center;
  color: rgba(104, 41, 58, 0.5);
  margin: 0;
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
}
</style>
