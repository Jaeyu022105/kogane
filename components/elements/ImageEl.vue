<script setup lang="ts">
import type { ImageElementDef } from '~/lib/uiTypes';

defineProps<{ element: ImageElementDef }>();
</script>

<template>
  <div class="w-full h-full overflow-hidden" :style="{ borderRadius: `${element.radius ?? 0}px` }">
    <img
      :src="element.src"
      :alt="element.label ?? 'image'"
      class="w-full h-full"
      :style="{ objectFit: element.fit }"
    />
  </div>
</template>
