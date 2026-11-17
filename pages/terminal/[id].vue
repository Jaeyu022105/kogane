<script setup lang="ts">
import AlertTriangleIcon from 'reicon-vue/icons/AlertTriangle';
import ArrowLeftIcon from 'reicon-vue/icons/ArrowLeft';
import ArrowRightIcon from 'reicon-vue/icons/ArrowRight';
import RecordIcon from 'reicon-vue/icons/Record';
import BackspaceIcon from 'reicon-vue/icons/Backspace';
import PowerIcon from 'reicon-vue/icons/Power';
import EyeIcon from 'reicon-vue/icons/Eye';
import EyeOffIcon from 'reicon-vue/icons/EyeOff';
import XIcon from 'reicon-vue/icons/X';
import ElementRenderer from '~/components/ElementRenderer.vue';
import TerminalBrandMark from '~/components/TerminalBrandMark.vue';
import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import { sanitizeImageSrc } from '~/lib/securityClient';
import { DEFAULT_LAYOUT_THEME, normalizeLayout, type UiLayout, type UiLayoutTheme } from '~/lib/uiTypes';
import type { TerminalBrandInfo } from '~/lib/workspaceBranding';

definePageMeta({ layout: 'default' });

interface TerminalRuntimeSession {
  terminalId: string;
  businessId?: string;
  displayName: string;
  businessName?: string;
  role: string;
  country?: string;
  currency?: string;
  currencySymbol?: string;
  brand?: TerminalBrandInfo;
  permissions: any;
  uiLayout: UiLayout;
  expiresAt: string;
}

const route = useRoute();
const terminalId = computed(() => route.params.id as string);
const { isLoggedIn, authHeaders, hydrateSession } = useAuth();

const pin = ref('');
const showPinDigits = ref(false);
const loginError = ref<string | null>(null);
const loading = ref(false);
const session = ref<TerminalRuntimeSession | null>(null);
const businessId = ref('');
const serverBusinessName = ref('');
const serverDisplayName = ref('');
const serverPinLength = ref(4);
const serverCountry = ref('US');
const serverCurrency = ref('USD');
const serverCurrencySymbol = ref('$');
const terminalTheme = ref<UiLayoutTheme>({ ...DEFAULT_LAYOUT_THEME });
const serverBrand = ref<TerminalBrandInfo | null>(null);
const logoutPin = ref('');
const showLogoutPinDigits = ref(false);
const logoutError = ref<string | null>(null);
const showLogoutPrompt = ref(false);
const logoutLoading = ref(false);

const viewW = ref(1280);
const viewH = ref(720);
const terminalViewport = ref<HTMLElement | null>(null);
const runtime = useCanvasRuntime();

provide(CANVAS_RUNTIME_KEY, runtime);

function updateViewport() {
  viewW.value = window.innerWidth;
  viewH.value = window.innerHeight;
}

function scrollWorkspace(direction: 'left' | 'right') {
  terminalViewport.value?.scrollBy({
    left: direction === 'right' ? Math.max(viewW.value * 0.8, 280) : -Math.max(viewW.value * 0.8, 280),
    behavior: 'smooth',
  });
}

const fitToWidth = ref(false);

const canvasScale = computed(() => {
  const layout = session.value?.uiLayout;
  if (!layout) return 1;
  const resW = layout.resolution?.width ?? 1280;
  const resH = layout.resolution?.height ?? 720;
  const scaleX = viewW.value / resW;
  const scaleY = (viewH.value - 40) / resH;

  // On tablets (720px - 1200px): fit both axes cleanly
  if (viewW.value >= 720) {
    return Math.min(scaleX, scaleY);
  }

  // On phones (<720px): fit to width if toggled, otherwise balanced readable scale
  if (fitToWidth.value) {
    return Math.max(0.28, Math.min(scaleX, 1));
  }

  return Math.min(1, Math.max(scaleY, 0.75));
});

const stationConfig = computed(() => session.value?.uiLayout?.stationConfig ?? null);
const dismissedWelcome = ref(false);
watch(() => stationConfig.value?.welcomeMessage, () => {
  dismissedWelcome.value = false;
});

const activeBrand = computed(() => session.value?.brand ?? serverBrand.value);
const brandName = computed(() => activeBrand.value?.name || session.value?.businessName || serverBusinessName.value);
const brandLogo = computed(() => sanitizeImageSrc(activeBrand.value?.logoUrl) || '');

