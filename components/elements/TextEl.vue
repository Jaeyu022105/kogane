<script setup lang="ts">
import type { TextElementDef } from '~/lib/uiTypes';
import { isLightColor } from '~/lib/workspaceBranding';

const props = defineProps<{ element: TextElementDef; runtime?: any; builderMode?: boolean }>();

const resolvedColor = computed(() => {
  const rawColor = props.element.color;
  const theme = props.runtime?.context?.value?.layout?.theme;
  const canvasBg = theme?.canvasBackground ?? '#111118';
  const isCanvasLight = isLightColor(canvasBg);

  if (!rawColor || rawColor === 'inherit') {
    return isCanvasLight ? (theme?.panelText ?? '#261a14') : (theme?.panelText ?? '#f5ede4');
  }

  // If text color is white/light on a light canvas:
  if (isCanvasLight && isLightColor(rawColor)) {
    return theme?.panelText ?? '#261a14';
  }

  // If text color is dark on a dark canvas:
  if (!isCanvasLight && !isLightColor(rawColor)) {
    return theme?.panelText ?? '#f5ede4';
  }

  return rawColor;
});
</script>

<template>
  <div
    class="w-full h-full overflow-hidden leading-snug"
    :style="{
      fontSize:   `${element.fontSize}px`,
      fontWeight: element.fontWeight,
      color:      resolvedColor,
      textAlign:  element.align ?? 'left',
    }"
  >
    {{ element.content }}
  </div>
</template>
