<script setup lang="ts">
definePageMeta({ layout: 'default' });

const router = useRouter();
const { isLoggedIn, devLogin, loadDevSession } = useAuth();

const email    = ref('admin@postfolio.dev');
const password = ref('');
const error    = ref<string | null>(null);
const loading  = ref(false);

// If already logged in, go straight to dashboard
onMounted(() => {
  loadDevSession();
  if (isLoggedIn.value) router.push('/dashboard');
});

async function handleLogin() {
  if (!email.value) return;
  loading.value = true;
  error.value   = null;

  try {
    const res = await $fetch<{ session: { userId: string; email: string; token: string } | null; error: string | null }>(
      '/api/auth/login',
      {
        method: 'POST',
        body:   { email: email.value, password: password.value },
      },
    );

    if (res.error || !res.session) {
      error.value = res.error ?? 'Login failed';
      return;
    }

    devLogin(email.value);
    router.push('/dashboard');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center px-4 relative overflow-hidden">
    <!-- Background glow -->
    <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-primary opacity-10 blur-3xl pointer-events-none" />
    <div class="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-accent opacity-10 blur-3xl pointer-events-none" />

    <div class="w-full max-w-sm animate-fade-in">
      <!-- Logo -->
      <div class="flex items-center gap-3 mb-8">
        <div class="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand-primary/30">
          P
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">Postfolio</h1>
          <p class="text-xs text-white/40">Internal tool builder</p>
        </div>
      </div>

      <!-- Card -->
      <div class="glass rounded-2xl p-8 space-y-5">
        <div>
          <h2 class="text-lg font-semibold text-white">Admin login</h2>
          <p class="text-sm text-white/40 mt-1">Sign in to manage your workspace</p>
        </div>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <div>
            <label class="text-xs text-white/50 block mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label class="text-xs text-white/50 block mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
              placeholder="••••••••"
            />
          </div>

          <div v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-brand-primary hover:brightness-110 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] shadow-lg shadow-brand-primary/25"
          >
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="text-xs text-white/25 text-center">
          Dev mode — any credentials are accepted
        </p>
      </div>
    </div>
  </div>
</template>