useHead(() => ({
  title: `${session.value?.displayName || serverDisplayName.value || 'Terminal'} - ${brandName.value || 'Kogane'}`,
  link: brandLogo.value ? [{ key: 'terminal-icon', rel: 'icon', href: brandLogo.value }] : [],
  htmlAttrs: {
    lang: (typeof stationConfig.value?.language === 'string' && stationConfig.value.language)
      ? stationConfig.value.language
      : 'en',
  },
}));

useSeoMeta({
  robots: 'noindex, nofollow',
});

const activeModal = computed(() =>
  session.value?.uiLayout?.modals?.find((modal) => modal.id === runtime.state.value.activeModalId) ?? null,
);
const activeTheme = computed(() => session.value?.uiLayout?.theme ?? terminalTheme.value ?? DEFAULT_LAYOUT_THEME);
const surfaceRadius = computed(() => activeTheme.value.surfaceStyle === 'square' ? '18px' : '28px');
const accentInk = computed(() => activeTheme.value.accentTextColor || '#ffffff');
const brandTileColor = computed(() => activeTheme.value.brandColor || activeBrand.value?.primary || activeTheme.value.accentColor);

function closeActiveModal() {
  runtime.emitLocal('modal:close');
}

function adminReturnLocation() {
  return `/dashboard/terminals/${terminalId.value}`;
}

function terminalReturnLocation() {
  return `/terminal/${terminalId.value}`;
}

function adminEntryLocation() {
  if (isLoggedIn.value) {
    return adminReturnLocation();
  }

  return {
    path: '/login',
    query: {
      redirect: adminReturnLocation(),
      returnTo: terminalReturnLocation(),
    },
  };
}

function terminalRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...authHeaders() };
  if (typeof window !== 'undefined') {
    const termToken = sessionStorage.getItem(`kogane_term_token_${terminalId.value}`);
    if (termToken) {
      headers['x-terminal-session'] = termToken;
    }
  }
  return headers;
}

function extractTerminalError(err: unknown): unknown {
  const anyErr = err as { data?: { error?: string; message?: string }; message?: string };
  return anyErr?.data?.error || anyErr?.data?.message || anyErr?.message;
}

function friendlyTerminalMessage(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  const message = raw.toLowerCase();
  if (message.includes('too many') || message.includes('try again in') || message.includes('429')) {
    return message.includes('too many') ? raw : 'Too many PIN attempts. Please wait before trying again.';
  }
  if (message.includes('invalid credential')) return 'That PIN is not correct. Try again.';
  if (message.includes('missing credential') || message.includes('pin is required')) return 'Enter the terminal PIN to continue.';
  if (message.includes('not found')) return 'This terminal is no longer available.';
  return fallback;
}

async function bootstrap() {
  await hydrateSession();

  const res = await $fetch<{
    businessId: string;
    businessName?: string;
    displayName: string;
    pinLength: number;
    country?: string;
    currency?: string;
    currencySymbol?: string;
    brand?: TerminalBrandInfo;
    theme: UiLayoutTheme;
    permissions: any;
    error: string | null;
  }>(`/api/terminals/${terminalId.value}/meta`).catch(() => null);

  if (res?.businessId) {
    businessId.value = res.businessId;
    serverBusinessName.value = res.businessName ?? '';
    serverDisplayName.value = res.displayName;
    serverPinLength.value = res.pinLength || 4;
    serverCountry.value = res.country || 'US';
    serverCurrency.value = res.currency || 'USD';
    serverCurrencySymbol.value = res.currencySymbol || '$';
    terminalTheme.value = res.theme ?? { ...DEFAULT_LAYOUT_THEME };
    serverBrand.value = res.brand ?? null;
  }

  // Restore active terminal session or authorize admin passthrough session
  try {
    const sessionRes = await $fetch<{
      session: TerminalRuntimeSession | null;
      token?: string | null;
      error: string | null;
    }>(`/api/terminals/${terminalId.value}/session`, {
      headers: terminalRequestHeaders(),
    });
    if (sessionRes?.session) {
      if (sessionRes.token && typeof window !== 'undefined') {
        sessionStorage.setItem(`kogane_term_token_${terminalId.value}`, sessionRes.token);
      }
      session.value = {
        ...sessionRes.session,
        uiLayout: normalizeLayout(sessionRes.session.uiLayout),
      };
      configureRuntime(session.value);
    }
  } catch {
    // No active session or admin session available
  }
}

