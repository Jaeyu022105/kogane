<script setup lang="ts">
/**
 * Terminals page — create and manage in-point staff accounts.
 */

definePageMeta({ layout: 'dashboard' });

const { authHeaders } = useAuth();
const { business }    = useBusiness();

const inpoints  = ref<any[]>([]);
const loading   = ref(false);
const showForm  = ref(false);
const saving    = ref(false);
const error     = ref<string | null>(null);

const form = reactive({
  displayName: '',
  role:        'staff',
  pin:         '',
});

async function loadInpoints() {
  if (!business.value) return;
  loading.value = true;

  try {
    const res = await $fetch<{ inpoints: any[] }>('/api/inpoints', {
      headers: authHeaders(),
      query:   { businessId: business.value.id },
    });
    inpoints.value = res.inpoints ?? [];
  } finally {
    loading.value = false;
  }
}

async function createInpoint() {
  if (!business.value) return;
  if (!form.displayName.trim() || !form.pin) return;

  saving.value = true;
  error.value  = null;

  try {
    const res = await $fetch<{ error: string | null }>('/api/inpoints/create', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    {
        businessId:  business.value.id,
        displayName: form.displayName.trim(),
        role:        form.role,
        pin:         form.pin,
      },
    });

    if (res.error) {
      error.value = res.error;
      return;
    }

    showForm.value      = false;
    form.displayName    = '';
    form.pin            = '';
    await loadInpoints();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

onMounted(loadInpoints);
watch(() => business.value?.id, loadInpoints);

const ROLE_COLORS: Record<string, string> = {
  admin:     'text-purple-400 bg-purple-500/10 border-purple-500/20',
  staff:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  inventory: 'text-green-400 bg-green-500/10 border-green-500/20',
  cashier:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
};
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <header class="px-8 py-5 border-b border-white/8 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Terminals</h1>
        <p class="text-sm text-white/40 mt-0.5">Staff in-points and roles</p>
      </div>
      <button
        class="flex items-center gap-2 bg-brand-primary hover:brightness-110 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-brand-primary/20"
        @click="showForm = true"
      >
        + New Terminal
      </button>
    </header>

    <div class="px-8 py-6">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>

      <div v-else class="grid grid-cols-2 gap-4">
        <div
          v-for="ip in inpoints"
          :key="ip.id"
          class="glass rounded-2xl p-5 space-y-3 animate-fade-in"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="font-semibold text-white">{{ ip.display_name }}</p>
              <p class="text-xs text-white/40 mt-0.5">Created {{ new Date(ip.created_at).toLocaleDateString() }}</p>
            </div>
            <span
              :class="['text-xs px-2 py-0.5 rounded-full border font-medium', ROLE_COLORS[ip.role] ?? 'text-white/50 bg-white/5 border-white/10']"
            >
              {{ ip.role }}
            </span>
          </div>
          <div class="flex gap-2">
            <NuxtLink
              :to="`/dashboard/builder?inpoint=${ip.id}`"
              class="flex-1 text-center text-xs py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
            >
              Edit Layout
            </NuxtLink>
            <NuxtLink
              :to="`/inpoint/${ip.id}`"
              class="flex-1 text-center text-xs py-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:brightness-125 transition-all"
            >
              Open Terminal →
            </NuxtLink>
          </div>
        </div>

        <div v-if="inpoints.length === 0" class="col-span-2 text-center py-16 text-white/30 text-sm">
          No terminals yet — create one to assign a staff role and layout
        </div>
      </div>
    </div>

    <!-- Create form modal -->
    <Transition name="v">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        style="background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);"
        @click.self="showForm = false"
      >
        <div class="w-full max-w-sm glass rounded-2xl p-6 space-y-4 animate-slide-up">
          <h2 class="font-semibold text-white">New Terminal</h2>

          <div>
            <label class="text-xs text-white/50 block mb-1.5">Display Name</label>
            <input
              v-model="form.displayName"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="Cashier 1"
            />
          </div>

          <div>
            <label class="text-xs text-white/50 block mb-1.5">Role</label>
            <select
              v-model="form.role"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="cashier">Cashier</option>
              <option value="inventory">Inventory</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label class="text-xs text-white/50 block mb-1.5">PIN (4–8 digits)</label>
            <input
              v-model="form.pin"
              type="password"
              inputmode="numeric"
              maxlength="8"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="••••"
            />
          </div>

          <div v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {{ error }}
          </div>

          <div class="flex gap-3 pt-1">
            <button
              class="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm transition-all"
              @click="showForm = false"
            >
              Cancel
            </button>
            <button
              class="flex-1 py-2.5 rounded-xl bg-brand-primary hover:brightness-110 disabled:opacity-40 text-white font-semibold text-sm transition-all"
              :disabled="!form.displayName || !form.pin || saving"
              @click="createInpoint"
            >
              {{ saving ? 'Creating…' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
