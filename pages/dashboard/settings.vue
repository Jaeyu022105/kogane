<script setup lang="ts">
/**
 * Settings page — business branding, theme colors, and business creation.
 */

definePageMeta({ layout: 'dashboard' });

const { authHeaders }             = useAuth();
const { business, fetchBusiness, updateTheme } = useBusiness();

const businessName = ref('');
const saving       = ref(false);
const error        = ref<string | null>(null);
const success      = ref(false);

// Default palette mirrors the CSS variable defaults
const palette = reactive({
  primary:    '#3b82f6',
  secondary:  '#6366f1',
  accent:     '#a855f7',
  background: '#0f0f17',
});

onMounted(async () => {
  if (!business.value) await fetchBusiness();

  if (business.value) {
    businessName.value          = business.value.name;
    palette.primary    = business.value.colorPalette.primary    ?? palette.primary;
    palette.secondary  = business.value.colorPalette.secondary  ?? palette.secondary;
    palette.accent     = business.value.colorPalette.accent     ?? palette.accent;
    palette.background = business.value.colorPalette.background ?? palette.background;
  }
});

async function saveTheme() {
  saving.value  = true;
  error.value   = null;
  success.value = false;

  try {
    await updateTheme({ ...palette });
    success.value = true;
    setTimeout(() => (success.value = false), 2500);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

// Create business if it doesn't exist yet
async function createBusiness() {
  if (!businessName.value.trim()) return;
  saving.value = true;
  error.value  = null;

  try {
    const res = await $fetch<{ business: any; error: string | null }>('/api/businesses/create', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    { name: businessName.value.trim(), colorPalette: { ...palette } },
    });

    if (res.error) {
      error.value = res.error;
      return;
    }

    await fetchBusiness();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

const COLOR_FIELDS: Array<{ key: keyof typeof palette; label: string }> = [
  { key: 'primary',    label: 'Primary' },
  { key: 'secondary',  label: 'Secondary' },
  { key: 'accent',     label: 'Accent' },
  { key: 'background', label: 'Background' },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <header class="px-8 py-5 border-b border-white/8">
      <h1 class="text-xl font-bold text-white">Settings</h1>
      <p class="text-sm text-white/40 mt-0.5">Branding and business configuration</p>
    </header>

    <div class="px-8 py-6 max-w-2xl space-y-8">

      <!-- No business yet -->
      <div v-if="!business" class="glass rounded-2xl p-6 space-y-4">
        <h2 class="font-semibold text-white">Create Your Business</h2>
        <p class="text-sm text-white/50">Set up your workspace to start building.</p>
        <input
          v-model="businessName"
          class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
          placeholder="My Business Name"
        />
        <div v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{{ error }}</div>
        <button
          class="w-full py-2.5 bg-brand-primary hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-40"
          :disabled="!businessName.trim() || saving"
          @click="createBusiness"
        >
          {{ saving ? 'Setting up…' : 'Create Business' }}
        </button>
      </div>

      <!-- Theme editor -->
      <div v-if="business" class="glass rounded-2xl p-6 space-y-5">
        <h2 class="font-semibold text-white">Brand Colors</h2>

        <div class="grid grid-cols-2 gap-4">
          <div v-for="field in COLOR_FIELDS" :key="field.key" class="space-y-1.5">
            <label class="text-xs text-white/50">{{ field.label }}</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="palette[field.key]"
                class="w-9 h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer"
              />
              <input
                v-model="palette[field.key]"
                class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Preview swatches -->
        <div class="flex gap-2 pt-1">
          <div
            v-for="field in COLOR_FIELDS"
            :key="field.key"
            class="flex-1 h-8 rounded-lg transition-colors"
            :style="{ background: palette[field.key] }"
            :title="field.label"
          />
        </div>

        <div v-if="error"   class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{{ error }}</div>
        <div v-if="success" class="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">Theme saved!</div>

        <button
          class="w-full py-2.5 bg-brand-primary hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-brand-primary/20"
          :disabled="saving"
          @click="saveTheme"
        >
          {{ saving ? 'Saving…' : 'Save Theme' }}
        </button>
      </div>

      <!-- Business info -->
      <div v-if="business" class="glass rounded-2xl p-6 space-y-3">
        <h2 class="font-semibold text-white">Business Info</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-white/40">ID</span>
            <span class="text-white/70 font-mono text-xs">{{ business.id }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">Schema</span>
            <span class="text-white/70 font-mono text-xs">{{ business.schemaName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">Created</span>
            <span class="text-white/70 text-xs">{{ new Date(business.createdAt).toLocaleDateString() }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
