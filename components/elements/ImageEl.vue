<script setup lang="ts">
import type { ImageElementDef } from '~/lib/uiTypes';
import { sanitizeImageSrc } from '~/lib/securityClient';

const props = defineProps<{ element: ImageElementDef; runtime?: any; builderMode?: boolean }>();

const safeSrc = computed(() => sanitizeImageSrc(props.element.src));

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
      v-if="safeSrc"
      :src="safeSrc"
      :alt="element.label ?? 'image'"
      class="w-full h-full"
      :style="{ objectFit: element.fit }"
    />
  </div>
</template>
