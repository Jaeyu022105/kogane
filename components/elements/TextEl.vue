<script setup lang="ts">
import type { TextElementDef } from '~/lib/uiTypes';

defineProps<{ element: TextElementDef }>();
</script>

<template>
  <div
    class="w-full h-full overflow-hidden leading-snug"
    :style="{
      fontSize:   `${element.fontSize}px`,
      fontWeight: element.fontWeight,
      color:      element.color ?? 'inherit',
      textAlign:  element.align ?? 'left',
    }"
  >
    {{ element.content }}
  </div>
</template>
