<script setup lang="ts">
import { Circle, Delete, Power } from 'lucide-vue-next';
import ElementRenderer from '~/components/ElementRenderer.vue';
import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import { normalizeLayout, type UiLayout } from '~/lib/uiTypes';

definePageMeta({ layout: 'default' });

interface TerminalRuntimeSession {
  terminalId: string;
  displayName: string;
  role: string;
  permissions: any;
  uiLayout: UiLayout;
  expiresAt: string;
}

const route = useRoute();
const terminalId = computed(() => route.params.id as string);

const displayName = ref('');
const pin = ref('');
const error = ref<string | null>(null);
const loading = ref(false);
const session = ref<TerminalRuntimeSession | null>(null);
const businessId = ref('');
const serverDisplayName = ref('');
const serverPinLength = ref(4);
const step = ref<1 | 2>(1);

const viewW = ref(1280);
const viewH = ref(720);
const runtime = useCanvasRuntime();
const { alert } = useModal();

provide(CANVAS_RUNTIME_KEY, runtime);

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function updateViewport() {
  viewW.value = window.innerWidth;
  viewH.value = window.innerHeight;
}

const canvasScale = computed(() => {
  const layout = session.value?.uiLayout;
  if (!layout) return 1;
  const scaleX = viewW.value / (layout.resolution?.width ?? 1280);
  const scaleY = (viewH.value - 40) / (layout.resolution?.height ?? 720);
  return Math.min(scaleX, scaleY);
});

const activeModal = computed(() =>
  session.value?.uiLayout?.modals?.find((modal) => modal.id === runtime.state.value.activeModalId) ?? null,
);

async function bootstrap() {
  const res = await $fetch<{
    businessId: string;
    displayName: string;
    pinLength: number;
    permissions: any;
    error: string | null;
  }>(`/api/terminals/${terminalId.value}/meta`).catch(() => null);

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

function configureRuntime(currentSession: TerminalRuntimeSession) {
  runtime.configure({
    terminalId: currentSession.terminalId,
    businessId: businessId.value,
    layout: normalizeLayout(currentSession.uiLayout),
    permissions: currentSession.permissions,
  });
}

async function login() {
  if (!displayName.value || pin.value.length < 4) return;
  loading.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ session: TerminalRuntimeSession | null; error: string | null }>('/api/terminals/login', {
      method: 'POST',
      body: {
        businessId: businessId.value,
        displayName: displayName.value,
        pin: pin.value,
      },
    });

    if (res.error || !res.session) {
      error.value = res.error ?? 'Invalid credentials';
      return;
    }

    session.value = {
      ...res.session,
      uiLayout: normalizeLayout(res.session.uiLayout),
    };
    configureRuntime(session.value);
    scheduleExpiryWarning(session.value.expiresAt);
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

function scheduleExpiryWarning(expiresAt: string) {
  if (expiryTimer) clearTimeout(expiryTimer);
  const expiresMs = new Date(expiresAt).getTime();
  const warningAt = expiresMs - 1000 * 60 * 2;
  const delay = warningAt - Date.now();
  if (delay <= 0) return;

  expiryTimer = setTimeout(async () => {
    await alert({
      title: 'Session expiry warning',
      description: 'This terminal session will expire in about 2 minutes.',
      confirmLabel: 'OK',
    });
  }, delay);
}

async function logout() {
  try {
    await $fetch('/api/terminals/logout', { method: 'POST' });
  } catch {
    // ignore logout API errors and clear local state anyway
  }

  session.value = null;
  runtime.reset();
  pin.value = '';
  step.value = 1;
}

onMounted(() => {
  bootstrap();
  updateViewport();
  window.addEventListener('resize', updateViewport);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport);
  if (expiryTimer) clearTimeout(expiryTimer);
});
</script>

<template>
  <div v-if="session" class="w-full h-dvh overflow-hidden relative bg-[#fdf7f2]">
    <div class="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-md border-b" style="border-color: rgba(61,24,32,0.1);">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold" style="background: rgb(var(--shell-sidebar));">T</div>
        <span class="text-xs font-semibold" style="color: rgb(var(--shell-sidebar));">{{ session.displayName }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style="color: rgba(61,24,32,0.6); background: rgba(61,24,32,0.06); border: 1px solid rgba(61,24,32,0.1);">{{ session.role }}</span>
      </div>
      <button class="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80" style="color: rgba(61,24,32,0.6);" @click="logout">
        <Power class="w-3.5 h-3.5" /> Logout
      </button>
    </div>

    <div
      class="absolute"
      :style="{
        top: '40px',
        left: '0',
        width: `${session.uiLayout?.resolution?.width ?? 1280}px`,
        height: `${session.uiLayout?.resolution?.height ?? 720}px`,
        transform: `scale(${canvasScale})`,
        transformOrigin: 'top left',
      }"
    >
      <ElementRenderer
        v-for="el in session.uiLayout?.elements ?? []"
        :key="el.id"
        :element="el"
        :business-id="businessId"
      />

      <div
        v-if="activeModal"
        class="absolute inset-0 z-[60] flex items-center justify-center bg-black/45"
      >
        <div
          class="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#1b1214] shadow-2xl"
          :style="activeModal.presentation === 'fullscreen'
            ? `width: ${session.uiLayout.resolution.width}px; height: ${session.uiLayout.resolution.height}px;`
            : activeModal.presentation === 'drawer'
              ? `width: ${Math.min(460, session.uiLayout.resolution.width)}px; height: ${session.uiLayout.resolution.height - 80}px; margin-left: auto;`
              : 'width: 640px; max-width: calc(100% - 48px); height: 420px; max-height: calc(100% - 48px);'"
        >
          <ElementRenderer
            v-for="el in activeModal.elements"
            :key="el.id"
            :element="el"
            :business-id="businessId"
          />
        </div>
      </div>
    </div>
  </div>

  <div v-else class="min-h-dvh flex items-center justify-center px-4 bg-[#fdf7f2]">
    <div class="w-full max-w-xs space-y-6 animate-fade-in">
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
            autofocus
            @keyup.enter="nextStep"
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

          <div class="grid grid-cols-3 gap-2.5 mt-2">
            <button
              v-for="digit in ['1','2','3','4','5','6','7','8','9','','0','delete']"
              :key="digit"
              :class="[
                'h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center',
                digit === '' ? 'invisible' : '',
                digit === 'delete' ? 'opacity-60 hover:opacity-100 hover:bg-black/5' : 'hover:bg-black/5',
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
            {{ loading ? 'Checking...' : 'Login' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
