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
const serverDisplayName = ref('');
const serverPinLength = ref(4);
const step        = ref<1 | 2>(1);

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
  const res = await $fetch<{ businessId: string; displayName: string; pinLength: number; error: string | null }>(`/api/inpoints/${inpointId.value}/meta`).catch(() => null);
  if (res?.businessId) {
    businessId.value = res.businessId;
    serverDisplayName.value = res.displayName;
    serverPinLength.value = res.pinLength || 4;
  }
}

function nextStep() {
  if (!displayName.value.trim()) return;
  if (displayName.value.trim().toLowerCase() === serverDisplayName.value.toLowerCase()) {
    step.value = 2;
    error.value = null;
  } else {
    error.value = 'Invalid terminal name';
  }
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
  if (pin.value.length < serverPinLength.value) pin.value += digit;
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
  <div v-if="session" class="w-full h-dvh overflow-hidden relative bg-[#fdf7f2]">
    <!-- Topbar -->
    <div class="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-md border-b" style="border-color: rgba(61,24,32,0.1);">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold" style="background: rgb(var(--shell-sidebar));">T</div>
        <span class="text-xs font-semibold" style="color: rgb(var(--shell-sidebar));">{{ session.displayName }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style="color: rgba(61,24,32,0.6); background: rgba(61,24,32,0.06); border: 1px solid rgba(61,24,32,0.1);">{{ session.role }}</span>
      </div>
      <button class="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80" style="color: rgba(61,24,32,0.6);" @click="session = null">
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
  <div v-else class="min-h-dvh flex items-center justify-center px-4 bg-[#fdf7f2]">
    <div class="w-full max-w-xs space-y-6 animate-fade-in">
      <!-- Logo -->
      <div class="text-center">
        <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-serif text-2xl mb-4 shadow-xl" style="background: rgb(var(--shell-sidebar));">
          T
        </div>
        <h1 class="text-xl font-serif font-medium" style="color: rgb(var(--shell-sidebar));">Terminal Login</h1>
        <p class="text-sm mt-1" style="color: rgba(61,24,32,0.5);">Enter your name and PIN</p>
      </div>

      <div class="bg-white rounded-3xl p-6 space-y-5 shadow-2xl" style="border: 1px solid rgba(61,24,32,0.08);">
        <template v-if="step === 1">
          <input
            v-model="displayName"
            class="w-full rounded-xl px-4 py-3 text-sm text-center font-medium transition-all focus:outline-none"
            style="background: rgba(61,24,32,0.04); color: rgb(var(--shell-sidebar)); border: 1.5px solid rgba(61,24,32,0.08);"
            placeholder="Your name"
            @keyup.enter="nextStep"
            autofocus
          />

          <div v-if="error" class="text-xs text-center font-medium mt-1" style="color: #dc2626;">{{ error }}</div>

          <button
            :disabled="!displayName"
            class="w-full py-3.5 mt-2 text-white font-semibold text-sm rounded-xl transition-all shadow-xl disabled:opacity-40 hover:opacity-90"
            style="background: rgb(var(--shell-sidebar)); box-shadow: 0 4px 14px rgba(61,24,32,0.25);"
            @click="nextStep"
          >
            Next
          </button>
        </template>

        <template v-else>
          <div
            class="w-full rounded-xl px-4 py-3 text-sm text-center font-semibold"
            style="background: rgba(61,24,32,0.04); color: rgb(var(--shell-sidebar)); border: 1.5px solid rgba(61,24,32,0.08);"
          >
            {{ displayName }}
          </div>

          <!-- PIN display -->
          <div class="flex gap-2 justify-center">
            <div
              v-for="i in serverPinLength"
              :key="i"
              class="w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all"
              :style="i <= pin.length ? 'border-color: rgb(var(--shell-sidebar)); background: rgba(61,24,32,0.05);' : 'border-color: rgba(61,24,32,0.1); background: transparent;'"
            >
              <Circle class="w-3.5 h-3.5 transition-all" :style="i <= pin.length ? 'fill: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar));' : 'color: transparent;'" />
            </div>
          </div>

          <!-- Numpad -->
          <div class="grid grid-cols-3 gap-2.5 mt-2">
            <button
              v-for="digit in ['1','2','3','4','5','6','7','8','9','','0','delete']"
              :key="digit"
              :class="[
                'h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center',
                digit === '' ? 'invisible' : '',
                digit === 'delete' ? 'opacity-60 hover:opacity-100 hover:bg-black/5' : 'hover:bg-black/5'
              ]"
              :style="digit !== '' ? 'color: rgb(var(--shell-sidebar));' : ''"
              @click="digit === 'delete' ? clearPin() : appendPin(digit)"
            >
              <Delete v-if="digit === 'delete'" class="w-6 h-6" />
              <template v-else>{{ digit }}</template>
            </button>
          </div>

          <div v-if="error" class="text-xs text-center font-medium mt-1" style="color: #dc2626;">{{ error }}</div>

          <button
            :disabled="pin.length < serverPinLength || loading"
            class="w-full py-3.5 mt-2 text-white font-semibold text-sm rounded-xl transition-all shadow-xl disabled:opacity-40 hover:opacity-90"
            style="background: rgb(var(--shell-sidebar)); box-shadow: 0 4px 14px rgba(61,24,32,0.25);"
            @click="login"
          >
            {{ loading ? 'Checking…' : 'Login' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