function configureRuntime(currentSession: TerminalRuntimeSession) {
  const effectiveBusinessId = currentSession.businessId || businessId.value;
  if (currentSession.businessId) {
    businessId.value = currentSession.businessId;
  }
  const cfg = currentSession.uiLayout?.stationConfig;
  const resolvedCurrencySymbol =
    typeof cfg?.currencySymbol === 'string' && cfg.currencySymbol.trim()
      ? cfg.currencySymbol.trim()
      : (currentSession.currencySymbol ?? serverCurrencySymbol.value);

  runtime.configure({
    terminalId: currentSession.terminalId,
    businessId: effectiveBusinessId,
    layout: normalizeLayout(currentSession.uiLayout),
    permissions: currentSession.permissions,
    sessionVars: {
      businessName: currentSession.businessName ?? serverBusinessName.value,
      terminalName: currentSession.displayName,
      terminalRole: currentSession.role,
      country: currentSession.country ?? serverCountry.value,
      currency: currentSession.currency ?? serverCurrency.value,
      currencySymbol: resolvedCurrencySymbol,
      language: typeof cfg?.language === 'string' && cfg.language ? cfg.language : 'en',
      welcomeMessage: typeof cfg?.welcomeMessage === 'string' ? cfg.welcomeMessage : '',
      showReceipt: cfg?.showReceipt !== false,
      menuItems: typeof cfg?.menuItems === 'string' ? cfg.menuItems : '',
    },
  });
}

let refreshingSession = false;
async function refreshTerminalSession(evt?: Record<string, unknown>) {
  if (!session.value || refreshingSession) return;
  if (evt?.terminalId && String(evt.terminalId) !== terminalId.value) return;

  refreshingSession = true;
  try {
    const sessionRes = await $fetch<{
      session: TerminalRuntimeSession | null;
      token?: string | null;
      error: string | null;
    }>(`/api/terminals/${terminalId.value}/session`, {
      headers: terminalRequestHeaders(),
    });
    if (!sessionRes?.session) return;

    if (sessionRes.token && typeof window !== 'undefined') {
      sessionStorage.setItem(`kogane_term_token_${terminalId.value}`, sessionRes.token);
    }

    const nextLayout = normalizeLayout(sessionRes.session.uiLayout);
    const prevSnapshot = JSON.stringify({
      displayName: session.value.displayName,
      brand: session.value.brand ?? null,
      permissions: session.value.permissions,
      uiLayout: session.value.uiLayout,
    });
    const nextSnapshot = JSON.stringify({
      displayName: sessionRes.session.displayName,
      brand: sessionRes.session.brand ?? null,
      permissions: sessionRes.session.permissions,
      uiLayout: nextLayout,
    });

    if (prevSnapshot !== nextSnapshot) {
      session.value = {
        ...sessionRes.session,
        uiLayout: nextLayout,
      };
      configureRuntime(session.value);
    }
  } catch {
    // Keep existing active terminal session on transient refresh failure
  } finally {
    refreshingSession = false;
  }
}

async function login() {
  if (pin.value.length < serverPinLength.value) return;
  loading.value = true;
  loginError.value = null;

  try {
    const res = await $fetch<{ session: TerminalRuntimeSession | null; token?: string | null; error: string | null }>('/api/terminals/login', {
      method: 'POST',
      body: {
        terminalId: terminalId.value,
        pin: pin.value,
      },
    });

    if (res.error || !res.session) {
      loginError.value = friendlyTerminalMessage(res.error, 'We could not sign you in. Check the PIN and try again.');
      return;
    }

    if (res.token && typeof window !== 'undefined') {
      sessionStorage.setItem(`kogane_term_token_${terminalId.value}`, res.token);
    }

    session.value = {
      ...res.session,
      uiLayout: normalizeLayout(res.session.uiLayout),
    };
    configureRuntime(session.value);
    pin.value = '';
  } catch (err) {
    loginError.value = friendlyTerminalMessage(extractTerminalError(err), 'We could not sign you in right now. Try again.');
  } finally {
    loading.value = false;
  }
}

