<script setup lang="ts">
/**
 * In-point PIN login page — staff enter their display name and PIN to access their terminal.
 * Layout is rendered from stored JSON after successful auth.
 */

import type { UiLayout } from '~/lib/uiTypes';
import ElementRenderer from '~/components/ElementRenderer.vue';
import { Power, Delete, Circle } from 'lucide-vue-next';

definePageMeta({ layout: 'default' });

const route     = useRoute();
const inpointId = computed(() => route.params.id as string);

const displayName = ref('');
const pin         = ref('');
const error       = ref<string | null>(null);
const loading     = ref(false);
const session     = ref<{ displayName: string; role: string; uiLayout: UiLayout } | null>(null);
const businessId  = ref('');

// Viewport size — computed client-side to avoid SSR window access
const viewW = ref(1280);
const viewH = ref(720);

function updateViewport() {
  viewW.value = window.innerWidth;
  viewH.value = window.innerHeight;
}

const canvasScale = computed(() => {
  const layout = session.value?.uiLayout;
  if (!layout) return 1;
  const scaleX = viewW.value / (layout.resolution?.width  ?? 1280);
  const scaleY = (viewH.value - 40) / (layout.resolution?.height ?? 720);
  return Math.min(scaleX, scaleY);
});

// Fetch which business this inpoint belongs to (for data queries)
async function bootstrap() {
  const res = await $fetch<{ businessId: string }>(`/api/inpoints/${inpointId.value}/meta`).catch(() => null);
  if (res?.businessId) businessId.value = res.businessId;
}

