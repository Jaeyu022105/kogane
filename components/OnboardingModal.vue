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
} from 'lucide-vue-next';
import type { SchemaDef, TableDef } from '~/lib/schemaUtils';

const emit = defineEmits<{ done: [] }>();

const { authHeaders } = useAuth();
const { fetchBusiness } = useBusiness();

// ── Step state ────────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3>(1);

// Step 1
const businessName = ref('');
const selectedType = ref<string | null>(null);

// Step 2
const selectedPreset  = ref<string | null>(null);
const selectedFeatures = ref<Set<string>>(new Set());

const submitting = ref(false);
const submitError = ref<string | null>(null);

// ── Business types ────────────────────────────────────────────────────────────
const businessTypes = [
  { id: 'restaurant',  label: 'Restaurant',  icon: UtensilsCrossed, color: '#e8748a' },
  { id: 'logistics',   label: 'Logistics',   icon: Truck,           color: '#8b5cf6' },
  { id: 'accounting',  label: 'Accounting',  icon: Calculator,      color: '#10b981' },
  { id: 'retail',      label: 'Retail',      icon: ShoppingBag,     color: '#f59e0b' },
  { id: 'clinic',      label: 'Clinic',      icon: Stethoscope,     color: '#3b82f6' },
  { id: 'services',    label: 'Services',    icon: Wrench,          color: '#ec4899' },
  { id: 'education',   label: 'Education',   icon: GraduationCap,   color: '#14b8a6' },
  { id: 'other',       label: 'Other',       icon: Building2,       color: '#6b7280' },
];

// ── Feature catalogue (each feature maps to tables) ──────────────────────────
interface Feature {
  id: string;
  label: string;
  description: string;
  tables: TableDef[];
}

const FEATURES: Feature[] = [
  {
    id: 'orders',
    label: 'Order Tracking',
    description: 'Track customer orders and their statuses',
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'order_number', type: 'text',    nullable: false, unique: true },
          { name: 'status',       type: 'text',    nullable: false, default: "'pending'" },
          { name: 'total_amount', type: 'numeric', nullable: true },
          { name: 'notes',        type: 'text',    nullable: true },
        ],
      },
      {
        name: 'order_items',
        columns: [
          { name: 'order_id',  type: 'text',    nullable: false },
          { name: 'item_name', type: 'text',    nullable: false },
          { name: 'quantity',  type: 'integer', nullable: false, default: '1' },
          { name: 'unit_price',type: 'numeric', nullable: true },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Manage stock levels and product catalog',
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

// ── Presets per business type ─────────────────────────────────────────────────
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
    { id: 'cafe',       label: 'Café',        description: 'Drinks, light bites, loyalty', features: ['orders', 'inventory', 'customers'] },
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
    { id: 'custom',     label: 'Custom',      description: 'Pick exactly what you need', features: [] },
  ],
};

const currentPresets = computed<Preset[]>(() =>
  selectedType.value ? (PRESETS_BY_TYPE[selectedType.value] ?? []) : [],
);

// When a preset is selected, sync feature checkboxes
function applyPreset(preset: Preset) {
  selectedPreset.value  = preset.id;
  selectedFeatures.value = new Set(preset.features);
}

function toggleFeature(id: string) {
  selectedPreset.value = null;
  if (selectedFeatures.value.has(id)) {
    selectedFeatures.value.delete(id);
  } else {
    selectedFeatures.value.add(id);
  }
  // Trigger reactivity
  selectedFeatures.value = new Set(selectedFeatures.value);
}

// ── Navigation ────────────────────────────────────────────────────────────────
function selectType(id: string) {
  selectedType.value    = id;
  selectedPreset.value  = null;
  selectedFeatures.value = new Set();

  const firstPreset = currentPresets.value[0];
  if (firstPreset) applyPreset(firstPreset);

  step.value = 2;
}

function goBack() {
  step.value = 1;
}

// ── Submit ────────────────────────────────────────────────────────────────────
const schemaDef = computed<SchemaDef>(() => {
  const tables: TableDef[] = [];
  for (const feature of FEATURES) {
    if (selectedFeatures.value.has(feature.id)) {
      tables.push(...feature.tables);
    }
  }
  return { tables };
});

async function handleSubmit() {
  if (!businessName.value.trim()) {
    submitError.value = 'Please enter your business name.';
    return;
  }

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
      },
    });

    if (res.error || !res.business) {
      submitError.value = res.error ?? 'Something went wrong.';
      return;
    }

    await fetchBusiness();
    step.value = 3;
  } catch (err) {
    submitError.value = (err as Error).message;
  } finally {
    submitting.value = false;
  }
}