async function loginAsAdmin() {
  loading.value = true;
  loginError.value = null;
  try {
    const sessionRes = await $fetch<{
      session: TerminalRuntimeSession | null;
      token?: string | null;
      error: string | null;
    }>(`/api/terminals/${terminalId.value}/session`, {
      headers: terminalRequestHeaders(),
    });

    if (sessionRes?.session) {
      if (sessionRes.token && typeof window !== 'undefined') {
        sessionStorage.setItem(`kogane_term_token_${terminalId.value}`, sessionRes.token);
      }
      session.value = {
        ...sessionRes.session,
        uiLayout: normalizeLayout(sessionRes.session.uiLayout),
      };
      configureRuntime(session.value);
      pin.value = '';
    } else {
      loginError.value = 'Could not sign in with admin privileges. Please use the terminal PIN.';
    }
  } catch (err) {
    loginError.value = friendlyTerminalMessage((err as Error).message, 'Failed to sign in as admin.');
  } finally {
    loading.value = false;
  }
}

function appendPin(digit: string) {
  if (showLogoutPrompt.value) {
    if (logoutPin.value.length < serverPinLength.value) logoutPin.value += digit;
    return;
  }

  if (pin.value.length < serverPinLength.value) pin.value += digit;
}

function deleteLastPinDigit() {
  if (showLogoutPrompt.value) {
    logoutPin.value = logoutPin.value.slice(0, -1);
    return;
  }
  pin.value = pin.value.slice(0, -1);
}

function clearPin() {
  if (showLogoutPrompt.value) {
    logoutPin.value = '';
    return;
  }

  pin.value = '';
}

function openLogoutPrompt() {
  showLogoutPrompt.value = true;
  logoutPin.value = '';
  logoutError.value = null;
}

function closeLogoutPrompt() {
  showLogoutPrompt.value = false;
  logoutPin.value = '';
  logoutError.value = null;
}

async function logout(forceAdminBypass = false) {
  if (!session.value) return;
  if (!forceAdminBypass && logoutPin.value.length < serverPinLength.value) return;
  logoutLoading.value = true;
  logoutError.value = null;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>('/api/terminals/logout', {
      method: 'POST',
      headers: terminalRequestHeaders(),
      body: {
        terminalId: terminalId.value,
        pin: forceAdminBypass ? '' : logoutPin.value,
      },
    });

    if (res.error || !res.success) {
      logoutError.value = friendlyTerminalMessage(res.error, 'That PIN is not correct. Try again.');
      return;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`kogane_term_token_${terminalId.value}`);
    }

    session.value = null;
    runtime.reset();
    pin.value = '';
    closeLogoutPrompt();
    await navigateTo(adminEntryLocation());
  } catch (err) {
    logoutError.value = friendlyTerminalMessage(extractTerminalError(err), 'We could not exit terminal mode right now. Try again.');
  } finally {
    logoutLoading.value = false;
  }
}

function leaveLoginPage() {
  navigateTo(adminEntryLocation());
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showLogoutPrompt.value) {
      closeLogoutPrompt();
      e.preventDefault();
      return;
    }
    if (runtime.state.value.activeModalId) {
      closeActiveModal();
      e.preventDefault();
      return;
    }
  }

  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
    if (!showLogoutPrompt.value) return;
  }

  if (e.key >= '0' && e.key <= '9') {
    appendPin(e.key);
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    deleteLastPinDigit();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (showLogoutPrompt.value) {
      logout(false);
    } else if (!session.value) {
      login();
    }
    e.preventDefault();
  }
}

let offTerminalUpdated: (() => void) | null = null;

onMounted(() => {
  bootstrap();
  updateViewport();
  window.addEventListener('resize', updateViewport);
  window.addEventListener('keydown', handleKeydown);
  offTerminalUpdated = runtime.on('terminal:updated', (payload) => {
    refreshTerminalSession(payload as Record<string, unknown> | undefined);
  });
});

onUnmounted(() => {
  offTerminalUpdated?.();
  offTerminalUpdated = null;
  window.removeEventListener('resize', updateViewport);
  window.removeEventListener('keydown', handleKeydown);
  runtime.reset();
});
</script>

