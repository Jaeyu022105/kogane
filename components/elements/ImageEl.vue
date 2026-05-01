<script setup lang="ts">
import type { ImageElementDef } from '~/lib/uiTypes';

const props = defineProps<{ element: ImageElementDef; runtime?: any; builderMode?: boolean }>();

async function handleClick() {
  if (props.builderMode || !props.runtime) return;
  await props.runtime.triggerElement(props.element, 'click');
}
</script>

<template>
  <div
    class="w-full h-full overflow-hidden"
    :style="{ borderRadius: `${element.radius ?? 0}px` }"
    @click="handleClick"
  >
    <img
      :src="element.src"
      :alt="element.label ?? 'image'"
      class="w-full h-full"
      :style="{ objectFit: element.fit }"
    />
  </div>
</template>
