<script setup lang="ts">
import { normalizeLayout, type ElementDef, type UiLayout } from '~/lib/uiTypes';

const props = defineProps<{
  layout: UiLayout | string | null | undefined;
  title?: string;
}>();

const previewWidth = 288;
const previewHeight = 180;

const parsedLayout = computed(() => {
  try {
    if (!props.layout) return normalizeLayout(null);
    const source = typeof props.layout === 'string' ? JSON.parse(props.layout) : props.layout;
    return normalizeLayout(source);
  } catch {
    return normalizeLayout(null);
  }
});

const scale = computed(() => Math.min(
  previewWidth / parsedLayout.value.resolution.width,
  previewHeight / parsedLayout.value.resolution.height,
));

const previewElements = computed(() => parsedLayout.value.elements
  .slice()
  .sort((left, right) => left.position.zIndex - right.position.zIndex)
  .slice(0, 8));

function elementStyle(element: ElementDef) {
  const base = {
    left: `${element.position.x * scale.value}px`,
    top: `${element.position.y * scale.value}px`,
    width: `${element.position.width * scale.value}px`,
    height: `${element.position.height * scale.value}px`,
  };

  switch (element.type) {
    case 'text':
      return {
        ...base,
        background: 'transparent',
        color: element.color ?? parsedLayout.value.theme.panelText,
        fontSize: `${Math.max(7, (element.fontSize ?? 14) * scale.value * 0.85)}px`,
        fontWeight: element.fontWeight === 'bold' ? 700 : 500,
      };
    case 'button':
      return {
        ...base,
        background: element.backgroundColor ?? parsedLayout.value.theme.accentColor,
        color: element.textColor ?? '#ffffff',
        borderRadius: `${Math.max(4, (element.radius ?? 16) * scale.value)}px`,
      };
    case 'input-field':
      return {
        ...base,
        background: element.backgroundColor ?? parsedLayout.value.theme.panelHeaderBackground,
        border: `1px solid ${element.borderColor ?? parsedLayout.value.theme.panelBorder}`,
        borderRadius: `${Math.max(4, (element.radius ?? 16) * scale.value)}px`,
      };
    case 'table-view':
      return {
        ...base,
        background: element.backgroundColor ?? parsedLayout.value.theme.panelBackground,
        border: `1px solid ${parsedLayout.value.theme.panelBorder}`,
        borderRadius: '10px',
      };
    case 'chart':
      return {
        ...base,
        background: element.backgroundColor ?? parsedLayout.value.theme.panelBackground,
        border: `1px solid ${parsedLayout.value.theme.panelBorder}`,
        borderRadius: '12px',
      };
    case 'cart-widget':
      return {
        ...base,
        background: element.backgroundColor ?? parsedLayout.value.theme.panelBackground,
        border: `1px solid ${element.borderColor ?? parsedLayout.value.theme.panelBorder}`,
        borderRadius: `${Math.max(6, (element.radius ?? 24) * scale.value)}px`,
      };
    default:
      return {
        ...base,
        background: parsedLayout.value.theme.panelHeaderBackground,
        borderRadius: '10px',
      };
  }
}
</script>

<template>
  <div class="thumbnail-shell">
    <div
      class="thumbnail-frame"
      :style="{ background: parsedLayout.theme.frameBackground }"
    >
      <div
        class="thumbnail-topbar"
        :style="{ background: parsedLayout.theme.topBarBackground, color: parsedLayout.theme.topBarText, borderColor: parsedLayout.theme.panelBorder }"
      >
        <span class="thumbnail-dot" :style="{ background: parsedLayout.theme.accentColor }" />
        <span class="truncate">{{ title || 'Terminal Preview' }}</span>
      </div>

      <div class="thumbnail-board" :style="{ background: parsedLayout.theme.canvasBackground, borderColor: parsedLayout.theme.panelBorder }">
        <div class="thumbnail-grid" :style="{ backgroundImage: `radial-gradient(${parsedLayout.theme.gridColor} 1px, transparent 1px)` }" />

        <div
          v-for="element in previewElements"
          :key="element.id"
          class="thumbnail-element"
          :style="elementStyle(element)"
        >
          <template v-if="element.type === 'text'">
            <span class="truncate">{{ element.content }}</span>
          </template>
          <template v-else-if="element.type === 'table-view'">
            <div class="thumbnail-panel-head" :style="{ background: element.headerBackgroundColor ?? parsedLayout.theme.panelHeaderBackground }" />
            <div class="thumbnail-lines">
              <span />
              <span />
              <span />
            </div>
          </template>
          <template v-else-if="element.type === 'chart'">
            <div class="thumbnail-chart">
              <span
                v-for="(color, index) in (element.colorPalette ?? [parsedLayout.theme.accentColor]).slice(0, 4)"
                :key="`${element.id}-${index}`"
                :style="{ background: color, height: `${45 + index * 12}%` }"
              />
            </div>
          </template>
          <template v-else-if="element.type === 'cart-widget'">
            <div class="thumbnail-cart-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </template>
          <template v-else-if="element.type === 'button'">
            <span class="truncate">{{ element.text }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thumbnail-shell {
  width: 100%;
}

.thumbnail-frame {
  width: 100%;
  border-radius: 22px;
  padding: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.thumbnail-topbar {
  height: 28px;
  border-radius: 12px 12px 0 0;
  border: 1px solid transparent;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.thumbnail-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.thumbnail-board {
  position: relative;
  margin-top: 10px;
  width: 100%;
  height: 180px;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid transparent;
}

.thumbnail-grid {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-size: 14px 14px;
}

.thumbnail-element {
  position: absolute;
  overflow: hidden;
}

.thumbnail-panel-head {
  height: 18%;
  width: 100%;
}

.thumbnail-lines {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px;
}

.thumbnail-lines span {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.thumbnail-chart {
  height: 100%;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 12px;
}

.thumbnail-chart span {
  flex: 1;
  border-radius: 999px 999px 4px 4px;
  opacity: 0.92;
}

.thumbnail-cart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 10px;
}

.thumbnail-cart-grid span {
  display: block;
  height: 22px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
}
</style>