<template>
  <div v-if="session" class="w-full h-dvh overflow-hidden relative" :style="{ background: activeTheme.frameBackground }">
    <div
      class="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 backdrop-blur-md border-b"
      :style="{ background: activeTheme.topBarBackground, borderColor: activeTheme.panelBorder }"
    >
      <div class="flex min-w-0 items-center gap-2">
        <TerminalBrandMark :name="brandName" :logo-url="activeBrand?.logoUrl" :color="brandTileColor" size="sm" :rounded="activeTheme.surfaceStyle" />
        <span v-if="brandName" class="hidden truncate font-serif text-sm sm:inline" :style="{ color: activeTheme.topBarText }">{{ brandName }}</span>
        <span v-if="brandName" class="hidden text-xs sm:inline" aria-hidden="true" :style="{ color: activeTheme.panelMutedText }">/</span>
        <span class="truncate text-xs font-semibold" :style="{ color: activeTheme.topBarText }">{{ session.displayName }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" :style="{ color: activeTheme.panelMutedText, background: activeTheme.panelHeaderBackground, border: `1px solid ${activeTheme.panelBorder}` }">{{ session.role }}</span>
      </div>
      <button type="button" aria-label="Log out of terminal" class="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80" :style="{ color: activeTheme.topBarText }" @click="openLogoutPrompt">
        <PowerIcon class="w-3.5 h-3.5" /> Logout
      </button>
    </div>

    <div
      v-if="viewW < 720"
      class="fixed bottom-3 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-medium shadow-lg backdrop-blur-md"
      :style="{ color: activeTheme.topBarText, background: activeTheme.topBarBackground, border: `1px solid ${activeTheme.panelBorder}` }"
      aria-live="polite"
    >
      <button type="button" class="rounded-full p-1" aria-label="Show the previous workspace area" @click.stop="scrollWorkspace('left')">
        <ArrowLeftIcon class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-all active:scale-95"
        :style="{ borderColor: activeTheme.panelBorder, background: fitToWidth ? activeTheme.accentColor : 'transparent', color: fitToWidth ? accentInk : activeTheme.topBarText }"
        @click="fitToWidth = !fitToWidth"
      >
        {{ fitToWidth ? 'Fit Screen' : 'Scroll 100%' }}
      </button>
      <button type="button" class="rounded-full p-1" aria-label="Show the next workspace area" @click.stop="scrollWorkspace('right')">
        <ArrowRightIcon class="h-3.5 w-3.5" />
      </button>
    </div>

    <div
      v-if="stationConfig?.welcomeMessage && !dismissedWelcome"
      class="fixed top-12 left-1/2 z-[65] -translate-x-1/2 max-w-md flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-md backdrop-blur-md border"
      :style="{ background: activeTheme.topBarBackground, color: activeTheme.topBarText, borderColor: activeTheme.panelBorder }"
    >
      <span class="truncate">{{ stationConfig.welcomeMessage }}</span>
      <button
        type="button"
        aria-label="Dismiss welcome message"
        class="p-0.5 rounded-full hover:opacity-75 shrink-0"
        @click="dismissedWelcome = true"
      >
        <XIcon class="w-3.5 h-3.5" />
      </button>
    </div>

    <div
      v-if="runtime.state.value.lastError"
      role="alert"
      class="fixed top-12 right-4 z-[80] max-w-sm flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-medium shadow-lg border bg-red-600/95 text-white border-red-400/50"
    >
      <AlertTriangleIcon class="w-4 h-4 shrink-0 mt-0.5" />
      <span class="flex-1 leading-snug">{{ runtime.state.value.lastError }}</span>
      <button
        type="button"
        aria-label="Dismiss runtime error"
        class="p-0.5 rounded-full hover:bg-white/20 shrink-0"
        @click="runtime.clearError()"
      >
        <XIcon class="w-3.5 h-3.5" />
      </button>
    </div>

    <div ref="terminalViewport" class="terminal-canvas-viewport absolute top-10 inset-x-0 bottom-0 flex items-start justify-center p-1 sm:p-3">
      <div
        class="terminal-canvas-wrapper relative shrink-0"
        :style="{
          width: `${Math.round((session.uiLayout?.resolution?.width ?? 1280) * canvasScale)}px`,
          height: `${Math.round((session.uiLayout?.resolution?.height ?? 720) * canvasScale)}px`,
        }"
      >
        <div
          class="terminal-canvas absolute top-0 left-0"
          :style="{
            width: `${session.uiLayout?.resolution?.width ?? 1280}px`,
            height: `${session.uiLayout?.resolution?.height ?? 720}px`,
            transform: `scale(${canvasScale})`,
            transformOrigin: 'top left',
            background: activeTheme.canvasBackground,
            color: activeTheme.panelText,
            borderRadius: surfaceRadius,
            overflow: 'hidden',
          }"
        >
        <div class="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            v-if="activeTheme.particleEffect === 'floating-orbs'"
            class="absolute -top-20 right-10 w-80 h-80 blur-3xl opacity-35"
            :style="{ background: `radial-gradient(circle, ${activeTheme.accentColor} 0%, transparent 72%)` }"
          />
          <div
            v-if="activeTheme.particleEffect === 'floating-orbs'"
            class="absolute bottom-0 left-0 w-96 h-96 blur-3xl opacity-20"
            :style="{ background: `radial-gradient(circle, ${activeTheme.panelHeaderBackground} 0%, transparent 72%)` }"
          />
          <div
            v-if="activeTheme.particleEffect === 'soft-grid'"
            class="absolute inset-0 opacity-20"
            :style="{ backgroundImage: `linear-gradient(${activeTheme.panelBorder} 1px, transparent 1px), linear-gradient(90deg, ${activeTheme.panelBorder} 1px, transparent 1px)`, backgroundSize: '32px 32px' }"
          />
        </div>

        <ElementRenderer
          v-for="el in session.uiLayout?.elements ?? []"
          :key="el.id"
          :element="el"
          :business-id="businessId"
        />

        <div
          v-if="activeModal"
          role="dialog"
          aria-modal="true"
          class="absolute inset-0 z-[60] flex items-center justify-center bg-black/45"
          @click.self="closeActiveModal"
        >
          <div
            class="relative overflow-hidden border shadow-2xl"
            :style="activeModal.presentation === 'fullscreen'
              ? `width: ${session.uiLayout.resolution.width}px; height: ${session.uiLayout.resolution.height}px; background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder}; border-radius: ${surfaceRadius};`
              : activeModal.presentation === 'drawer'
                ? `width: ${Math.min(activeModal.width ?? 460, session.uiLayout.resolution.width)}px; height: ${session.uiLayout.resolution.height - 80}px; margin-left: auto; background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder}; border-radius: ${surfaceRadius};`
                : `width: ${activeModal.width ?? 640}px; max-width: calc(100% - 48px); height: ${activeModal.height ?? 420}px; max-height: calc(100% - 48px); background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder}; border-radius: ${surfaceRadius};`"
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
    </div>

    <Transition name="v">
      <div
        v-if="showLogoutPrompt"
        class="absolute inset-0 z-[90] flex items-center justify-center bg-[rgba(15,5,7,0.55)] backdrop-blur-sm px-4"
        @click.self="closeLogoutPrompt"
      >
        <div
          class="w-full max-w-xs p-6 shadow-2xl"
          :style="{
            background: activeTheme.panelBackground,
            border: `1px solid ${activeTheme.panelBorder}`,
            borderRadius: surfaceRadius,
          }"
        >
          <div class="text-center">
            <TerminalBrandMark class="mx-auto mb-3 shadow-md" :name="brandName" :logo-url="activeBrand?.logoUrl" :color="brandTileColor" size="md" :rounded="activeTheme.surfaceStyle" />
            <h2 class="text-lg font-serif" :style="{ color: activeTheme.panelText }">Exit Terminal Mode</h2>
            <p class="text-sm mt-1" :style="{ color: activeTheme.panelMutedText }">
              {{ isLoggedIn ? 'Exit to dashboard or enter the terminal PIN to leave runtime mode.' : 'Enter the terminal PIN to leave runtime mode and return to the admin side.' }}
            </p>
          </div>

          <div v-if="isLoggedIn" class="mt-4 mb-1">
            <button
              type="button"
              :disabled="logoutLoading"
              class="w-full py-3 rounded-xl text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 hover:opacity-90"
              :style="{ background: activeTheme.accentColor, color: accentInk }"
              @click="logout(true)"
            >
              <PowerIcon class="w-4 h-4" />
              {{ logoutLoading ? 'Exiting...' : 'Exit to Dashboard (Admin)' }}
            </button>
            <div class="relative flex py-3 items-center">
              <div class="flex-grow border-t" :style="{ borderColor: activeTheme.panelBorder }"></div>
              <span class="flex-shrink mx-2 text-[10px] uppercase tracking-wider font-semibold" :style="{ color: activeTheme.panelMutedText }">or staff pin</span>
              <div class="flex-grow border-t" :style="{ borderColor: activeTheme.panelBorder }"></div>
            </div>
          </div>

          <div class="flex items-center justify-center gap-2" :class="isLoggedIn ? 'mt-1' : 'mt-5'">
            <div class="flex gap-2 justify-center">
              <div
                v-for="i in serverPinLength"
                :key="`logout-${i}`"
                class="w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all font-mono font-bold text-sm"
                :style="i <= logoutPin.length ? `border-color: ${activeTheme.accentColor}; background: ${activeTheme.panelHeaderBackground}; color: ${activeTheme.panelText};` : `border-color: ${activeTheme.panelBorder}; background: transparent;`"
              >
                <template v-if="showLogoutPinDigits">
                  {{ logoutPin[i - 1] ?? '' }}
                </template>
                <RecordIcon v-else class="w-3.5 h-3.5 transition-all" :style="i <= logoutPin.length ? `fill: ${activeTheme.accentColor}; color: ${activeTheme.accentColor};` : 'color: transparent;'" />
              </div>
            </div>
            <button
              type="button"
              class="w-9 h-9 rounded-xl flex items-center justify-center transition-all border-0 bg-transparent cursor-pointer"
              :style="{ color: activeTheme.panelMutedText }"
              :title="showLogoutPinDigits ? 'Hide PIN' : 'Show PIN'"
              :aria-label="showLogoutPinDigits ? 'Hide PIN' : 'Show PIN'"
              @click="showLogoutPinDigits = !showLogoutPinDigits"
            >
              <EyeOffIcon v-if="showLogoutPinDigits" class="w-4 h-4" />
              <EyeIcon v-else class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2.5 mt-4">
            <button
              v-for="digit in ['1','2','3','4','5','6','7','8','9','','0','delete']"
              :key="`logout-digit-${digit}`"
              type="button"
              :class="[
                'h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center',
                digit === '' ? 'invisible pointer-events-none' : 'hover:brightness-110 shadow-sm',
                digit === 'delete' ? 'opacity-80 hover:opacity-100' : '',
              ]"
              :style="digit !== '' ? {
                color: activeTheme.panelText,
                background: activeTheme.panelHeaderBackground,
                border: `1px solid ${activeTheme.panelBorder}`,
              } : {}"
              :aria-label="digit === 'delete' ? 'Backspace PIN' : digit || undefined"
              @click="digit === 'delete' ? deleteLastPinDigit() : appendPin(digit)"
            >
              <BackspaceIcon v-if="digit === 'delete'" class="w-6 h-6" />
              <template v-else>{{ digit }}</template>
            </button>
          </div>

          <div v-if="logoutError" class="text-xs text-center font-medium mt-3" style="color: #dc2626;">{{ logoutError }}</div>

          <div class="flex gap-3 mt-5">
            <button
              type="button"
              class="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
              :style="{ border: `1px solid ${activeTheme.panelBorder}`, color: activeTheme.panelMutedText }"
              @click="closeLogoutPrompt"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="logoutPin.length < serverPinLength || logoutLoading"
              class="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              :style="{ background: activeTheme.accentColor, color: accentInk }"
              @click="logout(false)"
            >
              {{ logoutLoading ? 'Checking...' : 'Exit' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <div v-else class="min-h-dvh flex items-center justify-center px-4" :style="{ background: activeTheme.frameBackground }">
    <div class="w-full max-w-xs space-y-6 animate-fade-in">
      <div class="text-center">
        <TerminalBrandMark class="mx-auto mb-4 shadow-xl" :name="brandName" :logo-url="activeBrand?.logoUrl" :color="brandTileColor" size="lg" :rounded="activeTheme.surfaceStyle" />
        <h1 class="text-xl font-serif font-medium" :style="{ color: activeTheme.panelText }">{{ brandName || 'Terminal Login' }}</h1>
        <p class="text-sm mt-1" :style="{ color: activeTheme.panelMutedText }">
          Enter the PIN for {{ serverDisplayName || 'this terminal' }}
        </p>
      </div>

      <div class="rounded-3xl p-6 space-y-5 shadow-2xl" :style="{ background: activeTheme.panelBackground, border: `1px solid ${activeTheme.panelBorder}` }">
        <div
          class="w-full rounded-xl px-4 py-3 text-sm text-center font-semibold"
          :style="{ background: activeTheme.panelHeaderBackground, color: activeTheme.panelText, border: `1.5px solid ${activeTheme.panelBorder}` }"
        >
          {{ serverDisplayName || 'Loading terminal...' }}
        </div>

        <button
          v-if="isLoggedIn"
          type="button"
          :disabled="loading"
          class="w-full py-3.5 font-semibold text-sm rounded-xl transition-all shadow-xl disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2"
          :style="{ background: activeTheme.accentColor, color: accentInk, boxShadow: `0 4px 14px ${activeTheme.accentColor}40` }"
          @click="loginAsAdmin"
        >
          {{ loading ? 'Signing in...' : 'Sign in as Business Admin' }}
        </button>

        <div v-if="isLoggedIn" class="relative flex items-center">
          <div class="flex-grow border-t" :style="{ borderColor: activeTheme.panelBorder }"></div>
          <span class="flex-shrink mx-2 text-[10px] uppercase tracking-wider font-semibold" :style="{ color: activeTheme.panelMutedText }">or staff pin</span>
          <div class="flex-grow border-t" :style="{ borderColor: activeTheme.panelBorder }"></div>
        </div>

        <div class="flex items-center justify-center gap-2">
          <div class="flex gap-2 justify-center">
            <div
              v-for="i in serverPinLength"
              :key="i"
              class="w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all font-mono font-bold text-sm"
              :style="i <= pin.length ? `border-color: ${activeTheme.accentColor}; background: ${activeTheme.panelHeaderBackground}; color: ${activeTheme.panelText};` : `border-color: ${activeTheme.panelBorder}; background: transparent;`"
            >
              <template v-if="showPinDigits">
                {{ pin[i - 1] ?? '' }}
              </template>
              <RecordIcon v-else class="w-3.5 h-3.5 transition-all" :style="i <= pin.length ? `fill: ${activeTheme.accentColor}; color: ${activeTheme.accentColor};` : 'color: transparent;'" />
            </div>
          </div>
          <button
            type="button"
            class="w-9 h-9 rounded-xl flex items-center justify-center transition-all border-0 bg-transparent cursor-pointer"
            :style="{ color: activeTheme.panelMutedText }"
            :title="showPinDigits ? 'Hide PIN' : 'Show PIN'"
            :aria-label="showPinDigits ? 'Hide PIN' : 'Show PIN'"
            @click="showPinDigits = !showPinDigits"
          >
            <EyeOffIcon v-if="showPinDigits" class="w-4 h-4" />
            <EyeIcon v-else class="w-4 h-4" />
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2.5 mt-2">
          <button
            v-for="digit in ['1','2','3','4','5','6','7','8','9','','0','delete']"
            :key="digit"
            type="button"
            :class="[
              'h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center',
              digit === '' ? 'invisible pointer-events-none' : 'hover:brightness-110 shadow-sm',
              digit === 'delete' ? 'opacity-80 hover:opacity-100' : '',
            ]"
            :style="digit !== '' ? {
              color: activeTheme.panelText,
              background: activeTheme.panelHeaderBackground,
              border: `1px solid ${activeTheme.panelBorder}`,
            } : {}"
            :aria-label="digit === 'delete' ? 'Backspace PIN' : digit || undefined"
            @click="digit === 'delete' ? deleteLastPinDigit() : appendPin(digit)"
          >
            <BackspaceIcon v-if="digit === 'delete'" class="w-6 h-6" />
            <template v-else>{{ digit }}</template>
          </button>
        </div>

        <div v-if="loginError" class="text-xs text-center font-medium mt-1" style="color: #dc2626;">{{ loginError }}</div>

        <button
          type="button"
          :disabled="pin.length < serverPinLength || loading"
          class="w-full py-3.5 mt-2 font-semibold text-sm rounded-xl transition-all shadow-xl disabled:opacity-40 hover:opacity-90"
          :style="{ background: activeTheme.accentColor, color: accentInk, boxShadow: `0 4px 14px ${activeTheme.accentColor}40` }"
          @click="login"
        >
          {{ loading ? 'Checking...' : 'Login with PIN' }}
        </button>

        <button
          type="button"
          class="w-full py-3 rounded-xl text-sm font-medium transition-all"
          :style="{ border: `1px solid ${activeTheme.panelBorder}`, color: activeTheme.panelText }"
          @click="leaveLoginPage"
        >
          {{ isLoggedIn ? 'Return To Dashboard' : 'Admin Login' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-canvas-viewport {
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 720px) {
  .terminal-canvas-viewport {
    padding-bottom: 1rem;
  }
}
</style>
