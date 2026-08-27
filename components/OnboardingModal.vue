<script setup lang="ts">
import {
  UtensilsCrossed,
  Truck,
  Calculator,
  ShoppingBag,
  Stethoscope,
  Wrench,
  GraduationCap,
  Building2,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  UploadCloud,
  AlertTriangle,
  X
} from 'lucide-vue-next';
import type { SchemaDef, TableDef } from '~/lib/schemaUtils';
import { TERMINAL_PERMISSION_PRESETS, type PermissionPresetKey } from '~/lib/permissions';
import { defaultLayoutVariantForPreset, inferStarterTerminals, layoutVariantsForPreset } from '~/lib/starterWorkstations';
import { UI_LAYOUT_BUNDLES, buildBusinessPalette, extractPaletteFromLogoDataUrl, type LayoutBundleKey, type ParticleEffect, type SurfaceStyle } from '~/lib/workspaceBranding';

const emit = defineEmits<{ done: [], close: [] }>();

const { authHeaders } = useAuth();
const { business, fetchBusiness } = useBusiness();
const { t, locale } = useLocale();

// ── Step state ────────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3 | 4>(1);

// Step 1: Basics
const businessName = ref('');
const logoUrl = ref<string | null>(null);
const colorPalette = ref(buildBusinessPalette('#68293A'));
const selectedType = ref<string | null>(null);
const uiStyle = ref('warm-minimal');
const layoutBundle = ref<LayoutBundleKey>('aurora-service');
const surfaceStyle = ref<SurfaceStyle>('rounded');
const particleEffect = ref<ParticleEffect>('none');

// Step 2: Features
const selectedPreset  = ref<string | null>(null);
const selectedFeatures = ref<Set<string>>(new Set());
const terminalStylePlan = ref<Record<string, { displayName: string; layoutVariant: string }>>({});

const submitting = ref(false);
const submitError = ref<string | null>(null);

async function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    logoUrl.value = reader.result as string;

    try {
      colorPalette.value = await extractPaletteFromLogoDataUrl(logoUrl.value, layoutBundle.value);
    } catch {
      colorPalette.value = buildBusinessPalette(colorPalette.value.primary, layoutBundle.value);
    }
  };
  reader.readAsDataURL(file);
}

// ── Business types ────────────────────────────────────────────────────────────
const businessTypes = computed(() => [
  { id: 'restaurant',  label: t('ind_restaurant_label'),  icon: UtensilsCrossed, color: '#e8748a' },
  { id: 'logistics',   label: t('ind_logistics_label'),   icon: Truck,           color: '#8b5cf6' },
  { id: 'accounting',  label: t('ind_accounting_label'),  icon: Calculator,      color: '#10b981' },
  { id: 'retail',      label: t('ind_retail_label'),      icon: ShoppingBag,     color: '#f59e0b' },
  { id: 'clinic',      label: t('ind_clinic_label'),      icon: Stethoscope,     color: '#3b82f6' },
  { id: 'services',    label: t('ind_services_label'),    icon: Wrench,          color: '#ec4899' },
  { id: 'education',   label: t('ind_education_label'),   icon: GraduationCap,   color: '#14b8a6' },
  { id: 'other',       label: t('ind_other_label'),       icon: Building2,       color: '#6b7280' },
]);

const UI_STYLE_PRESETS = computed(() => [
  {
    id: 'warm-minimal',
    label: t('style_warm_label'),
    description: t('style_warm_desc'),
    swatches: ['#68293A', '#F6E6D7', '#FF5776'],
  },
  {
    id: 'compact-ops',
    label: t('style_compact_label'),
    description: t('style_compact_desc'),
    swatches: ['#1F2937', '#E5E7EB', '#0EA5E9'],
  },
  {
    id: 'high-contrast',
    label: t('style_contrast_label'),
    description: t('style_contrast_desc'),
    swatches: ['#111827', '#FFFFFF', '#22C55E'],
  },
  {
    id: 'editorial',
    label: t('style_editorial_label'),
    description: t('style_editorial_desc'),
    swatches: ['#3D1820', '#FFF7ED', '#F59E0B'],
  },
]);

const SURFACE_STYLE_OPTIONS: Array<{ id: SurfaceStyle; label: string; description: string }> = [
  { id: 'rounded', label: t('surface_rounded_label'), description: t('surface_rounded_desc') },
  { id: 'square', label: t('surface_square_label'), description: t('surface_square_desc') },
];

const PARTICLE_OPTIONS: Array<{ id: ParticleEffect; label: string; description: string }> = [
  { id: 'none', label: t('ambient_none_label'), description: t('ambient_none_desc') },
  { id: 'floating-orbs', label: t('ambient_orbs_label'), description: t('ambient_orbs_desc') },
  { id: 'soft-grid', label: t('ambient_grid_label'), description: t('ambient_grid_desc') },
];

// ── Feature catalogue ──────────────────────────────────────────────────────────
interface Feature {
  id: string;
  label: string;
  description: string;
  availableFor: string[];
  tables: TableDef[];
}

