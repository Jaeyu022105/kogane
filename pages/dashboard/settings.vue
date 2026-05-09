<script setup lang="ts">
/**
 * Settings page — business branding, theme colors, and business creation.
 */

definePageMeta({ layout: 'dashboard' });

import { Check, Sparkles } from 'lucide-vue-next';

const { authHeaders }             = useAuth();
const { business, fetchBusiness, updateTheme } = useBusiness();
const { openOnboarding }          = useOnboarding();

const businessName = ref('');
const saving       = ref(false);
const uploadingLogo = ref(false);
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

async function uploadLogo() {
  if (!import.meta.client) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
  input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    uploadingLogo.value = true;
    error.value = null;

    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
      const form = new FormData();
      form.append('file', file);
      form.append('bucket', 'assets');
      form.append('path', `logo.${ext}`);

      const res = await $fetch<{ url: string; error: string | null }>('/api/storage/upload', {
        method: 'POST',
        body: form,
      });

      if (res.error) {
        error.value = res.error;
        return;
      }

      await updateTheme({ ...palette }, res.url);
      if (business.value) business.value.logoUrl = res.url;
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      uploadingLogo.value = false;
    }
  };
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
      <div v-if="!business" class="bg-white rounded-xl p-6 space-y-4 shadow-warm">
        <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Create Your Business</h2>
        <p class="text-sm" style="color: rgba(61,24,32,0.5);">Set up your workspace to start building.</p>
        <input
          v-model="businessName"
          class="input-warm w-full px-4 py-2.5 text-sm"
          placeholder="My Business Name"
        />
        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded-md"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
        >
          {{ error }}
        </div>
        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
          :disabled="!businessName.trim() || saving"
          @click="createBusiness"
        >
          {{ saving ? 'Setting up…' : 'Create Business' }}
        </button>
      </div>

      <!-- Theme editor -->
      <div v-if="business" class="bg-white rounded-xl p-6 space-y-5 shadow-warm">
        <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Brand Colors</h2>

        <div class="flex items-center gap-4 rounded-xl border px-4 py-4" style="border-color: rgba(61,24,32,0.08);">
          <div class="h-16 w-16 overflow-hidden rounded-xl border bg-[#f7f1eb]" style="border-color: rgba(61,24,32,0.08);">
            <img v-if="business.logoUrl" :src="business.logoUrl" alt="Business logo" class="h-full w-full object-cover" />
            <div v-else class="h-full w-full flex items-center justify-center text-sm font-semibold" style="color: rgba(61,24,32,0.35);">Logo</div>
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Business Logo</p>
            <p class="text-xs mt-1" style="color: rgba(61,24,32,0.45);">Stored through the shared upload abstraction.</p>
          </div>
          <button
            class="rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40"
            style="background: rgba(61,24,32,0.08); color: rgb(var(--shell-sidebar));"
            :disabled="uploadingLogo"
            @click="uploadLogo"
          >
            {{ uploadingLogo ? 'Uploading...' : 'Upload Logo' }}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div v-for="field in COLOR_FIELDS" :key="field.key" class="space-y-2">
            <label class="text-xs font-semibold" style="color: rgba(61,24,32,0.55);">{{ field.label }}</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="palette[field.key]"
                class="w-9 h-9 rounded-md cursor-pointer"
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
            class="flex-1 h-7 rounded-md transition-colors"
            :style="{ background: palette[field.key] }"
            :title="field.label"
          />
        </div>

        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded-md"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #dc2626;"
        >
          {{ error }}
        </div>
        <div
          v-if="success"
          class="text-xs px-3 py-2 rounded-md"
          style="background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.2); color: #15803d;"
        >
          <div class="flex items-center gap-1.5">
            Theme saved! <Check class="w-3.5 h-3.5" />
          </div>
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40"
          style="background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text)); box-shadow: 0 2px 8px rgba(61,24,32,0.2);"
          :disabled="saving"
          @click="saveTheme"
        >
          {{ saving ? 'Saving…' : 'Save Theme' }}
        </button>
      </div>

      <!-- Business info -->
      <div v-if="business" class="bg-white rounded-xl p-6 space-y-3 shadow-warm">
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

      <!-- Workspace setup -->
      <div class="bg-white rounded-xl p-6 space-y-3 shadow-warm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Workspace Setup</h2>
            <p class="text-sm mt-1" style="color: rgba(61,24,32,0.5);">Re-run the onboarding wizard to configure your business type and feature tables.</p>
          </div>
          <div
            class="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style="background: rgba(232,116,138,0.1);"
          >
            <Sparkles class="w-5 h-5" style="color: rgb(232,116,138);" />
          </div>
        </div>
        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all active:scale-[0.98]"
          style="background: rgba(61,24,32,0.06); color: rgb(var(--shell-sidebar)); border: 1.5px solid rgba(61,24,32,0.12);"
          @click="openOnboarding"
        >
          Open setup wizard
        </button>
      </div>

    </div>
  </div>
</template>
