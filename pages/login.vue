<script setup lang="ts">
definePageMeta({ layout: 'default' });

const router = useRouter();
const route = useRoute();
const { isLoggedIn, devLogin, loadDevSession } = useAuth();

const email = ref('admin@postfolio.dev');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

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
  if (exitTarget.value) {
    router.push(exitTarget.value);
  }
}

onMounted(() => {
  loadDevSession();
  if (isLoggedIn.value) router.push(redirectTarget.value);
});

async function handleLogin() {
  if (!email.value) return;
  loading.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ session: { userId: string; email: string; token: string } | null; error: string | null }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: { email: email.value, password: password.value },
      },
    );

    if (res.error || !res.session) {
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
</script>

<template>
  <div
    class="min-h-dvh flex items-center justify-center px-4 relative overflow-hidden"
    style="background: rgb(var(--shell-bg));"
  >
    <div
      class="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none"
      style="background: radial-gradient(circle, rgba(232,116,138,0.18) 0%, transparent 70%);"
    />
    <div
      class="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full pointer-events-none"
      style="background: radial-gradient(circle, rgba(61,24,32,0.08) 0%, transparent 70%);"
    />

    <div class="w-full max-w-sm animate-fade-in relative">
      <div class="flex items-center gap-3 mb-8">
        <div
          class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-warm"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));"
        >
          P
        </div>
        <div>
          <h1 class="font-serif text-xl leading-none" style="color: rgb(var(--shell-sidebar));">
            <span style="color: rgb(var(--shell-pink));">Post</span><strong>folio</strong>
          </h1>
          <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">Internal tool builder</p>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-8 space-y-5 shadow-warm-lg">
        <div>
          <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Admin login</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.45);">
            {{ exitTarget ? 'Sign in to continue to the admin view, or return to the terminal.' : 'Sign in to manage your workspace.' }}
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <div>
            <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="input-warm w-full px-4 py-2.5 text-sm"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Password</label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="input-warm w-full px-4 py-2.5 text-sm"
              placeholder="........"
            />
          </div>

          <div
            v-if="error"
            class="text-xs px-3 py-2 rounded-xl"
            style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
          >
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 text-sm font-semibold rounded-full transition-all active:scale-[0.98] disabled:opacity-50"
            style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 4px 16px rgba(61,24,32,0.25);"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <button
          v-if="exitTarget"
          class="w-full py-3 text-sm font-medium rounded-full transition-all"
          style="border: 1px solid rgba(61,24,32,0.12); color: rgba(61,24,32,0.68);"
          @click="leaveLoginPage"
        >
          Return to terminal
        </button>

        <p class="text-xs text-center" style="color: rgba(61,24,32,0.3);">
          Dev mode - any credentials are accepted
        </p>
      </div>
    </div>
  </div>
</template>