const FEATURES: Feature[] = [
  {
    id: 'orders',
    label: 'Order Tracking',
    description: 'Track customer orders and their statuses',
    availableFor: ['restaurant', 'retail', 'logistics', 'other'],
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'items',             type: 'text',    nullable: false },
          { name: 'line_items',        type: 'text',    nullable: true },
          { name: 'total',             type: 'numeric', nullable: false },
          { name: 'status',            type: 'text',    nullable: false, default: "'pending'" },
          { name: 'table_number',      type: 'text',    nullable: true },
          { name: 'staff_name',        type: 'text',    nullable: true },
          { name: 'payment_method',    type: 'text',    nullable: true },
          { name: 'payment_status',    type: 'text',    nullable: true },
          { name: 'payment_reference', type: 'text',    nullable: true },
          { name: 'receipt_number',    type: 'text',    nullable: true },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Manage stock levels and product catalog',
    availableFor: ['restaurant', 'retail', 'logistics', 'other'],
    tables: [
      {
        name: 'products',
        columns: [
          { name: 'name',        type: 'text',    nullable: false },
          { name: 'sku',         type: 'text',    nullable: true,  unique: true },
          { name: 'category',    type: 'text',    nullable: true },
          { name: 'unit_price',  type: 'numeric', nullable: true },
          { name: 'stock_qty',   type: 'integer', nullable: false, default: '0' },
          { name: 'reorder_at',  type: 'integer', nullable: true },
        ],
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customer Records',
    description: 'Store and manage customer profiles',
    availableFor: ['restaurant', 'retail', 'logistics', 'accounting', 'clinic', 'services', 'education', 'other'],
    tables: [
      {
        name: 'customers',
        columns: [
          { name: 'full_name', type: 'text', nullable: false },
          { name: 'email',     type: 'text', nullable: true,  unique: true },
          { name: 'phone',     type: 'text', nullable: true },
          { name: 'address',   type: 'text', nullable: true },
          { name: 'notes',     type: 'text', nullable: true },
        ],
      },
    ],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    description: 'Track employees, roles, and schedules',
    availableFor: ['restaurant', 'retail', 'logistics', 'accounting', 'clinic', 'services', 'education', 'other'],
    tables: [
      {
        name: 'staff',
        columns: [
          { name: 'full_name', type: 'text', nullable: false },
          { name: 'role',      type: 'text', nullable: false },
          { name: 'email',     type: 'text', nullable: true },
          { name: 'phone',     type: 'text', nullable: true },
          { name: 'active',    type: 'boolean', nullable: false, default: '1' },
        ],
      },
    ],
  },
  {
    id: 'appointments',
    label: 'Appointments',
    description: 'Schedule and track bookings or appointments',
    availableFor: ['clinic', 'services', 'education', 'restaurant', 'other'],
    tables: [
      {
        name: 'appointments',
        columns: [
          { name: 'customer_name', type: 'text',        nullable: false },
          { name: 'staff_id',      type: 'text',        nullable: true },
          { name: 'scheduled_at', type: 'timestamptz', nullable: false },
          { name: 'duration_min', type: 'integer',     nullable: true },
          { name: 'status',       type: 'text',        nullable: false, default: "'scheduled'" },
          { name: 'notes',        type: 'text',        nullable: true },
        ],
      },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoicing',
    description: 'Generate and track client invoices',
    availableFor: ['accounting', 'services', 'clinic', 'education', 'other'],
    tables: [
      {
        name: 'invoices',
        columns: [
          { name: 'invoice_number', type: 'text',    nullable: false, unique: true },
          { name: 'client_name',    type: 'text',    nullable: false },
          { name: 'issue_date',     type: 'date',    nullable: false },
          { name: 'due_date',       type: 'date',    nullable: true },
          { name: 'total_amount',   type: 'numeric', nullable: false },
          { name: 'paid',           type: 'boolean', nullable: false, default: '0' },
        ],
      },
    ],
  },
  {
    id: 'expenses',
    label: 'Expense Tracking',
    description: 'Log and categorise business expenses',
    availableFor: ['accounting', 'services', 'education', 'other'],
    tables: [
      {
        name: 'expenses',
        columns: [
          { name: 'description', type: 'text',    nullable: false },
          { name: 'category',    type: 'text',    nullable: true },
          { name: 'amount',      type: 'numeric', nullable: false },
          { name: 'expense_date',type: 'date',    nullable: false },
          { name: 'receipt_url', type: 'text',    nullable: true },
        ],
      },
    ],
  },
  {
    id: 'deliveries',
    label: 'Deliveries',
    description: 'Track delivery routes and statuses',
    availableFor: ['logistics', 'retail', 'other'],
    tables: [
      {
        name: 'deliveries',
        columns: [
          { name: 'tracking_code',  type: 'text', nullable: false, unique: true },
          { name: 'origin',         type: 'text', nullable: true },
          { name: 'destination',    type: 'text', nullable: false },
          { name: 'status',         type: 'text', nullable: false, default: "'pending'" },
          { name: 'driver_name',    type: 'text', nullable: true },
          { name: 'delivered_at',   type: 'timestamptz', nullable: true },
        ],
      },
    ],
  },
];

const availableFeaturesForType = computed(() => {
  if (!selectedType.value) return FEATURES;
  return FEATURES.filter(f => f.availableFor.includes(selectedType.value!));
});

// ── Presets ───────────────────────────────────────────────────────────────────
interface Preset {
  id: string;
  label: string;
  description: string;
  features: string[];
}

const PRESETS_BY_TYPE: Record<string, Preset[]> = {
  restaurant: [
    { id: 'fast-food',  label: 'Fast Food',   description: 'Quick service, high volume', features: ['orders', 'inventory', 'staff'] },
    { id: 'fine-dining',label: 'Fine Dining', description: 'Reservations and full service', features: ['orders', 'appointments', 'customers', 'staff'] },
    { id: 'cafe',       label: 'Cafe',        description: 'Drinks, light bites, loyalty', features: ['orders', 'inventory', 'customers'] },
  ],
  logistics: [
    { id: 'courier',    label: 'Courier',     description: 'Last-mile delivery tracking', features: ['deliveries', 'customers', 'staff'] },
    { id: 'warehouse',  label: 'Warehouse',   description: 'Stock and fulfilment ops',    features: ['inventory', 'orders', 'staff'] },
  ],
  accounting: [
    { id: 'bookkeeping',label: 'Bookkeeping', description: 'Expenses and invoicing',      features: ['invoices', 'expenses', 'customers'] },
    { id: 'payroll',    label: 'Payroll',     description: 'Staff and expense management',features: ['staff', 'expenses'] },
  ],
  retail: [
    { id: 'shop',       label: 'Retail Shop', description: 'Walk-in sales and inventory', features: ['inventory', 'orders', 'customers'] },
    { id: 'ecommerce',  label: 'E-Commerce',  description: 'Online orders and fulfilment',features: ['orders', 'inventory', 'customers', 'deliveries'] },
  ],
  clinic: [
    { id: 'general',    label: 'General Practice', description: 'Appointments and patient records', features: ['appointments', 'customers', 'staff'] },
    { id: 'specialist', label: 'Specialist',       description: 'Specialist scheduling',            features: ['appointments', 'customers', 'invoices'] },
  ],
  services: [
    { id: 'freelance',  label: 'Freelance',   description: 'Projects and invoicing',     features: ['invoices', 'customers', 'expenses'] },
    { id: 'agency',     label: 'Agency',      description: 'Team, clients, billing',     features: ['staff', 'customers', 'invoices', 'expenses'] },
  ],
  education: [
    { id: 'tutoring',   label: 'Tutoring',    description: 'Sessions and student records', features: ['appointments', 'customers', 'invoices'] },
    { id: 'school',     label: 'School',      description: 'Enrolment and staff management', features: ['customers', 'staff', 'expenses'] },
  ],
  other: [
    { id: 'starter',    label: 'Starter Workspace', description: 'A flexible preset for teams still refining their workflow', features: ['customers', 'staff'] },
  ],
};

const currentPresets = computed<Preset[]>(() =>
  selectedType.value ? (PRESETS_BY_TYPE[selectedType.value] ?? []) : [],
);

const selectedPresetRecord = computed(() =>
  currentPresets.value.find((preset) => preset.id === selectedPreset.value) ?? null,
);

const selectedUiStyleRecord = computed(() =>
  UI_STYLE_PRESETS.value.find((style) => style.id === uiStyle.value) ?? UI_STYLE_PRESETS.value[0],
);

const selectedBundleRecord = computed(() =>
  UI_LAYOUT_BUNDLES.find((bundle) => bundle.key === layoutBundle.value) ?? UI_LAYOUT_BUNDLES[0],
);

const selectedFeaturesList = computed(() =>
  FEATURES.filter((feature) => selectedFeatures.value.has(feature.id)),
);

const starterTerminalSeeds = computed(() =>
  inferStarterTerminals(selectedType.value, [...selectedFeatures.value]),
);

watch(starterTerminalSeeds, (next) => {
  const previous = terminalStylePlan.value;
  const updated: Record<string, { displayName: string; layoutVariant: string }> = {};

  for (const terminal of next) {
    updated[terminal.presetKey] = {
      displayName: previous[terminal.presetKey]?.displayName ?? terminal.displayName,
      layoutVariant: previous[terminal.presetKey]?.layoutVariant ?? terminal.layoutVariant ?? defaultLayoutVariantForPreset(terminal.presetKey),
    };
  }

  terminalStylePlan.value = updated;
}, { immediate: true });

const starterTerminalCards = computed(() =>
  starterTerminalSeeds.value.map((terminal) => {
    const preset = TERMINAL_PERMISSION_PRESETS.find((item) => item.key === terminal.presetKey);
    const plan = terminalStylePlan.value[terminal.presetKey];

    return {
      ...terminal,
      displayName: plan?.displayName ?? terminal.displayName,
      layoutVariant: plan?.layoutVariant ?? terminal.layoutVariant ?? defaultLayoutVariantForPreset(terminal.presetKey),
      presetLabel: preset?.label ?? terminal.presetKey,
      presetDescription: preset?.description ?? '',
      variants: layoutVariantsForPreset(terminal.presetKey),
    };
  }),
);

const terminalLayoutMap = computed(() =>
  Object.fromEntries(
    starterTerminalCards.value.map((terminal) => [terminal.presetKey, terminal.layoutVariant]),
  ),
);

function applyPreset(preset: Preset) {
  selectedPreset.value  = preset.id;
  selectedFeatures.value = new Set(preset.features);
}

function toggleFeature(id: string) {
  if (selectedFeatures.value.has(id)) {
    selectedFeatures.value.delete(id);
  } else {
    selectedFeatures.value.add(id);
  }
  selectedFeatures.value = new Set(selectedFeatures.value);

  let matchingPreset = null;

  for (let i = currentPresets.value.length - 1; i >= 0; --i) {
    const preset = currentPresets.value[i];

    if (preset.features.length === selectedFeatures.value.size) {
      let allMatch = true;

      for (let j = preset.features.length - 1; j >= 0; --j) {
        if (!selectedFeatures.value.has(preset.features[j])) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        matchingPreset = preset.id;
        break;
      }
    }
  }

  selectedPreset.value = matchingPreset;
}

function setTerminalLayoutVariant(presetKey: PermissionPresetKey, layoutVariant: string) {
  const current = terminalStylePlan.value[presetKey];
  terminalStylePlan.value = {
    ...terminalStylePlan.value,
    [presetKey]: {
      displayName: current?.displayName ?? starterTerminalSeeds.value.find((terminal) => terminal.presetKey === presetKey)?.displayName ?? '',
      layoutVariant,
    },
  };
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToFeatures() {
  if (!businessName.value.trim() || !selectedType.value) return;
  // auto select first preset if nothing is selected yet
  if (selectedFeatures.value.size === 0 && currentPresets.value.length > 0) {
    applyPreset(currentPresets.value[0]);
  }
  step.value = 2;
}

function goToReview() {
  if (!selectedPreset.value && currentPresets.value.length > 0) {
    applyPreset(currentPresets.value[0]);
  }
  step.value = 3;
}

function close() {
  if (step.value === 4 || submitting.value) return;
  emit('close');
}

const schemaDef = computed<SchemaDef>(() => {
  const tables: TableDef[] = [];
  for (const feature of FEATURES) {
    if (selectedFeatures.value.has(feature.id)) {
      tables.push(...feature.tables);
    }
  }
  return { tables };
});

const monthlyTotal = computed(() => {
  return 15 + (selectedFeatures.value.size * 5);
});

watch(layoutBundle, (nextBundle) => {
  colorPalette.value = {
    ...colorPalette.value,
    ...buildBusinessPalette(colorPalette.value.primary, nextBundle),
  };
});

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  submitting.value = true;
  submitError.value = null;

  try {
    const res = await $fetch<{ business: any; error: string | null }>('/api/businesses/onboard', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        businessName: businessName.value.trim(),
        businessType: selectedType.value,
        features:     [...selectedFeatures.value],
        schemaDef:    schemaDef.value,
        logoUrl:      logoUrl.value,
        colorPalette: {
          ...colorPalette.value,
          languagePreference: locale.value,
          uiStyle: uiStyle.value,
          onboardingPreset: selectedPreset.value,
          layoutBundle: layoutBundle.value,
          surfaceStyle: surfaceStyle.value,
          particleEffect: particleEffect.value,
          terminalLayouts: terminalLayoutMap.value,
        },
        terminalConfigs: starterTerminalCards.value.map((terminal) => ({
          displayName: terminal.displayName,
          presetKey: terminal.presetKey,
          layoutVariant: terminal.layoutVariant,
        })),
        override:     !!business.value,
      },
    });

    if (res.error || !res.business) {
      submitError.value = res.error ?? 'Something went wrong.';
      return;
    }

    await fetchBusiness();
    step.value = 4;
  } catch (err) {
    submitError.value = (err as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <!-- Panel -->
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        
        <!-- Close Button (Not visible in step 4) -->
        <button v-if="step !== 4" class="modal-close" @click="close" aria-label="Close">
          <X class="w-5 h-5" />
        </button>

        <!-- ── Step 1: Basics ────────────────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 1" class="flex flex-col h-full">
            <div class="px-10 pt-10 pb-6 shrink-0 border-b border-[rgba(104,41,58,0.06)]">
              <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1.5" style="color: rgba(104,41,58,0.4);">{{ t('onboarding_step_indicator', { step: 1 }) }}</p>
              <h1 id="onboarding-title" class="font-serif text-3xl text-[rgb(var(--shell-sidebar))]">{{ t('onboarding_step1_title') }}</h1>
              <p class="text-sm mt-1 text-[rgba(104,41,58,0.6)]">{{ t('onboarding_step1_sub') }}</p>
            </div>

            <div class="px-10 py-8 overflow-y-auto flex-1 space-y-10">
              <!-- Brand Identity -->
              <div>
                <h2 class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">{{ t('onboarding_identity') }}</h2>
                <div class="brand-identity flex items-start gap-8">
                  <!-- Logo Upload -->
                  <label class="block cursor-pointer group shrink-0">
                    <input type="file" accept="image/*" class="hidden" aria-label="Upload business logo" @change="handleLogoUpload" />
                    <div class="w-24 h-24 border-[1.5px] border-dashed border-[rgba(104,41,58,0.2)] rounded-xl flex flex-col items-center justify-center bg-[rgba(104,41,58,0.02)] transition-all group-hover:border-[rgba(104,41,58,0.4)] group-hover:bg-[#F6E6D7] overflow-hidden">
                      <img v-if="logoUrl" :src="logoUrl" class="w-full h-full object-contain p-2" />
                      <template v-else>
                        <UploadCloud class="w-6 h-6 mb-1 text-[rgba(104,41,58,0.3)] group-hover:text-[rgba(104,41,58,0.6)]" />
                        <span class="text-[10px] text-[rgba(104,41,58,0.5)] font-medium">{{ t('onboarding_upload') }}</span>
                      </template>
                    </div>
                  </label>

                  <!-- Name & Color -->
                  <div class="flex-1 space-y-4">
                    <div>
                      <label for="onboarding-business-name" class="text-sm font-semibold text-[rgba(104,41,58,0.7)] block mb-1.5">{{ t('onboarding_business_name') }}</label>
                      <input
                        id="onboarding-business-name"
                        v-model="businessName"
                        type="text"
                        placeholder="e.g. Sakura Cafe"
                        class="field-input max-w-sm"
                      />
                    </div>
                    <div>
                      <label for="onboarding-primary-color" class="text-sm font-semibold text-[rgba(104,41,58,0.7)] block mb-1.5">{{ t('onboarding_primary_color') }}</label>
                      <div class="flex items-center gap-3">
                        <input id="onboarding-primary-color" type="color" v-model="colorPalette.primary" class="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span class="text-xs font-mono text-[rgba(104,41,58,0.6)]">{{ colorPalette.primary.toUpperCase() }}</span>
                        <span v-if="logoUrl" class="text-[10px] px-2 py-1 rounded bg-[rgba(104,41,58,0.06)] text-[#68293A]">
                          {{ t('onboarding_predicted_color') }}
                        </span>
                      </div>
                      <div class="color-swatches mt-3 grid grid-cols-4 gap-2 max-w-md">
                        <div class="rounded-xl border border-black/5 p-2 bg-white/70">
                          <div class="h-8 rounded-lg" :style="{ background: colorPalette.primary }" />
                          <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">Primary</p>
                        </div>
                        <div class="rounded-xl border border-black/5 p-2 bg-white/70">
                          <div class="h-8 rounded-lg" :style="{ background: colorPalette.secondary }" />
                          <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">Secondary</p>
                        </div>
                        <div class="rounded-xl border border-black/5 p-2 bg-white/70">
                          <div class="h-8 rounded-lg" :style="{ background: colorPalette.accent }" />
                          <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">Accent</p>
                        </div>
                        <div class="rounded-xl border border-black/5 p-2 bg-white/70">
                          <div class="h-8 rounded-lg" :style="{ background: colorPalette.background }" />
                          <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">Frame</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Industry -->
              <div>
                <h2 class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">{{ t('onboarding_industry') }}</h2>
                <div class="industry-grid grid grid-cols-4 gap-3">
                  <button
                    v-for="type in businessTypes"
                    :key="type.id"
                    class="type-card relative flex flex-col items-center gap-2.5 py-5 px-3 text-center cursor-pointer"
                    :class="{ 'active': selectedType === type.id }"
                    type="button"
                    :aria-pressed="selectedType === type.id"
                    @click="selectedType = type.id"
                  >
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                      :style="`background: ${type.color}18; color: ${type.color};`"
                    >
                      <component :is="type.icon" class="w-5 h-5" />
                    </div>
                    <span class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ type.label }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="px-10 py-4 shrink-0 border-t border-[rgba(104,41,58,0.06)] flex justify-end bg-[rgba(104,41,58,0.01)]">
                  <button
                    class="btn-nav"
                    :disabled="!businessName.trim() || !selectedType"
                    @click="goToFeatures"
                  >
                    {{ t('continue') }} <ChevronRight class="w-4 h-4" />
                  </button>
            </div>
          </div>
        </Transition>

        <!-- ── Step 2: Features ──────────────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 2" class="flex flex-col h-full">
            <div class="px-10 pt-10 pb-6 shrink-0 border-b border-[rgba(104,41,58,0.06)] flex justify-between items-start">
              <div>
                <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1.5" style="color: rgba(104,41,58,0.4);">{{ t('onboarding_step_indicator', { step: 2 }) }}</p>
                <h1 class="font-serif text-3xl text-[rgb(var(--shell-sidebar))]">{{ t('onboarding_step2_title') }}</h1>
                <p class="text-sm mt-1 text-[rgba(104,41,58,0.6)]">{{ t('onboarding_step2_sub') }}</p>
              </div>
            </div>

            <div class="flex-1 flex overflow-hidden">
              <!-- Presets -->
              <div class="w-64 shrink-0 overflow-y-auto p-6 bg-white border-r border-[rgba(104,41,58,0.06)]">
                <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">{{ t('onboarding_presets') }}</p>
                <div class="space-y-1.5">
                  <button
                    v-for="preset in currentPresets"
                    :key="preset.id"
                    class="preset-card w-full text-left px-4 py-3 text-[rgb(var(--shell-sidebar))]"
                    :class="{ 'active': selectedPreset === preset.id }"
                    @click="applyPreset(preset)"
                  >
                    <p class="text-xs font-semibold">{{ preset.label }}</p>
                    <p class="text-[11px] mt-0.5 opacity-70">{{ preset.description }}</p>
                  </button>

                  <div v-if="false" class="pt-3 mt-3 border-t border-[rgba(104,41,58,0.06)]">
                    <button
                      class="preset-card w-full text-left px-4 py-3 text-[rgb(var(--shell-sidebar))]"
                      :class="{ 'active': selectedPreset === null }"
                      @click="() => { selectedPreset = null; selectedFeatures = new Set(); }"
                    >
                      <p class="text-xs font-semibold">{{ t('onboarding_custom') }}</p>
                      <p class="text-[11px] mt-0.5 opacity-70">{{ t('onboarding_custom_sub') }}</p>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Checklist -->
              <div class="flex-1 overflow-y-auto p-6 bg-[#fdf7f2]">
                <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">{{ t('onboarding_included_workflows') }}</p>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    v-for="feature in availableFeaturesForType"
                    :key="feature.id"
                    class="feature-card flex items-start gap-3 p-4 text-left"
                    :class="{ 'active': selectedFeatures.has(feature.id) }"
                    @click="toggleFeature(feature.id)"
                  >
                    <div
                      class="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all border"
                      :class="selectedFeatures.has(feature.id)
                        ? 'bg-[rgb(var(--shell-sidebar))] border-[rgb(var(--shell-sidebar))]'
                        : 'border-[rgba(104,41,58,0.2)] bg-transparent'"
                    >
                      <Check v-if="selectedFeatures.has(feature.id)" class="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ feature.label }}</p>
                      <p class="text-[11px] mt-0.5 text-[rgba(104,41,58,0.6)]">{{ feature.description }}</p>
                    </div>
                  </button>
                </div>
                <div class="mt-6">
                  <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">Starter Workstations</p>
                  <div class="grid grid-cols-2 gap-3">
                    <div
                      v-for="terminal in starterTerminalCards"
                      :key="terminal.presetKey"
                      class="style-card p-4"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ terminal.displayName }}</p>
                          <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.6)]">{{ terminal.presetLabel }}</p>
                        </div>
                        <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[rgba(104,41,58,0.05)] text-[rgba(104,41,58,0.45)]">
                          {{ terminal.variants.length }} layouts
                        </span>
                      </div>
                      <p class="text-[11px] mt-3 text-[rgba(104,41,58,0.56)]">{{ terminal.presetDescription }}</p>
                      <div class="mt-4 space-y-2">
                        <button
                          v-for="variant in terminal.variants"
                          :key="variant.id"
                          class="style-card text-left p-3 w-full"
                          :class="{ 'active': terminal.layoutVariant === variant.id }"
                          @click="setTerminalLayoutVariant(terminal.presetKey, variant.id)"
                        >
                          <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ variant.label }}</p>
                          <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.6)]">{{ variant.description }}</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mt-6">
                  <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">UI Layout Bundle</p>
                  <div class="grid grid-cols-3 gap-3">
                    <button
                      v-for="bundle in UI_LAYOUT_BUNDLES"
                      :key="bundle.key"
                      class="style-card text-left p-4"
                      :class="{ 'active': layoutBundle === bundle.key }"
                      @click="layoutBundle = bundle.key"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ bundle.label }}</p>
                        <div class="flex gap-1 shrink-0">
                          <span
                            v-for="swatch in bundle.swatches"
                            :key="swatch"
                            class="w-4 h-4 rounded-full border border-black/5"
                            :style="{ background: swatch }"
                          />
                        </div>
                      </div>
                      <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.6)]">{{ bundle.description }}</p>
                    </button>
                  </div>
                </div>
                <div class="mt-6">
                  <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">{{ t('onboarding_interface_style') }}</p>
                  <div class="grid grid-cols-2 gap-3">
                    <button
                      v-for="style in UI_STYLE_PRESETS"
                      :key="style.id"
                      class="style-card text-left p-4"
                      :class="{ 'active': uiStyle === style.id }"
                      @click="uiStyle = style.id"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ style.label }}</p>
                        <div class="flex gap-1 shrink-0">
                          <span
                            v-for="swatch in style.swatches"
                            :key="swatch"
                            class="w-4 h-4 rounded-full border border-black/5"
                            :style="{ background: swatch }"
                          />
                        </div>
                      </div>
                      <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.6)]">{{ style.description }}</p>
                    </button>
                  </div>
                </div>
                <div class="mt-6 grid grid-cols-2 gap-6">
                  <div>
                    <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">Element Shape</p>
                    <div class="space-y-3">
                      <button
                        v-for="option in SURFACE_STYLE_OPTIONS"
                        :key="option.id"
                        class="style-card text-left p-4 w-full"
                        :class="{ 'active': surfaceStyle === option.id }"
                        @click="surfaceStyle = option.id"
                      >
                        <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ option.label }}</p>
                        <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.6)]">{{ option.description }}</p>
                      </button>
                    </div>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)] mb-4">Ambient Effect</p>
                    <div class="space-y-3">
                      <button
                        v-for="option in PARTICLE_OPTIONS"
                        :key="option.id"
                        class="style-card text-left p-4 w-full"
                        :class="{ 'active': particleEffect === option.id }"
                        @click="particleEffect = option.id"
                      >
                        <p class="text-xs font-semibold text-[rgb(var(--shell-sidebar))]">{{ option.label }}</p>
                        <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.6)]">{{ option.description }}</p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="px-10 py-4 shrink-0 border-t border-[rgba(104,41,58,0.06)] flex justify-between items-center bg-[rgba(104,41,58,0.01)]">
              <button class="btn-nav-ghost" @click="step = 1">
                <ChevronLeft class="w-4 h-4" /> {{ t('btn_back') }}
              </button>
              <div class="flex items-center gap-4">
                <span class="text-xs text-[rgba(104,41,58,0.6)] font-mono">
                  {{ selectedPresetRecord?.label ?? t('preset_required') }} / {{ selectedBundleRecord.label }} / {{ selectedUiStyleRecord.label }}
                </span>
                <button
                  class="btn-nav"
                  :disabled="!selectedPreset"
                  @click="goToReview"
                >
                  Review & Confirm <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ── Step 3: Review & Confirm ────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 3" class="flex flex-col h-full">
            <div class="px-10 pt-10 pb-6 shrink-0 border-b border-[rgba(104,41,58,0.06)] flex justify-between items-start">
              <div>
                <p class="text-[10px] font-mono uppercase tracking-[0.18em] mb-1.5" style="color: rgba(104,41,58,0.4);">{{ t('onboarding_step_indicator', { step: 3 }) }}</p>
                <h1 class="font-serif text-3xl text-[rgb(var(--shell-sidebar))]">{{ t('onboarding_step3_title') }}</h1>
                <p class="text-sm mt-1 text-[rgba(104,41,58,0.6)]">{{ t('onboarding_step3_sub') }}</p>
              </div>
            </div>

            <div class="flex-1 flex overflow-hidden">
              <!-- Preset Summary -->
              <div class="flex-1 overflow-y-auto p-6 bg-[#fdf7f2]">
                <div class="flex items-center gap-2 mb-4">
                  <Sparkles class="w-4 h-4 text-[rgba(104,41,58,0.4)]" />
                  <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">{{ t('onboarding_summary_preset') }}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                  <div v-for="feature in selectedFeaturesList" :key="feature.id" class="feature-card bg-white p-4">
                    <div class="flex items-center gap-2 border-b border-[rgba(104,41,58,0.06)] pb-2 mb-3">
                      <Sparkles class="w-3.5 h-3.5 text-[rgba(104,41,58,0.5)]" />
                      <span class="text-xs font-bold text-[rgb(var(--shell-sidebar))]">{{ feature.label }}</span>
                    </div>
                    <p class="text-xs leading-relaxed text-[rgba(104,41,58,0.58)]">{{ feature.description }}</p>
                  </div>
                </div>

                <div v-if="selectedFeaturesList.length === 0" class="text-center py-10 text-[rgba(104,41,58,0.5)] text-sm">
                  Choose a preset to continue.
                </div>

                <div v-if="starterTerminalCards.length > 0" class="mt-6">
                  <div class="flex items-center gap-2 mb-4">
                    <Sparkles class="w-4 h-4 text-[rgba(104,41,58,0.4)]" />
                    <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">Terminal Styles</p>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div v-for="terminal in starterTerminalCards" :key="`${terminal.presetKey}-review`" class="feature-card bg-white p-4">
                      <div class="flex items-center justify-between gap-3 border-b border-[rgba(104,41,58,0.06)] pb-2 mb-3">
                        <span class="text-xs font-bold text-[rgb(var(--shell-sidebar))]">{{ terminal.displayName }}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-[rgba(104,41,58,0.45)]">{{ terminal.presetLabel }}</span>
                      </div>
                      <p class="text-xs leading-relaxed text-[rgba(104,41,58,0.58)]">
                        {{ terminal.variants.find((variant) => variant.id === terminal.layoutVariant)?.label ?? terminal.layoutVariant }}
                      </p>
                      <p class="text-[11px] mt-1 text-[rgba(104,41,58,0.5)]">
                        {{ terminal.variants.find((variant) => variant.id === terminal.layoutVariant)?.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Workspace Summary -->
              <div class="w-72 shrink-0 overflow-y-auto p-6 bg-white border-l border-[rgba(104,41,58,0.06)] flex flex-col">
                <div class="flex items-center gap-2 mb-4">
                  <Sparkles class="w-4 h-4 text-[rgba(104,41,58,0.4)]" />
                  <p class="text-xs font-bold uppercase tracking-widest text-[rgba(104,41,58,0.4)]">{{ t('onboarding_summary_workspace') }}</p>
                </div>

                <div class="feature-card bg-white p-4 space-y-4 mb-6">
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[rgba(104,41,58,0.7)]">{{ t('onboarding_presets') }}</span>
                    <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ selectedPresetRecord?.label ?? t('none') }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[rgba(104,41,58,0.7)]">Layout Bundle</span>
                    <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ selectedBundleRecord.label }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[rgba(104,41,58,0.7)]">{{ t('style') }}</span>
                    <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ selectedUiStyleRecord.label }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[rgba(104,41,58,0.7)]">Starter Terminals</span>
                    <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ starterTerminalCards.length }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[rgba(104,41,58,0.7)]">Element Shape</span>
                    <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ surfaceStyle === 'rounded' ? 'Rounded' : 'Square' }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-[rgba(104,41,58,0.7)]">Ambient Effect</span>
                    <span class="font-semibold text-[rgb(var(--shell-sidebar))]">{{ particleEffect === 'floating-orbs' ? 'Floating Orbs' : particleEffect === 'soft-grid' ? 'Soft Grid' : 'None' }}</span>
                  </div>
                  <div class="flex gap-2 h-7 rounded-lg overflow-hidden border border-black/5">
                    <div
                      class="flex-1"
                      :style="{ background: colorPalette.primary }"
                    />
                    <div
                      class="flex-1"
                      :style="{ background: colorPalette.secondary }"
                    />
                    <div
                      class="flex-1"
                      :style="{ background: colorPalette.accent }"
                    />
                    <div
                      class="flex-1"
                      :style="{ background: colorPalette.background }"
                    />
                  </div>
                  <div class="flex gap-2 h-7 rounded-lg overflow-hidden border border-black/5">
                    <div
                      v-for="swatch in selectedBundleRecord.swatches"
                      :key="swatch"
                      class="flex-1"
                      :style="{ background: swatch }"
                    />
                  </div>
                </div>

                <!-- Warning Block -->
                <div v-if="business" class="mt-auto mb-4 p-4 rounded-xl" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);">
                  <div class="flex items-center gap-2 mb-2">
                    <AlertTriangle class="w-4 h-4 text-red-600" />
                    <span class="text-xs font-bold text-red-700 uppercase tracking-widest">{{ t('onboarding_override_warning_title') }}</span>
                  </div>
                  <p class="text-xs text-red-700 leading-relaxed">
                    {{ t('onboarding_override_warning_body') }}
                  </p>
                </div>

                <div v-if="submitError" class="mb-4 text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-lg border border-red-200">
                  {{ submitError }}
                </div>

                <button
                  class="btn-nav btn-ribbon w-full"
                  style="--ribbon-color: #68293A"
                  :disabled="submitting"
                  @click="handleSubmit"
                >
                  <Sparkles v-if="!submitting" class="w-4 h-4 text-[rgb(var(--shell-pink))]" />
                  {{ submitting ? t('onboarding_creating') : t('onboarding_create_btn') }}
                </button>
              </div>
            </div>

            <div class="px-10 py-4 shrink-0 border-t border-[rgba(104,41,58,0.06)] flex justify-between items-center bg-[rgba(104,41,58,0.01)]">
              <button class="btn-nav-ghost" @click="step = 2">
                <ChevronLeft class="w-4 h-4" /> {{ t('btn_back') }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- ── Step 4: Done ────────────────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 4" class="flex flex-col items-center justify-center px-10 py-20 text-center h-full bg-white">
            <div class="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-[#F6E6D7] border border-[rgba(104,41,58,0.1)]">
              <Sparkles class="w-10 h-10 text-[rgb(var(--shell-pink))]" />
            </div>
            <h2 class="font-serif text-3xl mb-3 text-[rgb(var(--shell-sidebar))]">
              {{ t('onboarding_step4_title') }}
            </h2>
            <p class="text-sm max-w-md text-[rgba(104,41,58,0.6)] leading-relaxed">
              {{ t('onboarding_step4_sub') }}
            </p>
            <button
              class="mt-10 btn-nav"
              @click="emit('done')"
            >
              {{ t('onboarding_go_dashboard') }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(104, 41, 58, 0.4);
  backdrop-filter: blur(8px);
}

.modal-card {
  width: 100%;
  max-width: 900px;
  height: 90dvh;
  max-height: 90dvh;
  background: #FFFFFF;
  border-radius: 0.75rem;
  border: 1px solid rgba(104, 41, 58, 0.09);
  box-shadow: 0 8px 32px rgba(104, 41, 58, 0.1);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.modal-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: rgba(104, 41, 58, 0.5);
  background: transparent;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  z-index: 10;
}
.modal-close:hover {
  background: rgba(104, 41, 58, 0.05);
  border-color: rgba(104, 41, 58, 0.1);
  color: rgba(104, 41, 58, 0.8);
}

.btn-nav {
  padding: 0.65rem 1.25rem;
  background: #68293A;
  color: #F6E6D7;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn-nav:hover    { opacity: 0.88; }
.btn-nav:active   { transform: scale(0.98); }
.btn-nav:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-nav-ghost {
  padding: 0.65rem 1.25rem;
  background: transparent;
  color: rgba(104, 41, 58, 0.68);
  border: 1.5px solid rgba(104, 41, 58, 0.12);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn-nav-ghost:hover {
  border-color: rgba(104, 41, 58, 0.3);
  background: rgba(104, 41, 58, 0.03);
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

.type-card {
  border-radius: 0.5rem;
  border: 1.5px solid rgba(104, 41, 58, 0.15);
  background: transparent;
  transition: all 0.15s;
}
.type-card:hover {
  background: rgba(104, 41, 58, 0.03);
}
.type-card.active {
  border-color: rgba(104, 41, 58, 0.5);
  background: rgba(104, 41, 58, 0.05);
}

.feature-card {
  border-radius: 0.5rem;
  border: 1.5px solid rgba(104, 41, 58, 0.15);
  background: transparent;
  transition: all 0.15s;
}
.feature-card:hover {
  background: rgba(104, 41, 58, 0.03);
}
.feature-card.active {
  border-color: rgba(104, 41, 58, 0.5);
  background: rgba(104, 41, 58, 0.05);
}

.preset-card {
  border-radius: 0.5rem;
  transition: all 0.15s;
  background: transparent;
  border: 1px solid transparent;
}
.preset-card:hover {
  background: rgba(104, 41, 58, 0.03);
}
.preset-card.active {
  background: #68293A;
  color: #F6E6D7;
}
.preset-card.active p {
  color: #F6E6D7;
}
.preset-card.active p.opacity-70 {
  opacity: 0.8;
}

.style-card {
  border-radius: 0.5rem;
  transition: all 0.15s;
  background: #ffffff;
  border: 1.5px solid rgba(104, 41, 58, 0.12);
}
.style-card:hover {
  background: rgba(104, 41, 58, 0.03);
}
.style-card.active {
  border-color: rgba(104, 41, 58, 0.5);
  background: rgba(104, 41, 58, 0.05);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
.slide-enter-from { opacity: 0; transform: translateX(20px); }
.slide-leave-to   { opacity: 0; transform: translateX(-20px); }

/* Small instructional labels need to remain readable on the warm white panels. */
.modal-card [class*="text-[rgba(104,41,58,0."] {
  color: rgba(104, 41, 58, 0.75) !important;
}

.modal-card [style*="color: rgba(104,41,58,0."] {
  color: rgba(104, 41, 58, 0.75) !important;
}

@media (max-width: 768px) {
  .modal-overlay {
    align-items: flex-start;
    padding: 0.5rem;
  }

  .modal-card {
    height: calc(100dvh - 1rem);
    max-height: none;
    border-radius: 0.9rem;
  }

  .modal-close {
    top: 0.75rem;
    right: 0.75rem;
  }

  .modal-card .px-10 {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .modal-card .pt-10 {
    padding-top: 2rem;
  }

  .modal-card .brand-identity {
    flex-direction: column;
    gap: 1rem;
  }

  .modal-card .brand-identity > label {
    align-self: flex-start;
  }

  .modal-card .color-swatches {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: none;
  }

  .modal-card .industry-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .modal-card .type-card {
    min-height: 6.25rem;
    padding: 0.85rem 0.5rem;
  }

  .modal-card .type-card span {
    line-height: 1.2;
  }
}
</style>

