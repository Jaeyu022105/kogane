<script setup lang="ts">
/**
 * Settings page — business branding, theme colors, and business creation.
 */

definePageMeta({ layout: 'dashboard' });

import { Check } from 'lucide-vue-next';

const { authHeaders }             = useAuth();
const { business, fetchBusiness, updateTheme } = useBusiness();

const businessName = ref('');
const saving       = ref(false);
const error        = ref<string | null>(null);
const success      = ref(false);

const palette = reactive({
  primary:    '#3b82f6',
  secondary:  '#6366f1',
  accent:     '#a855f7',
  background: '#0f0f17',
});

onMounted(async () => {
  if (!business.value) await fetchBusiness();

  if (business.value) {
    businessName.value = business.value.name;
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
  <div class="flex-1 overflow-y-auto" style="background: rgb(var(--shell-bg));">
    <header
      class="px-8 py-5"
      style="border-bottom: 1px solid rgba(61,24,32,0.1);"
    >
      <h1 class="font-serif text-2xl font-normal" style="color: rgb(var(--shell-sidebar));">Settings</h1>
      <p class="text-sm mt-0.5" style="color: rgba(61,24,32,0.45);">Branding and business configuration</p>
    </header>

    <div class="px-8 py-7 max-w-2xl space-y-6">

      <!-- No business yet -->
      <div v-if="!business" class="bg-white rounded-2xl p-6 space-y-4 shadow-warm">
        <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Create Your Business</h2>
        <p class="text-sm" style="color: rgba(61,24,32,0.5);">Set up your workspace to start building.</p>
        <input
          v-model="businessName"
          class="input-warm w-full px-4 py-2.5 text-sm"
          placeholder="My Business Name"
        />
        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded-xl"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
        >
          {{ error }}
        </div>
        <button
          class="w-full py-2.5 text-sm font-semibold rounded-full transition-all disabled:opacity-40"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
          :disabled="!businessName.trim() || saving"
          @click="createBusiness"
        >
          {{ saving ? 'Setting up…' : 'Create Business' }}
        </button>
      </div>

      <!-- Theme editor -->
      <div v-if="business" class="bg-white rounded-2xl p-6 space-y-5 shadow-warm">
        <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Brand Colors</h2>

        <div class="grid grid-cols-2 gap-4">
          <div v-for="field in COLOR_FIELDS" :key="field.key" class="space-y-2">
            <label class="text-xs font-semibold" style="color: rgba(61,24,32,0.55);">{{ field.label }}</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="palette[field.key]"
                class="w-9 h-9 rounded-lg cursor-pointer"
                style="border: 1.5px solid rgba(61,24,32,0.15); background: transparent;"
              />
              <input
                v-model="palette[field.key]"
                class="input-warm flex-1 px-3 py-1.5 text-sm font-mono"
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
            class="flex-1 h-7 rounded-full transition-colors"
            :style="{ background: palette[field.key] }"
            :title="field.label"
          />
        </div>

        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded-xl"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
        >
          {{ error }}
        </div>
        <div
          v-if="success"
          class="text-xs px-3 py-2 rounded-xl"
          style="background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.2); color: #15803d;"
        >
          <div class="flex items-center gap-1.5">
            Theme saved! <Check class="w-3.5 h-3.5" />
          </div>
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-full transition-all disabled:opacity-40"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
          :disabled="saving"
          @click="saveTheme"
        >
          {{ saving ? 'Saving…' : 'Save Theme' }}
        </button>
      </div>

      <!-- Business info -->
      <div v-if="business" class="bg-white rounded-2xl p-6 space-y-3 shadow-warm">
        <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Business Info</h2>
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
            <span class="text-xs font-semibold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">ID</span>
            <span class="text-xs font-mono" style="color: rgba(61,24,32,0.65);">{{ business.id }}</span>
          </div>
          <div class="flex justify-between items-center py-2" style="border-bottom: 1px solid rgba(61,24,32,0.07);">
            <span class="text-xs font-semibold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">Schema</span>
            <span class="text-xs font-mono" style="color: rgba(61,24,32,0.65);">{{ business.schemaName }}</span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="text-xs font-semibold uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">Created</span>
            <span class="text-xs" style="color: rgba(61,24,32,0.65);">{{ new Date(business.createdAt).toLocaleDateString() }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
