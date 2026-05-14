<script setup lang="ts">
/**
 * Settings page — business branding, theme colors, and business creation.
 */

definePageMeta({ layout: 'dashboard' });

import { Check, Sparkles, Upload } from 'lucide-vue-next';

const { authHeaders }                        = useAuth();
const { business, fetchBusiness, updateTheme } = useBusiness();
const { openOnboarding }                     = useOnboarding();
const { isEnterprise }                       = useEnterpriseAccess();

const businessName  = ref('');
const saving        = ref(false);
const uploadingLogo = ref(false);
const error         = ref<string | null>(null);
const success       = ref(false);

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

  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
  input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    uploadingLogo.value = true;
    error.value         = null;

    try {
      const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'png';
      const form = new FormData();
      form.append('file',   file);
      form.append('bucket', 'assets');
      form.append('path',   `logo.${ext}`);

      const res = await $fetch<{ url: string; error: string | null }>('/api/storage/upload', {
        method: 'POST',
        body:   form,
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

const businessDetailItems = computed(() => {
  if (!business.value) return [];

  const items = [
    { label: 'ID',      value: business.value.id },
    { label: 'Created', value: new Date(business.value.createdAt).toLocaleDateString() },
  ];

  if (isEnterprise.value) {
    items.splice(1, 0, { label: 'Schema', value: business.value.schemaName });
  }

  return items;
});
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #F6E6D7 0%, #FFFFFF 18%);">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div class="px-10 pt-10 pb-8" style="border-bottom: 1px solid rgba(61,24,32,0.08);">
      <h1 class="font-serif font-normal text-2xl" style="color: rgb(var(--shell-sidebar));">Settings</h1>
      <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">Branding and business configuration</p>
    </div>

    <div class="px-10 py-8 max-w-xl space-y-10">

      <!-- ── No business yet ───────────────────────────────────── -->
      <section v-if="!business" class="space-y-4">
        <div>
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-2" style="color: rgba(61,24,32,0.3);">Setup</p>
          <h2 class="font-serif text-xl font-normal" style="color: rgb(var(--shell-sidebar));">Create your workspace</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.45);">Set up your business to start building internal tools.</p>
        </div>

        <input
          v-model="businessName"
          class="input-warm w-full px-4 py-3 text-sm"
          placeholder="My Business Name"
        />

        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ error }}
        </div>

        <button
          class="w-full py-3 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] btn-primary btn-ribbon"
          :disabled="!businessName.trim() || saving"
          @click="createBusiness"
        >
          {{ saving ? 'Setting up…' : 'Create business' }}
        </button>
      </section>

      <!-- ── Brand Colors ──────────────────────────────────────── -->
      <section v-if="business" class="space-y-5">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">Branding</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Brand colors</h2>
        </div>

        <!-- Logo -->
        <div class="flex items-center gap-4">
          <div
            class="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
            style="background: rgba(61,24,32,0.05); border: 1px solid rgba(61,24,32,0.1);"
          >
            <img v-if="business.logoUrl" :src="business.logoUrl" alt="Business logo" class="w-full h-full object-cover" />
            <span v-else class="text-xs font-mono" style="color: rgba(61,24,32,0.3);">Logo</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">Business logo</p>
            <p class="text-xs mt-0.5" style="color: rgba(61,24,32,0.4);">PNG, JPG, SVG, or WebP</p>
          </div>
          <button
            class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shrink-0 btn-ghost"
            :disabled="uploadingLogo"
            @click="uploadLogo"
          >
            <Upload class="w-3.5 h-3.5" />
            {{ uploadingLogo ? 'Uploading…' : 'Upload' }}
          </button>
        </div>

        <!-- Color swatches preview strip -->
        <div class="flex gap-2 h-2 rounded overflow-hidden">
          <div
            v-for="field in COLOR_FIELDS"
            :key="field.key"
            class="flex-1 transition-colors"
            :style="{ background: palette[field.key] }"
            :title="field.label"
          />
        </div>

        <!-- Color fields -->
        <div class="grid grid-cols-2 gap-4">
          <div v-for="field in COLOR_FIELDS" :key="field.key" class="space-y-2">
            <label class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.4);">
              {{ field.label }}
            </label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="palette[field.key]"
                class="w-8 h-8 rounded cursor-pointer shrink-0"
                style="border: 1.5px solid rgba(61,24,32,0.12); background: transparent; padding: 1px;"
              />
              <input
                v-model="palette[field.key]"
                class="input-warm flex-1 px-3 py-2 text-xs font-mono"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Feedback -->
        <div
          v-if="error"
          class="text-xs px-3 py-2 rounded"
          style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #dc2626;"
        >
          {{ error }}
        </div>

        <div
          v-if="success"
          class="text-xs px-3 py-2 rounded flex items-center gap-1.5"
          style="background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.18); color: #15803d;"
        >
          <Check class="w-3.5 h-3.5" /> Theme saved
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] btn-primary btn-ribbon"
          :disabled="saving"
          @click="saveTheme"
        >
          {{ saving ? 'Saving…' : 'Save theme' }}
        </button>
      </section>

      <!-- ── Business Info ──────────────────────────────────────── -->
      <section v-if="business" class="space-y-3">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">Info</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Business details</h2>
        </div>

        <div class="space-y-0">
          <div
            v-for="(item, i) in businessDetailItems"
            :key="i"
            class="flex items-center justify-between py-3"
            style="border-bottom: 1px solid rgba(61,24,32,0.06);"
          >
            <span class="text-[10px] font-mono uppercase tracking-widest" style="color: rgba(61,24,32,0.35);">
              {{ item.label }}
            </span>
            <span class="text-xs font-mono" style="color: rgba(61,24,32,0.6);">{{ item.value }}</span>
          </div>
        </div>
      </section>

      <!-- ── Workspace Setup ────────────────────────────────────── -->
      <section class="space-y-3">
        <div style="border-bottom: 1px solid rgba(61,24,32,0.08); padding-bottom: 0.75rem;">
          <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1" style="color: rgba(61,24,32,0.3);">Onboarding</p>
          <h2 class="font-serif text-lg font-normal" style="color: rgb(var(--shell-sidebar));">Workspace setup</h2>
          <p class="text-sm mt-1" style="color: rgba(61,24,32,0.4);">Re-run the wizard to reconfigure your business preset and workspace style.</p>
        </div>

        <button
          class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 btn-ghost"
          @click="openOnboarding"
        >
          <Sparkles class="w-4 h-4" style="color: rgb(232,116,138);" />
          Open setup wizard
        </button>
      </section>

    </div>
  </div>
</template>
