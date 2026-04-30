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

    showForm.value   = false;
    form.displayName = '';
    form.pin         = '';
    await loadInpoints();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

onMounted(loadInpoints);
watch(() => business.value?.id, loadInpoints);

const ROLE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  admin:     { bg: 'rgba(168,85,247,0.08)',  color: '#7c3aed', border: 'rgba(168,85,247,0.2)' },
  staff:     { bg: 'rgba(61,24,32,0.07)',    color: '#3d1820', border: 'rgba(61,24,32,0.18)' },
  inventory: { bg: 'rgba(22,163,74,0.08)',   color: '#15803d', border: 'rgba(22,163,74,0.2)' },
  cashier:   { bg: 'rgba(232,116,138,0.1)',  color: '#be4561', border: 'rgba(232,116,138,0.25)' },
};

function roleStyle(role: string) {
  return ROLE_STYLES[role] ?? { bg: 'rgba(61,24,32,0.05)', color: 'rgba(61,24,32,0.5)', border: 'rgba(61,24,32,0.15)' };
}
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <!-- Header -->
    <header
      class="px-8 py-5 flex items-center justify-between shrink-0"
      style="border-bottom: 1px solid rgba(61,24,32,0.1);"
    >
      <div>
        <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Terminals</h1>
        <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">Staff in-points and roles</p>
      </div>
      <button
        class="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
        style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
        @click="showForm = true"
      >
        + New Terminal
      </button>
    </header>

    <div class="px-8 py-7">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <div
          class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style="border-color: rgba(61,24,32,0.2); border-top-color: transparent;"
        />
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-2 gap-4">
        <div
          v-for="ip in inpoints"
          :key="ip.id"
          class="card rounded-2xl p-5 space-y-4 animate-pop"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="font-semibold text-sm" style="color: rgb(var(--shell-sidebar));">
                {{ ip.display_name }}
              </p>
              <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">
                Created {{ new Date(ip.created_at).toLocaleDateString() }}
              </p>
            </div>
            <span
              class="role-badge"
              :style="{
                background:   roleStyle(ip.role).bg,
                color:        roleStyle(ip.role).color,
                borderColor:  roleStyle(ip.role).border,
              }"
            >
              {{ ip.role }}
            </span>
          </div>

          <div class="flex gap-2 pt-1">
            <NuxtLink
              :to="`/dashboard/builder?inpoint=${ip.id}`"
              class="flex-1 text-center text-xs py-2 rounded-full font-medium transition-all"
              style="border: 1.5px solid rgba(61,24,32,0.18); color: rgba(61,24,32,0.65); text-decoration: none;"
            >
              Edit Layout
            </NuxtLink>
            <NuxtLink
              :to="`/inpoint/${ip.id}`"
              class="flex-1 text-center text-xs py-2 rounded-full font-semibold transition-all"
              style="background: rgb(var(--shell-pink)); color: #fff; text-decoration: none; box-shadow: 0 2px 8px rgba(232,116,138,0.3);"
            >
              Open Terminal →
            </NuxtLink>
          </div>
        </div>

        <div v-if="inpoints.length === 0" class="col-span-2">
          <EmptyState
            icon="⬡"
            title="No terminals yet"
            message="Create one to assign a staff role and layout"
          />
        </div>
      </div>
    </div>

    <!-- Create form modal -->
    <Transition name="v">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        style="background: rgba(61,24,32,0.35); backdrop-filter: blur(6px);"
        @click.self="showForm = false"
      >
        <div class="w-full max-w-sm bg-white rounded-3xl p-7 space-y-5 animate-pop shadow-warm-lg">
          <div>
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">New Terminal</h2>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Add a staff in-point with a role and PIN.</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Display Name</label>
              <input
                v-model="form.displayName"
                class="input-warm w-full px-4 py-2.5 text-sm"
                placeholder="Cashier 1"
              />
            </div>

            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">Role</label>
              <select
                v-model="form.role"
                class="input-warm w-full px-4 py-2.5 text-sm"
              >
                <option value="cashier">Cashier</option>
                <option value="inventory">Inventory</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">PIN (4–8 digits)</label>
              <input
                v-model="form.pin"
                type="password"
                inputmode="numeric"
                maxlength="8"
                class="input-warm w-full px-4 py-2.5 text-sm"
                placeholder="••••"
              />
            </div>
          </div>

          <div
            v-if="error"
            class="text-xs px-3 py-2 rounded-xl"
            style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
          >
            {{ error }}
          </div>

          <div class="flex gap-3 pt-1">
            <button
              class="flex-1 py-2.5 text-sm font-medium rounded-full transition-all"
              style="border: 1.5px solid rgba(61,24,32,0.18); color: rgba(61,24,32,0.65);"
              @click="showForm = false"
            >
              Cancel
            </button>
            <button
              class="flex-1 py-2.5 text-sm font-semibold rounded-full transition-all disabled:opacity-40"
              style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
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
