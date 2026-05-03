<script setup lang="ts">
import ElementRenderer from '~/components/ElementRenderer.vue';
import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import { DEFAULT_LAYOUT_THEME, normalizeLayout, type UiLayout, type UiLayoutTheme } from '~/lib/uiTypes';

/**
 * Public (guest) terminal page.
 * Accessed via /t/[slug]?table_id=3 — no login required.
 * The terminal must have is_public enabled in the admin dashboard.
 * URL query params are injected as $$session.* variables into the runtime.
 */

definePageMeta({ layout: 'default' });

interface GuestSession {
  terminalId: string;
  displayName: string;
  businessId: string;
  role: string;
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

function updateViewport() {
  viewW.value = window.innerWidth;
  viewH.value = window.innerHeight;
}

const canvasScale = computed(() => {
  const layout = session.value?.uiLayout;
  if (!layout) return 1;
  const scaleX = viewW.value / (layout.resolution?.width ?? 1280);
  const scaleY = viewH.value / (layout.resolution?.height ?? 720);
  return Math.min(scaleX, scaleY);
});

const activeTheme = computed(() => session.value?.uiLayout?.theme ?? DEFAULT_LAYOUT_THEME);
const activeModal = computed(() =>
  session.value?.uiLayout?.modals?.find((modal) => modal.id === runtime.state.value.activeModalId) ?? null,
);

async function bootstrap() {
  loading.value = true;
  loadError.value = null;

  try {
    const res = await $fetch<{ session: GuestSession | null; error: string | null }>(
      `/api/terminals/public/${slug.value}`,
    );

    if (res.error || !res.session) {
      loadError.value = res.error ?? 'Terminal not found';
      return;
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
      sessionVars: Object.fromEntries(
        Object.entries(route.query).map(([key, value]) => [key, value]),
      ),
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
      <p class="text-xs" style="color: rgba(255,255,255,0.4);">Loading terminal…</p>
    </div>

    <div v-else-if="loadError" class="text-center px-6">
      <p class="text-2xl mb-2" style="color: #f5ede4;">Terminal unavailable</p>
      <p class="text-sm" style="color: rgba(245,237,228,0.5);">{{ loadError }}</p>
    </div>

    <div
      v-else-if="session"
      class="absolute top-0 left-0"
      :style="{
        width: `${session.uiLayout?.resolution?.width ?? 1280}px`,
        height: `${session.uiLayout?.resolution?.height ?? 720}px`,
        transform: `scale(${canvasScale})`,
        transformOrigin: 'top left',
        background: activeTheme.canvasBackground,
      }"
    >
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
          class="relative overflow-hidden rounded-[28px] border shadow-2xl"
          :style="activeModal.presentation === 'fullscreen'
            ? `width: ${session.uiLayout.resolution.width}px; height: ${session.uiLayout.resolution.height}px; background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder};`
            : activeModal.presentation === 'drawer'
              ? `width: ${Math.min(460, session.uiLayout.resolution.width)}px; height: ${session.uiLayout.resolution.height - 80}px; margin-left: auto; background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder};`
              : `width: 640px; max-width: calc(100% - 48px); height: 420px; max-height: calc(100% - 48px); background: ${activeTheme.panelBackground}; border-color: ${activeTheme.panelBorder};`"
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
</template>