const selectedTypeMeta = computed(() =>
  businessTypes.find(t => t.id === selectedType.value),
);
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style="background: rgba(10, 3, 6, 0.55); backdrop-filter: blur(12px);"
    >
      <!-- Panel -->
      <div
        class="w-full bg-white relative overflow-hidden"
        style="
          max-width: 780px;
          border-radius: 28px;
          border: 1px solid rgba(61,24,32,0.1);
          box-shadow: 0 32px 80px rgba(61,24,32,0.22), 0 4px 16px rgba(61,24,32,0.08);
          max-height: 90dvh;
          display: flex;
          flex-direction: column;
        "
      >
        <!-- Decorative blob -->
        <div
          class="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style="background: radial-gradient(circle, rgba(232,116,138,0.12) 0%, transparent 70%);"
        />

        <!-- ── Step 1: Business type ──────────────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 1" class="flex flex-col" style="min-height: 0;">
            <div class="px-8 pt-8 pb-5 shrink-0">
              <div class="flex items-center gap-2 mb-1">
                <div
                  class="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-sm"
                  style="background: rgb(61,24,32); color: #fff;"
                >
                  P
                </div>
                <span class="text-xs font-semibold" style="color: rgba(61,24,32,0.4);">Postfolio · Setup</span>
              </div>
              <h1 class="font-serif text-2xl mt-3" style="color: rgb(61,24,32);">
                What kind of business do you run?
              </h1>
              <p class="text-sm mt-1.5" style="color: rgba(61,24,32,0.5);">
                We'll suggest the right features and starter tables for you.
              </p>
            </div>

            <div class="px-8 pb-8 overflow-y-auto" style="flex: 1; min-height: 0;">
              <div class="grid grid-cols-4 gap-3">
                <button
                  v-for="type in businessTypes"
                  :key="type.id"
                  class="relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl text-center transition-all duration-150 group"
                  :style="selectedType === type.id
                    ? `background: ${type.color}14; border: 2px solid ${type.color}; box-shadow: 0 4px 16px ${type.color}28;`
                    : 'background: #fdf7f2; border: 2px solid rgba(61,24,32,0.07);'"
                  @click="selectType(type.id)"
                >
                  <div
                    class="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
                    :style="`background: ${type.color}18; color: ${type.color};`"
                  >
                    <component :is="type.icon" class="w-5 h-5" />
                  </div>
                  <span class="text-xs font-semibold" style="color: rgb(61,24,32);">{{ type.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ── Step 2: Features ───────────────────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 2" class="flex flex-col" style="min-height: 0; flex: 1;">
            <!-- Header -->
            <div class="px-8 pt-8 pb-5 shrink-0">
              <button
                class="flex items-center gap-1.5 text-xs mb-4 transition-colors"
                style="color: rgba(61,24,32,0.45);"
                @click="goBack"
                @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgb(61,24,32)'"
                @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color = 'rgba(61,24,32,0.45)'"
              >
                <ChevronLeft class="w-3.5 h-3.5" />
                Back
              </button>
              <div class="flex items-center gap-2 mb-1">
                <div
                  v-if="selectedTypeMeta"
                  class="w-7 h-7 rounded-xl flex items-center justify-center"
                  :style="`background: ${selectedTypeMeta.color}18; color: ${selectedTypeMeta.color};`"
                >
                  <component :is="selectedTypeMeta.icon" class="w-4 h-4" />
                </div>
                <span class="text-xs font-semibold" style="color: rgba(61,24,32,0.4);">
                  {{ selectedTypeMeta?.label }}
                </span>
              </div>
              <h1 class="font-serif text-2xl mt-2" style="color: rgb(61,24,32);">
                What features do you need?
              </h1>
              <p class="text-sm mt-1" style="color: rgba(61,24,32,0.5);">
                Pick a preset or mix and match the features on the right.
              </p>
            </div>

            <!-- Business name -->
            <div class="px-8 pb-4 shrink-0">
              <label class="text-xs font-semibold block mb-1.5" style="color: rgba(61,24,32,0.55);">
                Business name
              </label>
              <input
                v-model="businessName"
                type="text"
                placeholder="e.g. Sakura Café"
                class="input-warm w-full px-4 py-2.5 text-sm"
              />
            </div>

            <!-- Two-col layout -->
            <div class="flex gap-0 overflow-hidden" style="flex: 1; min-height: 0; border-top: 1px solid rgba(61,24,32,0.07);">
              <!-- Left: Presets -->
              <div
                class="shrink-0 overflow-y-auto py-4 px-4"
                style="width: 200px; border-right: 1px solid rgba(61,24,32,0.07); background: #fdf7f2;"
              >
                <p class="text-xs font-bold uppercase tracking-widest mb-3 px-2" style="color: rgba(61,24,32,0.35);">
                  Presets
                </p>
                <div class="space-y-1">
                  <button
                    v-for="preset in currentPresets"
                    :key="preset.id"
                    class="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    :style="selectedPreset === preset.id
                      ? 'background: rgb(61,24,32); color: #fff;'
                      : 'color: rgb(61,24,32);'"
                    @click="applyPreset(preset)"
                    @mouseenter="(e: MouseEvent) => { if (selectedPreset !== preset.id) (e.currentTarget as HTMLElement).style.background = 'rgba(61,24,32,0.07)' }"
                    @mouseleave="(e: MouseEvent) => { if (selectedPreset !== preset.id) (e.currentTarget as HTMLElement).style.background = '' }"
                  >
                    <p class="text-xs font-semibold leading-snug">{{ preset.label }}</p>
                    <p
                      class="text-xs leading-snug mt-0.5 truncate"
                      :style="selectedPreset === preset.id ? 'color: rgba(245,237,228,0.6);' : 'color: rgba(61,24,32,0.45);'"
                    >
                      {{ preset.description }}
                    </p>
                  </button>
                </div>

                <div class="mt-3 pt-3" style="border-top: 1px solid rgba(61,24,32,0.07);">
                  <button
                    class="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    :style="selectedPreset === null
                      ? 'background: rgb(61,24,32); color: #fff;'
                      : 'color: rgba(61,24,32,0.6);'"
                    @click="() => { selectedPreset = null; selectedFeatures = new Set(); }"
                    @mouseenter="(e: MouseEvent) => { if (selectedPreset !== null) (e.currentTarget as HTMLElement).style.background = 'rgba(61,24,32,0.07)' }"
                    @mouseleave="(e: MouseEvent) => { if (selectedPreset !== null) (e.currentTarget as HTMLElement).style.background = '' }"
                  >
                    <p class="text-xs font-semibold">Custom</p>
                    <p
                      class="text-xs mt-0.5"
                      :style="selectedPreset === null ? 'color: rgba(245,237,228,0.6);' : 'color: rgba(61,24,32,0.35);'"
                    >
                      Pick manually
                    </p>
                  </button>
                </div>
              </div>

              <!-- Right: Feature checkboxes -->
              <div class="flex-1 overflow-y-auto py-4 px-5">
                <p class="text-xs font-bold uppercase tracking-widest mb-3 px-1" style="color: rgba(61,24,32,0.35);">
                  Options
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="feature in FEATURES"
                    :key="feature.id"
                    class="flex items-start gap-3 p-3 rounded-2xl text-left transition-all"
                    :style="selectedFeatures.has(feature.id)
                      ? 'background: rgba(61,24,32,0.06); border: 1.5px solid rgba(61,24,32,0.2);'
                      : 'background: #fdf7f2; border: 1.5px solid rgba(61,24,32,0.07);'"
                    @click="toggleFeature(feature.id)"
                  >
                    <div
                      class="mt-0.5 w-4 h-4 rounded-md shrink-0 flex items-center justify-center transition-all"
                      :style="selectedFeatures.has(feature.id)
                        ? 'background: rgb(61,24,32); border: 1.5px solid rgb(61,24,32);'
                        : 'background: transparent; border: 1.5px solid rgba(61,24,32,0.25);'"
                    >
                      <Check v-if="selectedFeatures.has(feature.id)" class="w-2.5 h-2.5 text-white" />
                    </div>
                    <div style="min-width: 0;">
                      <p class="text-xs font-semibold leading-snug" style="color: rgb(61,24,32);">
                        {{ feature.label }}
                      </p>
                      <p class="text-xs mt-0.5 leading-snug" style="color: rgba(61,24,32,0.45);">
                        {{ feature.description }}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="px-8 py-4 shrink-0 flex items-center justify-between"
              style="border-top: 1px solid rgba(61,24,32,0.08);"
            >
              <div>
                <p v-if="submitError" class="text-xs" style="color: #dc2626;">{{ submitError }}</p>
                <p v-else class="text-xs" style="color: rgba(61,24,32,0.4);">
                  {{ selectedFeatures.size }} feature{{ selectedFeatures.size === 1 ? '' : 's' }} selected
                  · {{ schemaDef.tables.length }} table{{ schemaDef.tables.length === 1 ? '' : 's' }} will be created
                </p>
              </div>
              <button
                class="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
                style="background: rgb(61,24,32); color: rgb(245,237,228); box-shadow: 0 4px 16px rgba(61,24,32,0.25);"
                :disabled="submitting || !businessName.trim()"
                @click="handleSubmit"
              >
                <span>{{ submitting ? 'Setting up…' : 'Set up workspace' }}</span>
                <ChevronRight v-if="!submitting" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </Transition>

        <!-- ── Step 3: Done ───────────────────────────────────────────────── -->
        <Transition name="slide">
          <div v-if="step === 3" class="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div
              class="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style="background: rgba(61,24,32,0.07);"
            >
              <Sparkles class="w-8 h-8" style="color: rgb(232,116,138);" />
            </div>
            <h2 class="font-serif text-2xl mb-2" style="color: rgb(61,24,32);">
              You're all set!
            </h2>
            <p class="text-sm max-w-sm" style="color: rgba(61,24,32,0.5);">
              Your workspace has been configured. You can always add more tables and features from the Database editor.
            </p>
            <button
              class="mt-8 px-7 py-3 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
              style="background: rgb(61,24,32); color: rgb(245,237,228); box-shadow: 0 4px 16px rgba(61,24,32,0.2);"
              @click="emit('done')"
            >
              Go to dashboard
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  position: absolute;
  width: 100%;
}
.slide-enter-from { opacity: 0; transform: translateX(24px); }
.slide-leave-to   { opacity: 0; transform: translateX(-24px); }
</style>