async function login() {
  if (!displayName.value || pin.value.length < 4) return;
  loading.value = true;
  error.value   = null;

  try {
    const res = await $fetch<{ session: any; error: string | null }>('/api/inpoints/login', {
      method: 'POST',
      body:   { businessId: businessId.value, displayName: displayName.value, pin: pin.value },
    });

    if (res.error || !res.session) {
      error.value = res.error ?? 'Invalid credentials';
      return;
    }

    session.value = res.session;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

function appendPin(digit: string) {
  if (pin.value.length < 8) pin.value += digit;
}

function clearPin() {
  pin.value = '';
}

const elementStates = ref<Record<string, Record<string, unknown>>>({});

function handleFieldUpdate(elementId: string, field: string, value: unknown) {
  if (!elementStates.value[elementId]) {
    elementStates.value[elementId] = {};
  }
  elementStates.value[elementId][field] = value;
}

async function handleAction(element: any) {
  if (element.type !== 'button') return;
  const action = element.action;
  if (!action || action.type === 'none') return;

  if (action.type === 'navigate') {
    if (action.payload.url) window.location.href = action.payload.url;
  } else if (action.type === 'insert-record') {
    const tableName = action.payload.tableName;
    const mapping = action.payload.dataMapping;
    if (!tableName || !mapping) return;

    const record: Record<string, unknown> = {};
    for (const [col, mapDef] of Object.entries(mapping) as [string, any][]) {
      if (mapDef.type === 'static') {
        record[col] = mapDef.value;
      } else if (mapDef.type === 'element_value') {
        const elId = mapDef.elementId;
        // Search the element definition to find its fieldName, or assume input elements emit to their 'fieldName'
        const elDef = session.value?.uiLayout?.elements.find(e => e.id === elId) as any;
        const fieldName = elDef?.fieldName ?? 'value';
        const val = elementStates.value[elId]?.[fieldName];
        record[col] = val ?? null;
      }
    }

    try {
      await $fetch('/api/inpoints/insert', {
        method: 'POST',
        body: { inpointId: inpointId.value, tableName, record }
      });
      // Optionally reset fields after successful insert?
      alert('Record inserted successfully!');
    } catch (e) {
      alert('Failed to insert record: ' + (e as Error).message);
    }
  } else if (action.type === 'custom-script') {
    if (action.payload.script) {
      try {
        const func = new Function('elementStates', action.payload.script);
        func(elementStates.value);
      } catch (e) {
        console.error('Custom script error:', e);
      }
    }
  }
}

onMounted(() => {
  bootstrap();
  updateViewport();
  window.addEventListener('resize', updateViewport);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <!-- Authenticated: render the in-point UI -->
  <div v-if="session" class="w-full h-dvh overflow-hidden relative bg-[rgb(var(--color-background))]">
    <!-- Topbar -->
    <div class="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-md border-b border-white/10">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-md bg-brand-primary flex items-center justify-center text-white text-xs font-bold">P</div>
        <span class="text-xs font-medium text-white/80">{{ session.displayName }}</span>
        <span class="text-xs text-white/30 px-2 py-0.5 rounded-full border border-white/10">{{ session.role }}</span>
      </div>
      <button class="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors" @click="session = null">
        <Power class="w-3.5 h-3.5" /> Logout
      </button>
    </div>

    <!-- Canvas: scale layout to fill the viewport below the topbar -->
    <div
      class="absolute"
      :style="{
        top:             '40px',
        left:            '0',
        width:           `${session.uiLayout?.resolution?.width ?? 1280}px`,
        height:          `${session.uiLayout?.resolution?.height ?? 720}px`,
        transform:       `scale(${canvasScale})`,
        transformOrigin: 'top left',
      }"
    >
      <ElementRenderer
        v-for="el in session.uiLayout?.elements ?? []"
        :key="el.id"
        :element="el"
        :business-id="businessId"
        @action="handleAction"
        @field-update="handleFieldUpdate"
      />
    </div>
  </div>

  <!-- Not authenticated: PIN login screen -->
  <div v-else class="min-h-dvh flex items-center justify-center px-4">
    <div class="w-full max-w-xs space-y-6 animate-fade-in">
      <!-- Logo -->
      <div class="text-center">
        <div class="w-12 h-12 rounded-2xl bg-brand-primary mx-auto flex items-center justify-center text-white font-bold text-xl mb-3 shadow-lg shadow-brand-primary/30">
          P
        </div>
        <h1 class="text-lg font-bold text-white">Terminal Login</h1>
        <p class="text-sm text-white/40 mt-1">Enter your name and PIN</p>
      </div>

      <div class="glass rounded-2xl p-5 space-y-4">
        <input
          v-model="displayName"
          class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-primary"
          placeholder="Your name"
        />

        <!-- PIN display -->
        <div class="flex gap-2 justify-center">
          <div
            v-for="i in 6"
            :key="i"
            :class="[
              'w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold transition-all',
              i <= pin.length
                ? 'border-brand-primary bg-brand-primary/20 text-brand-primary'
                : 'border-white/10 text-white/20',
            ]"
          >
            <Circle :class="['w-3 h-3', i <= pin.length ? 'fill-current' : '']" />
          </div>
        </div>

        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="digit in ['1','2','3','4','5','6','7','8','9','','0','delete']"
            :key="digit"
            :class="[
              'h-12 rounded-xl text-lg font-semibold transition-all active:scale-95',
              digit === ''  ? 'invisible' : '',
              digit === 'delete' ? 'text-white/50 bg-white/5 hover:bg-white/10 flex items-center justify-center' : 'text-white bg-white/5 hover:bg-white/10',
            ]"
            @click="digit === 'delete' ? clearPin() : appendPin(digit)"
          >
            <Delete v-if="digit === 'delete'" class="w-6 h-6" />
            <template v-else>{{ digit }}</template>
          </button>
        </div>

        <div v-if="error" class="text-xs text-red-400 text-center">{{ error }}</div>

        <button
          :disabled="pin.length < 4 || !displayName || loading"
          class="w-full py-2.5 bg-brand-primary hover:brightness-110 disabled:opacity-40 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-brand-primary/20"
          @click="login"
        >
          {{ loading ? 'Checking…' : 'Login' }}
        </button>
      </div>
    </div>
  </div>
</template>
