<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';
import ElementRenderer from '~/components/ElementRenderer.vue';
import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import { DEFAULT_LAYOUT_THEME, normalizeLayout, type UiLayout, type UiLayoutTheme } from '~/lib/uiTypes';

/**
 * Public (guest) terminal page.
 * Accessed via /t/[slug]?table_id=3 â€” no login required.
 * The terminal must have is_public enabled in the admin dashboard.
 * URL query params are injected as $$session.* variables into the runtime.
 */

definePageMeta({ layout: 'default' });

interface GuestSession {
  terminalId: string;
  displayName: string;
  businessName?: string;
  businessId: string;
  role: string;
  country?: string;
  currency?: string;
  currencySymbol?: string;
  permissions: any;
  uiLayout: UiLayout;
  expiresAt: string;
}

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const runtime = useCanvasRuntime();

provide(CANVAS_RUNTIME_KEY, runtime);

const session = ref<GuestSession | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(true);

const viewW = ref(1280);
const viewH = ref(720);
const terminalViewport = ref<HTMLElement | null>(null);

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
  const scaleY = viewH.value / resH;

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

useHead(() => ({
  title: `${session.value?.displayName || 'Terminal'} - Kogane`,
}));

const activeTheme = computed(() => session.value?.uiLayout?.theme ?? DEFAULT_LAYOUT_THEME);
const activeModal = computed(() =>
  session.value?.uiLayout?.modals?.find((modal) => modal.id === runtime.state.value.activeModalId) ?? null,
);
const surfaceRadius = computed(() => activeTheme.value.surfaceStyle === 'square' ? '18px' : '28px');

async function bootstrap() {
  loading.value = true;
  loadError.value = null;

  try {
    const res = await $fetch<{ session: GuestSession | null; token?: string; error: string | null }>(
      `/api/terminals/public/${slug.value}`,
    );

    if (res.error || !res.session) {
      loadError.value = res.error ?? 'Terminal not found';
      return;
    }

    if (import.meta.client && res.token && res.session?.terminalId) {
      sessionStorage.setItem(`kogane_term_token_${res.session.terminalId}`, res.token);
    }

    session.value = {
      ...res.session,
      uiLayout: normalizeLayout(res.session.uiLayout),
    };

    /* inject all URL query params as $$session.* variables */
    for (const [key, value] of Object.entries(route.query)) {
      runtime.setSessionVar(key, value);
    }

    runtime.configure({
      terminalId: res.session.terminalId,
      businessId: res.session.businessId,
      layout: session.value.uiLayout,
      permissions: res.session.permissions,
      sessionVars: {
        ...Object.fromEntries(
          Object.entries(route.query).map(([key, value]) => [key, value]),
        ),
        businessName: res.session.businessName ?? '',
        terminalName: res.session.displayName,
        terminalRole: res.session.role,
        country: res.session.country ?? 'US',
        currency: res.session.currency ?? 'USD',
        currencySymbol: res.session.currencySymbol ?? '$',
      },
    });
  } catch (err) {
    loadError.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
  bootstrap();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport);
  runtime.reset();
});
</script>

<template>
  <div class="w-full h-dvh overflow-hidden flex items-center justify-center" :style="{ background: activeTheme.frameBackground }">
    <div v-if="loading" class="flex flex-col items-center gap-3">
      <div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: rgba(255,255,255,0.16); border-top-color: #e8748a;" />
      <p class="text-xs" style="color: rgba(255,255,255,0.4);">Loading terminal...</p>
    </div>

    <div v-else-if="loadError" class="text-center px-6">
      <p class="text-2xl mb-2" style="color: #f5ede4;">Terminal unavailable</p>
      <p class="text-sm" style="color: rgba(245,237,228,0.5);">{{ loadError }}</p>
    </div>

    <div
      v-else-if="session"
      ref="terminalViewport"
      class="terminal-canvas-viewport absolute inset-0 flex items-start justify-center p-1 sm:p-3"
    >
      <div
        v-if="viewW < 720"
        class="fixed bottom-3 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-medium shadow-lg backdrop-blur-md"
        :style="{ color: activeTheme.topBarText, background: activeTheme.topBarBackground, border: `1px solid ${activeTheme.panelBorder}` }"
        aria-live="polite"
      >
        <button type="button" class="rounded-full p-1" aria-label="Show the previous workspace area" @click.stop="scrollWorkspace('left')">
          <ArrowLeft class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-all active:scale-95"
          :style="{ borderColor: activeTheme.panelBorder, background: fitToWidth ? activeTheme.accentColor : 'transparent', color: fitToWidth ? '#ffffff' : activeTheme.topBarText }"
          @click="fitToWidth = !fitToWidth"
        >
          {{ fitToWidth ? 'Fit Screen' : 'Scroll 100%' }}
        </button>
        <button type="button" class="rounded-full p-1" aria-label="Show the next workspace area" @click.stop="scrollWorkspace('right')">
          <ArrowRight class="h-3.5 w-3.5" />
        </button>
      </div>

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
        :business-id="session.businessId"
      />

      <div
        v-if="activeModal"
        class="absolute inset-0 z-[60] flex items-center justify-center bg-black/45"
      >
        <div
          class="relative overflow-hidden border shadow-2xl"
          :style="activeModal.presentation === 'fullscreen'
            ? `width: ${session.uiLayout.resolution.width}px; height: ${session.uiLayout.resolution.height}px; background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder}; border-radius: ${surfaceRadius};`
            : activeModal.presentation === 'drawer'
              ? `width: ${Math.min(460, session.uiLayout.resolution.width)}px; height: ${session.uiLayout.resolution.height - 80}px; margin-left: auto; background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder}; border-radius: ${surfaceRadius};`
              : `width: 640px; max-width: calc(100% - 48px); height: 420px; max-height: calc(100% - 48px); background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder}; border-radius: ${surfaceRadius};`"
        >
          <ElementRenderer
            v-for="el in activeModal.elements"
            :key="el.id"
            :element="el"
            :business-id="session.businessId"
          />
        </div>
      </div>
    </div>
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
</style>

